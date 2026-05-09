// screens-onboarding.jsx — Welcome, Level Test, Level Result

function WelcomeScreen({ go }) {
  return (
    <div className="page" style={{paddingTop:0,paddingBottom:0,minHeight:'calc(100vh - 60px)',display:'grid',gridTemplateColumns:'1.05fr 1fr',gap:64,alignItems:'center'}}>
      <div className="col gap-8 fade-in" style={{maxWidth:560}}>
        <div className="col gap-4">
          <span className="eyebrow">Audio-first Spanish · Buenos Aires</span>
          <h1 className="h-display">Practice Spanish<br/>by <em>speaking</em> it.</h1>
          <p className="lede" style={{maxWidth:480,marginTop:8}}>An audio tutor that knows your level, remembers what you struggle with, and helps you sound like you actually live in Buenos Aires.</p>
        </div>
        <div className="row gap-3">
          <button className="btn btn-primary btn-lg" onClick={() => go('leveltest')}>Test my level <Icon.arrow/></button>
          <button className="btn btn-ghost btn-lg" onClick={() => go('dashboard')}>Continue</button>
        </div>
        <div className="row gap-6" style={{marginTop:8}}>
          <div className="col gap-1"><span className="eyebrow">Default</span><span className="small" style={{color:'var(--ink-2)'}}>Rioplatense (vos)</span></div>
          <div className="divider-v"></div>
          <div className="col gap-1"><span className="eyebrow">Session</span><span className="small" style={{color:'var(--ink-2)'}}>20–30 min · daily</span></div>
          <div className="divider-v"></div>
          <div className="col gap-1"><span className="eyebrow">Method</span><span className="small" style={{color:'var(--ink-2)'}}>Listen · respond · review</span></div>
        </div>
      </div>

      <div style={{position:'relative',aspectRatio:'4/5',maxHeight:680,width:'100%'}}>
        <image-slot
          id="welcome-tutor"
          shape="rect"
          radius="2"
          placeholder="Tutor portrait — drop a photo of your tutor or a Buenos Aires café scene"
          style={{width:'100%',height:'100%'}}
        ></image-slot>
        <div style={{position:'absolute',left:-24,bottom:32,background:'var(--bg)',border:'1px solid var(--line)',padding:'14px 18px',maxWidth:280,fontFamily:'var(--serif)',fontStyle:'italic',fontSize:18,lineHeight:1.35}}>
          <span style={{color:'var(--warm)'}}>“</span>Dale, sentate. Empezamos cuando estés listo.<span style={{color:'var(--warm)'}}>”</span>
          <div className="kicker" style={{marginTop:8,fontStyle:'normal'}}>— your tutor</div>
        </div>
        <div style={{position:'absolute',top:24,right:24,padding:'6px 10px',background:'rgba(10,9,8,.7)',backdropFilter:'blur(8px)',border:'1px solid var(--line)',borderRadius:3}}>
          <span className="mono" style={{fontSize:11,letterSpacing:'.1em',color:'var(--mute)'}}>● LIVE TUTOR · 00:00</span>
        </div>
      </div>
    </div>
  );
}

// — Level test (single representative prompt screen) —
function LevelTestScreen({ go }) {
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);
  const [showText, setShowText] = useState(false);
  const total = 12;
  const prompt = {
    title: 'Listen and respond',
    cue: '¿Querés tomar algo antes de ir?',
    instruction: 'A friend just asked you something. Respond naturally in Spanish.',
    transcript: 'Querés tomar algo antes de ir?',
    transl: 'Do you want to grab something to drink before we go?',
  };

  const record = () => {
    setRecording(true);
    setTimeout(() => { setRecording(false); setDone(true); }, 2200);
  };
  const next = () => {
    setDone(false); setShowText(false);
    if (step < total - 1) setStep(s => s+1);
    else go('levelresult');
  };

  return (
    <div className="page-narrow fade-in">
      <div className="row between" style={{marginBottom:48}}>
        <div className="col gap-2">
          <span className="eyebrow">Level Test</span>
          <span className="mono" style={{fontSize:13,color:'var(--mute)'}}>{String(step+1).padStart(2,'0')} / {total}</span>
        </div>
        <button className="btn btn-text small" onClick={() => go('welcome')}>Exit test</button>
      </div>
      <div className="progress" style={{marginBottom:64}}><div className="progress-fill" style={{width:`${((step+1)/total)*100}%`}}/></div>

      <div className="col gap-8" style={{alignItems:'center',textAlign:'center'}}>
        <span className="eyebrow eyebrow-warm">Prompt · listen and respond</span>
        <div className="col gap-6" style={{alignItems:'center'}}>
          <div className="row gap-4" style={{alignItems:'center'}}>
            <button className="btn btn-icon btn-ghost" style={{width:64,height:64,borderRadius:'50%'}}><Icon.play/></button>
            <Wave count={48} height={44}/>
            <span className="mono small">0:08</span>
          </div>
          {showText && <p className="serif" style={{fontSize:32,letterSpacing:'-.01em',maxWidth:680,fontStyle:'italic'}}>“{prompt.cue}”</p>}
          <button className="btn btn-text small" onClick={() => setShowText(s => !s)}>{showText ? 'Hide text' : 'Show text'}</button>
        </div>

        <p className="lede" style={{maxWidth:520}}>{prompt.instruction}</p>

        <div className="col gap-4" style={{alignItems:'center',marginTop:16}}>
          <button className={'mic-btn' + (recording ? ' recording' : '')} disabled={done} onClick={record}>
            <Icon.mic/>
          </button>
          <span className="mono small" style={{color: recording ? 'var(--crit)' : 'var(--mute)'}}>
            {recording ? '● RECORDING · 00:02' : done ? 'Response captured' : 'Tap to respond'}
          </span>
        </div>

        {done && (
          <div className="card fade-in" style={{maxWidth:560,width:'100%',textAlign:'left'}}>
            <span className="eyebrow">You said</span>
            <p className="serif" style={{fontSize:22,marginTop:8,fontStyle:'italic'}}>“Sí, vamos a tomar un café.”</p>
            <hr className="divider" style={{margin:'14px 0'}}/>
            <div className="row gap-2" style={{alignItems:'center'}}>
              <Tag kind="leaf">● Good</Tag>
              <span className="small">Marked for review · feedback after the test.</span>
            </div>
          </div>
        )}

        <div className="row gap-3">
          <button className="btn btn-ghost" onClick={() => { setRecording(false); setDone(false); }}>Skip</button>
          <button className="btn btn-primary" disabled={!done} onClick={next}>Continue <Icon.arrow/></button>
        </div>

        <div className="row gap-3" style={{marginTop:24,padding:'12px 16px',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:4,maxWidth:520}}>
          <span className="mate-icon" style={{marginTop:4}}></span>
          <span className="small" style={{textAlign:'left'}}>Brief feedback only during the test. We'll save corrections and show a full profile at the end.</span>
        </div>
      </div>
    </div>
  );
}

function LevelResultScreen({ go }) {
  return (
    <div className="page-narrow fade-in">
      <div className="col gap-12">
        <div className="col gap-3">
          <span className="eyebrow">Level test complete · 12 prompts</span>
          <h1 className="h-display">Your level is <em>B1.</em></h1>
          <p className="lede" style={{maxWidth:560}}>You can handle simple conversations and follow most everyday audio. Your spoken responses lag and you still slip into <span style={{fontFamily:'var(--serif)',fontStyle:'italic'}}>tú</span> forms.</p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,border:'1px solid var(--line)'}}>
          {[
            { eb:'Strong with', items:['Restaurant and café phrases','Numbers, time, directions','Short comprehension at slow speed','Polite small talk'] },
            { eb:'Needs work',  items:['Vos forms (tenés / querés / podés)','Faster responses to open prompts','Object pronouns in casual speech','Understanding natural-speed audio'], warm:true },
          ].map((c, i) => (
            <div key={i} style={{padding:'28px 28px',borderLeft: i ? '1px solid var(--line)' : 'none'}}>
              <span className={'eyebrow' + (c.warm ? ' eyebrow-warm' : '')}>{c.eb}</span>
              <ul style={{margin:'14px 0 0',padding:0,listStyle:'none'}}>
                {c.items.map((it, j) => (
                  <li key={j} className="row gap-3" style={{padding:'10px 0',borderTop: j ? '1px solid var(--line)' : 'none',alignItems:'baseline'}}>
                    <span className="mono" style={{fontSize:11,color:'var(--mute-2)',width:24}}>{String(j+1).padStart(2,'0')}</span>
                    <span className="serif" style={{fontSize:18,color:c.warm ? 'var(--ink)' : 'var(--ink-2)'}}>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="card" style={{padding:32}}>
          <div className="row between" style={{alignItems:'center',marginBottom:14}}>
            <span className="eyebrow eyebrow-warm">Recommended first lesson</span>
            <Tag kind="warm">Personalized</Tag>
          </div>
          <h2 className="h-2" style={{marginBottom:10}}>Making plans with a friend.</h2>
          <p className="body" style={{maxWidth:620}}>Casual invitations, near-future ("voy a"), and the vos forms you missed. About 25 minutes of audio practice.</p>
          <div className="row gap-3" style={{marginTop:24}}>
            <button className="btn btn-warm" onClick={() => go('preview')}>Start recommended lesson <Icon.arrow/></button>
            <button className="btn btn-ghost" onClick={() => go('dashboard')}>Go to dashboard</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WelcomeScreen, LevelTestScreen, LevelResultScreen });
