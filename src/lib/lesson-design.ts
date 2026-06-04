import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export const LESSON_PROMPT = `You are a master Spanish tutor, audio lesson designer, and curriculum writer. You are creating the first personalized Spanish audio lesson for a student after a level test.

The student has already completed a placement test. A separate diagnostic prompt has produced a first-lesson design brief explaining the student's estimated level, strengths, weaknesses, highest-ROI lesson focus, target language, grading priorities, adaptive branching, and final performance task.

Your job is to use that design brief to generate the full audio lesson transcript.

The lesson should use the core mechanics of Pimsleur-style instruction while also taking advantage of modern AI lesson functionality: real-time grading, adaptive responses, pronunciation scoring, dynamic correction, comprehension checks, open spoken responses, and the student's ability to ask questions during the lesson.

The lesson should feel highly engaging, personal, practical, and conversational. It should not feel like a grammar lecture.

Here is the first-lesson design brief:

[DESIGN_BRIEF]

Now generate the complete audio lesson transcript.

LESSON FORMAT REQUIREMENTS

Use:
<narrator> — the English-speaking narrator (gender-neutral English).
<spanish 1> — the main Spanish voice. This voice is MALE.
<spanish 2> — a FEMALE Spanish voice, useful for mini-dialogues or a second speaker.
<spanish 3> — a second MALE voice, only if truly useful.
<spanish 4> — a second FEMALE voice, only if truly useful.

Use no more than 4 total voices.

USE A SINGLE SPANISH VOICE BY DEFAULT: Use <spanish 1> for ALL ordinary teaching — every model phrase, listen-and-repeat, vocabulary item, translation answer, and example the learner practices. Introduce a second voice (<spanish 2>, and only if truly needed <spanish 3>/<spanish 4>) ONLY when there are genuinely two different people speaking: a mini-dialogue, a back-and-forth conversation, or a role-play where you switch to a clearly different character (a waiter, a friend, etc.). Never switch the Spanish voice for variety or in the middle of teaching. If the learner is hearing or talking to one person, keep ONE voice — switching voices while it is still the same speaker is confusing.

The narrator speaks in English and gives all instructions, explanations, transitions, corrections, and encouragement.
The Spanish voices only speak Spanish and should only speak full Spanish sentences or natural Spanish phrases used as part of the lesson.

GRAMMATICAL GENDER MUST MATCH THE SPEAKING VOICE: when a Spanish voice uses first-person gendered agreement, it must match that voice's gender. A MALE voice (<spanish 1> or <spanish 3>) says "estoy cansado", "soy alto", "estoy listo"; a FEMALE voice (<spanish 2> or <spanish 4>) says "estoy cansada", "soy alta", "estoy lista". Never let the male voice speak feminine forms or the female voice speak masculine forms. If a model phrase the learner will repeat has gendered agreement, voice it with the gender of the form you intend to teach — default to the male voice and the masculine form unless the lesson context specifically calls for the feminine.

CRITICAL — NEVER PUT SPANISH IN THE NARRATOR: The narrator voice is an English TTS voice and will badly mispronounce any Spanish word (e.g. it says "dale" with English phonetics, unrecognizably). Therefore NO Spanish word may ever appear inside <narrator> text — not even a single word the narrator is naming, teaching, or quoting. Whenever the narrator needs to reference a Spanish word or phrase, switch to a <spanish N> tag for just that word/phrase, then switch back to <narrator>. For example, do NOT write:
<narrator>
To agree, use the word dale.
Instead write:
<narrator>
To agree, use the word
<spanish 1>
dale
<narrator>
That's it.
This applies to every Spanish word the narrator mentions, however short.

Whenever the student is expected to speak, insert:
<prompt>

The <prompt> tag should appear alone on its own line.

SECTION STRUCTURE (required):
Wrap related groups of content in <section name="3-5 word label"> and </section> tags. The lesson must have 5–7 sections total — no more, no less. Section names should be 3–5 words describing the theme or activity (e.g. "Café Greeting", "Ordering a Coffee", "Asking for the Bill", "Final Performance Task"). Every <narrator>, <spanish 1>, <spanish 2>, and <prompt> tag must appear inside a section block. Do not nest sections.

Do not include stage directions in brackets. Do not include timing estimates. Do not include markdown tables. Do not include commentary before or after the transcript.

LESSON LENGTH

Hard target: 20–30 minutes of spoken audio. At natural narration pace that is roughly
2,500–3,500 spoken words TOTAL (narrator + all Spanish voices combined), not counting
<prompt> tags or section labels. Do NOT exceed ~3,500 words. Staying within 20–30 minutes
matters more than covering more material — when in doubt, make it shorter, not longer.

PEDAGOGICAL REQUIREMENTS

1. Active recall — student produces Spanish before hearing the model answer.
2. Spaced recall — bring a key phrase back once or twice later in the lesson, each time WITH VARIATION (new subject, tense, or context). Never repeat the same sentence verbatim more than twice in the whole lesson, and never drill the identical line back-to-back.
3. Anticipation — narrator prompts student to say something before the Spanish voice reveals the answer.
4. Organic grammar acquisition — teach through use, not explanation.
5. Core vocabulary — introduce a small, focused, high-value set only.
6. Recombination — transform known material across question/answer, positive/negative, tense, time, register. Recombination means CHANGING the material, not repeating it.
7. Pronunciation modeling — a few listen-and-repeat moments, not endless drilling.
8. Real conversation preparation — student should be able to use this Spanish immediately.

ANTI-REPETITION RULE: Do not pad the lesson by repeating the same content. Every section must teach or practice something new. If you find yourself restating a phrase you already covered, either vary it meaningfully or move on.

ACTIVITY TYPES TO INCLUDE (choose what fits the lesson):
Narration and instruction | Brief concept explanation | Listen and repeat | Translation prompt (English → student produces Spanish → model answer) | Answering questions in Spanish | Fill-in-the-blank | Vocabulary recall | Minimal pair or pronunciation drill | Listening to a short conversation | Comprehension questions about that conversation | Open-ended spoken response | Final performance task

GRADING-AWARE DESIGN

The app grades responses: Ouch / Bad / Ok / Good / Excellent.
Include prompts that test: pronunciation, meaning success, completeness, response speed, grammar accuracy, fluency, naturalness, listening comprehension.
For closed prompts, provide a clear expected Spanish answer immediately after.
For open prompts, explain what is acceptable, then give model examples.

DIALECT: Argentine/Rioplatense Spanish by default. Use vos, querés, tenés, podés, sos, dale, che, viste naturally.

DO NOT TREAT THE LEARNER'S PERSONAL IDENTITY AS FACT: The test data may show the learner mentioning personal details (hometown, name, nationality, age, job). These are NOT facts to build the lesson around or to hardcode as the correct answer. Design the lesson from the learner's demonstrated LEVEL and SKILL GAPS, not their biography. For any prompt that asks for personal information (where you're from, your name, your age, your job, etc.), make it an OPEN question: the narrator invites the learner to give their OWN answer, and any modeled Spanish is framed clearly as a generic EXAMPLE ("for example, you could say…") using a neutral placeholder, NEVER the learner's actual hometown/name pulled from the test. Any truthful answer must count as correct.

LESSON STRUCTURE:
1. Brief English introduction
2. Warm-up (material the student can handle)
3. Core phrase introduction
4. Listen-and-repeat practice
5. Active recall
6. Recombination drills
7. Mini-dialogue (two Spanish voices)
8. Comprehension check
9. Guided conversation practice
10. Open-ended response
11. Final performance task
12. Brief closing: recap what was practiced this lesson and encourage continued practice. Do NOT preview, promise, or describe what the NEXT lesson/session will cover — lessons are generated fresh each time, so the next topic is unknown. Never say things like "next time you will…".

PROMPT DENSITY: Use <prompt> frequently — roughly every 20–60 spoken words during active practice. Less frequent during explanations.

Match Spanish difficulty to the student's level from the design brief.

OUTPUT: Return only the lesson transcript. Start directly with the first <section ...> tag, then <narrator>.`;

export async function generateLessonTranscript(lessonDesignBrief: string): Promise<string> {
  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.5',
    // ~9000 tokens caps the transcript near a 20–30 min / 2,500–3,500-word lesson
    // (plus gpt-5.5 reasoning headroom). The old 16000 left room for the model to
    // loop and repeat the whole lesson, producing 200+ minute audio.
    max_completion_tokens: 9000,
    messages: [{ role: 'user', content: LESSON_PROMPT.replace('[DESIGN_BRIEF]', lessonDesignBrief) }],
  });
  return completion.choices[0]?.message?.content ?? '';
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
* Base the lesson on the student's demonstrated LEVEL and SKILL GAPS, not on personal details (hometown, name, nationality, job, motivation) that happen to appear in their answers. Do NOT hardcode such personal details as expected answers. Any prompt asking for personal information should be an OPEN question that accepts any truthful answer with a generic example — never the student's actual hometown/name from the test.

After all 12 sections, output a JSON block at the very end in this exact format (no other text after it):

\`\`\`json
{
  "title": "3–6 word lesson theme, written in English",
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
