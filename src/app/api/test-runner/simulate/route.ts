import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type { SimulationRun, SimulationPrompt } from '@/lib/testing/types';
import type { PromptResult, ComfortLevel } from '@/lib/types';
import {
  initEngine, selectNextQuestion, updateEngine, shouldStopTest,
  generateFinalReport, calculateEvidenceScore,
} from '@/lib/test-engine';
import { QUESTION_BANK } from '@/lib/question-bank';
import { generateTestAudio, saveTestAudio } from '@/lib/testing/audio-generator';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const RUNS_DIR = path.join(process.cwd(), 'data', 'test-runs');

function saveRun(run: SimulationRun) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RUNS_DIR, `${run.id}.json`), JSON.stringify(run, null, 2));
}

const LEVEL_TO_COMFORT: Record<string, ComfortLevel> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5,
};

const LEVEL_GUIDES: Record<string, string> = {
  A1: 'You are a true beginner. Use 1–3 word answers, major grammar errors, may mix in English, struggle to form sentences. Often say "no sé" or guess randomly.',
  A2: 'You are an elementary learner. Short simple sentences, common errors (ser/estar confusion, wrong verb endings), limited vocabulary. Sometimes understand but respond incorrectly.',
  B1: 'You are an intermediate learner. Complete sentences, some grammar errors (wrong tense, missing agreement), decent vocabulary, can communicate meaning even with errors.',
  B2: 'You are an upper-intermediate learner. Good fluency, occasional subtle errors, strong comprehension, can handle complex prompts with minor vocabulary gaps.',
  C1: 'You are an advanced learner. Near-native fluency, rare errors, sophisticated vocabulary, vos conjugation mostly correct, natural Argentine-style phrasing.',
};

async function generateStudentResponse(
  promptText: string,
  audioText: string | undefined,
  acceptableExamples: string[],
  designatedLevel: string,
): Promise<string> {
  const guide = LEVEL_GUIDES[designatedLevel] ?? LEVEL_GUIDES['B1'];
  const audioCtx = audioText ? `\nAudio played to student: "${audioText}"` : '';
  const examples = acceptableExamples.slice(0, 2).join(' | ');

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    max_completion_tokens: 80,
    messages: [{
      role: 'user',
      content: `${guide}

The student was asked: "${promptText}"${audioCtx}
${examples ? `A correct answer would be: "${examples}"` : ''}

Generate the SPOKEN response this student would actually produce — with errors and limitations matching their level. Argentine Spanish dialect. Return ONLY the spoken words, nothing else.`,
    }],
  });
  return completion.choices[0].message.content?.trim() || 'No sé.';
}

const EDUCATOR_PROMPT = `You're an expert Argentine Spanish tutor reviewing a simulated student's level test. Write a concise educator report (under 400 words, bullet points) covering:
- Whether the detected level matches the designated level, and what that tells us
- Key strengths observed in the responses
- Priority weaknesses and error patterns to address
- Specific recommendations for the first lessons

Be specific and reference actual responses where possible. Be direct and actionable.`;

async function generateEducatorReport(run: SimulationRun): Promise<string> {
  if (!run.testReport) return '';
  const r = run.testReport;
  const lines = [
    `SIMULATED STUDENT: ${run.studentName}`,
    `Designated level: ${run.designatedLevel} | Detected: ${r.display_level} (${r.cefr_band}) | Accurate: ${run.levelAccurate ? 'YES' : 'NO'}`,
    `Ability estimate: ${r.overall_score.toFixed(2)} | Confidence: ${r.confidence}`,
    ``,
    `SKILL SCORES (0–10): Listening ${r.skill_scores.listening_comprehension.toFixed(1)} | Fluency ${r.skill_scores.speaking_fluency.toFixed(1)} | Grammar ${r.skill_scores.grammar_control.toFixed(1)} | Vocabulary ${r.skill_scores.vocabulary_range.toFixed(1)} | Pronunciation ${r.skill_scores.pronunciation_intelligibility.toFixed(1)} | Speed ${r.skill_scores.response_speed.toFixed(1)} | Argentine style ${r.skill_scores.target_style_alignment.toFixed(1)} | Practical ${r.skill_scores.practical_communication.toFixed(1)}`,
    ``,
    `PROMPT RESULTS:`,
    ...run.prompts.map((p, i) =>
      `${i + 1}. [${p.promptType} · ${p.difficultyBucket}] "${p.promptText.slice(0, 70)}"` +
      `\n   Said: "${p.generatedResponse.slice(0, 70)}"` +
      `\n   Grade: ${p.grade?.label ?? 'N/A'} (${p.grade?.overall_score ?? '?'}/5) — ${p.grade?.brief_feedback ?? ''}` +
      (p.grade?.observed_errors?.length ? `\n   Errors: ${p.grade.observed_errors.map((e) => e.category).join(', ')}` : '')
    ),
  ];

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    max_completion_tokens: 700,
    messages: [
      { role: 'system', content: EDUCATOR_PROMPT },
      { role: 'user', content: lines.join('\n') },
    ],
  });
  return completion.choices[0].message.content?.trim() || '';
}

export async function POST(req: Request) {
  const { studentName, designatedLevel } = await req.json() as {
    studentName: string;
    designatedLevel: string;
  };

  if (!studentName?.trim() || !designatedLevel) {
    return Response.json({ error: 'studentName and designatedLevel required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const runId = `sim-${Date.now()}`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const comfortLevel = LEVEL_TO_COMFORT[designatedLevel] ?? 3;

  const run: SimulationRun = {
    id: runId,
    mode: 'simulation',
    createdAt: new Date().toISOString(),
    status: 'pending',
    studentName: studentName.trim(),
    designatedLevel,
    comfortLevel,
    prompts: [],
    testReport: null,
    educatorReport: null,
    suggestedLesson: null,
    detectedLevel: null,
    levelAccurate: null,
  };

  saveRun(run);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try { controller.enqueue(encoder.encode(payload)); } catch {}
      };

      try {
        run.status = 'running';
        saveRun(run);

        let engine = initEngine(comfortLevel);
        const promptResults: PromptResult[] = [];

        send('status', { message: `Starting simulation for ${run.studentName} (${designatedLevel})…` });

        while (!shouldStopTest(engine, promptResults)) {
          const question = selectNextQuestion(engine, QUESTION_BANK);
          if (!question) break;

          const idx = run.prompts.length;
          const abilityBefore = engine.abilityEstimate;

          send('prompt_start', {
            index: idx + 1,
            promptType: question.prompt_type,
            difficulty: question.difficulty_bucket,
            promptText: question.instruction_text.slice(0, 60),
          });

          const start = Date.now();
          let generatedResponse = '';
          let audioUrl = '';
          let transcript: string | null = null;
          let grade: PromptResult['grade'] = null;
          let promptError: string | null = null;

          try {
            generatedResponse = await generateStudentResponse(
              question.instruction_text ?? question.audio_text ?? '',
              question.audio_text,
              question.acceptable_response_examples ?? [],
              designatedLevel,
            );

            const audioBuffer = await generateTestAudio(generatedResponse, 'spanish', 1.0);
            audioUrl = await saveTestAudio(runId, `p${idx}`, audioBuffer);

            const audioBlob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: 'audio/mpeg' });
            const audioFile = new File([audioBlob], 'test.mp3', { type: 'audio/mpeg' });
            const fd = new FormData();
            fd.append('audio', audioFile);
            fd.append('question', JSON.stringify(question));
            fd.append('allow_english', question.response_language_allowed === 'english_or_spanish' ? '1' : '0');
            fd.append('response_time_seconds', '3.0');
            fd.append('speaking_duration_seconds', '2.0');
            fd.append('used_transcript_help', '0');

            const res = await fetch(`${baseUrl}/api/transcribe-and-grade`, { method: 'POST', body: fd });
            if (res.ok) {
              const text = await res.text();
              for (const line of text.trim().split('\n')) {
                if (!line.trim()) continue;
                try {
                  const msg = JSON.parse(line);
                  if (msg.type === 'transcript') transcript = msg.transcript;
                  if (msg.type === 'grade') grade = msg.grade;
                } catch (parseErr) {
                  if (!(parseErr instanceof SyntaxError)) throw parseErr;
                }
              }
            }
          } catch (e) {
            promptError = String(e);
          }

          const durationMs = Date.now() - start;
          const overallScore = grade?.overall_score ?? 2;
          const evidenceScore = calculateEvidenceScore(question.difficulty_score, overallScore);

          const promptResult: PromptResult = {
            promptIndex: idx,
            questionId: question.prompt_id,
            promptType: question.prompt_type,
            promptDifficulty: question.difficulty_score,
            promptBucket: question.difficulty_bucket,
            promptText: question.instruction_text ?? '',
            transcript,
            usedTranscriptHelp: false,
            skipped: false,
            responseTimeSeconds: 3.0,
            speakingDurationSeconds: 2.0,
            wordsPerMinute: null,
            overallScore,
            evidenceScore,
            abilityEstimateBefore: abilityBefore,
            abilityEstimateAfter: 0,
            grade,
            briefFeedback: grade?.brief_feedback ?? '',
          };

          engine = updateEngine(engine, overallScore, promptResult, question);
          promptResult.abilityEstimateAfter = engine.abilityEstimate;
          promptResults.push(promptResult);

          const simPrompt: SimulationPrompt = {
            index: idx,
            questionId: question.prompt_id,
            promptType: question.prompt_type,
            promptText: question.instruction_text ?? '',
            audioText: question.audio_text,
            difficulty: question.difficulty_score,
            difficultyBucket: question.difficulty_bucket,
            generatedResponse,
            audioUrl,
            transcript,
            grade,
            abilityBefore,
            abilityAfter: engine.abilityEstimate,
            durationMs,
            error: promptError,
          };
          run.prompts.push(simPrompt);
          saveRun(run);

          send('prompt_result', {
            index: idx + 1,
            gradeLabel: grade?.label ?? 'N/A',
            score: overallScore,
            abilityBefore: abilityBefore.toFixed(2),
            abilityAfter: engine.abilityEstimate.toFixed(2),
          });
        }

        send('status', { message: 'Generating test report…' });
        const testReport = generateFinalReport(engine, promptResults);
        const detectedLevel = testReport.display_level;

        const LEVEL_ABILITY: Record<string, number> = { A1: 2.0, A2: 4.0, B1: 6.0, B2: 8.0, C1: 9.5 };
        const expectedAbility = LEVEL_ABILITY[designatedLevel] ?? 4.0;
        const levelAccurate = Math.abs(engine.abilityEstimate - expectedAbility) <= 1.5;

        run.testReport = testReport;
        run.detectedLevel = detectedLevel;
        run.levelAccurate = levelAccurate;
        run.suggestedLesson = testReport.recommended_first_lesson;
        saveRun(run);

        send('report_ready', { detectedLevel, designatedLevel, levelAccurate });

        send('status', { message: 'Generating educator report…' });
        run.educatorReport = await generateEducatorReport(run);
        run.status = 'complete';
        saveRun(run);

        send('complete', {
          runId,
          studentName: run.studentName,
          detectedLevel,
          designatedLevel,
          levelAccurate,
          promptCount: run.prompts.length,
        });
      } catch (e) {
        run.status = 'failed';
        saveRun(run);
        send('error', { message: String(e) });
        console.error('[simulate] Error:', e);
      } finally {
        controller.close();
      }
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
