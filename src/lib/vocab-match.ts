// Advisory STT matching for recall (speak) cards: did the learner say the target word?
// Never used to auto-grade — only to show a Match / Not-quite hint.

// Lowercase → strip ALL diacritics (ñ→n too — symmetric on both sides, so 'manana'
// matches 'mañana') → strip punctuation (incl. ¿¡) → collapse whitespace.
export function normalizeSpanish(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿¡?!.,;:'"«»“”‘’()\-—–…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ARTICLES = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'];

function dropLeadingArticle(normalized: string): string {
  const space = normalized.indexOf(' ');
  if (space === -1) return normalized;
  const first = normalized.slice(0, space);
  return ARTICLES.includes(first) ? normalized.slice(space + 1) : normalized;
}

// True when the heard text equals the target after normalization, tolerating a
// missing/extra leading article on either side ('colectivo' ⇔ 'el colectivo').
export function matchesAnswer(heard: string, targetEs: string): boolean {
  const h = normalizeSpanish(heard);
  const t = normalizeSpanish(targetEs);
  if (!h || !t) return false;
  if (h === t) return true;
  return dropLeadingArticle(h) === dropLeadingArticle(t);
}
