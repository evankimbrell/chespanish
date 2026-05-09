'use client';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/ui/top-nav';
import { SectionHead } from '@/components/ui/section-head';
import { Wave } from '@/components/ui/wave';
import { Icons } from '@/components/ui/icons';
import { TENES_EXAMPLES } from '@/lib/data';

const PATTERN = [
  ['tener', 'tenés'], ['querer', 'querés'], ['poder', 'podés'],
  ['venir', 'venís'], ['decir', 'decís'],   ['saber', 'sabés'],
];

export default function MistakeDetailPage() {
  const router = useRouter();

  return (
    <>
      <TopNav />
      <div className="page-narrow fade-in">
        <button className="btn btn-text small" style={{ paddingLeft: 0, marginBottom: 12 }} onClick={() => router.push('/mistakes')}>
          <Icons.arrowLeft /> All mistakes
        </button>

        <span className="eyebrow eyebrow-warm">Conjugation · 14 misses</span>
        <h1 className="ty-h1" style={{ marginTop: 14, marginBottom: 24 }}>
          Vos:{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--warm)' }}>tenés</em>{' '}
          vs{' '}
          <em style={{ fontStyle: 'italic', textDecoration: 'line-through', textDecorationColor: 'var(--mute-2)' }}>tienes</em>.
        </h1>

        <p className="lede" style={{ maxWidth: 640, marginBottom: 40 }}>
          In Argentine Spanish, people use <span className="serif" style={{ fontStyle: 'italic' }}>vos</span>{' '}
          instead of <span className="serif" style={{ fontStyle: 'italic' }}>tú</span>. So &ldquo;you have&rdquo; is usually{' '}
          <span className="serif" style={{ fontStyle: 'italic' }}>vos tenés</span>, not{' '}
          <span className="serif" style={{ fontStyle: 'italic' }}>tú tienes</span>. This is not slang — it&rsquo;s the normal everyday form.
        </p>

        {/* Target vs less Argentine */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid var(--line)', marginBottom: 48 }}>
          <div style={{ padding: '28px 28px', background: 'var(--bg-2)' }}>
            <span className="eyebrow eyebrow-warm">Target · Argentine</span>
            <p className="serif" style={{ fontSize: 32, fontStyle: 'italic', marginTop: 14 }}>&ldquo;¿Tenés tiempo?&rdquo;</p>
            <p className="small" style={{ marginTop: 6 }}>What you&rsquo;ll hear in BA, Mendoza, Rosario.</p>
          </div>
          <div style={{ padding: '28px 28px', borderLeft: '1px solid var(--line)' }}>
            <span className="eyebrow">Less Argentine</span>
            <p className="serif" style={{ fontSize: 32, fontStyle: 'italic', marginTop: 14, color: 'var(--mute)' }}>&ldquo;¿Tienes tiempo?&rdquo;</p>
            <p className="small" style={{ marginTop: 6 }}>Understandable, but immediately marks you as not local.</p>
          </div>
        </div>

        <SectionHead title="Hear it in context" right={<button className="btn btn-text small"><Icons.play /> Play all</button>} />
        <div className="col" style={{ border: '1px solid var(--line)', marginBottom: 48 }}>
          {TENES_EXAMPLES.map((e, i) => (
            <div key={i} className="row gap-4 card-hover" style={{ padding: '14px 20px', borderTop: i ? '1px solid var(--line)' : 'none', alignItems: 'center' }}>
              <button className="btn btn-icon btn-ghost" style={{ width: 32, height: 32 }}><Icons.play /></button>
              <span className="mono" style={{ fontSize: 11, color: 'var(--mute-2)', width: 28 }}>{String(i + 1).padStart(2, '0')}</span>
              <span className="serif" style={{ fontSize: 20, fontStyle: 'italic', flex: 1 }}>&ldquo;{e}&rdquo;</span>
              <Wave count={20} height={16} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 48 }}>
          <div>
            <span className="eyebrow">Pattern</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 13 }}>
              <tbody>
                {PATTERN.map(([a, b]) => (
                  <tr key={a}>
                    <td style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', color: 'var(--mute)' }}>{a}</td>
                    <td style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', textAlign: 'right', color: 'var(--warm)' }}>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <span className="eyebrow">Why it matters</span>
            <p className="lede" style={{ marginTop: 14, fontSize: 18, lineHeight: 1.5, maxWidth: 480 }}>
              You&rsquo;ll hear &ldquo;tenés&rdquo; constantly in Argentina. Saying &ldquo;tienes&rdquo; is grammatically fine but immediately marks you as not from here. Once it&rsquo;s automatic, the rest of{' '}
              <span className="serif" style={{ fontStyle: 'italic' }}>vos</span> conjugation falls into place.
            </p>
            <div className="row gap-2" style={{ marginTop: 16 }}>
              <button className="chip">Short explanation</button>
              <button className="chip selected">Medium</button>
              <button className="chip">Deep dive</button>
            </div>
          </div>
        </div>

        <div className="row gap-3" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-warm" onClick={() => router.push('/player')}><Icons.spark /> Generate short drill · 5 min</button>
          <button className="btn btn-ghost" onClick={() => router.push('/builder')}>Generate medium drill · 12 min</button>
          <button className="btn btn-ghost">Add to next lesson</button>
          <button className="btn btn-text" style={{ marginLeft: 'auto' }}>Test me on this <Icons.arrow /></button>
        </div>
      </div>
    </>
  );
}
