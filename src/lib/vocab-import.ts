import { normalizeSpanish } from './vocab-match';

// Deck-file parsing for user uploads. CSV/TXT only — .apkg (Anki packages) is deferred.
// Parsing is forgiving: malformed lines become per-line error strings, never throws.

export interface ParsedNote {
  es: string;
  en: string;
  example?: string;
  exampleEn?: string;
  tags: string[];
}

export interface ImportResult {
  notes: ParsedNote[];
  errors: string[];
}

export function parseDeckFile(text: string, filename: string): ImportResult {
  const result = /\.csv$/i.test(filename) ? parseCsv(text) : parseTxt(text);
  return dedupe(result);
}

// Part-of-speech labels (English + Spanish) as they appear in Anki-style exports
// whose columns run [es, en, POS, example, exampleEn]. Detected per FILE (majority
// vote over data rows) so the POS becomes a tag — without this, "preposition" lands
// in the note's example field and gets rendered (and spoken by TTS!) as the example.
const POS_LABELS = new Set([
  'noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'conjunction',
  'interjection', 'article', 'determiner', 'phrase', 'expression', 'idiom',
  'connector', 'number', 'numeral', 'greeting', 'question word', 'verb phrase',
  'sustantivo', 'verbo', 'adjetivo', 'adverbio', 'preposición', 'preposicion',
  'pronombre', 'conjunción', 'conjuncion', 'interjección', 'interjeccion',
  'artículo', 'articulo', 'frase', 'expresión', 'expresion', 'conector', 'saludo',
]);

export function looksLikePos(value: string | undefined): boolean {
  if (!value || !value.trim()) return false;
  const parts = value.trim().toLowerCase().split(/\s*[/,]\s*/);
  return parts.every((p) => POS_LABELS.has(p));
}

// es,en[,example[,exampleEn[,tags(semicolon-separated)]]] — RFC-4180 quoted fields;
// a first line that looks like a header (starts with es,en / spanish,english) is
// skipped. If most rows carry a part-of-speech label in column 3, the file is an
// Anki-style export laid out [es, en, POS, example, exampleEn] — the POS becomes a
// tag and columns 4/5 become the example pair.
export function parseCsv(text: string): ImportResult {
  const errors: string[] = [];
  const rows: { fields: string[]; lineNo: number }[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    if (i === 0 && /^\s*(es|spanish)\s*,\s*(en|english)\b/i.test(line)) return; // header
    const fields = splitCsvLine(line);
    if (fields === null) { errors.push(`line ${i + 1}: unterminated quote`); return; }
    rows.push({ fields: fields.map((f) => f.trim()), lineNo: i + 1 });
  });

  const withThird = rows.filter((r) => r.fields[2]);
  const posLayout = withThird.length > 0 &&
    withThird.filter((r) => looksLikePos(r.fields[2])).length / withThird.length >= 0.6;

  const notes: ParsedNote[] = [];
  for (const { fields, lineNo } of rows) {
    const [es, en] = fields;
    if (!es || !en) { errors.push(`line ${lineNo}: needs at least "es,en"`); continue; }
    if (posLayout) {
      const [, , pos, example, exampleEn] = fields;
      notes.push({
        es, en,
        example: example || undefined,
        exampleEn: exampleEn || undefined,
        tags: pos ? [pos.toLowerCase()] : [],
      });
    } else {
      const [, , example, exampleEn, tags] = fields;
      notes.push({
        es, en,
        example: example || undefined,
        exampleEn: exampleEn || undefined,
        tags: tags ? tags.split(';').map((t) => t.trim()).filter(Boolean) : [],
      });
    }
  }
  return { notes, errors };
}

// One entry per line: 'es — en', 'es - en', or 'es<TAB>en'. Blank lines and #comments skipped.
export function parseTxt(text: string): ImportResult {
  const notes: ParsedNote[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    // Prefer tab, then em/en dash, then a hyphen surrounded by spaces (so 'fin de semana - weekend' works)
    let parts: string[];
    if (trimmed.includes('\t')) parts = trimmed.split('\t');
    else if (/[—–]/.test(trimmed)) parts = trimmed.split(/[—–]/);
    else parts = trimmed.split(/\s-\s/);
    if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
      errors.push(`line ${i + 1}: expected "es — en"`);
      return;
    }
    notes.push({ es: parts[0].trim(), en: parts.slice(1).join(' ').trim(), tags: [] });
  });
  return { notes, errors };
}

// RFC-4180-ish single-line splitter. Returns null on an unterminated quote.
function splitCsvLine(line: string): string[] | null {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  if (inQuotes) return null;
  out.push(cur);
  return out;
}

function dedupe(result: ImportResult): ImportResult {
  const seen = new Set<string>();
  const notes = result.notes.filter((n) => {
    const key = normalizeSpanish(n.es);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { notes, errors: result.errors };
}
