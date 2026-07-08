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

// es,en[,example[,exampleEn[,tags(semicolon-separated)]]] — RFC-4180 quoted fields;
// a first line that looks like a header (starts with es,en / spanish,english) is skipped.
export function parseCsv(text: string): ImportResult {
  const notes: ParsedNote[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    if (i === 0 && /^\s*(es|spanish)\s*,\s*(en|english)\b/i.test(line)) return; // header
    const fields = splitCsvLine(line);
    if (fields === null) { errors.push(`line ${i + 1}: unterminated quote`); return; }
    const [es, en, example, exampleEn, tags] = fields.map((f) => f.trim());
    if (!es || !en) { errors.push(`line ${i + 1}: needs at least "es,en"`); return; }
    notes.push({
      es, en,
      example: example || undefined,
      exampleEn: exampleEn || undefined,
      tags: tags ? tags.split(';').map((t) => t.trim()).filter(Boolean) : [],
    });
  });
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
