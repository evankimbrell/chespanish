'use client';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { TutorStrip } from '@/components/ui/tutor-strip';
import { Icons } from '@/components/ui/icons';
import { ChooseChip } from '@/components/builder/choose-chip';
import { DifficultySlider } from '@/components/builder/difficulty-slider';
import { useAppStore } from '@/lib/store';
import { SCENARIOS, FOCUSES, RECENT_MISTAKES, GRAMMAR_TOPICS } from '@/lib/data';

function offsetToLevel(n: number) { return n >= 0 ? `B1.${n}` : `A2.${10 + n}`; }
function offsetLabel(n: number)   { return n <= -2 ? 'Easier' : n >= 2 ? 'Harder' : 'Normal'; }
function offsetDesc(n: number) {
  if (n <= -2) return 'Slower audio, shorter sentences, lots of repetition.';
  if (n === -1) return 'Slightly slower, gentler scaffolding.';
  if (n === 0)  return 'Matched to your current B1 profile.';
  if (n === 1)  return 'Slightly faster, less hand-holding.';
  return 'Faster audio, longer prompts, less scaffolding.';
}

export default function BuilderPage() {
  const router = useRouter();
  const builder = useAppStore((s) => s.builder);
  const setBuilder = useAppStore((s) => s.setBuilder);

  const set = <K extends keyof typeof builder>(k: K, v: typeof builder[K]) => setBuilder({ [k]: v } as Partial<typeof builder>);
  const toggleMistake = (id: string) =>
    set('mistakes', builder.mistakes.includes(id) ? builder.mistakes.filter((x) => x !== id) : [...builder.mistakes, id]);

  const showMistakes = builder.focus === 'recent' || builder.focus === 'common';
  const showGrammar  = builder.focus === 'grammar';

  const scenarioLabel = builder.scenario === 'auto' ? 'Choose for me' : (SCENARIOS.find((s) => s.id === builder.scenario)?.label ?? '—');
  const focusLabel    = builder.focus    === 'auto' ? 'Choose for me' : (FOCUSES.find((f) => f.id === builder.focus)?.label    ?? '—');

  return (
    <>
      <TopNav />
      <div className="page fade-in">
        <button className="btn btn-text small" style={{ marginBottom: 8, paddingLeft: 0 }} onClick={() => router.push('/dashboard')}>
          <Icons.arrowLeft /> Dashboard
        </button>
        <SectionHead num="01 / Builder" title="Build today's lesson." sub="Each control narrows what your tutor will generate. The custom prompt can override anything else." />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48, alignItems: 'start' }}>
          <div className="col gap-10">

            {/* Scenario */}
            <div>
              <span className="label">Scenario</span>
              <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
                <ChooseChip selected={builder.scenario === 'auto'} onClick={() => set('scenario', 'auto')} />
                {SCENARIOS.map((s) => (
                  <button key={s.id} className={'chip chip-square' + (builder.scenario === s.id ? ' selected' : '')} onClick={() => set('scenario', s.id)}>{s.label}</button>
                ))}
              </div>
            </div>

            {/* Focus */}
            <div>
              <span className="label">Focus</span>
              <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
                <ChooseChip selected={builder.focus === 'auto'} onClick={() => set('focus', 'auto')} />
                {FOCUSES.map((f) => (
                  <button key={f.id} className={'chip chip-square chip-warm' + (builder.focus === f.id ? ' selected' : '')} onClick={() => set('focus', f.id)}>{f.label}</button>
                ))}
              </div>
            </div>

            {/* Conditional: mistakes */}
            {showMistakes && (
              <div className="fade-in">
                <span className="label">Pick mistakes to drill</span>
                <div className="col" style={{ border: '1px solid var(--line)', borderRadius: 4 }}>
                  {RECENT_MISTAKES.map((m, i) => (
                    <label key={m.id} className="row gap-3" style={{ padding: '14px 18px', borderTop: i ? '1px solid var(--line)' : 'none', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={builder.mistakes.includes(m.id)} onChange={() => toggleMistake(m.id)} style={{ accentColor: 'var(--warm)', width: 16, height: 16 }} />
                      <div className="col" style={{ flex: 1 }}>
                        <span style={{ fontSize: 14 }}>{m.label}</span>
                        <span className="kicker">{m.count}× · last {m.last}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Conditional: grammar */}
            {showGrammar && (
              <div className="fade-in">
                <span className="label">Grammar targets</span>
                <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                  <ChooseChip
                    selected={builder.grammar.includes('__auto__')}
                    onClick={() => set('grammar', builder.grammar.includes('__auto__') ? [] : ['__auto__'])}
                  />
                  {GRAMMAR_TOPICS.map((g) => (
                    <button key={g} className={'chip' + (builder.grammar.includes(g) ? ' selected' : '')} onClick={() => {
                      const cleaned = builder.grammar.filter((x) => x !== '__auto__');
                      set('grammar', cleaned.includes(g) ? cleaned.filter((x) => x !== g) : [...cleaned, g]);
                    }}>{g}</button>
                  ))}
                </div>
                <p className="small" style={{ marginTop: 12, fontStyle: 'italic', fontFamily: 'var(--font-newsreader), serif', fontSize: 14 }}>
                  Grammar appears as practical speaking moments — not drills with rules on a page.
                </p>
              </div>
            )}

            {/* Difficulty + length */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32 }}>
              <div>
                <span className="label">Difficulty · base level B1</span>
                <DifficultySlider
                  value={builder.diffOffset}
                  onChange={(v) => set('diffOffset', v as typeof builder.diffOffset)}
                  levelOf={offsetToLevel}
                  labelOf={offsetLabel}
                />
                <span className="small" style={{ marginTop: 10, display: 'block' }}>{offsetDesc(builder.diffOffset)}</span>
              </div>
              <div>
                <span className="label">Length</span>
                <div className="row" style={{ border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                  {([10, 15, 25, 40] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => set('length', n)}
                      style={{
                        flex: 1, padding: '12px 0',
                        background: n === builder.length ? 'var(--ink)' : 'transparent',
                        color: n === builder.length ? '#100e0c' : 'var(--ink-2)',
                        border: 0, borderLeft: n !== 10 ? '1px solid var(--line)' : 0,
                        cursor: 'pointer', fontSize: 13, fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {n} min
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom prompt */}
            <div>
              <span className="label">Custom instruction · optional</span>
              <textarea
                className="textarea"
                placeholder={'E.g. "I\'m at a bar watching Boca play and I want to make small talk with people around me." or "I need to tell my landlord that the hot water stopped working."'}
                value={builder.custom}
                onChange={(e) => set('custom', e.target.value)}
              />
              <p className="small" style={{ marginTop: 8, fontStyle: 'italic', fontFamily: 'var(--font-newsreader), serif', fontSize: 14 }}>
                Custom prompts override or supplement the choices above.
              </p>
            </div>
          </div>

          {/* Summary rail */}
          <aside style={{ position: 'sticky', top: 120 }}>
            <div className="card" style={{ padding: 24 }}>
              <span className="eyebrow">Lesson summary</span>
              <h3 className="h-3" style={{ marginTop: 14, marginBottom: 18 }}>
                {builder.custom ? 'Custom-shaped lesson' : `${scenarioLabel} · ${focusLabel}`}
              </h3>
              <div className="col gap-3">
                {[
                  ['Level',    `${offsetToLevel(builder.diffOffset)} · ${offsetLabel(builder.diffOffset)}`],
                  ['Length',   `${builder.length} minutes`],
                  ['Scenario', scenarioLabel],
                  ['Focus',    focusLabel],
                  ...(showMistakes && builder.mistakes.length ? [['Mistakes', `${builder.mistakes.length} selected`]] : []),
                  ...(showGrammar  && builder.grammar.length  ? [['Grammar',  `${builder.grammar.length} selected`]]  : []),
                ].map(([k, v]) => (
                  <div key={k} className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                    <span className="small">{k}</span>
                    <span className="small" style={{ color: 'var(--ink)', fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 12 }}>{v}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 24 }} onClick={() => router.push('/preview')}>
                <Icons.spark /> Generate lesson
              </button>
              <p className="small" style={{ marginTop: 10, textAlign: 'center', color: 'var(--mute-2)' }}>~3 sec · personalized to your profile</p>
            </div>
            <TutorStrip>Lessons get more useful the more you talk. Even a generic scenario will adapt to you.</TutorStrip>
          </aside>
        </div>
      </div>
    </>
  );
}
