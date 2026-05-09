// components.jsx — shared primitives + nav

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// — Icons (sparingly used) —
const Icon = {
  play: (p={}) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><path d="M3 2.5L11.5 7L3 11.5V2.5Z" fill="currentColor"/></svg>,
  pause: (p={}) => <svg width="12" height="14" viewBox="0 0 12 14" fill="none" {...p}><rect x="1" y="2" width="3.5" height="10" fill="currentColor"/><rect x="7.5" y="2" width="3.5" height="10" fill="currentColor"/></svg>,
  mic: (p={}) => <svg width="20" height="22" viewBox="0 0 20 22" fill="none" {...p}><rect x="7" y="2" width="6" height="11" rx="3" fill="currentColor"/><path d="M3 11C3 14.866 6.13401 18 10 18C13.866 18 17 14.866 17 11" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M10 18V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  arrow: (p={}) => <svg width="14" height="10" viewBox="0 0 14 10" fill="none" {...p}><path d="M1 5H13M13 5L9 1M13 5L9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  arrowLeft: (p={}) => <svg width="14" height="10" viewBox="0 0 14 10" fill="none" {...p}><path d="M13 5H1M1 5L5 1M1 5L5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  check: (p={}) => <svg width="12" height="10" viewBox="0 0 12 10" fill="none" {...p}><path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x: (p={}) => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...p}><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  dots: (p={}) => <svg width="14" height="4" viewBox="0 0 14 4" fill="none" {...p}><circle cx="2" cy="2" r="1.4" fill="currentColor"/><circle cx="7" cy="2" r="1.4" fill="currentColor"/><circle cx="12" cy="2" r="1.4" fill="currentColor"/></svg>,
  refresh: (p={}) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><path d="M12 7C12 9.76 9.76 12 7 12C4.7 12 2.78 10.45 2.21 8.36M2 7C2 4.24 4.24 2 7 2C9.3 2 11.22 3.55 11.79 5.64M12 2.5V5.5H9M2 11.5V8.5H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  spark: (p={}) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><path d="M7 1L8.5 5.5L13 7L8.5 8.5L7 13L5.5 8.5L1 7L5.5 5.5L7 1Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/></svg>,
  settings: (p={}) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" fill="none"/><path d="M7 1V3M7 11V13M13 7H11M3 7H1M11.24 2.76L9.83 4.17M4.17 9.83L2.76 11.24M11.24 11.24L9.83 9.83M4.17 4.17L2.76 2.76" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
};

// — Top nav —
function TopNav({ current, go }) {
  const items = [
    { id: 'dashboard', label: 'Home' },
    { id: 'finished', label: 'Lessons' },
    { id: 'mistakes', label: 'Mistakes' },
    { id: 'settings', label: 'Settings' },
  ];
  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <div className="brand" onClick={() => go('dashboard')} style={{cursor:'pointer'}}>
          <span className="brand-mark"></span>
          <span>Che <em>Spanish</em></span>
        </div>
        <div className="nav-links">
          {items.map(i => (
            <button key={i.id} className={'nav-link' + (current === i.id || (i.id==='dashboard' && ['dashboard','builder','preview','player','report'].includes(current)) ? ' active':'')} onClick={() => go(i.id)}>{i.label}</button>
          ))}
        </div>
        <div className="nav-right">
          <span className="small mono" style={{color:'var(--mute-2)'}}>B1 · 12 lessons</span>
          <div className="profile-chip" onClick={() => go('settings')}>
            <span className="avatar">M</span>
            <span className="small">Mateo</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

// — Section header —
function SectionHead({ num, title, sub, right }) {
  return (
    <div className="section-head">
      <div className="col gap-2">
        {num && <span className="section-num">{num}</span>}
        <h2 className="h-2">{title}</h2>
        {sub && <p className="small" style={{maxWidth:560,marginTop:4}}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// — Wave (decorative bars) —
function Wave({ playing, count = 28, height = 28 }) {
  const bars = useMemo(() => Array.from({length: count}, (_, i) => 0.35 + Math.abs(Math.sin(i * 0.7)) * 0.65), [count]);
  return (
    <div className={'wave' + (playing ? ' playing':'')} style={{height}}>
      {bars.map((h, i) => (
        <span key={i} style={{height: `${h*100}%`, animationDelay: `${i * 0.04}s`}} />
      ))}
    </div>
  );
}

// — Tag —
function Tag({ kind = 'mute', children }) {
  return <span className={`tag tag-${kind}`}>{children}</span>;
}

// — Footnote tutor strip (used in many places) —
function TutorStrip({ children }) {
  return (
    <div className="row gap-3" style={{alignItems:'center',padding:'10px 14px',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:4}}>
      <span className="mate-icon"></span>
      <span className="small" style={{color:'var(--ink-2)',fontStyle:'italic',fontFamily:'var(--serif)'}}>{children}</span>
    </div>
  );
}

// — Striped placeholder —
function Stripes({ w='100%', h=200, label }) {
  return (
    <div className="placeholder-stripes" style={{width:w,height:h}}>
      {label && <span className="ph-label">{label}</span>}
    </div>
  );
}

// — Animated scrubber bar with markers —
function Scrubber({ progress, markers = [], onSeek }) {
  return (
    <div style={{position:'relative',height:24,cursor:'pointer'}} onClick={(e) => {
      if (!onSeek) return;
      const r = e.currentTarget.getBoundingClientRect();
      onSeek((e.clientX - r.left) / r.width);
    }}>
      <div className="progress" style={{position:'absolute',top:11,left:0,right:0}}>
        <div className="progress-fill" style={{width:`${progress*100}%`}} />
      </div>
      {markers.map((m, i) => (
        <div key={i} title={m.label} style={{position:'absolute',top:6,left:`${m.t*100}%`,width:1,height:12,background: m.t <= progress ? 'var(--ink)' : 'var(--mute-2)'}}/>
      ))}
      <div style={{position:'absolute',top:7,left:`${progress*100}%`,width:10,height:10,borderRadius:'50%',background:'var(--ink)',transform:'translateX(-50%)',boxShadow:'0 0 0 4px rgba(245,241,232,.1)'}}/>
    </div>
  );
}

Object.assign(window, { Icon, TopNav, SectionHead, Wave, Tag, TutorStrip, Stripes, Scrubber });
