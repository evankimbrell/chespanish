import fs from 'fs';
import path from 'path';
import type { TestRun, TestScenario, TargetArea } from '@/lib/testing/types';
import { generateHypothesis, selectQuestion } from '@/lib/testing/hypothesis-generator';
import { generateTestAudio, saveTestAudio } from '@/lib/testing/audio-generator';
import { runScenario } from '@/lib/testing/api-tester';
import { analyzeResults } from '@/lib/testing/bug-analyzer';

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
            usedIds
          );

          if (!question) {
            send('warning', { message: `No matching question for scenario: ${plan.name}` });
            continue;
          }

          usedIds.push(question.prompt_id);

          let audioUrl = '';
          let audioBuffer: Buffer;

          try {
            const text = plan.category === 'silence' ? '...' : plan.responseToGenerate;
            audioBuffer = await generateTestAudio(text, plan.voice ?? 'spanish');
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
              generatedResponse: plan.responseToGenerate,
              audioUrl: '',
              transcript: null,
              grade: null,
              expectedLabel: plan.expectedLabel,
              expectedErrorCategories: plan.expectedErrorCategories,
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
            generatedResponse: plan.responseToGenerate,
            audioUrl,
            transcript: null,
            grade: null,
            expectedLabel: plan.expectedLabel,
            expectedErrorCategories: plan.expectedErrorCategories,
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
