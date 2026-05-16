import OpenAI from 'openai';
import type { TranscriptionCreateParams } from 'openai/resources/audio/transcriptions';
import type { Question } from '@/lib/types';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const ARGENTINE_PROMPT =
  'Che, ¿qué hacés? ¿Querés tomar algo antes de salir? No sé, depende. Sí, claro que sí. Mirá, la verdad es que no tengo tiempo. ¿Y vos qué pensás? No entendí bien lo que me dijiste.';

const SLAVIC_RE = /[ČčŠšŽžĚěŘřŮů]/;

async function runTranscription(audio: File, forceLang?: string, noPrompt?: boolean): Promise<string> {
  const params: TranscriptionCreateParams = {
    file: audio,
    model: 'whisper-1',
    ...(forceLang
      ? { language: forceLang }
      : noPrompt
        ? {}
        : { prompt: ARGENTINE_PROMPT }),
  };
  const result = await getOpenAI().audio.transcriptions.create(params);
  return result.text;
}

const SYSTEM_PROMPT = `You are a grading assistant for an Argentine Spanish language level test. Grade each spoken response and return structured JSON.

TARGET DIALECT: Rioplatense / Argentine Spanish. Non-Argentine forms (e.g. "tienes" instead of "tenés") reduce target_style_alignment but not grammar unless meaning is affected.

CRITICAL RULE — TASK COMPLETION GATES THE OVERALL SCORE:
The most important question is: did the user actually answer what was asked?
- If the user did NOT answer the prompt (said "I don't understand", went off-topic, gave unrelated Spanish, said nothing useful) → overall score MUST be 0 or 1, regardless of language quality.
- A grammatically perfect sentence that doesn't answer the question is still score 0–1.
- Only award score 2+ when the response at least partially addresses the actual prompt.

OVERALL SCORE (0–5):
0 = No meaningful response OR response that doesn't engage with the prompt at all
1 = Attempted but meaning is mostly missing, wrong, or fails to address the prompt
2 = Partial — addresses the prompt in some way but with major gaps or errors
3 = Understandable and on-topic with noticeable errors
4 = Correct or mostly correct, complete, and natural enough
5 = Natural, fluent, complete — flexible phrasing

LABEL MAPPING: 0→"Ouch", 1→"Bad", 2→"Ok", 3→"Good", 4→"Excellent", 5→"Excellent"

BRIEF FEEDBACK: Exactly one sentence in plain English (max 15 words) on the key strength or main issue.

NOTES FOR PROFILE: 1–3 short strings (10–20 words each) noting what this response revealed about the learner's abilities or gaps. Written as objective observations, not as feedback to the learner.

DIMENSIONS (each 0–5):
- comprehension: Did the user understand the prompt?
- task_completion: Did they actually answer what was asked? (0 if they didn't address the prompt)
- grammar: How controlled is the grammar?
- vocabulary: Was vocabulary sufficient and appropriate?
- fluency: How smoothly was the answer produced?
- pronunciation_intelligibility: Could a listener understand the spoken Spanish?
- response_speed: Based on responseLatencyMs — 5=<2s, 4=2–4s, 3=4–7s, 2=7–12s, 1=>12s, 0=no response
- target_style_alignment: How Argentine/Rioplatense is the phrasing?

ERROR CATEGORIES (use only when applicable):
no_response, skipped, misunderstood_prompt, incomplete_answer, wrong_meaning, grammar,
verb_conjugation, tense_error, ser_estar, por_para, gender_agreement, number_agreement,
word_order, missing_pronoun, object_pronoun, preposition, vocabulary_gap, unnatural_wording,
pronunciation, response_speed, target_style_vos, target_style_vocabulary,
target_style_pronunciation, too_much_english, hallucinated_or_unrelated_answer

CEFR SIGNAL: Estimate the level this response suggests given prompt difficulty + quality.
Values: below_A1, A1, A2, B1, B2, C1, C2

Return ONLY valid JSON matching this exact schema:
{
  "prompt_id": "string",
  "overall_score": 0,
  "label": "Ouch",
  "brief_feedback": "one sentence max 15 words",
  "dimension_scores": {
    "comprehension": 0,
    "task_completion": 0,
    "grammar": 0,
    "vocabulary": 0,
    "fluency": 0,
    "pronunciation_intelligibility": 0,
    "response_speed": 0,
    "target_style_alignment": 0
  },
  "observed_errors": [
    {
      "category": "category_name",
      "description": "brief description",
      "severity": 1,
      "correction": "corrected form if applicable",
      "review_later": true
    }
  ],
  "cefr_signal": "A2",
  "notes_for_profile": ["observation 1", "observation 2"]
}`;

const LABELS = ['Ouch', 'Bad', 'Ok', 'Good', 'Excellent', 'Excellent'] as const;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response('OPENAI_API_KEY not configured', { status: 500 });
  }

  const fd = await req.formData();
  const audio = fd.get('audio') as File | null;
  const questionJson = fd.get('question') as string | null;
  const allowEnglish = fd.get('allow_english') === '1';
  const responseTimeSec = parseFloat(fd.get('response_time_seconds') as string) || 0;
  const speakDurationSec = parseFloat(fd.get('speaking_duration_seconds') as string) || 0;
  const usedTranscriptHelp = fd.get('used_transcript_help') === '1';

  if (!audio || !questionJson) {
    return new Response('audio and question required', { status: 400 });
  }

  let question: Question;
  try {
    question = JSON.parse(questionJson);
  } catch {
    return new Response('invalid question JSON', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      try {
        // Step 1: Transcribe
        let transcriptText = await runTranscription(audio, undefined, allowEnglish);
        if (!allowEnglish && SLAVIC_RE.test(transcriptText)) {
          transcriptText = await runTranscription(audio, 'es');
        }

        send({ type: 'transcript', transcript: transcriptText });

        // Step 2: Grade immediately server-side — no extra round-trip
        const q = question;
        const responseLatencyMs = responseTimeSec * 1000;

        const contextLines = [
          `Prompt type: ${q.prompt_type}`,
          `Difficulty: ${q.difficulty_score.toFixed(1)} (${q.difficulty_bucket})`,
          `CEFR band: ${q.cefr_band}`,
          q.audio_text ? `Audio prompt: "${q.audio_text}"` : null,
          `Instruction: "${q.instruction_text}"`,
          q.target_answer ? `Target answer: "${q.target_answer}"` : null,
          q.acceptable_response_examples?.length
            ? `Acceptable responses: ${q.acceptable_response_examples.join(' | ')}`
            : null,
          q.strong_response_examples?.length
            ? `Strong responses: ${q.strong_response_examples.join(' | ')}`
            : null,
          q.partial_response_examples?.length
            ? `Partial credit responses: ${q.partial_response_examples.join(' | ')}`
            : null,
          q.failed_response_examples?.length
            ? `Failed responses: ${q.failed_response_examples.join(' | ')}`
            : null,
          q.prompt_specific_grading_notes?.length
            ? `Grading notes: ${q.prompt_specific_grading_notes.join('; ')}`
            : null,
          q.scoring_guidance
            ? `Scoring guidance — 5: ${q.scoring_guidance.score_5} | 3: ${q.scoring_guidance.score_3} | 1: ${q.scoring_guidance.score_1}`
            : null,
          q.dimension_weighting
            ? `Weighted dimensions: ${Object.entries(q.dimension_weighting).map(([k, v]) => `${k}=${v}`).join(', ')}`
            : null,
        ].filter(Boolean).join('\n');

        const userMessage = `${contextLines}

User transcript: "${transcriptText}"
Response latency: ${responseLatencyMs.toFixed(0)}ms
Speaking duration: ${(speakDurationSec * 1000).toFixed(0)}ms
Used transcript help: ${usedTranscriptHelp}
Skipped: false

Prompt ID to echo back: ${q.prompt_id}`;

        const completion = await getOpenAI().chat.completions.create({
          model: 'gpt-5.5-mini',
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 900,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
        });

        const raw = completion.choices[0]?.message?.content ?? '{}';
        const parsed = JSON.parse(raw);
        const score = Math.max(0, Math.min(5, Number(parsed.overall_score) || 0)) as 0 | 1 | 2 | 3 | 4 | 5;
        parsed.overall_score = score;
        parsed.label = LABELS[score];
        parsed.prompt_id = q.prompt_id;

        send({ type: 'grade', grade: parsed });
      } catch (e) {
        console.error('[transcribe-and-grade] error:', e);
        send({ type: 'error', message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
