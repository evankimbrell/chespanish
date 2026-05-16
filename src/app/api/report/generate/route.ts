import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import type { LevelTestSession } from '@/lib/types';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const EDUCATOR_PROMPT = `You're an expert language tutor for Spanish, and your student just took a quick brief language test to test their level. You can see all of the questions they were asked and then detailed about what they said and the feedback on what they did right or wrong. From this point, they're going to start taking daily lessons that are audio primarily, but include potential features in the future for vocabulary testing and pronunciation and back-and-forth roleplay.

Imagine you're going to write a report and hand that to another educator who's going to build the first set of lessons and plan the students' trajectory so that they can learn Spanish as quickly and effectively as possible. What would you pull from this report or similar reports that might be useful for the person designing the lessons? What areas do they appear to be weak in? What areas could you immediately address, and what are the knowledge gaps that you might have to fill in before going forward?

Make the report less than 500 words and use bullet points to clearly map their strengths, weaknesses, gaps, and logical things to incorporate next. Make the report specific and to the point.`;

const LESSON_PROMPT = `You're a master Spanish tutor designing the first lesson for a student learning spanish. You've been handed a report explaining the students strengths and weaknesses based off a basic preliminary level test. You'll also receive the level test report that shows the questions they were asked and their answers as well as a grade of how well they did for each question.

Create an audio lesson based off the report recommendations. The target length of the audio lesson is 2000 words.

The lesson should have an English language narrator that briefly explains at the beginning what we'll be doing in the lesson. The English language narrator also will be used in the lesson when the user is instructed to do something. It will also be used an outro saying that the lesson is now over and giving the user some basic encouragement.

IMPORTANT: The audio lesson should use the core tenets of Pimsleur lessons. Pimsleur is built around active recall under light pressure. Instead of passively listening or repeating, the learner is prompted to produce the answer before hearing it. The lesson pauses, the learner responds out loud, then the native speaker gives the correct version. This trains retrieval, pronunciation, and speaking automaticity rather than recognition alone. Its other core mechanic is graduated interval recall: words and phrases return at carefully spaced intervals, just as the learner is starting to forget them. Lessons use a small set of high-value vocabulary and phrase patterns, then recombine them in different ways: statement to question, positive to negative, now to later, "I want" to "do you want." Grammar is learned organically through use, not through long explanations.

Each portion of the lesson needs to be labeled as <English voice> and <Spanish voice>. When the user is expected to respond with an answer, put <prompt>. Use <prompts> frequently to maintain engagement.

Generate the lesson. Do not include any other text other than the lesson transcript. The user does not hear the word <prompt> because this is just a signal for the audio transcriber to read. The English voice should never read Spanish.`;

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
      `Pronunciation: ${report.skill_scores.pronunciation_intelligibility.toFixed(1)}`,
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

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    temperature: 0.4,
    max_tokens: 800,
    messages: [
      { role: 'user', content: EDUCATOR_PROMPT + '\n\n' + formattedReport },
    ],
  });

  const educatorReport = completion.choices[0]?.message?.content ?? '';

  const lessonCompletion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    temperature: 0.5,
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `${LESSON_PROMPT}\n\n--- EDUCATOR RECOMMENDATIONS ---\n${educatorReport}\n\n--- LEVEL TEST REPORT ---\n${formattedReport}`,
      },
    ],
  });

  const lessonTranscript = lessonCompletion.choices[0]?.message?.content ?? '';

  const safeUserName = (userName ?? 'student').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const timestamp = (session.completedAt ?? new Date().toISOString()).replace(/[:.]/g, '-');
  const filename = `${safeUserName}-${timestamp}.json`;
  const reportsDir = path.join(process.cwd(), 'data', 'reports');

  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, filename),
    JSON.stringify({
      userName,
      generatedAt: new Date().toISOString(),
      educatorReport,
      testReport: session.report ?? null,
      lessonTranscript,
      session,
    }, null, 2),
  );

  return Response.json({
    educatorReport,
    testReport: session.report ?? null,
    lessonTranscript,
    savedTo: `data/reports/${filename}`,
  });
}
