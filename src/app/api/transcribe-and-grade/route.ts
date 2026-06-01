import OpenAI from 'openai';
import type { Question } from '@/lib/types';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const WHISPER_PROMPT =
  'Transcribe VERBATIM in the exact language spoken. Do NOT translate. Do NOT correct or improve what was said. Write exactly what the speaker said, including any errors, in the language they used.';

const SLAVIC_RE = /[ČčŠšŽžĚěŘřŮů]/;

interface WordTiming { word: string; start: number; end: number; }
interface TranscriptionResult { text: string; words: WordTiming[]; detectedLanguage?: string; }

async function runTranscription(audio: File, forceLang?: string, noPrompt?: boolean): Promise<TranscriptionResult> {
  // Build base params then add optional fields imperatively to avoid union-type overload issues
  const params: Record<string, unknown> = {
    file: audio,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
  };
  if (forceLang) {
    params.language = forceLang;
  } else if (!noPrompt) {
    params.prompt = WHISPER_PROMPT;
  }
  // SDK return type is narrowed by response_format at runtime; cast needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (getOpenAI().audio.transcriptions.create as any)(params) as {
    text: string;
    words?: WordTiming[];
    language?: string;
  };
  return { text: result.text, words: result.words ?? [], detectedLanguage: result.language };
}

interface SpeechMetrics {
  initialSilenceSec: number;
  maxPauseSec: number;
  notablePauseCount: number;  // pauses > 1s between words
  mediumPauseCount: number;   // pauses > 0.5s between words
  wordsPerMinute: number;
}

const MIN_WORDS_FOR_WPM = 8; // fewer words → WPM is too noisy to be meaningful

function analyzeSpeechTiming(words: WordTiming[]): SpeechMetrics | null {
  if (words.length < 2) return null;
  const initialSilenceSec = words[0].start;
  let maxPauseSec = 0;
  let notablePauseCount = 0;
  let mediumPauseCount = 0;
  for (let i = 1; i < words.length; i++) {
    const pause = words[i].start - words[i - 1].end;
    if (pause > maxPauseSec) maxPauseSec = pause;
    if (pause > 1.0) notablePauseCount++;
    if (pause > 0.5) mediumPauseCount++;
  }
  const speechDuration = words[words.length - 1].end - words[0].start;
  const wordsPerMinute = speechDuration > 0 ? (words.length / speechDuration) * 60 : 0;
  return { initialSilenceSec, maxPauseSec, notablePauseCount, mediumPauseCount, wordsPerMinute };
}

const SYSTEM_PROMPT = `You are a grading assistant for an Argentine Spanish language level test. Grade each spoken response and return structured JSON.

TARGET DIALECT: Rioplatense / Argentine Spanish. Non-Argentine forms (e.g. "tienes" instead of "tenés") reduce target_style_alignment but not grammar unless meaning is affected.

CRITICAL RULE — TASK COMPLETION GATES THE OVERALL SCORE:
The most important question is: did the user actually answer what was asked?
- If the user did NOT answer the prompt (said "I don't understand", went off-topic, gave unrelated Spanish, said nothing useful) → overall score MUST be 0 or 1, regardless of language quality.
- A grammatically perfect sentence that doesn't answer the question is still score 0–1.
- Only award score 2+ when the response at least partially addresses the actual prompt.

CRITICAL RULE — GRAMMAR_IN_CONTEXT PROMPTS:
When prompt_type is "grammar_in_context" (fill-in-the-blank, complete-the-sentence tasks), grammar accuracy is the entire point of the exercise. Any grammar error — even minor ones like wrong number agreement, wrong article, or wrong tense — MUST cap the overall_score at 3 (Good). A student who produces the correct sentence with no errors can score 4–5. A student with any grammar error, no matter how small, scores at most 3.

OVERALL SCORE (0–5):
0 = No meaningful response OR response that doesn't engage with the prompt at all
1 = Attempted but meaning is mostly missing, wrong, or fails to address the prompt
2 = Partial — addresses the prompt in some way but with major gaps or errors
3 = Complete and on-topic but contains at least one grammar error of any kind
4 = Complete, on-topic, and grammatically correct — no grammar errors flagged, phrasing sounds natural
5 = As above, plus particularly fluent, idiomatic, or impressively well-phrased

CRITICAL RULE — ANY GRAMMAR ERROR CAPS THE SCORE AT 3:
If ANY error from the grammar family is flagged in observed_errors (grammar, verb_conjugation, tense_error, ser_estar, por_para, gender_agreement, number_agreement, word_order, missing_pronoun, object_pronoun, preposition, calque), the overall_score MUST be capped at 3 (Good), regardless of how complete or communicative the response is. Excellent (4–5) is reserved exclusively for responses with zero grammar errors.

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
- response_speed: Consider ALL timing signals — response latency, initial silence before speaking, longest mid-speech pause, and speech rate (WPM). Penalize: initial silence >2s, pauses between words >1.5s, or speech rate <110 WPM (normal conversational Spanish is 130–160 WPM; below 110 WPM is noticeably slow). 5=fast+fluent, 4=slight delay, 3=noticeable hesitation, 2=significant slowness, 1=very slow throughout, 0=no response
- target_style_alignment: How Argentine/Rioplatense is the phrasing?

ERROR CATEGORIES (use only when applicable):
no_response, skipped, misunderstood_prompt, incomplete_answer, wrong_meaning, grammar,
verb_conjugation, tense_error, ser_estar, por_para, gender_agreement, number_agreement,
word_order, missing_pronoun, object_pronoun, preposition, vocabulary_gap, unnatural_wording,
pronunciation, response_speed, target_style_vos, target_style_vocabulary,
target_style_pronunciation, too_much_english, hallucinated_or_unrelated_answer,
filled_pause, repetition_restart, false_start, article_omission, article_overuse,
subject_pronoun_overuse, subjunctive_error, conditional_error, negation_error,
false_cognate, calque, code_switching, register_error, discourse_markers,
response_shape, one_word_avoidance

CATEGORY PRIORITY RULES — apply the most specific category first:
1. too_much_english: Use this whenever the learner's response is primarily or entirely in English when Spanish was required. This takes priority over hallucinated_or_unrelated_answer — a response in English is a language error, not an unrelated answer. Always use too_much_english for English responses to Spanish prompts.
2. incomplete_answer: The learner addressed the prompt but left out a required element. They are clearly responding to the right question. Example: asked to "order a coffee and say no sugar" → said only "Un café, por favor" (correct topic, missing the no-sugar part).
3. hallucinated_or_unrelated_answer: The learner answered a completely different question or said something that has no connection to the prompt. Example: asked about coffee → said "Hola, me llamo Juan." Use this only when the response is clearly off-topic AND not an English response — never combine with too_much_english.
4. grammar vs wrong_meaning: Use 'grammar' for structural errors including wrong connectors/conjunctions (e.g. "cuando" instead of "porque", "pero" instead of "sino"), wrong prepositions, agreement errors. Reserve 'wrong_meaning' ONLY for vocabulary substitutions where the grammatical structure is correct but a word has the wrong semantic meaning (e.g. said "frío" when context required "caliente"). A wrong connector IS a grammar error, not a wrong_meaning error.

OBSERVATIONAL CATEGORIES — flag these in observed_errors when present, but NEVER let them change overall_score or label. They enrich the learner profile for progress tracking. Set review_later: true and severity 1 (or 2 if extreme). They are NOT grading penalties:
- filled_pause: Audible English hesitation sounds (um, uh, like) mid-Spanish-sentence instead of Spanish fillers (pues, este, o sea, bueno)
- repetition_restart: Repeating the same word/phrase 2–3 times as a stalling tactic ("yo... yo... yo voy")
- false_start: Abandoning a sentence structure mid-way and restarting with a different one ("Cuando yo... mañana voy a viajar")
- article_omission: Dropping required Spanish articles ("voy a tienda" → "a la tienda"; "me gusta café" → "el café"; "tengo perro" → "un perro")
- article_overuse: Using articles where Spanish omits them ("soy el doctor" → "soy doctor"; "hablo el español" → "hablo español")
- subject_pronoun_overuse: Repeating "yo/ella/él" in every clause when the verb ending already conveys the subject — an English carry-over habit
- subjunctive_error: Using indicative where subjunctive is required after triggers like espero que, ojalá, para que, cuando+future ("espero que viene" → "venga"; "cuando llego" → "llegue"; "para que sabes" → "sepas")
- conditional_error: Wrong tense pairing in si-clauses ("si tengo... iría" → "iré"; "si tuviera... voy a viajar" → "viajaría")
- negation_error: Missing Spanish double negatives or wrong placement ("veo nada" → "no veo nada"; "como nunca carne" → "nunca como carne" or "no como carne nunca")
- false_cognate: Using a word that resembles English but carries a different meaning ("estoy embarazada" meaning pregnant not embarrassed; "actualmente" meaning currently not actually; "soportar" meaning tolerate not support; "realizar" meaning carry out not realize)
- calque: Word-for-word English-to-Spanish translations that are grammatically incorrect or unnatural ("hace sentido" → "tiene sentido"; "cambiar mi mente" → "cambiar de opinión"; "estoy excitado" when meaning thrilled/excited → "estoy emocionado"; "tener un buen tiempo" → "pasarla bien"). NOTE: Unlike other observational categories, calque IS a grammar error and MAY reduce the overall_score — treat it like a grammar error of comparable severity.
- code_switching: Inserting isolated English words mid-Spanish-sentence ("yo fui al... store"; "mi favorito color es... blue"; "necesito un bowl")
- register_error: Wrong formality level — tú with a boss/stranger when usted is expected, usted with a close friend, or mixing both in the same utterance
- discourse_markers: Conspicuous absence of connectors (pues, entonces, o sea, bueno, a ver, mira) making speech feel stilted and unlinked — each statement a blunt isolated sentence
- response_shape: Response scale grossly mismatches the question — full paragraph for a yes/no question, or a single word for an open-ended question requiring elaboration
- one_word_avoidance: Consistently giving single-word minimal answers to open questions as a strategy to avoid producing full sentences

SPEECH TIMING RULES — when speech timing data is present in the input:

ALWAYS add one notes_for_profile entry with the raw timing data. Include WPM, initial silence, longest pause, and pause count. Note whether it is within normal range or slow. This is required even if speech was perfectly fluent — the data is needed for learner progress tracking.

ONLY add "response_speed" to observed_errors when the input line contains a ⚠ warning. If there is no ⚠ in the speech timing line, do NOT add response_speed to observed_errors (fast or normal speech is not an error). When you do add it, the description must include the specific values that triggered the warning.

Thresholds that trigger ⚠ (pre-computed in the input — look for the warning text):
- WPM < 110 AND response was at least 8 words → CLEARLY SLOW, add response_speed severity 2
- WPM 110–124 AND response was at least 8 words → SLIGHTLY BELOW NORMAL (natural range 130–160 WPM), add response_speed severity 1
- Initial silence before speaking > 2s → add response_speed
- Longest pause > 2s, OR 3+ pauses each exceeding 1s (frequent hesitation) → add response_speed
A 0.2s pause is completely normal. A single 1.5s pause is borderline. Only flag when pauses are genuinely disruptive.
For WPM: severity 1 = mild (only slightly affects fluency), severity 2 = significant (noticeably slow). Never let a severity-1 response_speed alone reduce a response from Excellent to Ok/Bad.

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
        let transcription = await runTranscription(audio, undefined, allowEnglish);
        // Retry with forced Spanish ONLY for Slavic character artifacts (a real Whisper
        // transcription bug where Spanish audio gets garbled into Slavic chars).
        // We do NOT retry on detectedLanguage === 'english' because forcing language='es'
        // causes Whisper to TRANSLATE English audio into Spanish instead of transcribing
        // verbatim — an English response would then appear as correct Spanish.
        // The grader handles genuine English responses via the too_much_english error category.
        if (!allowEnglish && SLAVIC_RE.test(transcription.text)) {
          transcription = await runTranscription(audio, 'es');
        }
        const transcriptText = transcription.text;
        const speechMetrics = analyzeSpeechTiming(transcription.words);

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

        const wordCount = transcription.words.length;
        const tooShortForSpeed = wordCount < MIN_WORDS_FOR_WPM;
        const wpm = speechMetrics ? Math.round(speechMetrics.wordsPerMinute) : 0;
        // Two-tier WPM thresholds: natural conversational Spanish is 130–160 WPM
        const clearlySlowWpm = !tooShortForSpeed && speechMetrics ? wpm < 110 : false;
        const slightlySlowWpm = !tooShortForSpeed && speechMetrics ? (wpm >= 110 && wpm < 125) : false;
        const longSilence = !tooShortForSpeed && speechMetrics ? speechMetrics.initialSilenceSec > 2 : false;
        const significantPauses = !tooShortForSpeed && speechMetrics
          ? speechMetrics.maxPauseSec > 2.0 || speechMetrics.notablePauseCount >= 3
          : false;
        const speechTimingLine = speechMetrics
          ? tooShortForSpeed
            ? `Speech timing (record in notes_for_profile as context only): ${wordCount} words — too short for reliable speed measurement. Do NOT grade response_speed; set response_speed dimension to 5 and omit from observed_errors.`
            : `Speech timing (ALWAYS record in notes_for_profile): initial silence ${speechMetrics.initialSilenceSec.toFixed(1)}s | longest pause ${speechMetrics.maxPauseSec.toFixed(1)}s | pauses >0.5s: ${speechMetrics.mediumPauseCount} | pauses >1s: ${speechMetrics.notablePauseCount} | speech rate ${wpm} WPM${clearlySlowWpm ? ' ⚠ CLEARLY SLOW (<110 WPM) — add response_speed to observed_errors, severity 2' : slightlySlowWpm ? ' ⚠ SLIGHTLY BELOW NORMAL (110–124 WPM; natural range 130–160) — add response_speed to observed_errors, severity 1' : ''}${longSilence ? ' ⚠ INITIAL SILENCE >2s — add response_speed to observed_errors' : ''}${significantPauses ? ' ⚠ SIGNIFICANT PAUSES — add response_speed to observed_errors' : ''}`
          : null;

        const userMessage = `${contextLines}

User transcript: "${transcriptText}"
Response latency: ${responseLatencyMs.toFixed(0)}ms
Speaking duration: ${(speakDurationSec * 1000).toFixed(0)}ms
${speechTimingLine ? speechTimingLine + '\n' : ''}Used transcript help: ${usedTranscriptHelp}
Skipped: false

Prompt ID to echo back: ${q.prompt_id}`;

        const completion = await getOpenAI().chat.completions.create({
          model: 'gpt-5.5',
          response_format: { type: 'json_object' },
          max_completion_tokens: 1500,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
        });

        const raw = completion.choices[0]?.message?.content ?? '{}';
        // eslint-disable-next-line prefer-const
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          // Truncated JSON (token limit hit) — emit what we can and bail gracefully
          console.error('[transcribe-and-grade] JSON parse failed (token limit?), raw:', raw.slice(0, 200));
          send({ type: 'error', message: 'Grading response was truncated — increase max_completion_tokens or simplify prompt' });
          return;
        }
        const score = Math.max(0, Math.min(5, Number(parsed.overall_score) || 0)) as 0 | 1 | 2 | 3 | 4 | 5;
        parsed.overall_score = score;
        parsed.label = LABELS[score];
        parsed.prompt_id = q.prompt_id;
        if (speechMetrics) {
          parsed.speech_metrics = {
            wpm: Math.round(speechMetrics.wordsPerMinute),
            initial_silence_sec: speechMetrics.initialSilenceSec,
            max_pause_sec: speechMetrics.maxPauseSec,
            notable_pause_count: speechMetrics.notablePauseCount,
            medium_pause_count: speechMetrics.mediumPauseCount,
          };
        }

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
