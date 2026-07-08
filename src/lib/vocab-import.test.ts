import { describe, it, expect } from 'vitest';
import { parseDeckFile, parseCsv, parseTxt } from './vocab-import';

describe('parseCsv', () => {
  it('parses 2-column and 5-column rows', () => {
    const { notes, errors } = parseCsv(
      'la vereda,the sidewalk\n' +
      'el colectivo,the city bus,Me tomé el colectivo.,I took the bus.,noun;transport\n',
    );
    expect(errors).toEqual([]);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toEqual({ es: 'la vereda', en: 'the sidewalk', example: undefined, exampleEn: undefined, tags: [] });
    expect(notes[1]).toMatchObject({ es: 'el colectivo', example: 'Me tomé el colectivo.', tags: ['noun', 'transport'] });
  });

  it('handles quoted fields containing commas and escaped quotes', () => {
    const { notes } = parseCsv('"che, boludo","hey, dude","Dijo ""che"" fuerte."');
    expect(notes[0]).toMatchObject({ es: 'che, boludo', en: 'hey, dude', example: 'Dijo "che" fuerte.' });
  });

  it('skips a header row and comment/blank lines', () => {
    const { notes } = parseCsv('es,en,example\n# comment\n\nla plata,money\n');
    expect(notes).toHaveLength(1);
  });

  it('reports malformed lines as errors without throwing', () => {
    const { notes, errors } = parseCsv('solo-una-columna\n"unterminated,quote\nla plata,money');
    expect(notes).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });
});

describe('parseTxt', () => {
  it('parses em-dash, hyphen, and tab separators', () => {
    const { notes, errors } = parseTxt('la vereda — the sidewalk\nel laburo - work (casual)\nla guita\tmoney');
    expect(errors).toEqual([]);
    expect(notes.map((n) => n.es)).toEqual(['la vereda', 'el laburo', 'la guita']);
  });
  it('keeps hyphenated Spanish intact (only splits on spaced hyphens)', () => {
    const { notes } = parseTxt('el fin de semana - the weekend');
    expect(notes[0]).toMatchObject({ es: 'el fin de semana', en: 'the weekend' });
  });
  it('errors on lines without a separator', () => {
    const { errors } = parseTxt('no separator here');
    expect(errors).toHaveLength(1);
  });
});

describe('parseDeckFile', () => {
  it('routes by extension and dedupes by normalized es', () => {
    const { notes } = parseDeckFile('la plata,money\nLa Pláta,cash', 'deck.csv');
    expect(notes).toHaveLength(1);
  });
  it('treats non-csv as txt', () => {
    const { notes } = parseDeckFile('che — hey', 'words.txt');
    expect(notes[0].es).toBe('che');
  });
});
