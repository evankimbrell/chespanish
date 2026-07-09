// Shared-passcode gate page. Plain server-rendered form (no client JS) posting to
// /api/gate, which sets the year-long cookie and bounces back to ?next=.
export default async function GatePage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = '/', error } = await searchParams;
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="card" style={{ padding: 36, maxWidth: 420, width: '100%' }}>
        <span className="eyebrow eyebrow-warm">Che Spanish · private beta</span>
        <h1 className="serif" style={{ fontSize: 32, fontStyle: 'italic', margin: '10px 0 6px' }}>¿Contraseña?</h1>
        <p className="small" style={{ color: 'var(--mute)', marginBottom: 20 }}>
          Enter the access code Evan gave you. One time per browser.
        </p>
        <form method="POST" action="/api/gate" className="col gap-3">
          <input type="hidden" name="next" value={next} />
          <input
            type="password"
            name="code"
            autoFocus
            placeholder="Access code"
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4,
              padding: '12px 14px', color: 'var(--ink)', fontSize: 16, width: '100%',
            }}
          />
          <button className="btn btn-primary" type="submit">Enter</button>
        </form>
        {error && (
          <p className="small" style={{ color: 'var(--crit)', marginTop: 14, marginBottom: 0 }}>
            That code didn&rsquo;t match — try again.
          </p>
        )}
      </div>
    </div>
  );
}
