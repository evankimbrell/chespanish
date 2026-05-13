import type { Lesson } from './types';

type ResponseToken = { t: string; kind: 'ok' | 'wrong' | 'missing'; issue?: string; cat?: string };

export const SCENARIOS = [
  { id: 'restaurant', label: 'Restaurant',         hint: 'parrilla, bodegón, pedido' },
  { id: 'cafe',       label: 'Café',               hint: 'cortado, medialunas' },
  { id: 'taxi',       label: 'Taxi / Uber',         hint: 'direcciones, charla' },
  { id: 'soccer',     label: 'Soccer game',         hint: 'cancha, hinchada' },
  { id: 'apartment',  label: 'Apartment',           hint: 'encargado, alquiler' },
  { id: 'grocery',    label: 'Grocery store',       hint: 'verdulería, kiosco' },
  { id: 'pharmacy',   label: 'Pharmacy',            hint: 'farmacia, receta' },
  { id: 'gym',        label: 'Gym',                 hint: 'turno, clase' },
  { id: 'date',       label: 'Date / social plans', hint: 'salir, te pinta' },
  { id: 'smalltalk',  label: 'Small talk',          hint: 'che, ¿cómo andás?' },
  { id: 'whatsapp',   label: 'WhatsApp audio',      hint: 'mensaje de voz' },
  { id: 'travel',     label: 'Travel logistics',    hint: 'colectivo, micro' },
  { id: 'work',       label: 'Work conversation',   hint: 'reunión, oficina' },
  { id: 'custom',     label: 'Custom scenario',     hint: 'describe a tu manera' },
];

export const FOCUSES = [
  { id: 'balanced', label: 'Balanced lesson' },
  { id: 'recent',   label: 'Recent mistakes' },
  { id: 'common',   label: 'Most common mistakes' },
  { id: 'grammar',  label: 'Grammar' },
  { id: 'listening',label: 'Listening comprehension' },
  { id: 'speed',    label: 'Faster responses' },
  { id: 'pron',     label: 'Pronunciation' },
  { id: 'flow',     label: 'Conversation flow' },
  { id: 'vocab',    label: 'Scenario vocabulary' },
];

export const RECENT_MISTAKES = [
  { id: 'tenes',    label: 'Using "quieres" instead of "querés"',  count: 7, last: 'today' },
  { id: 'porpara',  label: 'Confusing "por" and "para"',           count: 4, last: '2 days ago' },
  { id: 'slow',     label: 'Slow response to simple prompts',       count: 9, last: 'today' },
  { id: 'dale',     label: 'Mishearing "dale"',                     count: 3, last: 'yesterday' },
  { id: 'pronouns', label: 'Forgetting object pronouns',            count: 5, last: 'today' },
];

export const GRAMMAR_TOPICS = [
  'Present tense', 'Vos conjugations', 'Pretérito', 'Imperfecto',
  'Future with voy a', 'Conditional (me gustaría)', 'Commands',
  'Reflexive verbs', 'Direct objects', 'Indirect objects', 'Por vs para',
  'Ser vs estar', 'Subjunctive basics',
];

export const SECTIONS = [
  { id: 1, label: 'Warm-up review',     pct: 0.00, end: 0.12, blurb: 'Quick recap of phrases from your last lesson — café and restaurant basics.' },
  { id: 2, label: 'New phrases',        pct: 0.12, end: 0.32, blurb: 'Three new patterns: querés, te pinta, voy a + infinitive.' },
  { id: 3, label: 'Prompt-response',    pct: 0.32, end: 0.55, blurb: 'Short, fast drills. You hear a cue and respond. Speed matters here.' },
  { id: 4, label: 'Listening dialogue', pct: 0.55, end: 0.74, blurb: 'A two-minute exchange between two friends planning a Friday night.' },
  { id: 5, label: 'Roleplay',           pct: 0.74, end: 0.92, blurb: 'You play yourself. Tutor plays a friend texting you about plans.' },
  { id: 6, label: 'Recap',             pct: 0.92, end: 1.00, blurb: 'Final summary and the three phrases you should walk away with.' },
];

export const SUBTITLE_LINES = [
  '¿Te pinta tomar algo después del laburo?',
  'Yo termino tipo siete y media.',
  'Si querés podemos ir al bar de Defensa, ¿cómo te queda?',
];

export const USER_RESPONSE: { text: string; tokens: ResponseToken[] } = {
  text: '¿Tienes tiempo mañana? Quieres tomar un café.',
  tokens: [
    { t: '¿',       kind: 'ok' },
    { t: 'Tienes',  kind: 'wrong', issue: 'Use the vos form: "Tenés".', cat: 'Conjugation' },
    { t: 'tiempo',  kind: 'ok' },
    { t: 'mañana?', kind: 'ok' },
    { t: 'Quieres', kind: 'wrong', issue: 'Use the vos form: "Querés".', cat: 'Conjugation' },
    { t: 'tomar',   kind: 'ok' },
    { t: 'un',      kind: 'ok' },
    { t: 'café',    kind: 'ok' },
    { t: '.',       kind: 'ok' },
  ],
};

export const LESSON: Lesson = {
  id: 'l-current',
  title: 'Making plans with a friend',
  subtitle: 'Casual invitations, near future, and sounding like a porteño',
  duration: 25,
  level: 'B1',
  scenario: 'Social plans · Café in San Telmo',
  focus: 'Recent mistakes + speed',
  score: 88,
  mistakes: 6,
  date: 'May 9',
  outline: [
    { n: 1, label: 'Warm-up review',    pct: 0.00 },
    { n: 2, label: 'New phrases',       pct: 0.12 },
    { n: 3, label: 'Prompt-response',   pct: 0.32 },
    { n: 4, label: 'Listening dialogue',pct: 0.55 },
    { n: 5, label: 'Roleplay',          pct: 0.74 },
    { n: 6, label: 'Recap',             pct: 0.92 },
  ],
  prompts: [
    { id: 1, kind: 'translate', cue: 'Say: Do you have time tomorrow?',  es: '¿Tenés tiempo mañana?',            userSays: '¿Tienes tiempo mañana?',        status: 'understandable', note: 'Understandable, but in Argentina use "tenés."', t: 0.34 },
    { id: 2, kind: 'answer',    cue: '¿Querés tomar algo después?',       es: 'Dale, ¿a qué hora?',               userSays: 'Sí, ¿a qué hora?',             status: 'good',           note: 'Natural answer.',                               t: 0.46 },
    { id: 3, kind: 'roleplay',  cue: "You're meeting a friend at a bar in Palermo. Suggest you both go watch the Boca game.", es: '¿Te pinta ir a ver el partido de Boca?', userSays: '¿Quieres ver el partido de Boca?', status: 'almost', note: 'Almost. "Te pinta" is more natural here.', t: 0.78 },
  ],
};

export const RECENT_LESSONS = [
  { id: 'l1', title: 'Making plans with a friend',  date: 'May 9',   duration: 26, level: 'B1', focus: 'vos forms + fast responses', mistakes: 6, score: 88 },
  { id: 'l2', title: 'At the parrilla in San Telmo', date: 'May 7',  duration: 24, level: 'B1', focus: 'restaurant vocabulary',        mistakes: 4, score: 92 },
  { id: 'l3', title: 'Apartment hot water issue',    date: 'May 5',   duration: 18, level: 'B1', focus: 'describing problems',          mistakes: 9, score: 74 },
  { id: 'l4', title: 'Taxi to Recoleta',             date: 'May 3',   duration: 15, level: 'A2', focus: 'directions + small talk',      mistakes: 5, score: 84 },
  { id: 'l5', title: 'Watching Boca play',           date: 'May 1',   duration: 28, level: 'B1', focus: 'casual reactions',             mistakes: 7, score: 79 },
  { id: 'l6', title: 'Greengrocer on the corner',    date: 'Apr 28',  duration: 12, level: 'A2', focus: 'numbers + quantities',         mistakes: 3, score: 90 },
];

export const COMMON_MISTAKES = [
  { id: 'm1', cat: 'Conjugation', name: 'Vos: tenés / querés / podés',           count: 14, severity: 'high', wrong: 'tienes', right: 'tenés',  last: 'today' },
  { id: 'm2', cat: 'Speed',       name: 'Slow responses to direct questions',     count: 11, severity: 'high',                                   last: 'today' },
  { id: 'm3', cat: 'Grammar',     name: 'Object pronouns: lo / la / me / te',    count:  8, severity: 'med',                                    last: 'yesterday' },
  { id: 'm4', cat: 'Tense',       name: 'Past endings (pretérito vs imperfecto)', count:  6, severity: 'med',                                    last: 'May 7' },
  { id: 'm5', cat: 'Listening',   name: 'Mishearing fast casual phrases',         count:  5, severity: 'med',                                    last: 'May 9' },
  { id: 'm6', cat: 'Naturalness', name: '"Deseo" instead of "quiero"',           count:  3, severity: 'low',                                    last: 'May 3' },
];

export const TENES_EXAMPLES = [
  '¿Tenés tiempo?', '¿Tenés hambre?', '¿Tenés ganas de salir?',
  '¿Tenés efectivo?', '¿Tenés el número?', '¿Tenés idea?',
  '¿Tenés un segundo?', '¿Tenés Whatsapp?',
];
