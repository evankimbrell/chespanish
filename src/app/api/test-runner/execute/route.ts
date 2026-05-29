import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type { TestRun, TestScenario, TargetArea, ScenarioCategory } from '@/lib/testing/types';
import type { Question } from '@/lib/types';
import { generateHypothesis, selectQuestion } from '@/lib/testing/hypothesis-generator';
import { generateTestAudio, saveTestAudio } from '@/lib/testing/audio-generator';
import { runScenario } from '@/lib/testing/api-tester';
import { analyzeResults } from '@/lib/testing/bug-analyzer';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

async function buildResponseText(category: ScenarioCategory, question: Question, planResponse: string): Promise<string> {
  if (category === 'correct') {
    // Generate a complete, natural correct response using GPT — don't blindly use the first
    // acceptable example, which may be a template ("Me llamo...") or otherwise incomplete
    const prompt = question.instruction_text ?? question.audio_text ?? question.scenario ?? '';
    const examples = question.acceptable_response_examples ?? [];
    const target = question.target_answer ?? '';
    const guidance = [...(target ? [target] : []), ...examples].filter(Boolean).slice(0, 3).join(' | ');

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `The student was asked: "${prompt}". ${guidance ? `Acceptable answers include: ${guidance}. ` : ''}Generate ONE complete, natural Argentine Spanish response that fully answers the question. Fill in any blanks (names, numbers, etc.) with realistic values. Return ONLY the spoken text, no quotes, no ellipses.`,
      }],
    });
    return completion.choices[0].message.content?.trim() || planResponse;
  }

  // For broken scenarios, ask the AI to produce a contextually wrong response based on this specific question
  const correctAnswer = question.acceptable_response_examples?.[0] ?? question.target_answer ?? '';
  const prompt = question.instruction_text ?? question.audio_text ?? question.scenario ?? '';

  const systemMsg: Record<ScenarioCategory, string> = {
    correct: '',
    wrong_language: `The student was asked: "${prompt}". A correct answer would be: "${correctAnswer}". Generate a natural English response to this specific question (translated/answered in English instead of Spanish). Return ONLY the spoken text, nothing else.`,
    bad_grammar: `The student was asked: "${prompt}". A correct answer would be: "${correctAnswer}".

Your job: take the correct answer and introduce ONE clear grammatical error that makes it WRONG. The error MUST be phonetically distinct — a listener must be able to hear the mistake.

REQUIRED: Your output must differ meaningfully from the correct answer. If it matches the correct answer, you have failed.

Best error types to use (pick the most natural one for this sentence):
- ser/estar/tener confusion: "Yo soy treinta años" instead of "Yo tengo treinta años"; "Estoy cansada" vs "Soy cansada"
- Wrong verb tense: "Fui al mercado mañana" (preterite for future), "Voy ayer" (present for past)
- Wrong subject-verb agreement: "Ellos come" instead of "Ellos comen", "Nosotros tiene" instead of "Nosotros tenemos"
- Wrong gender article: "el mesa" instead of "la mesa", "una libro" instead of "un libro"
- Wrong vocabulary (different-sounding word): substitute a clearly wrong noun or verb

FORBIDDEN error types (TTS will silently fix these, making the error undetectable):
- Contraction differences: "a la" vs "al", "de el" vs "del"
- Accent mark differences (e.g. "esta" vs "está")
- Spelling-only changes

Return ONLY the spoken text with the error introduced, nothing else.`,
    incomplete: `The student was asked: "${prompt}". A correct answer would be: "${correctAnswer}". Generate a Spanish response that is clearly ON-TOPIC (responding to the same question) but leaves out a KEY required element. The response must be recognizably about the same subject — NOT a random or unrelated answer. Examples of good incomplete responses: if asked to order coffee AND say no sugar → say only "Un café, por favor" (on topic, missing the constraint); if asked to introduce yourself with name AND where you're from → say only "Me llamo María" (on topic, missing location). The response should be grammatically correct but structurally incomplete. Return ONLY the spoken text.`,
    slow: correctAnswer || planResponse,
    wrong_answer: `The student was asked: "${prompt}". Generate a plausible-sounding Spanish response that completely misunderstands the question — answers something different. Return ONLY the spoken text.`,
    silence: '...',
  };

  if (category === 'slow') return correctAnswer || planResponse;
  if (category === 'silence') return '...';

  const userPrompt = systemMsg[category];
  if (!userPrompt) return planResponse;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-záéíóúüñ\s]/g, '').replace(/\s+/g, ' ').trim();

  try {
    // For bad_grammar, retry up to 2 times if the model returns the correct answer unchanged
    const maxAttempts = category === 'bad_grammar' ? 2 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const generated = completion.choices[0].message.content?.trim() || '';
      if (!generated) break;

      // For bad_grammar: reject if output is too similar to any acceptable answer
      if (category === 'bad_grammar' && correctAnswer) {
        const acceptableNorms = [
          correctAnswer,
          ...(question.acceptable_response_examples ?? []),
        ].map(normalize);
        if (acceptableNorms.some((a) => normalize(generated) === a)) {
          // Generated correct form — retry on next iteration
          continue;
        }
      }

      return generated;
    }
    return planResponse;
  } catch {
    return planResponse;
  }
}

const RUNS_DIR = path.join(process.cwd(), 'data', 'test-runs');

function saveRun(run: TestRun) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RUNS_DIR, `${run.id}.json`), JSON.stringify(run, null, 2));
}

export async function POST(req: Request) {
  const { instructions, targetArea = 'grading' } = await req.json() as {
    instructions: string;
    targetArea?: TargetArea;
  };

  if (!instructions?.trim()) {
    return Response.json({ error: 'instructions required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const runId = `run-${Date.now()}`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

  const run: TestRun = {
    id: runId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    instructions: instructions.trim(),
    hypothesis: '',
    targetArea,
    scenarios: [],
    bugs: [],
    fixPlan: null,
    fixesApplied: false,
    verificationRun: null,
  };

  saveRun(run);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {}
      };

      try {
        run.status = 'running';
        saveRun(run);

        // Step 1: Generate hypothesis
        send('status', { phase: 'hypothesis', message: 'Generating test hypothesis…' });
        const { hypothesis, scenarios: scenarioPlans } = await generateHypothesis(
          instructions,
          targetArea
        );
        run.hypothesis = hypothesis;
        saveRun(run);

        send('hypothesis', {
          hypothesis,
          scenariosPlanned: scenarioPlans.length,
        });

        // Step 2: Build scenarios + generate audio
        const usedIds: string[] = [];

        for (let i = 0; i < scenarioPlans.length; i++) {
          const plan = scenarioPlans[i];
          const scenarioId = `s${i + 1}`;

          send('status', {
            phase: 'audio',
            message: `Generating audio for scenario ${i + 1}/${scenarioPlans.length}: ${plan.name}`,
          });

          const question = selectQuestion(
            plan.promptTypePreference,
            plan.difficultyRange,
            usedIds,
            plan.category
          );

          if (!question) {
            send('warning', { message: `No matching question for scenario: ${plan.name}` });
            continue;
          }

          usedIds.push(question.prompt_id);

          const baseResponseText = await buildResponseText(plan.category, question, plan.responseToGenerate);
          const deliberatePauses = plan.category === 'slow' && !!plan.deliberatePauses;
          // ElevenLabs does not support SSML break tags — strip any that slipped in via generated text
          const responseText = baseResponseText.replace(/<break[^>]*\/>/gi, '').replace(/\s{2,}/g, ' ').trim();

          let audioUrl = '';
          let audioBuffer: Buffer;

          try {
            const text = responseText;
            const audioSpeed = plan.audioSpeed ?? (plan.category === 'slow' ? 0.7 : 1.0);
            audioBuffer = await generateTestAudio(text, plan.voice ?? 'spanish', audioSpeed);
            audioUrl = await saveTestAudio(runId, scenarioId, audioBuffer);
          } catch (e) {
            send('warning', {
              message: `Audio generation failed for ${plan.name}: ${String(e)}`,
            });
            const scenario: TestScenario = {
              id: scenarioId,
              name: plan.name,
              category: plan.category,
              promptQuestion: question,
              generatedResponse: responseText,
              audioUrl: '',
              transcript: null,
              grade: null,
              expectedLabel: plan.expectedLabel,
              expectedErrorCategories: plan.expectedErrorCategories,
              audioSpeed: plan.category === 'slow' ? (plan.audioSpeed ?? 0.7) : undefined,
              deliberatePauses: deliberatePauses || undefined,
              passed: false,
              failureReason: `Audio generation failed: ${String(e)}`,
              durationMs: 0,
              error: String(e),
            };
            run.scenarios.push(scenario);
            saveRun(run);
            continue;
          }

          const scenario: TestScenario = {
            id: scenarioId,
            name: plan.name,
            category: plan.category,
            promptQuestion: question,
            generatedResponse: responseText,
            audioUrl,
            transcript: null,
            grade: null,
            expectedLabel: plan.expectedLabel,
            expectedErrorCategories: plan.expectedErrorCategories,
            audioSpeed: plan.category === 'slow' ? (plan.audioSpeed ?? 0.7) : undefined,
            deliberatePauses: deliberatePauses || undefined,
            passed: false,
            failureReason: null,
            durationMs: 0,
            error: null,
          };
          run.scenarios.push(scenario);
          saveRun(run);

          // Step 3: Run the API test
          send('status', {
            phase: 'testing',
            message: `Testing scenario ${i + 1}/${scenarioPlans.length}: ${plan.name}`,
          });

          const result = await runScenario(scenario, audioBuffer, baseUrl);

          // Update in place
          const idx = run.scenarios.findIndex((s) => s.id === scenarioId);
          if (idx >= 0) run.scenarios[idx] = result;
          saveRun(run);

          send('scenario_result', {
            scenarioId,
            name: result.name,
            passed: result.passed,
            failureReason: result.failureReason,
            transcript: result.transcript,
            gradeLabel: result.grade?.label ?? null,
            expectedLabel: result.expectedLabel,
            durationMs: result.durationMs,
          });
        }

        // Step 4: Analyze results
        send('status', { phase: 'analyzing', message: 'Analyzing results with AI…' });
        const { bugs, fixPlan } = await analyzeResults(run.scenarios, hypothesis);

        run.bugs = bugs;
        run.fixPlan = fixPlan;
        run.status = 'complete';
        saveRun(run);

        const passed = run.scenarios.filter((s) => s.passed).length;
        send('complete', {
          runId,
          passed,
          total: run.scenarios.length,
          bugsFound: bugs.length,
          hypothesis,
          fixPlan,
        });
      } catch (e) {
        run.status = 'failed';
        saveRun(run);
        send('error', { message: String(e) });
        console.error('[test-runner/execute] Error:', e);
      } finally {
        controller.close();
      }
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
