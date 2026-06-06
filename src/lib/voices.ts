// Central catalog of the ElevenLabs voices the app uses. Single source of truth so a
// voice swap happens in one place, and so we retain voices we've moved off of —
// we plan to let users pick their own voice later.

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  language: 'es' | 'en';
  role: 'spanish-male' | 'spanish-female' | 'narrator';
  dialect?: string;
  active: boolean; // currently selected for its role
  note?: string;
}

export const VOICE_CATALOG: VoiceOption[] = [
  {
    id: 'gBTPbHzRd0ZmV75Z5Zk4',
    name: 'Carlos',
    gender: 'male',
    language: 'es',
    role: 'spanish-male',
    dialect: 'rioplatense',
    active: true,
    note: 'Clearer male Spanish voice.',
  },
  {
    id: 'qnvusyIjzlSoWYJ0C2Nm',
    name: 'Facundo',
    gender: 'male',
    language: 'es',
    role: 'spanish-male',
    dialect: 'rioplatense',
    active: false,
    note: 'Previous male Spanish voice; retained for upcoming user voice-switching.',
  },
  {
    id: '1WXz8v08ntDcSTeVXMN2',
    name: 'Spanish female',
    gender: 'female',
    language: 'es',
    role: 'spanish-female',
    dialect: 'rioplatense',
    active: true,
  },
  {
    id: 'nzFihrBIvB34imQBuxub',
    name: 'English narrator',
    gender: 'neutral',
    language: 'en',
    role: 'narrator',
    active: true,
  },
];

// The currently-selected voice id for a role (falls back to any voice for that role).
export function activeVoiceId(role: VoiceOption['role']): string {
  const active = VOICE_CATALOG.find((v) => v.role === role && v.active);
  const id = (active ?? VOICE_CATALOG.find((v) => v.role === role))?.id;
  if (!id) throw new Error(`No voice configured for role "${role}"`);
  return id;
}

export const SPANISH_MALE_VOICE_ID = activeVoiceId('spanish-male');
export const SPANISH_FEMALE_VOICE_ID = activeVoiceId('spanish-female');
export const NARRATOR_VOICE_ID = activeVoiceId('narrator');
