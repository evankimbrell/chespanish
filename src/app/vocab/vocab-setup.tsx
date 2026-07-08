'use client';
import { useRef, useState } from 'react';
import { Icons } from '@/components/ui/icons';
import { Tag } from '@/components/ui/tag';

interface ImportPreview {
  deckId: string;
  noteCount: number;
  sample: string[];
  errors: string[];
}

// First-run setup (also reachable later via "+ Add / upload deck"): auto-generate a
// personalized starter deck via GPT, or import a CSV/TXT list. (.apkg deferred.)
export function VocabSetup({ userName, hasDecks, onDone, onBack }: {
  userName: string;
  hasDecks: boolean;
  onDone: () => void;
  onBack?: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploaded, setUploaded] = useState<ImportPreview & { filename: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const generate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/vocab/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName }),
      });
      const data = await res.json();
      if (!res.ok || !data.decks) throw new Error(data.error ?? 'generation failed');
      onDone();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
      setGenerating(false);
    }
  };

  // The file is read client-side and sent as text — server parses CSV/TXT.
  const handleFile = (file: File) => {
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setImportError('Only .csv and .txt files are supported for now.');
      return;
    }
    setImportError(null);
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/vocab/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: userName, filename: file.name, content: String(reader.result ?? '') }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.errors?.[0] ?? data.error ?? 'import failed');
        setUploaded({ ...data, filename: file.name });
      } catch (e) {
        setImportError(e instanceof Error ? e.message : String(e));
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="page-narrow fade-in" style={{ maxWidth: 840 }}>
      {onBack && (
        <button className="btn btn-text small" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={onBack}>
          <Icons.arrowLeft /> Back to Vocab
        </button>
      )}
      <span className="eyebrow">{hasDecks ? 'Vocab · add a deck' : 'Vocab · first time'}</span>
      <h1 className="ty-h1" style={{ marginTop: 14, marginBottom: 18 }}>
        Build your <em style={{ fontStyle: 'italic', color: 'var(--warm)' }}>vocabulary</em> deck.
      </h1>
      <p className="lede" style={{ maxWidth: 600, marginBottom: 48 }}>
        Spaced repetition, tuned for speaking. Cards resurface right before you&rsquo;d forget them — and
        recall cards make you say the word out loud, not just recognize it.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>
        {/* Decide for me */}
        <div className="card col" style={{ padding: 32, borderColor: 'var(--warm)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle,rgba(212,165,116,.14),transparent 70%)' }} />
          <span className="eyebrow eyebrow-warm"><Icons.spark /> Recommended</span>
          <h2 className="ty-h3" style={{ marginTop: 14, marginBottom: 12 }}>Decide for me.</h2>
          <p className="body" style={{ flex: 1 }}>
            We build a starter deck from your level, your lessons, and the words you&rsquo;ve already fumbled.
            High-frequency Buenos Aires vocabulary first — <span className="serif" style={{ fontStyle: 'italic' }}>colectivo, heladera, laburo</span> — not textbook words.
          </p>
          <ul style={{ margin: '18px 0 24px', padding: 0, listStyle: 'none' }}>
            {[['~120', 'core words for your level'], ['auto', 'from your lesson mistakes'], ['40', 'lunfardo & casual speech']].map(([n, t]) => (
              <li key={t} className="row gap-3" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', alignItems: 'baseline' }}>
                <span className="mono" style={{ color: 'var(--warm)', width: 42, fontSize: 13 }}>{n}</span>
                <span className="small" style={{ color: 'var(--ink-2)' }}>{t}</span>
              </li>
            ))}
          </ul>
          {genError && <p className="small" style={{ color: 'var(--crit)', marginBottom: 12 }}>Couldn&rsquo;t build the deck: {genError}</p>}
          <button className="btn btn-warm" disabled={generating} onClick={generate}>
            {generating ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Building your deck — about a minute…</> : <><Icons.spark /> Build my deck</>}
          </button>
        </div>

        {/* Upload */}
        <div className="card-flat col" style={{ padding: 32 }}>
          <span className="eyebrow">Bring your own</span>
          <h2 className="ty-h3" style={{ marginTop: 14, marginBottom: 12 }}>Upload a deck.</h2>
          <p className="body">Import a CSV (<span className="mono" style={{ fontSize: 12 }}>es,en[,example,exampleEn,tags]</span>) or a plain list (<span className="mono" style={{ fontSize: 12 }}>es — en</span> per line).</p>

          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

          {!uploaded ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              style={{ flex: 1, minHeight: 150, marginTop: 20, marginBottom: 24, border: `1.5px dashed ${dragging ? 'var(--warm)' : 'var(--line-2)'}`, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', background: dragging ? 'rgba(212,165,116,.05)' : 'transparent', transition: 'all .15s' }}
            >
              {importing ? (
                <span className="spinner" style={{ width: 20, height: 20 }} />
              ) : (
                <>
                  <span className="mono" style={{ fontSize: 11, letterSpacing: '.1em', color: dragging ? 'var(--warm)' : 'var(--mute)' }}>DROP .CSV / .TXT</span>
                  <span className="small" style={{ color: 'var(--mute-2)' }}>or click to browse</span>
                </>
              )}
            </div>
          ) : (
            <div className="fade-in" style={{ flex: 1, marginTop: 20, marginBottom: 24, border: '1px solid var(--line)', borderRadius: 6, padding: '16px 18px' }}>
              <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>{uploaded.filename}</span>
                <Tag kind="leaf">{uploaded.noteCount} cards parsed</Tag>
              </div>
              {uploaded.sample.map((s, i) => (
                <div key={i} className="small" style={{ padding: '6px 0', borderTop: '1px solid var(--line)', fontFamily: 'var(--font-newsreader), serif', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)' }}>{s}</div>
              ))}
              {uploaded.noteCount > 3 && <span className="kicker" style={{ display: 'block', marginTop: 8 }}>+ {uploaded.noteCount - 3} more</span>}
              {uploaded.errors.length > 0 && (
                <span className="small" style={{ display: 'block', marginTop: 8, color: 'var(--warm)' }}>{uploaded.errors.length} line(s) skipped</span>
              )}
            </div>
          )}
          {importError && <p className="small" style={{ color: 'var(--crit)', marginBottom: 12 }}>{importError}</p>}
          <button className="btn btn-ghost" disabled={!uploaded} onClick={onDone}>Use this deck <Icons.arrow /></button>
        </div>
      </div>

      <p className="small" style={{ marginTop: 28, textAlign: 'center', color: 'var(--mute-2)' }}>
        You can add, merge, or upload more decks any time from the Vocab home.
      </p>
    </div>
  );
}
