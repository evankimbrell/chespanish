import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import type { LevelTestSession } from '@/lib/types';
import { generateLessonDesignBrief, generateLessonTranscript } from '@/lib/lesson-design';
import { buildDiagnosticInput, generateDiagnosticReport, diagnosticFallback } from '@/lib/diagnostic-report';

export const maxDuration = 300; // 4 sequential gpt-5.5 calls — must not hit the default timeout

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const EDUCATOR_PROMPT = `You're an expert language tutor for Spanish, and your student just took a quick brief language test to test their level. You can see all of the questions they were asked and then detailed about what they said and the feedback on what they did right or wrong. From this point, they're going to start taking daily lessons that are audio primarily, but include potential features in the future for vocabulary testing and pronunciation and back-and-forth roleplay.

Imagine you're going to write a report and hand that to another educator who's going to build the first set of lessons and plan the students' trajectory so that they can learn Spanish as quickly and effectively as possible. What would you pull from this report or similar reports that might be useful for the person designing the lessons? What areas do they appear to be weak in? What areas could you immediately address, and what are the knowledge gaps that you might have to fill in before going forward?

Base your analysis on the student's language ability, level, and skill gaps only. Do NOT build conclusions around the student's personal biography (where they live, their job, why they're learning) — even if it surfaces in their answers, we don't actually know it for a real learner.

Make the report less than 500 words and use bullet points to clearly map their strengths, weaknesses, gaps, and logical things to incorporate next. Make the report specific and to the point.`;


function formatSessionForOpenAI(session: LevelTestSession, userName: string): string {
  const report = session.report;
  const prompts = session.prompts;

  const lines: string[] = [
    `LEVEL TEST RESULTS`,
    `==================`,
    `Student: ${userName}`,
  ];

  if (report) {
    lines.push(
      `Overall Level: ${report.display_level} (CEFR: ${report.cefr_band})`,
      `Confidence: ${report.confidence} (${report.confidence_range[0].toFixed(1)}–${report.confidence_range[1].toFixed(1)})`,
      `Summary: ${report.summary}`,
    );
  }

  lines.push(
    `Test date: ${session.completedAt ?? 'unknown'}`,
    `Prompts completed: ${prompts.length}`,
    ``,
  );

  if (report?.skill_scores) {
    lines.push(
      `SKILL SCORES (0–10)`,
      `-------------------`,
      `Listening comprehension: ${report.skill_scores.listening_comprehension.toFixed(1)}`,
      `Speaking fluency: ${report.skill_scores.speaking_fluency.toFixed(1)}`,
      `Grammar control: ${report.skill_scores.grammar_control.toFixed(1)}`,
      `Vocabulary range: ${report.skill_scores.vocabulary_range.toFixed(1)}`,
      `Response speed: ${report.skill_scores.response_speed.toFixed(1)}`,
      `Argentine style alignment: ${report.skill_scores.target_style_alignment.toFixed(1)}`,
      `Practical communication: ${report.skill_scores.practical_communication.toFixed(1)}`,
      ``,
    );
  }

  if (report?.strengths?.length) {
    lines.push(`Strengths: ${report.strengths.join(', ')}`);
  }
  if (report?.weaknesses?.length) {
    lines.push(`Weaknesses: ${report.weaknesses.join(', ')}`);
  }
  if (report?.next_level_gap) {
    lines.push(`Gap to next level: ${report.next_level_gap}`);
  }
  if (report?.most_common_error_categories?.length) {
    lines.push(`Most common errors: ${report.most_common_error_categories.join(', ')}`);
  }
  lines.push(``);

  lines.push(
    `QUESTION-BY-QUESTION BREAKDOWN`,
    `------------------------------`,
  );

  for (const p of prompts) {
    lines.push(
      `Q${p.promptIndex + 1}: [${p.promptType}] [${p.promptBucket}] difficulty ${p.promptDifficulty.toFixed(1)}`,
      `Prompt: "${p.promptText}"`,
    );

    if (p.skipped) {
      lines.push(`Response: (skipped)`);
    } else if (p.transcript) {
      lines.push(`Response: "${p.transcript}"`);
    } else {
      lines.push(`Response: (no transcript)`);
    }

    if (p.grade) {
      lines.push(
        `Grade: ${p.grade.label} (${p.grade.overall_score}/5) | CEFR signal: ${p.grade.cefr_signal}`,
      );
      if (p.grade.brief_feedback) {
        lines.push(`Feedback: ${p.grade.brief_feedback}`);
      }
      if (p.grade.observed_errors?.length) {
        const errStr = p.grade.observed_errors
          .map((e) => `${e.category}: ${e.description}`)
          .join('; ');
        lines.push(`Errors: ${errStr}`);
      }
      if (p.grade.notes_for_profile?.length) {
        lines.push(`Observations: ${p.grade.notes_for_profile.join(' | ')}`);
      }
      const ds = p.grade.dimension_scores;
      if (ds) {
        const dims = Object.entries(ds)
          .filter(([, v]) => v != null)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        if (dims) lines.push(`Dimensions: ${dims}`);
      }
    }

    lines.push(
      `Response time: ${p.responseTimeSeconds.toFixed(1)}s`,
      `Ability before: ${p.abilityEstimateBefore.toFixed(2)} → after: ${p.abilityEstimateAfter.toFixed(2)}`,
      ``,
    );
  }

  return lines.join('\n');
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response('OPENAI_API_KEY not configured', { status: 500 });
  }

  const body = await req.json();
  const { session, userName }: { session: LevelTestSession; userName: string } = body;

  if (!session || !session.prompts?.length) {
    return Response.json({ error: 'missing_session' }, { status: 400 });
  }

  const formattedReport = formatSessionForOpenAI(session, userName ?? 'student');
  const testReport = session.report ?? null;

  // Stream results as each piece is ready (NDJSON). The diagnostic report is what the
  // learner sees first, so it's generated and sent BEFORE the slow lesson transcript —
  // the page no longer waits ~a minute (and previously, with no maxDuration, the whole
  // request could time out and hang the spinner forever).
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'));
      try {
        // Immediately available — no model call.
        send({ type: 'test', testReport });

        // Kick off the three independent generations concurrently.
        const educatorP = getOpenAI().chat.completions
          .create({ model: 'gpt-5.5', max_completion_tokens: 8000, messages: [{ role: 'user', content: EDUCATOR_PROMPT + '\n\n' + formattedReport }] })
          .then((c) => c.choices[0]?.message?.content ?? '')
          .catch((e) => { console.error('[report/generate] educator failed:', e); return ''; });

        const designP = generateLessonDesignBrief(formattedReport)
          .catch((e) => { console.error('[report/generate] design brief failed:', e); return null; });

        const diagnosticP = (testReport
          ? generateDiagnosticReport(buildDiagnosticInput(session.prompts, testReport.display_level, testReport.confidence)).catch(() => null)
          : Promise.resolve(null));

        // Diagnostic first — stream it the moment it resolves.
        const diagnosticReport = (await diagnosticP) ?? diagnosticFallback(testReport);
        send({ type: 'diagnostic', diagnosticReport });

        // Then the rest (educator + design brief in flight already; lesson needs the brief).
        const educatorReport = await educatorP;
        const design = await designP;
        const lessonDesignBrief = design?.fullBrief ?? '';
        const displayLesson = design?.displayLesson ?? null;
        const lessonTranscript = lessonDesignBrief
          ? await generateLessonTranscript(lessonDesignBrief).catch((e) => { console.error('[report/generate] transcript failed:', e); return ''; })
          : '';

        const safeUserName = (userName ?? 'student').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const timestamp = (session.completedAt ?? new Date().toISOString()).replace(/[:.]/g, '-');
        const filename = `${safeUserName}-${timestamp}.json`;
        const reportsDir = path.join(process.cwd(), 'data', 'reports');
        fs.mkdirSync(reportsDir, { recursive: true });
        fs.writeFileSync(
          path.join(reportsDir, filename),
          JSON.stringify({
            userName, generatedAt: new Date().toISOString(),
            educatorReport, lessonDesignBrief, recommendedLesson: displayLesson,
            testReport, diagnosticReport, lessonTranscript, session,
          }, null, 2),
        );

        send({ type: 'done', educatorReport, lessonDesignBrief, recommendedLesson: displayLesson, lessonTranscript, savedTo: `data/reports/${filename}` });
        controller.close();
      } catch (e) {
        console.error('[report/generate] error:', e);
        send({ type: 'error', message: e instanceof Error ? e.message : String(e) });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
}
