import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export interface DisplayLesson {
  title: string;
  scenario: string;
  focus_points: string[];
  why: string;
}

export interface LessonDesignResult {
  fullBrief: string;
  displayLesson: DisplayLesson;
}

const DESIGN_BRIEF_PROMPT = `You are a master Spanish tutor and curriculum designer creating the first personalized audio lesson for a student after a Spanish level test.

The student has completed an adaptive Spanish placement test covering the A1–C2 CEFR range. I will provide the student's test results, including their estimated level, prompt-by-prompt answers, grading notes, strengths, weaknesses, response speed, pauses, completeness, pronunciation issues, recurring grammar mistakes, and any evaluator recommendations.

Your job is NOT to write the full lesson transcript yet. Your job is to create a clear first-lesson design brief that another prompt will later use to generate the actual audio lesson.

The lesson will be primarily audio-based. The student will listen, respond out loud, repeat, be graded in real time, receive dynamic correction, and occasionally ask questions during the lesson. The lesson should use the core mechanics of Pimsleur-style instruction: active recall, graduated interval recall, anticipation, listen-and-respond prompts, useful conversational chunks, organic grammar acquisition, pronunciation modeling, and frequent recombination of known material.

Design the first lesson based on the student's actual level and highest-ROI next step. Do not simply spot-treat every error from the test. Instead, identify the most logical next lesson that would produce the best improvement in the student's real Spanish speaking ability.

The lesson should be appropriate for any level from A1 to C2:

* For A1–A2 students, prioritize core survival conversation, high-frequency sentence frames, pronunciation, question/answer formation, and basic automaticity.
* For B1 students, prioritize fuller sentence production, narrating simple events, explaining reasons, using past/future forms, and handling common real-life situations.
* For B2 students, prioritize open-ended speaking, opinions, disagreement, nuance, problem-solving, storytelling, register, and conversational flexibility.
* For C1–C2 students, prioritize precision, idiomaticity, discourse structure, tone, register switching, argumentation, cultural nuance, fast listening, and natural conversational rhythm.

Use Argentine/Rioplatense Spanish as the default dialect unless the student profile says otherwise. If relevant, mention where Rioplatense forms such as "vos," "querés," "tenés," "podés," "dale," "che," or "viste" should be used. Avoid mixing dialects casually.

Here is the student information:

[TEST_DATA]

Now produce a first-lesson design brief with the following sections:

1. Estimated Student Level
   Give the student's likely CEFR level and explain briefly whether they appear solid, weak, or uneven at that level.

2. Core Diagnosis
   Summarize the student's most important strengths and weaknesses. Focus only on issues that matter for designing the first lesson.

3. Highest-ROI Lesson Focus
   Choose the single best first lesson topic or communicative situation for this student. Explain why this is the best next step.

4. Communicative Goal
   State what the learner should be able to do by the end of the lesson in real-world terms.

5. Target Language
   List the core vocabulary, sentence frames, grammar patterns, discourse moves, and pronunciation targets the lesson should train. Keep this practical and focused.

6. What Not to Focus On Yet
   Identify mistakes or weaknesses from the test that should not be prioritized in the first lesson, either because they are lower ROI, too advanced, or better handled later.

7. Lesson Architecture
   Outline the recommended structure of the first audio lesson. Include phases such as warm-up, introduction of core chunks, controlled recall, transformations, mini-dialogue, open response, and final challenge. Adapt these phases to the student's level.

8. Adaptive Branching
   Explain how the lesson should adapt if the student performs below expectations, at expectations, or above expectations during the lesson.

9. Real-Time Grading Priorities
   Specify what the app should grade during this lesson. Include categories such as meaning success, grammar accuracy, response completeness, response speed, pronunciation, fluency, repair ability, register, and naturalness where relevant.

10. Correction Style
    Explain how corrections should be delivered during the audio lesson. Keep corrections brief, useful, and appropriate to the student's level.

11. Final Performance Task
    Design one final spoken task that tests whether the student achieved the lesson goal. Give examples of acceptable answers at weak, expected, and strong performance levels.

12. Post-Lesson Report Notes
    Specify what the system should report back to the student after the lesson: what they practiced, what improved, their main issue, and what the next lesson should likely cover.

Important constraints:

* Do not write the full lesson transcript.
* Do not overfit to tiny errors from the test.
* Do not design a generic lesson unrelated to the student's profile.
* Prioritize real speaking ability over grammar explanation.
* Make the lesson feel like the system understood the student personally.
* Keep the lesson focused enough to complete in roughly 15–25 minutes of audio.
* Use practical Spanish the student could actually use in conversation.
* Make the design brief detailed enough that a separate lesson-generation prompt can create the full audio lesson from it.

After all 12 sections, output a JSON block at the very end in this exact format (no other text after it):

\`\`\`json
{
  "title": "3–6 word lesson theme",
  "scenario": "1–2 word context tag (e.g. social, restaurant, travel, work)",
  "focus_points": ["specific item 1", "specific item 2", "specific item 3"],
  "why": "2–3 sentence personalized explanation of why this topic and these focus points were chosen for this specific student's situation."
}
\`\`\``;

function extractDisplayLesson(briefText: string): DisplayLesson | null {
  const match = briefText.match(/```json\s*([\s\S]*?)\s*```\s*$/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed.title || !parsed.focus_points) return null;
    return {
      title: parsed.title,
      scenario: parsed.scenario ?? '',
      focus_points: Array.isArray(parsed.focus_points) ? parsed.focus_points : [],
      why: parsed.why ?? '',
    };
  } catch {
    return null;
  }
}

export async function generateLessonDesignBrief(formattedTestData: string): Promise<LessonDesignResult> {
  const prompt = DESIGN_BRIEF_PROMPT.replace('[TEST_DATA]', formattedTestData);

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    max_completion_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const fullBrief = completion.choices[0]?.message?.content?.trim() ?? '';

  const displayLesson = extractDisplayLesson(fullBrief) ?? {
    title: 'Your First Lesson',
    scenario: 'conversation',
    focus_points: ['Speaking practice', 'Core vocabulary', 'Argentine Spanish'],
    why: 'Based on your test results, this lesson will address your most important speaking needs.',
  };

  return { fullBrief, displayLesson };
}
