import { describe, it, expect } from 'vitest';
import { VOICE_CATALOG, activeVoiceId, SPANISH_MALE_VOICE_ID, SPANISH_FEMALE_VOICE_ID, NARRATOR_VOICE_ID } from './voices';

describe('voice catalog', () => {
  it('uses Carlos as the active male Spanish voice', () => {
    expect(SPANISH_MALE_VOICE_ID).toBe('gBTPbHzRd0ZmV75Z5Zk4');
    expect(activeVoiceId('spanish-male')).toBe('gBTPbHzRd0ZmV75Z5Zk4');
    const carlos = VOICE_CATALOG.find((v) => v.name === 'Carlos');
    expect(carlos).toMatchObject({ id: 'gBTPbHzRd0ZmV75Z5Zk4', role: 'spanish-male', active: true });
  });

  it('retains Facundo (inactive) for future user voice-switching', () => {
    const facundo = VOICE_CATALOG.find((v) => v.name === 'Facundo');
    expect(facundo).toBeDefined();
    expect(facundo).toMatchObject({ id: 'qnvusyIjzlSoWYJ0C2Nm', role: 'spanish-male', active: false });
  });

  it('resolves the female and narrator roles', () => {
    expect(SPANISH_FEMALE_VOICE_ID).toBe('1WXz8v08ntDcSTeVXMN2');
    expect(NARRATOR_VOICE_ID).toBe('nzFihrBIvB34imQBuxub');
  });

  it('has exactly one active voice per role', () => {
    for (const role of ['spanish-male', 'spanish-female', 'narrator'] as const) {
      expect(VOICE_CATALOG.filter((v) => v.role === role && v.active)).toHaveLength(1);
    }
  });
});
