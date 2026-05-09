'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { Icons } from '@/components/ui/icons';
import { Segmented } from '@/components/settings/segmented';
import { Toggle } from '@/components/settings/toggle';
import { FOCUSES } from '@/lib/data';

const STATS = [
  ['Level', 'B1', 'last tested Apr 14'],
  ['Lessons', '12', 'since Apr 7'],
  ['Streak', '5 days', 'best 11'],
  ['Total speaking', '4h 32m', 'avg 22 min'],
];

function SettingGroup({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
        <h3 style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, fontSize: 22 }}>{title}</h3>
        {sub && <p className="small" style={{ marginTop: 6, maxWidth: 520 }}>{sub}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingRow({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <div className="row between" style={{ padding: '18px 0', borderBottom: '1px solid var(--line)', alignItems: 'center', gap: 24 }}>
      <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{label}</span>
      <div>{right}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [showRetest, setShowRetest] = useState(false);

  return (
    <>
      <TopNav />
      <div className="page-narrow fade-in">
        <SectionHead num="01 / Settings" title="Profile and preferences." />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid var(--line)', marginBottom: 48 }}>
          {STATS.map(([k, v, s], i) => (
            <div
              key={k}
              style={{
                padding: 24,
                borderTop: i > 1 ? '1px solid var(--line)' : 'none',
                borderLeft: i % 2 ? '1px solid var(--line)' : 'none',
              }}
            >
              <span className="eyebrow">{k}</span>
              <div className="serif" style={{ fontSize: 32, marginTop: 6 }}>{v}</div>
              <span className="kicker">{s}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-ghost" style={{ marginBottom: showRetest ? 16 : 48 }} onClick={() => setShowRetest(true)}>
          <Icons.refresh /> Retest my level
        </button>

        {showRetest && (
          <div className="card fade-in" style={{ padding: 24, marginBottom: 48, borderColor: 'var(--warm)' }}>
            <span className="eyebrow eyebrow-warm">Retest available</span>
            <p className="body" style={{ marginTop: 8, marginBottom: 16 }}>
              Takes ~10 minutes. Your profile and recommendations will update.
            </p>
            <div className="row gap-2">
              <button className="btn btn-warm btn-sm" onClick={() => { setShowRetest(false); router.push('/level-test'); }}>
                Start retest
              </button>
              <button className="btn btn-text btn-sm" onClick={() => setShowRetest(false)}>Cancel</button>
            </div>
          </div>
        )}

        <SettingGroup
          title="Dialect"
          sub="What kind of Spanish you're learning. Argentine is the default and the recommended target."
        >
          <SettingRow
            label="Target Spanish"
            right={
              <select className="select-field" style={{ width: 280 }} defaultValue="rio">
                <option value="rio">Rioplatense / Argentine</option>
                <option value="latam" disabled>Neutral Latin American · soon</option>
                <option value="es" disabled>Spain · soon</option>
                <option value="mx" disabled>Mexico · soon</option>
              </select>
            }
          />
        </SettingGroup>

        <SettingGroup title="Lesson behavior">
          <SettingRow
            label="Explanation depth during lessons"
            right={<Segmented options={['Minimal', 'Moderate', 'Detailed']} value="Minimal" />}
          />
          <SettingRow
            label="Default lesson length"
            right={<Segmented options={['10', '15', '25', '40']} value="25" suffix=" min" />}
          />
          <SettingRow
            label="Default difficulty"
            right={<Segmented options={['Easier', 'Normal', 'Harder']} value="Normal" />}
          />
          <SettingRow
            label="Default focus"
            right={
              <select className="select-field" style={{ width: 280 }} defaultValue="recent">
                {FOCUSES.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            }
          />
          <SettingRow
            label="Correction strictness"
            right={<Segmented options={['Lenient', 'Standard', 'Strict']} value="Standard" />}
          />
        </SettingGroup>

        <SettingGroup title="Audio">
          <SettingRow
            label="Default voice"
            right={
              <select className="select-field" style={{ width: 280 }} defaultValue="lucia">
                <option value="lucia">Lucía · Buenos Aires, female, 30s</option>
                <option value="diego">Diego · Rosario, male, 40s</option>
                <option value="vale">Valentina · Córdoba, female, 20s</option>
              </select>
            }
          />
          <SettingRow
            label="Playback speed"
            right={<Segmented options={['0.85×', '1.0×', '1.1×', '1.25×']} value="1.0×" />}
          />
          <SettingRow
            label="Replay speed"
            right={<Segmented options={['0.7×', '0.85×', '1.0×']} value="0.85×" />}
          />
          <SettingRow label="Show transcript by default" right={<Toggle value={false} />} />
          <SettingRow label="Show translation by default" right={<Toggle value={false} />} />
        </SettingGroup>

        <SettingGroup title="Account">
          <SettingRow label="Email" right={<span className="small mono">mateo@example.com</span>} />
          <SettingRow
            label="Export your data"
            right={<button className="btn btn-text small">Export JSON</button>}
          />
          <SettingRow
            label="Reset profile"
            right={
              <button className="btn btn-text small" style={{ color: 'var(--crit)' }}>
                Reset everything
              </button>
            }
          />
        </SettingGroup>
      </div>
    </>
  );
}
