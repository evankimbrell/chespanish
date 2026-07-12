import { describe, it, expect } from 'vitest';
import { parseDeckFile, parseCsv, parseTxt, looksLikePos } from './vocab-import';

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

describe('looksLikePos', () => {
  it('recognizes single and compound POS labels in both languages', () => {
    expect(looksLikePos('preposition')).toBe(true);
    expect(looksLikePos('Noun')).toBe(true);
    expect(looksLikePos('noun/verb')).toBe(true);
    expect(looksLikePos('connector')).toBe(true);
    expect(looksLikePos('sustantivo')).toBe(true);
  });
  it('rejects sentences and ordinary words', () => {
    expect(looksLikePos('Soy de Argentina.')).toBe(false);
    expect(looksLikePos('the fridge')).toBe(false);
    expect(looksLikePos('')).toBe(false);
    expect(looksLikePos(undefined)).toBe(false);
  });
});

describe('parseCsv — Anki [es,en,POS,example,exampleEn] layout', () => {
  const anki = [
    'de,of / from,preposition,Soy de Argentina.,I am from Argentina.',
    'donde,where,connector,Este es el lugar donde nos conocimos.,This is the place where we met.',
    'la heladera,fridge,noun,La heladera está rota.,The fridge is broken.',
  ].join('\n');

  it('routes the POS to tags and keeps the example pair aligned', () => {
    const { notes, errors } = parseCsv(anki);
    expect(errors).toEqual([]);
    expect(notes[0]).toEqual({
      es: 'de', en: 'of / from',
      example: 'Soy de Argentina.', exampleEn: 'I am from Argentina.',
      tags: ['preposition'],
    });
    expect(notes[1].tags).toEqual(['connector']);
    expect(notes[1].example).toBe('Este es el lugar donde nos conocimos.');
  });

  it('leaves the standard [es,en,example,exampleEn,tags] layout untouched', () => {
    const { notes } = parseCsv('el subte,subway,Tomá el subte hasta Palermo.,Take the subway to Palermo.,transport;noun');
    expect(notes[0].example).toBe('Tomá el subte hasta Palermo.');
    expect(notes[0].tags).toEqual(['transport', 'noun']);
  });

  it('majority vote: a single odd row follows the file-level layout', () => {
    const mixed = anki + '\n' + 'che,hey,VERY unusual entry,x,y';
    const { notes } = parseCsv(mixed);
    // 3 of 4 rows look like POS → whole file parses as the Anki layout
    expect(notes[3].tags).toEqual(['very unusual entry']);
  });
});
