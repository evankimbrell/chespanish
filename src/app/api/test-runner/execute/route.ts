import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type { TestRun, TestScenario, TargetArea, ScenarioCategory } from '@/lib/testing/types';
import type { Question } from '@/lib/types';
import { generateHypothesis, selectQuestion } from '@/lib/testing/hypothesis-generator';
import { generateTestAudio, saveTestAudio } from '@/lib/testing/audio-generator';
import { runScenario } from '@/lib/testing/api-tester';
import { analyzeResults } from '@/lib/testing/bug-analyzer';
import * as dp from '@/lib/data-paths';

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
      model: 'gpt-5.5',
      max_completion_tokens: 80,
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
    bad_grammar: `The student was asked: "${prompt}".${question.audio_text ? ` Audio played to student: "${question.audio_text}".` : ''} A correct answer would be: "${correctAnswer}".

Your job: take the correct answer and introduce ONE clear grammatical error. The response MUST still answer the original question — only the grammar should be wrong, not the topic.

CRITICAL: Keep the response on-topic. If someone was asked to order at a café, they must still order at a café. If asked about plans, they must still describe plans. NEVER change the subject.

REQUIRED: Your output must differ meaningfully from the correct answer due to a grammar error. If it matches the correct answer, you have failed.

Best error types to use (pick the most natural one for this sentence):
- ser/estar/tener confusion: "Yo soy treinta años" instead of "Yo tengo treinta años"
- Wrong verb tense: "Fui al mercado mañana" (preterite for future), "Voy ayer" (present for past)
- Wrong subject-verb agreement: "Ellos come" instead of "Ellos comen", "Nosotros tiene" instead of "Nosotros tenemos"
- Wrong gender article: "el mesa" instead of "la mesa", "una libro" instead of "un libro"

FORBIDDEN:
- Changing the subject or topic of the response
- Contraction differences: "a la" vs "al", "de el" vs "del"
- Accent mark differences (e.g. "esta" vs "está")
- Spelling-only changes

Return ONLY the spoken text with the error introduced, nothing else.`,
    incomplete: `The student was asked: "${prompt}". A correct answer would be: "${correctAnswer}".

Generate a Spanish response that addresses the SAME SITUATION but leaves out ONE required element.

CRITICAL: The response must be about EXACTLY the same topic as the prompt. If the prompt is about missing a work meeting, the response must be about missing a work meeting. If the prompt is about ordering food, the response must be about ordering food. NEVER switch topics.

Good examples of incomplete responses:
- Asked to explain being late AND suggest a solution → say only "Lo siento, llegué tarde al trabajo" (explains but no solution)
- Asked to order coffee AND say no sugar → say only "Un café, por favor" (orders but no dietary constraint)
- Asked to introduce yourself AND say where you're from → say only "Me llamo María" (name but no location)
- Asked to apologize AND offer to reschedule → say only "Disculpe, no pude asistir a la reunión" (apology but no reschedule offer)

FORBIDDEN: Switching to a different topic entirely, talking about something unrelated to what was asked.

Return ONLY the spoken Spanish text.`,
    slow: '',
    wrong_answer: `The student was asked: "${prompt}". Generate a Spanish response that answers a COMPLETELY DIFFERENT question — about an entirely unrelated topic. The response must NOT address the actual question at all. The student should sound like they misheard or misread the prompt entirely.

EXAMPLES of completely wrong answers:
- Asked about ordering food → talks about their commute to work
- Asked to explain a delay diplomatically → describes their weekend plans
- Asked to introduce themselves → asks for directions to the station
- Asked about a product problem → talks about the weather

FORBIDDEN: Partially addressing the actual question, giving an incomplete answer on the same topic, or referencing the same subject matter in any way.

Return ONLY the spoken Spanish text.`,
    silence: '...',
    observational: '',
  };

  if (category === 'observational') {
    // Generate an on-topic correct response with the specific observational error injected.
    // planResponse contains the error description/target from the hypothesis generator.
    const audioCtx = question.audio_text ? ` Audio played to student: "${question.audio_text}".` : '';
    const obsGuidance = [...(question.target_answer ? [question.target_answer] : []), ...(question.acceptable_response_examples ?? [])].filter(Boolean).slice(0, 2).join(' | ');
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-5.5',
        max_completion_tokens: 120,
        messages: [{
          role: 'user',
          content: `A student was asked: "${prompt}".${audioCtx}${obsGuidance ? ` Acceptable answers include: ${obsGuidance}.` : ''}

Generate ONE natural Argentine Spanish response that:
1. Directly and fully answers the question — stay exactly on topic
2. Contains this specific learner error naturally embedded in the answer: ${planResponse}

The response must answer the actual question. Return ONLY the spoken text.`,
        }],
      });
      const generated = completion.choices[0].message.content?.trim();
      if (generated) return generated;
    } catch {}
    return planResponse;
  }

  if (category === 'slow') {
    // Bilingual questions (listen_for_meaning, monologue_comprehension) may have English correct
    // answers. Using English text with the Spanish TTS voice produces garbled audio that Whisper
    // translates instead of transcribing. Always generate a Spanish response for slow scenarios
    // so the Spanish TTS voice and Whisper both work correctly.
    const isBilingual = question.response_language_allowed === 'english_or_spanish';
    if (isBilingual) {
      try {
        const audioContext = question.audio_text ? ` Audio played to student: "${question.audio_text}".` : '';
        const completion = await getOpenAI().chat.completions.create({
          model: 'gpt-5.5',
          max_completion_tokens: 60,
          messages: [{
            role: 'user',
            content: `A student was asked: "${prompt}".${audioContext} Generate ONE natural Argentine Spanish response that correctly answers the question. Return ONLY the spoken Spanish text, nothing else.`,
          }],
        });
        const spanishResponse = completion.choices[0].message.content?.trim();
        if (spanishResponse) return spanishResponse;
      } catch {}
    }
    return correctAnswer || planResponse;
  }
  if (category === 'silence') return '...';

  const userPrompt = systemMsg[category];
  if (!userPrompt) return planResponse;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-záéíóúüñ\s]/g, '').replace(/\s+/g, ' ').trim();

  try {
    // For bad_grammar, retry up to 2 times if the model returns the correct answer unchanged
    const maxAttempts = category === 'bad_grammar' ? 2 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-5.5',
        max_completion_tokens: 80,
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

const RUNS_DIR = dp.TEST_RUNS_DIR;

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

          let baseResponseText = await buildResponseText(plan.category, question, plan.responseToGenerate);
          const deliberatePauses = plan.category === 'slow' && !!plan.deliberatePauses;
          // ElevenLabs does not support SSML break tags — strip any that slipped in via generated text
          baseResponseText = baseResponseText.replace(/<break[^>]*\/>/gi, '').replace(/\s{2,}/g, ' ').trim();

          // For deliberate-pause scenarios: ensure response is long enough for WPM to be meaningful
          // (MIN_WORDS_FOR_WPM = 8) and inject "..." pauses every 3 words so Whisper picks up real gaps
          let responseText = baseResponseText;
          if (deliberatePauses) {
            const words = responseText.split(/\s+/).filter(Boolean);
            if (words.length < 8) {
              // Too short — expand to a fuller response so WPM measurement is valid
              try {
                const prompt = question.instruction_text ?? question.audio_text ?? '';
                const audioCtx = question.audio_text ? ` Audio played to student: "${question.audio_text}".` : '';
                const expanded = await getOpenAI().chat.completions.create({
                  model: 'gpt-5.5',
                  max_completion_tokens: 80,
                  messages: [{ role: 'user', content: `A student was asked: "${prompt}".${audioCtx} Give a complete, natural Argentine Spanish response of at least 3 sentences (12+ words total). Return ONLY the spoken Spanish text.` }],
                });
                const expandedText = expanded.choices[0].message.content?.trim();
                if (expandedText) responseText = expandedText;
              } catch {}
            }
            // Insert "..." every 3 words to create ~0.5–1s audible hesitation pauses in the TTS audio
            const finalWords = responseText.split(/\s+/).filter(Boolean);
            const withPauses: string[] = [];
            finalWords.forEach((word, i) => {
              withPauses.push(word);
              if ((i + 1) % 3 === 0 && i < finalWords.length - 1) withPauses.push('...');
            });
            responseText = withPauses.join(' ');
          }

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
