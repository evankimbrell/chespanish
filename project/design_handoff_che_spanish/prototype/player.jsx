// player.jsx — Lesson Player. Default: orb. Variants: editorial, conversation.

const SECTIONS = [
  { id:1, label:'Warm-up review',     pct: 0.00, end:0.12, blurb:'Quick recap of phrases from your last lesson — café and restaurant basics.' },
  { id:2, label:'New phrases',        pct: 0.12, end:0.32, blurb:'Three new patterns: querés, te pinta, voy a + infinitive.' },
  { id:3, label:'Prompt-response',    pct: 0.32, end:0.55, blurb:'Short, fast drills. You hear a cue and respond. Speed matters here.' },
  { id:4, label:'Listening dialogue', pct: 0.55, end:0.74, blurb:'A two-minute exchange between two friends planning a Friday night.' },
  { id:5, label:'Roleplay',           pct: 0.74, end:0.92, blurb:'You play yourself. Tutor plays a friend texting you about plans.' },
  { id:6, label:'Recap',              pct: 0.92, end:1.00, blurb:'Final summary and the three phrases you should walk away with.' },
];

// Sentence-by-sentence transcript (current section)
const SUBTITLE_LINES = [
  '¿Te pinta tomar algo después del laburo?',
  'Yo termino tipo siete y media.',
  'Si querés podemos ir al bar de Defensa, ¿cómo te queda?',
];

// User response with marked-up mistakes for the orb player
const USER_RESPONSE = {
  text: '¿Tienes tiempo mañana? Quieres tomar un café.',
  // Each token: {t:text, kind:'ok'|'wrong'|'correction'}
  tokens: [
    { t:'¿', kind:'ok' },
    { t:'Tienes', kind:'wrong', issue:'Use the vos form: "Tenés".', cat:'Conjugation' },
    { t:'tiempo', kind:'ok' },
    { t:'mañana?', kind:'ok' },
    { t:'Quieres', kind:'wrong', issue:'Use the vos form: "Querés".', cat:'Conjugation' },
    { t:'tomar', kind:'ok' },
    { t:'un', kind:'ok' },
    { t:'café', kind:'ok' },
    { t:'.', kind:'ok' },
  ],
};

function useFakePlayer() {
  const [state, setState] = useState('idle'); // idle | playing | prompting | recording | processing | feedback | asking | answering | complete
  const [progress, setProgress] = useState(0);
  const [promptIdx, setPromptIdx] = useState(0);
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [prevState, setPrevState] = useState('idle');
  const tickRef = useRef();
  const subRef = useRef();

  const play = () => {
    setState('playing');
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setProgress(p => {
        const next = Math.min(1, p + 0.005);
        const cur = LESSON.prompts[promptIdx];
        if (cur && next >= cur.t && p < cur.t) {
          clearInterval(tickRef.current);
          setState('prompting');
          return cur.t;
        }
        if (next >= 1) { clearInterval(tickRef.current); setState('complete'); }
        return next;
      });
    }, 80);
    // Cycle subtitles while playing
    if (subRef.current) clearInterval(subRef.current);
    subRef.current = setInterval(() => setSubtitleIdx(i => (i + 1) % SUBTITLE_LINES.length), 3200);
  };
  const pause = () => { clearInterval(tickRef.current); clearInterval(subRef.current); setState('idle'); };
  const record = () => {
    setState('recording');
    setTimeout(() => { setState('processing'); setTimeout(() => setState('feedback'), 900); }, 2400);
  };
  const next = () => {
    if (promptIdx < LESSON.prompts.length - 1) { setPromptIdx(i => i+1); play(); }
    else { setProgress(1); setState('complete'); }
  };
  const retry = () => setState('prompting');
  const seek = (t) => { setProgress(t); pause(); };
  const ask = () => { setPrevState(state); clearInterval(tickRef.current); clearInterval(subRef.current); setState('asking'); };
  const submitQuestion = () => {
    setState('answering');
    setTimeout(() => { setState(prevState === 'playing' ? 'idle' : prevState); }, 2200);
  };

  useEffect(() => () => { clearInterval(tickRef.current); clearInterval(subRef.current); }, []);

  return { state, progress, promptIdx, subtitleIdx, play, pause, record, next, retry, seek, ask, submitQuestion };
}

// — Variant: Editorial —
function PlayerEditorial({ p, prompt, go }) {
  const [showText, setShowText] = useState(false);
  return (
    <div className="page-narrow fade-in" style={{maxWidth:920}}>
      <div className="row between" style={{marginBottom:8}}>
        <button className="btn btn-text small" style={{paddingLeft:0}} onClick={() => go('preview')}><Icon.arrowLeft/> Lesson preview</button>
        <span className="kicker">SECTION 03 · PROMPT-RESPONSE</span>
      </div>
      <span className="eyebrow eyebrow-warm">Lesson player</span>
      <h1 className="h-2" style={{marginTop:14,marginBottom:32}}>{LESSON.title}.</h1>
      <Scrubber progress={p.progress} markers={SECTIONS.map(s => ({t:s.pct, label:s.label}))} onSeek={p.seek}/>
      <div style={{marginTop:48,display:'grid',gridTemplateColumns:'auto 1fr',gap:48}}>
        <button className={'btn btn-icon ' + (p.state==='playing'?'btn-ghost':'btn-primary')} style={{width:80,height:80,borderRadius:'50%'}} onClick={p.state==='playing' ? p.pause : p.play}>{p.state === 'playing' ? <Icon.pause/> : <Icon.play/>}</button>
        <div className="col gap-3" style={{justifyContent:'center'}}>
          <span className="eyebrow">{p.state === 'prompting' ? 'Respond now' : 'Tutor speaking'}</span>
          <Wave playing={p.state==='playing'} count={64} height={30}/>
          {showText && <p className="serif" style={{fontSize:24,fontStyle:'italic'}}>“{prompt.cue}”</p>}
          <div className="row gap-3">
            <button className="btn btn-text small" onClick={() => setShowText(s => !s)} style={{padding:0}}>{showText ? 'Hide text' : 'Show text'}</button>
            <button className="btn btn-text small" onClick={p.ask} style={{padding:0}}><Icon.spark/> Ask a question</button>
          </div>
        </div>
      </div>
      {p.state === 'prompting' && <button className="btn btn-warm btn-lg" style={{marginTop:32}} onClick={p.record}><Icon.mic/> Tap to respond</button>}
      {p.state === 'feedback' && <div className="card fade-in" style={{padding:24,marginTop:24}}><Tag kind="warm">● {prompt.status}</Tag> <span className="small">{prompt.note}</span><p className="serif" style={{fontSize:22,fontStyle:'italic',marginTop:10}}>“{prompt.es}”</p><div className="row gap-2" style={{marginTop:14}}><button className="btn btn-ghost btn-sm" onClick={p.retry}>Try again</button><button className="btn btn-primary btn-sm" onClick={p.next}>Continue <Icon.arrow/></button></div></div>}
      {p.state === 'complete' && <div className="card fade-in" style={{padding:32,textAlign:'center',marginTop:40}}><h2 className="h-2">Buen laburo.</h2><button className="btn btn-primary btn-lg" style={{marginTop:18}} onClick={() => go('report')}>See your report <Icon.arrow/></button></div>}
      <AskOverlay p={p}/>
    </div>
  );
}

// — Variant: Conversation —
function PlayerConversation({ p, prompt, go }) {
  return (
    <div className="page-narrow fade-in" style={{maxWidth:760}}>
      <div className="row between" style={{marginBottom:24}}>
        <button className="btn btn-text small" style={{paddingLeft:0}} onClick={() => go('preview')}><Icon.arrowLeft/> Exit lesson</button>
        <span className="kicker">{LESSON.title} · 03 / 06</span>
        <button className="btn btn-text small" onClick={p.ask}><Icon.spark/> Ask</button>
      </div>
      <div className="progress" style={{marginBottom:32}}><div className="progress-fill" style={{width:`${p.progress*100}%`}}/></div>
      <div className="col gap-4">
        <div className="row gap-3" style={{alignItems:'flex-start'}}><span className="brand-mark" style={{marginTop:4}}/><div style={{background:'var(--bg-2)',padding:'14px 18px',borderRadius:'2px 14px 14px 14px',maxWidth:520}}><p className="serif" style={{fontSize:18,fontStyle:'italic',margin:0}}>{prompt.cue}</p></div></div>
        {p.state === 'feedback' && <div className="row gap-3" style={{justifyContent:'flex-end'}}><div style={{background:'var(--ink)',color:'#100e0c',padding:'14px 18px',borderRadius:'14px 2px 14px 14px',maxWidth:520}}><p className="serif" style={{fontSize:18,fontStyle:'italic',margin:0}}>{prompt.userSays}</p></div></div>}
      </div>
      <div style={{position:'sticky',bottom:24,padding:'20px 0',marginTop:24,borderTop:'1px solid var(--line)',background:'var(--bg)'}}>
        {p.state === 'idle' && <button className="btn btn-primary" style={{width:'100%'}} onClick={p.play}><Icon.play/> Start lesson</button>}
        {p.state === 'prompting' && <button className="btn btn-warm" style={{width:'100%'}} onClick={p.record}><Icon.mic/> Hold to respond</button>}
        {p.state === 'feedback' && <button className="btn btn-primary" style={{width:'100%'}} onClick={p.next}>Continue <Icon.arrow/></button>}
        {p.state === 'complete' && <button className="btn btn-primary" style={{width:'100%'}} onClick={() => go('report')}>See your report <Icon.arrow/></button>}
      </div>
      <AskOverlay p={p}/>
    </div>
  );
}

// — Variant: Orb (DEFAULT) —
function PlayerOrb({ p, prompt, go }) {
  const [hoverSection, setHoverSection] = useState(null);
  const [showText, setShowText] = useState(false);
  const [explainToken, setExplainToken] = useState(null);
  const activeSection = SECTIONS.find(s => p.progress >= s.pct && p.progress < s.end) || SECTIONS[0];
  const displaySection = hoverSection != null ? SECTIONS.find(s => s.id === hoverSection) : activeSection;

  return (
    <div style={{minHeight:'calc(100vh - 60px)',display:'flex',flexDirection:'column'}}>
      <div className="page" style={{paddingTop:28,paddingBottom:0,flex:1,display:'flex',flexDirection:'column',maxWidth:1200}}>
        {/* Top bar */}
        <div className="row between" style={{marginBottom:8}}>
          <button className="btn btn-text small" style={{paddingLeft:0}} onClick={() => go('preview')}><Icon.arrowLeft/> Exit lesson</button>
          <div className="col gap-1" style={{textAlign:'center'}}>
            <span className="kicker">{LESSON.title}</span>
            <span className="mono" style={{fontSize:11,color:'var(--mute-2)'}}>{Math.round(p.progress*100)}% · section 0{activeSection.id} of 06</span>
          </div>
          <button className="btn btn-text small" onClick={p.ask}><Icon.spark/> Ask a question</button>
        </div>

        {/* Orb */}
        <div className="col center" style={{flex:1,padding:'24px 0',position:'relative'}}>
          <OrbWithSections
            progress={p.progress}
            sections={SECTIONS}
            prompts={LESSON.prompts}
            active={p.state==='playing' || p.state==='recording'}
            accent={p.state==='recording'}
            hoverSection={hoverSection}
            setHoverSection={setHoverSection}
            onSeek={p.seek}
            state={p.state}
            onPlay={p.play}
            onPause={p.pause}
            onRecord={p.record}
          />
          {/* Section description (when hovering) */}
          <div style={{minHeight:64,maxWidth:560,textAlign:'center',marginTop:18,transition:'opacity .2s', opacity: displaySection ? 1 : 0}}>
            <span className="eyebrow eyebrow-warm">SECTION 0{displaySection?.id} · {displaySection?.label}</span>
            <p className="body" style={{marginTop:8,fontFamily:'var(--serif)',fontStyle:'italic',fontSize:18,color:'var(--ink-2)'}}>{displaySection?.blurb}</p>
          </div>

          {/* Show text button BELOW the orb */}
          <button className="btn btn-ghost btn-sm" style={{marginTop:12}} onClick={() => setShowText(s => !s)}>
            {showText ? 'Hide text' : 'Show text'}
          </button>

          {/* Sentence-by-sentence subtitle */}
          {showText && (
            <div className="fade-in" style={{marginTop:16,padding:'16px 24px',background:'rgba(10,9,8,.7)',backdropFilter:'blur(8px)',border:'1px solid var(--line)',borderRadius:4,maxWidth:680,textAlign:'center'}}>
              <span className="kicker">CC · {p.subtitleIdx + 1} / {SUBTITLE_LINES.length}</span>
              <p className="serif" style={{fontSize:24,fontStyle:'italic',margin:'8px 0 0',lineHeight:1.35}}>“{SUBTITLE_LINES[p.subtitleIdx]}”</p>
            </div>
          )}

          {/* Prompting state: cue */}
          {p.state === 'prompting' && (
            <div className="col gap-3 fade-in" style={{alignItems:'center',marginTop:20,maxWidth:600,textAlign:'center'}}>
              <span className="eyebrow eyebrow-warm">Your turn · respond now</span>
              <p className="serif" style={{fontSize:26,fontStyle:'italic'}}>“{prompt.cue}”</p>
            </div>
          )}

          {/* Feedback state: user response with mistake markers */}
          {p.state === 'feedback' && (
            <div className="fade-in" style={{marginTop:24,maxWidth:720,width:'100%'}}>
              <UserResponseAnalysis tokens={USER_RESPONSE.tokens} target={prompt.es} explainToken={explainToken} setExplainToken={setExplainToken} go={go}/>
              <div className="row gap-2" style={{marginTop:18,justifyContent:'center'}}>
                <button className="btn btn-ghost btn-sm" onClick={p.retry}><Icon.refresh/> Try again</button>
                <button className="btn btn-ghost btn-sm"><Icon.play/> Hear correct version</button>
                <button className="btn btn-primary btn-sm" onClick={p.next}>Continue <Icon.arrow/></button>
              </div>
            </div>
          )}

          {p.state === 'idle' && p.progress === 0 && (
            <p className="lede" style={{marginTop:24,maxWidth:480,textAlign:'center'}}>Press play. The audio will pause when it's your turn — speak naturally.</p>
          )}

          {p.state === 'complete' && (
            <div className="col gap-4 fade-in" style={{alignItems:'center',marginTop:24}}>
              <h2 className="h-1">Buen laburo.</h2>
              <button className="btn btn-primary btn-lg" onClick={() => go('report')}>See your report <Icon.arrow/></button>
            </div>
          )}
        </div>

        {/* Bottom scrubber */}
        <div style={{padding:'20px 0',borderTop:'1px solid var(--line)'}}>
          <Scrubber progress={p.progress} markers={SECTIONS.map(s => ({t:s.pct}))} onSeek={p.seek}/>
          <div className="row between" style={{marginTop:8}}>
            <span className="kicker tabular">{Math.floor(p.progress*25)}:{String(Math.floor((p.progress*25 % 1)*60)).padStart(2,'0')}</span>
            <span className="kicker">25:00</span>
          </div>
        </div>
      </div>
      <AskOverlay p={p}/>
    </div>
  );
}

// Orb visualization with sections, prompt dots, hover targets
function OrbWithSections({ progress, sections, prompts, active, accent, hoverSection, setHoverSection, onSeek, state, onPlay, onPause, onRecord }) {
  const size = 380;
  const cx = size / 2, cy = size / 2;
  const r = 142;
  const labelR = 175;
  const N_BARS = 72;
  const bars = useMemo(() => Array.from({length:N_BARS}, (_,i) => 0.4 + Math.abs(Math.sin(i*0.4))*0.6), []);

  // Helper: angle in radians for a given t (0..1) — start at top (-90°)
  const angleAt = (t) => (t * 2 * Math.PI) - Math.PI/2;

  return (
    <div style={{position:'relative',width:size,height:size}}>
      {/* Soft warm halo when active */}
      <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'radial-gradient(circle, rgba(212,165,116,.22), rgba(212,165,116,0) 65%)',animation: active ? 'pulse 2.4s ease-in-out infinite' : 'none'}}/>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position:'absolute',inset:0}}>
        {/* Outer faint ring */}
        <circle cx={cx} cy={cy} r={labelR} fill="none" stroke="var(--line)" strokeWidth="1"/>
        {/* Inner ring */}
        <circle cx={cx} cy={cy} r={r-12} fill="none" stroke="var(--line)" strokeWidth="1"/>

        {/* Section arcs */}
        {sections.map((s, i) => {
          const a1 = angleAt(s.pct);
          const a2 = angleAt(s.end);
          const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
          const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
          const largeArc = (s.end - s.pct) > 0.5 ? 1 : 0;
          const isActive = progress >= s.pct && progress < s.end;
          const isHover = hoverSection === s.id;
          const isPast = progress >= s.end;
          return (
            <g key={s.id}>
              <path
                d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                fill="none"
                stroke={isActive || isHover ? 'var(--warm)' : isPast ? 'var(--ink-2)' : 'var(--line-2)'}
                strokeWidth={isActive || isHover ? 4 : 2}
                strokeLinecap="round"
                style={{transition:'all .2s',cursor:'pointer'}}
                onMouseEnter={() => setHoverSection(s.id)}
                onMouseLeave={() => setHoverSection(null)}
                onClick={() => onSeek(s.pct + 0.001)}
              />
            </g>
          );
        })}

        {/* Tiny prompt dots */}
        {prompts.map(pr => {
          const a = angleAt(pr.t);
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          const done = progress >= pr.t;
          return (
            <g key={pr.id}>
              <circle cx={x} cy={y} r={5} fill="var(--bg)" stroke={done ? 'var(--warm)' : 'var(--mute-2)'} strokeWidth="1.5"/>
              {done && <circle cx={x} cy={y} r={2.5} fill="var(--warm)"/>}
            </g>
          );
        })}

        {/* Progress head */}
        {(() => {
          const a = angleAt(Math.max(0.001, progress));
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          return <circle cx={x} cy={y} r={6} fill="var(--ink)"/>;
        })()}

        {/* Audio bars (inside) */}
        {bars.map((h, i) => {
          const angle = (i / N_BARS) * Math.PI * 2 - Math.PI/2;
          const r1 = r - 32;
          const r2 = r1 + h * (active ? 22 : 6);
          const x1 = cx + Math.cos(angle) * r1, y1 = cy + Math.sin(angle) * r1;
          const x2 = cx + Math.cos(angle) * r2, y2 = cy + Math.sin(angle) * r2;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent ? 'var(--crit)' : 'var(--ink-2)'} strokeWidth="1.5" strokeLinecap="round" opacity={active ? 0.6 : 0.3} style={{transition:'all .25s',transitionDelay:`${i*4}ms`}}/>;
        })}
      </svg>

      {/* Section labels around the perimeter */}
      {sections.map(s => {
        const midT = (s.pct + s.end) / 2;
        const a = angleAt(midT);
        const x = cx + Math.cos(a) * labelR;
        const y = cy + Math.sin(a) * labelR;
        const isActive = progress >= s.pct && progress < s.end;
        const isHover = hoverSection === s.id;
        // Position labels outside the orb
        const outR = labelR + 20;
        const lx = cx + Math.cos(a) * outR;
        const ly = cy + Math.sin(a) * outR;
        // align text based on quadrant
        const alignRight = lx < cx - 4;
        return (
          <button key={s.id}
            onMouseEnter={() => setHoverSection(s.id)}
            onMouseLeave={() => setHoverSection(null)}
            onClick={() => onSeek(s.pct + 0.001)}
            style={{
              position:'absolute',
              left: alignRight ? 'auto' : lx,
              right: alignRight ? size - lx : 'auto',
              top: ly,
              transform:'translateY(-50%)',
              background:'transparent',border:0,cursor:'pointer',padding:'4px 6px',
              textAlign: alignRight ? 'right' : 'left',
              whiteSpace:'nowrap',
              opacity: isActive || isHover ? 1 : 0.55,
              transition:'opacity .15s'
            }}>
            <span className="mono" style={{fontSize:10,letterSpacing:'.08em',color: isActive ? 'var(--warm)' : 'var(--mute)',display:'block'}}>0{s.id}</span>
            <span className="serif" style={{fontSize:14,color: isActive || isHover ? 'var(--ink)' : 'var(--ink-2)',display:'block'}}>{s.label}</span>
          </button>
        );
      })}

      {/* Center control */}
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
        {(state === 'playing' || state === 'idle') && (
          <button className="btn btn-icon" style={{pointerEvents:'auto',width:84,height:84,borderRadius:'50%',background:'var(--ink)',color:'#100e0c',border:0,boxShadow:'0 8px 32px rgba(0,0,0,.5)'}} onClick={state==='playing' ? onPause : onPlay}>{state==='playing' ? <Icon.pause/> : <Icon.play/>}</button>
        )}
        {state === 'prompting' && (
          <button className="mic-btn" style={{pointerEvents:'auto',width:96,height:96}} onClick={onRecord}><Icon.mic/></button>
        )}
        {state === 'recording' && (
          <button className="mic-btn recording" style={{pointerEvents:'auto',width:96,height:96}}><Icon.mic/></button>
        )}
        {state === 'processing' && <div className="spinner" style={{width:36,height:36}}/>}
        {state === 'feedback' && (
          <div className="col center gap-2" style={{textAlign:'center'}}>
            <Tag kind="warm">● Almost</Tag>
            <span className="mono" style={{fontSize:10,color:'var(--mute)',letterSpacing:'.1em'}}>2 ISSUES</span>
          </div>
        )}
        {(state === 'asking' || state === 'answering') && (
          <div className="col center gap-2" style={{textAlign:'center'}}>
            <Icon.spark style={{color:'var(--warm)',width:24,height:24}}/>
            <span className="kicker eyebrow-warm">{state==='asking' ? 'PAUSED · ASK' : 'ANSWERING'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Marked-up user response with click-to-explain
function UserResponseAnalysis({ tokens, target, explainToken, setExplainToken, go }) {
  const tok = explainToken != null ? tokens[explainToken] : null;
  return (
    <div className="card" style={{padding:24}}>
      <div className="row between" style={{alignItems:'baseline',marginBottom:14}}>
        <span className="eyebrow">YOU SAID</span>
        <span className="kicker">2 issues · tap a word</span>
      </div>
      <p className="serif" style={{fontSize:26,fontStyle:'italic',lineHeight:1.4,margin:0}}>
        {tokens.map((t, i) => {
          if (t.kind === 'wrong') {
            const isOpen = explainToken === i;
            return (
              <span key={i}>
                <button onClick={() => setExplainToken(isOpen ? null : i)} style={{
                  background: isOpen ? 'rgba(201,112,100,.2)' : 'transparent',
                  color: 'var(--crit)',
                  border:0, padding:'0 2px',
                  textDecoration:'underline',
                  textDecorationStyle:'wavy',
                  textDecorationColor:'var(--crit)',
                  textUnderlineOffset:5,
                  cursor:'pointer',
                  fontFamily:'var(--serif)', fontStyle:'italic', fontSize:'inherit',
                }}>{t.t}</button>{' '}
              </span>
            );
          }
          return <span key={i}>{t.t}{i < tokens.length - 1 && t.t !== '¿' ? ' ' : ''}</span>;
        })}
      </p>

      {/* Inline explanation panel */}
      {tok && (
        <div className="fade-in" style={{marginTop:16,padding:'16px 18px',background:'var(--bg-3)',borderLeft:'2px solid var(--crit)',borderRadius:'0 4px 4px 0'}}>
          <div className="row between" style={{alignItems:'baseline'}}>
            <span className="eyebrow" style={{color:'var(--crit)'}}>{tok.cat} · "{tok.t}"</span>
            <button className="btn btn-text small" onClick={() => setExplainToken(null)} style={{padding:0}}><Icon.x/></button>
          </div>
          <p className="body" style={{marginTop:10,marginBottom:14,fontFamily:'var(--serif)',fontStyle:'italic',fontSize:17}}>{tok.issue}</p>
          <div className="row gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => go('mistake-detail')}><Icon.spark/> Explain it to me</button>
            <button className="btn btn-text btn-sm"><Icon.play/> Hear it correctly</button>
          </div>
        </div>
      )}

      <hr className="divider" style={{margin:'18px 0'}}/>
      <span className="eyebrow eyebrow-warm">TARGET</span>
      <p className="serif" style={{fontSize:24,fontStyle:'italic',marginTop:8,marginBottom:0}}>“{target}”</p>
    </div>
  );
}

// Modal overlay: ask a question
function AskOverlay({ p }) {
  const [q, setQ] = useState('');
  if (p.state !== 'asking' && p.state !== 'answering') return null;
  const placeholder = 'e.g. "Why did she say \u201cdale\u201d there?" or "What\u2019s the difference between \u201cporque\u201d and \u201cpor qu\u00e9\u201d?"';
  return (
    <div className="fade-in" style={{position:'fixed',inset:0,zIndex:200,background:'rgba(10,9,8,.85)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div className="card" style={{maxWidth:640,width:'100%',padding:32,position:'relative'}}>
        <div className="row between" style={{alignItems:'baseline',marginBottom:16}}>
          <span className="eyebrow eyebrow-warm">● PAUSED · ASK YOUR TUTOR</span>
          <span className="kicker">audio resumes after</span>
        </div>
        {p.state === 'asking' && (
          <div className="col gap-4">
            <h2 className="h-3">What do you want to know?</h2>
            <textarea
              autoFocus
              className="textarea"
              placeholder={placeholder}
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{minHeight:96,fontFamily:'var(--serif)',fontStyle:'italic',fontSize:18}}/>
            <div className="row gap-2" style={{flexWrap:'wrap'}}>
              <span className="kicker" style={{alignSelf:'center',marginRight:4}}>QUICK ASKS ·</span>
              {['What did she just say?','Why "vos" and not "tú"?','When do I use "dale"?'].map(s => (
                <button key={s} className="chip" style={{borderStyle:'dashed'}} onClick={() => setQ(s)}>{s}</button>
              ))}
            </div>
            <div className="row gap-2" style={{marginTop:8}}>
              <button className="btn btn-ghost" onClick={() => { setQ(''); p.submitQuestion(); }}>Cancel</button>
              <button className="btn btn-primary" disabled={!q.trim()} onClick={p.submitQuestion} style={{marginLeft:'auto'}}><Icon.spark/> Ask</button>
            </div>
          </div>
        )}
        {p.state === 'answering' && (
          <div className="col gap-4 fade-in">
            <span className="eyebrow">YOU ASKED</span>
            <p className="serif" style={{fontSize:20,fontStyle:'italic',color:'var(--ink-2)'}}>“{q || 'What did she just say?'}”</p>
            <hr className="divider"/>
            <div className="row gap-3" style={{alignItems:'flex-start'}}>
              <span className="brand-mark" style={{marginTop:4}}/>
              <div className="col gap-2" style={{flex:1}}>
                <div className="row gap-2" style={{alignItems:'center'}}>
                  <span className="spinner"/>
                  <span className="small">Tutor is answering…</span>
                </div>
                <p className="serif" style={{fontSize:18,fontStyle:'italic',color:'var(--ink-2)'}}>“She said <span style={{color:'var(--warm)'}}>‘te pinta’</span> — it's a casual way to ask if you feel like doing something. Closer to <span style={{color:'var(--ink)'}}>‘are you up for it?’</span> than ‘do you want to.’ You'll hear it constantly with friends.”</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerScreen({ go, variant }) {
  const p = useFakePlayer();
  const prompt = LESSON.prompts[p.promptIdx];
  if (variant === 'editorial')    return <PlayerEditorial p={p} prompt={prompt} go={go}/>;
  if (variant === 'conversation') return <PlayerConversation p={p} prompt={prompt} go={go}/>;
  return <PlayerOrb p={p} prompt={prompt} go={go}/>;
}

Object.assign(window, { PlayerScreen });
