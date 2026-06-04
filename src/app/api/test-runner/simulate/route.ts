import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type { SimulationRun, SimulationPrompt, StudentPersona } from '@/lib/testing/types';
import type { PromptResult, ComfortLevel } from '@/lib/types';
import { generateLessonDesignBrief } from '@/lib/lesson-design';
import { buildDiagnosticInput, generateDiagnosticReport, diagnosticFallback } from '@/lib/diagnostic-report';
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

const LEVEL_PERSONA_GUIDE: Record<string, string> = {
  A1: `A1 (absolute beginner). Knows only isolated words and memorized phrases. Cannot form original sentences. Heavy English interference. Vocabulary under 200 words. Common patterns: single-word answers, "no sé", random English words, mispronounced Spanish with no structure.`,
  A2: `A2 (elementary). Can make simple statements about familiar topics with noticeable errors. Knows present tense mostly, struggles with ser/estar, uses wrong gender/number endings. Mixes in English when stuck. Can understand simple questions if spoken slowly. Common errors: ser/estar confusion, gender disagreement, missing articles, English filler words.`,
  B1: `B1 (intermediate). Can handle everyday topics in complete sentences. Uses present, past (preterite/imperfect mixed up), and immediate future. Vocabulary is functional but gaps appear for precise words. Makes agreement errors, wrong tense choices, and misses vos conjugations. Understands most questions at normal speed. Common errors: wrong tense (preterite vs imperfect), ser/estar confusion on states, vos conjugation mistakes, calque expressions from English, missing subjunctive triggers.`,
  B2: `B2 (upper-intermediate). Speaks with reasonable fluency on a wide range of topics. Can handle hypothetical and complex ideas. Main issues: subtle grammar (subjunctive, conditional in si-clauses), occasional false cognates, register mismatches, and unnatural Argentine expressions. Common errors: indicative instead of subjunctive, conditional tense errors, false cognates like "actualmente"/"realizar", overly formal vocabulary.`,
  C1: `C1 (advanced). Near-fluent, sounds natural most of the time. Handles sophisticated topics, idiomatic vos usage, Argentine slang. Rare but characteristic errors: occasional subjunctive slip in complex clauses, overly literal translation of an idiom, minor pronunciation polish. Responses feel native-like with occasional tells.`,
};

async function generateStudentPersona(name: string, level: string): Promise<StudentPersona> {
  const levelGuide = LEVEL_PERSONA_GUIDE[level] ?? LEVEL_PERSONA_GUIDE['B1'];

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    // Reasoning tokens come out of this budget before the JSON; too low → empty →
    // generic fallback persona for everyone. Keep headroom.
    max_completion_tokens: 1400,
    messages: [{
      role: 'user',
      content: `Create a realistic Argentine Spanish learner profile for a student named "${name}" at ${level} level.

Level description: ${levelGuide}

Return a JSON object with exactly these fields:
{
  "background": "2-3 sentences: who they are, why they're learning Spanish, how long they've been studying, their exposure to Argentine culture",
  "errorPatterns": ["3-5 specific recurring errors this student consistently makes, tied to their level"],
  "strengths": ["2-3 areas where this student performs relatively well for their level"],
  "speechStyle": "1-2 sentences describing HOW this student speaks: pace, hesitation patterns, confidence, filler words they use, tendency to avoid hard structures or attempt them anyway"
}

Make the profile distinct and specific — not generic. Give them a real story. Return ONLY the JSON object.`,
    }],
  });

  try {
    const raw = completion.choices[0].message.content?.trim() ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return JSON.parse(cleaned) as StudentPersona;
  } catch {
    return {
      background: `${name} is a ${level}-level student learning Argentine Spanish.`,
      errorPatterns: ['verb conjugation errors', 'ser/estar confusion'],
      strengths: ['listening comprehension', 'vocabulary recall'],
      speechStyle: 'Speaks with moderate confidence, pauses to search for words.',
    };
  }
}

async function generateStudentResponse(
  promptText: string,
  audioText: string | undefined,
  acceptableExamples: string[],
  designatedLevel: string,
  persona: StudentPersona | null,
): Promise<string> {
  const levelGuide = LEVEL_PERSONA_GUIDE[designatedLevel] ?? LEVEL_PERSONA_GUIDE['B1'];
  const audioCtx = audioText ? `\nAudio played to student: "${audioText}"` : '';
  const examples = acceptableExamples.slice(0, 2).join(' | ');

  const personaCtx = persona
    ? `STUDENT PROFILE:
Background: ${persona.background}
Speech style: ${persona.speechStyle}
Recurring errors this student makes: ${persona.errorPatterns.join('; ')}
Strengths: ${persona.strengths.join('; ')}`
    : `LEVEL: ${levelGuide}`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    // Too low truncates to empty → the fallback fires for EVERY prompt, making all
    // simulated responses identical (the original "no sé" bug). Keep headroom.
    max_completion_tokens: 1200,
    messages: [{
      role: 'user',
      content: `You are roleplaying as this specific Spanish learner. Stay completely in character.

${personaCtx}

Level benchmark: ${levelGuide}

The student was asked: "${promptText}"${audioCtx}
${examples ? `A fully correct answer would be: "${examples}"` : ''}

Produce the EXACT SPOKEN WORDS this student would say — include their characteristic errors, hesitations, and limitations. Do NOT give a perfect answer unless they are C1. Do NOT say "no sé" unless the question is genuinely incomprehensible at their level. Always attempt the question in some form matching their ability. Argentine Spanish dialect. Return ONLY the spoken words.`,
    }],
  });
  return completion.choices[0].message.content?.trim() || 'Ehh... no entiendo bien.';
}

function formatSimulationForDesignBrief(run: SimulationRun): string {
  const r = run.testReport;
  const lines: string[] = [
    `LEVEL TEST RESULTS`,
    `==================`,
  ];

  if (r) {
    lines.push(
      `Overall Level: ${r.display_level} (CEFR: ${r.cefr_band})`,
      `Confidence: ${r.confidence} (${r.confidence_range[0].toFixed(1)}–${r.confidence_range[1].toFixed(1)})`,
      `Summary: ${r.summary}`,
      ``,
      `SKILL SCORES (0–10)`,
      `-------------------`,
      `Listening comprehension: ${r.skill_scores.listening_comprehension.toFixed(1)}`,
      `Speaking fluency: ${r.skill_scores.speaking_fluency.toFixed(1)}`,
      `Grammar control: ${r.skill_scores.grammar_control.toFixed(1)}`,
      `Vocabulary range: ${r.skill_scores.vocabulary_range.toFixed(1)}`,
      `Response speed: ${r.skill_scores.response_speed.toFixed(1)}`,
      `Argentine style alignment: ${r.skill_scores.target_style_alignment.toFixed(1)}`,
      `Practical communication: ${r.skill_scores.practical_communication.toFixed(1)}`,
      ``,
    );
    if (r.strengths?.length) lines.push(`Strengths: ${r.strengths.join(', ')}`);
    if (r.weaknesses?.length) lines.push(`Weaknesses: ${r.weaknesses.join(', ')}`);
    if (r.most_common_error_categories?.length) lines.push(`Most common errors: ${r.most_common_error_categories.join(', ')}`);
    lines.push(``);
  }

  lines.push(`QUESTION-BY-QUESTION BREAKDOWN`, `------------------------------`);

  for (const p of run.prompts) {
    lines.push(
      `Q${p.index + 1}: [${p.promptType}] [${p.difficultyBucket}] difficulty ${p.difficulty.toFixed(1)}`,
      `Prompt: "${p.promptText}"`,
      `Response: "${p.transcript ?? p.generatedResponse}"`,
    );
    if (p.grade) {
      lines.push(`Grade: ${p.grade.label} (${p.grade.overall_score}/5) | CEFR signal: ${p.grade.cefr_signal}`);
      if (p.grade.brief_feedback) lines.push(`Feedback: ${p.grade.brief_feedback}`);
      if (p.grade.observed_errors?.length) {
        lines.push(`Errors: ${p.grade.observed_errors.map((e) => `${e.category}: ${e.description}`).join('; ')}`);
      }
    }
    lines.push(`Ability: ${p.abilityBefore.toFixed(2)} → ${p.abilityAfter.toFixed(2)}`, ``);
  }

  return lines.join('\n');
}

const EDUCATOR_PROMPT = `You're an expert Argentine Spanish tutor reviewing a simulated student's level test. Write a concise educator report (under 400 words, bullet points) covering:
- Whether the detected level matches the designated level, and what that tells us
- Key strengths observed in the responses
- Priority weaknesses and error patterns to address
- Specific recommendations for the first lessons

Base your analysis on the student's language ability, level, and skill gaps. Do NOT build conclusions around the student's personal biography (where they live, their job, why they're learning) — even if it surfaces in their answers, we don't actually know it for a real learner.

Be specific and reference actual responses where possible. Be direct and actionable.`;

async function generateEducatorReport(run: SimulationRun): Promise<string> {
  if (!run.testReport) return '';
  const r = run.testReport;
  const lines = [
    `SIMULATED STUDENT: ${run.studentName}`,
    `Designated level: ${run.designatedLevel} | Detected: ${r.display_level} (${r.cefr_band}) | Accurate: ${run.levelAccurate ? 'YES' : 'NO'}`,
    `Ability estimate: ${r.overall_score.toFixed(2)} | Confidence: ${r.confidence}`,
    ``,
    `SKILL SCORES (0–10): Listening ${r.skill_scores.listening_comprehension.toFixed(1)} | Fluency ${r.skill_scores.speaking_fluency.toFixed(1)} | Grammar ${r.skill_scores.grammar_control.toFixed(1)} | Vocabulary ${r.skill_scores.vocabulary_range.toFixed(1)} | Speed ${r.skill_scores.response_speed.toFixed(1)} | Argentine style ${r.skill_scores.target_style_alignment.toFixed(1)} | Practical ${r.skill_scores.practical_communication.toFixed(1)}`,
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
    max_completion_tokens: 1200,
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
    // persona drives the simulated test ANSWERS only. It must never be fed into the
    // educator report / design brief / diagnostic / lesson generation — those get test
    // performance only, exactly like a real user (who has no persona).
    persona: null,
    prompts: [],
    testReport: null,
    diagnosticReport: null,
    educatorReport: null,
    lessonDesignBrief: null,
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

        send('status', { message: `Generating student persona for ${run.studentName} (${designatedLevel})…` });
        const persona = await generateStudentPersona(run.studentName, designatedLevel);
        run.persona = persona;
        saveRun(run);
        send('persona_ready', {
          background: persona.background,
          errorPatterns: persona.errorPatterns,
          strengths: persona.strengths,
          speechStyle: persona.speechStyle,
        });

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
              persona,
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
            // Use the WPM the grader measured from the synthetic audio so Speed
            // reflects the actual spoken rate, not the student's CEFR level.
            wordsPerMinute: grade?.speech_metrics?.wpm ?? null,
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
        saveRun(run);

        send('status', { message: 'Generating diagnostic report…' });
        run.diagnosticReport =
          (await generateDiagnosticReport(
            buildDiagnosticInput(promptResults, testReport.display_level, testReport.confidence),
          )) ?? diagnosticFallback(testReport);
        saveRun(run);

        send('status', { message: 'Generating lesson design brief…' });
        const { fullBrief, displayLesson } = await generateLessonDesignBrief(formatSimulationForDesignBrief(run));
        run.lessonDesignBrief = fullBrief;
        run.suggestedLesson = displayLesson;
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
