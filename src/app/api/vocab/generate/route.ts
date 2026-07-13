import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type { LessonActivityRecord, LessonHistoryEntry, VocabDeck, VocabNote } from '@/lib/types';
import type { ParsedNote } from '@/lib/vocab-import';
import { aggregateMistakes, type MistakeSummary } from '@/lib/common-mistakes';
import { normalizeSpanish } from '@/lib/vocab-match';
import { createCardsForNote } from '@/lib/srs';
import { LUNFARDO_DECK } from '@/lib/lunfardo-deck';
import { readStore, writeStore, noteIdFor, safeName } from '../store';
import { generateDeckAudio } from '@/lib/vocab-audio';
import * as dp from '@/lib/data-paths';

export const maxDuration = 300; // two gpt-5.5 calls generating ~150 JSON notes

// POST /api/vocab/generate { user } — the "Decide for me" setup path. Builds:
//   core     — GPT: ~100–150 frequency-ordered Rioplatense notes from level + lesson
//              topics + mistake categories
//   mistakes — GPT: notes for the specific words/phrases the learner fumbled
//   lunfardo — curated in-repo deck (deterministic, no model call)

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

const REPORTS_DIR = dp.REPORTS_DIR;
const LESSONS_DIR = dp.LESSONS_DIR;
const ACTIVITY_DIR = dp.ACTIVITY_DIR;

function readLevel(user: string): string {
  try {
    const prefix = `${safeName(user)}-`;
    const file = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.json') && f.startsWith(prefix)).sort().at(-1);
    if (!file) return 'B1';
    const report = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8'));
    return report?.testReport?.display_level ?? 'B1';
  } catch { return 'B1'; }
}

function readLessonTopics(user: string): string[] {
  try {
    const entries: LessonHistoryEntry[] = JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, `${safeName(user)}.json`), 'utf8'));
    return [...new Set(entries.flatMap((e) => [e.title, ...(e.topics ?? [])]))].slice(0, 20);
  } catch { return []; }
}

function readMistakes(user: string): MistakeSummary[] {
  try {
    const raw = fs.readFileSync(path.join(ACTIVITY_DIR, `${safeName(user)}.jsonl`), 'utf8');
    const records = raw.split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as LessonActivityRecord; } catch { return null; } })
      .filter((r): r is LessonActivityRecord => r !== null);
    return aggregateMistakes(records);
  } catch { return []; }
}

const NOTE_SPEC = `Each note: { "es": "Spanish word/short phrase (Rioplatense, with article for nouns, e.g. \\"el colectivo\\")", "en": "concise English meaning", "example": "short natural Argentine Spanish example sentence using it", "exampleEn": "English translation of the example", "tags": ["1-3 short lowercase tags, e.g. noun, transport, lunfardo"] }`;

// Model output shape → validated ParsedNote[]
function validateNotes(raw: unknown): ParsedNote[] {
  const arr = (raw as { notes?: unknown })?.notes;
  if (!Array.isArray(arr)) return [];
  const out: ParsedNote[] = [];
  for (const n of arr) {
    if (!n || typeof n !== 'object') continue;
    const o = n as Record<string, unknown>;
    if (typeof o.es !== 'string' || !o.es.trim() || typeof o.en !== 'string' || !o.en.trim()) continue;
    out.push({
      es: o.es.trim(),
      en: o.en.trim(),
      example: typeof o.example === 'string' && o.example.trim() ? o.example.trim() : undefined,
      exampleEn: typeof o.exampleEn === 'string' && o.exampleEn.trim() ? o.exampleEn.trim() : undefined,
      tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string').slice(0, 3) : [],
    });
  }
  return out;
}

// gpt-5.5 with escalating reasoning effort — empty output = reasoning-token exhaustion,
// the known failure mode (see lesson/grade). Generous completion budget.
async function generateNotes(prompt: string): Promise<ParsedNote[]> {
  for (const effort of ['low', 'medium'] as const) {
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-5.5',
        max_completion_tokens: 16000,
        reasoning_effort: effort,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) { console.warn(`[vocab/generate] empty content (effort=${effort})`); continue; }
      try {
        const notes = validateNotes(JSON.parse(content));
        if (notes.length > 0) return notes;
        console.warn(`[vocab/generate] zero valid notes (effort=${effort})`);
      } catch {
        console.warn(`[vocab/generate] JSON parse failed (effort=${effort})`);
      }
    } catch (e) {
      console.error(`[vocab/generate] error (effort=${effort}):`, e);
    }
  }
  return [];
}

function corePrompt(level: string, topics: string[], mistakeCategories: string[]): string {
  return `You are building a personalized spaced-repetition vocabulary deck for a learner of Argentine (Rioplatense) Spanish at level ${level}.

Learner context:
- Lesson topics so far: ${topics.length ? topics.join('; ') : '(none yet)'}
- Recurring mistake areas: ${mistakeCategories.length ? mistakeCategories.join('; ') : '(none yet)'}

Produce 120 vocabulary notes of HIGH-FREQUENCY, practical Buenos Aires daily-life Spanish, ordered most-frequent/most-useful first. Prefer words a person actually needs on the street, in cafés, on transport, at work, in an apartment — NOT textbook words. Use Rioplatense forms and vocabulary (colectivo, subte, heladera, departamento, vos forms in examples). Slightly bias toward the learner's lesson topics and mistake areas. Do NOT include basic greetings the learner obviously knows at ${level}. Avoid duplicates.

${NOTE_SPEC}

Return ONLY JSON: { "notes": [ ... ] }`;
}

function mistakesPrompt(mistakes: MistakeSummary[]): string {
  const items = mistakes.slice(0, 25).map((m) => {
    const ex = m.examples[0];
    return `- ${m.name}: ${ex ? `said "${ex.youSaid}"${ex.target ? ` (target: "${ex.target}")` : ''}` : m.blurb}`;
  }).join('\n');
  return `A learner of Argentine Spanish keeps making these mistakes in lessons:

${items}

For each mistake that centers on a WORD or SHORT PHRASE the learner should drill (skip purely structural/speed issues), produce one vocabulary note for the correct target word/phrase. 5–25 notes total.

${NOTE_SPEC}

Return ONLY JSON: { "notes": [ ... ] }`;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }
  let body: { user?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const user = body.user;
  if (!user) return Response.json({ error: 'missing_user' }, { status: 400 });

  const level = readLevel(user);
  const topics = readLessonTopics(user);
  const mistakes = readMistakes(user);

  const [coreNotes, mistakeNotes] = await Promise.all([
    generateNotes(corePrompt(level, topics, mistakes.map((m) => m.category))),
    mistakes.length > 0 ? generateNotes(mistakesPrompt(mistakes)) : Promise.resolve([]),
  ]);
  if (coreNotes.length === 0) {
    return Response.json({ error: 'generation_failed' }, { status: 502 });
  }

  const now = new Date();
  const store = readStore(user);
  const existingIds = new Set(store.decks.flatMap((d) => d.notes.map((n) => n.id)));
  // Dedupe across all three decks by normalized Spanish (core wins, then mistakes, then lunfardo).
  const seenEs = new Set(store.decks.flatMap((d) => d.notes.map((n) => normalizeSpanish(n.es))));

  const build = (id: string, name: string, description: string, source: string, parsed: ParsedNote[]): VocabDeck => {
    const notes: VocabNote[] = [];
    for (const p of parsed) {
      const key = normalizeSpanish(p.es);
      if (seenEs.has(key)) continue;
      seenEs.add(key);
      notes.push({ id: noteIdFor(p.es, existingIds), es: p.es, en: p.en, example: p.example, exampleEn: p.exampleEn, tags: p.tags });
    }
    return {
      id, name, description, source, direction: 'both', createdAt: now.toISOString(),
      notes,
      cards: notes.flatMap((n) => createCardsForNote(n.id, now)),
    };
  };

  const decks = [
    build('core', 'BA Survival Core', 'High-frequency words for daily life in Buenos Aires', 'Generated from your lessons + level', coreNotes),
    build('mistakes', 'From your mistakes', 'Every word you’ve fumbled in a lesson, auto-added', 'Auto-synced with Mistakes', mistakeNotes),
    build('lunfardo', 'Lunfardo & casual speech', 'laburo, quilombo, che — what people actually say', 'Curated starter deck', LUNFARDO_DECK),
  ].filter((d) => d.notes.length > 0 || d.id === 'mistakes'); // keep empty mistakes deck as the sync target

  // Replace same-id decks if regenerating; keep user-uploaded decks untouched.
  store.decks = [...store.decks.filter((d) => !decks.some((nd) => nd.id === d.id)), ...decks];
  store.setupCompleted = true;
  store.setupMethod = 'auto';
  writeStore(user, store);

  // Pre-generate card audio in the background (content-addressed cache: repeat
  // words across decks are free). The vocab UI shows readiness per deck.
  for (const d of decks) void generateDeckAudio(user, d);

  return Response.json({
    decks: decks.map((d) => ({ id: d.id, name: d.name, noteCount: d.notes.length })),
  });
}
