// screens-build.jsx — Dashboard, Lesson Builder, Preview

function Dashboard({ go, setBuilder }) {
  return (
    <div className="page fade-in">
      <div className="col gap-12">
        {/* Hero strip */}
        <div className="row between" style={{alignItems:'flex-end',gap:48,paddingBottom:32,borderBottom:'1px solid var(--line)'}}>
          <div className="col gap-4" style={{flex:1}}>
            <span className="eyebrow">Buenos días, Mateo · martes, 9 de mayo</span>
            <h1 className="h-1">Pick up where you left off, or <em style={{fontFamily:'var(--serif)',fontStyle:'italic',color:'var(--warm)'}}>build something new</em>.</h1>
          </div>
          <div className="row gap-8" style={{paddingBottom:6}}>
            {[
              { k:'Level',     v:'B1',     s:'+0.2 since Apr 14' },
              { k:'Lessons',   v:'12',     s:'6 this week' },
              { k:'Streak',    v:'5 days', s:'best: 11' },
              { k:'Speaking',  v:'4h 32m', s:'avg 22 min' },
            ].map(s => (
              <div key={s.k} className="col gap-1" style={{minWidth:90}}>
                <span className="eyebrow">{s.k}</span>
                <span className="serif" style={{fontSize:30,letterSpacing:'-.01em'}}>{s.v}</span>
                <span className="small" style={{color:'var(--mute-2)'}}>{s.s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended */}
        <div className="row gap-6" style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:24}}>
          <div className="card" style={{padding:36,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',right:-40,top:-40,width:240,height:240,borderRadius:'50%',background:'radial-gradient(circle,rgba(212,165,116,.12),transparent 70%)'}}/>
            <span className="eyebrow eyebrow-warm">Recommended next · for you</span>
            <h2 className="h-1" style={{marginTop:16,marginBottom:18,maxWidth:520}}>Practice making plans and responding faster.</h2>
            <p className="body" style={{maxWidth:560}}>You're accurate with simple café and restaurant phrases, but you hesitate on open-ended responses and still slip into <span style={{fontFamily:'var(--serif)',fontStyle:'italic'}}>tú</span> forms. This lesson drills <span style={{fontFamily:'var(--mono)',fontSize:13}}>querés / tenés / podés</span> with timed responses.</p>
            <div className="row gap-2" style={{marginTop:24,flexWrap:'wrap'}}>
              <Tag kind="warm">25 min</Tag><Tag kind="mute">B1</Tag><Tag kind="mute">Social plans</Tag><Tag kind="mute">Vos forms</Tag><Tag kind="mute">Speed drills</Tag>
            </div>
            <div className="row gap-3" style={{marginTop:32}}>
              <button className="btn btn-primary" onClick={() => go('preview')}>Start lesson <Icon.arrow/></button>
              <button className="btn btn-ghost" onClick={() => go('builder')}>Customize first</button>
            </div>
          </div>

          <div className="col gap-3">
            <div className="card-flat" style={{padding:20}}>
              <div className="row between" style={{alignItems:'center',marginBottom:10}}>
                <span className="eyebrow">In progress</span>
                <span className="mono small">62%</span>
              </div>
              <div className="serif" style={{fontSize:20,marginBottom:4}}>Apartment hot water issue</div>
              <p className="small" style={{marginBottom:12}}>Paused at the listening dialogue · 11 min left</p>
              <div className="progress" style={{marginBottom:14}}><div className="progress-fill" style={{width:'62%'}}/></div>
              <button className="btn btn-ghost btn-sm" onClick={() => go('player')}><Icon.play/> Resume</button>
            </div>

            <div className="card-flat" style={{padding:20}}>
              <span className="eyebrow">Why this recommendation</span>
              <ul style={{margin:'12px 0 0',padding:0,listStyle:'none'}}>
                {[
                  ['7×','missed "querés" this week'],
                  ['9×','slow on direct questions'],
                  ['3×','asked to practice social plans'],
                ].map(([n,t]) => (
                  <li key={t} className="row gap-3" style={{padding:'8px 0',borderTop:'1px solid var(--line)'}}>
                    <span className="mono" style={{color:'var(--warm)',width:32,fontSize:13}}>{n}</span>
                    <span className="small" style={{color:'var(--ink-2)'}}>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Quick generate */}
        <div>
          <SectionHead num="01 / Generate" title="What do you want to practice today?" sub="Type a situation in your own words, or pick a scenario below. The full builder gives you finer control." right={<button className="btn btn-text small" onClick={() => go('builder')}>Open lesson builder <Icon.arrow/></button>}/>

          <DashboardCustomPrompt go={go} setBuilder={setBuilder}/>

          <div className="row between" style={{alignItems:'baseline',margin:'28px 0 14px'}}>
            <span className="eyebrow">Or pick a scenario</span>
            <span className="kicker">8 of {SCENARIOS.length}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
            {SCENARIOS.slice(0,8).map(s => (
              <button key={s.id} className="card-hover" onClick={() => go('builder')} style={{textAlign:'left',background:'var(--bg-2)',border:'1px solid var(--line)',padding:'18px 18px 16px',borderRadius:4,cursor:'pointer'}}>
                <div className="serif" style={{fontSize:20,marginBottom:6}}>{s.label}</div>
                <div className="kicker" style={{fontStyle:'italic',color:'var(--mute)'}}>{s.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent lessons strip */}
        <div>
          <SectionHead num="02 / Library" title="Recent lessons" right={<button className="btn btn-text small" onClick={() => go('finished')}>See all 12 <Icon.arrow/></button>}/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:'var(--line)',border:'1px solid var(--line)'}}>
            {RECENT_LESSONS.slice(0,3).map(l => (
              <div key={l.id} className="card-hover" style={{background:'var(--bg)',padding:24,cursor:'pointer'}} onClick={() => go('finished-detail')}>
                <div className="row between" style={{marginBottom:14,alignItems:'center'}}>
                  <span className="kicker">{l.date} · {l.duration} min</span>
                  <Tag kind={l.score >= 85 ? 'leaf' : 'warm'}>{l.score}</Tag>
                </div>
                <div className="serif" style={{fontSize:22,letterSpacing:'-.01em',marginBottom:8}}>{l.title}</div>
                <div className="small" style={{color:'var(--mute)'}}>{l.focus}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// — Lesson Builder —
function BuilderScreen({ go, builder, setBuilder }) {
  const b = builder;
  const set = (k,v) => setBuilder(p => ({...p, [k]: v}));
  const toggleMistake = id => set('mistakes', b.mistakes.includes(id) ? b.mistakes.filter(x=>x!==id) : [...b.mistakes, id]);
  const showMistakes = b.focus === 'recent' || b.focus === 'common';
  const showGrammar = b.focus === 'grammar';
  const offsetToLevel = (n) => n >= 0 ? 'B1.' + n : 'A2.' + (10 + n);
  const offsetLabel = (n) => n <= -2 ? 'Easier' : n >= 2 ? 'Harder' : 'Normal';
  const offsetDesc = (n) => {
    if (n <= -2) return 'Slower audio, shorter sentences, lots of repetition.';
    if (n === -1) return 'Slightly slower, gentler scaffolding.';
    if (n === 0) return 'Matched to your current B1 profile.';
    if (n === 1) return 'Slightly faster, less hand-holding.';
    return 'Faster audio, longer prompts, less scaffolding.';
  };

  return (
    <div className="page fade-in">
      <button className="btn btn-text small" style={{marginBottom:8,paddingLeft:0}} onClick={() => go('dashboard')}><Icon.arrowLeft/> Dashboard</button>
      <SectionHead num="01 / Builder" title="Build today's lesson." sub="Each control narrows what your tutor will generate. The custom prompt can override anything else."/>

      <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:48,alignItems:'start'}}>
        <div className="col gap-10">
          {/* Scenario */}
          <div>
            <span className="label">Scenario</span>
            <div className="row gap-2" style={{flexWrap:'wrap',marginBottom:14}}>
              <ChooseChip selected={b.scenario === 'auto'} onClick={() => set('scenario', 'auto')}/>
              {SCENARIOS.map(s => (
                <button key={s.id} className={'chip chip-square' + (b.scenario === s.id ? ' selected' : '')} onClick={() => set('scenario', s.id)}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Focus */}
          <div>
            <span className="label">Focus</span>
            <div className="row gap-2" style={{flexWrap:'wrap',marginBottom:14}}>
              <ChooseChip selected={b.focus === 'auto'} onClick={() => set('focus', 'auto')}/>
              {FOCUSES.map(f => (
                <button key={f.id} className={'chip chip-square chip-warm' + (b.focus === f.id ? ' selected' : '')} onClick={() => set('focus', f.id)}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* Conditional: mistakes */}
          {showMistakes && (
            <div className="fade-in">
              <span className="label">Pick mistakes to drill</span>
              <div className="col" style={{border:'1px solid var(--line)',borderRadius:4}}>
                {RECENT_MISTAKES.map((m, i) => (
                  <label key={m.id} className="row gap-3" style={{padding:'14px 18px',borderTop: i ? '1px solid var(--line)' : 'none',alignItems:'center',cursor:'pointer'}}>
                    <input type="checkbox" checked={b.mistakes.includes(m.id)} onChange={() => toggleMistake(m.id)} style={{accentColor:'var(--warm)',width:16,height:16}}/>
                    <div className="col" style={{flex:1}}>
                      <span style={{fontSize:14}}>{m.label}</span>
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
              <div className="row gap-2" style={{flexWrap:'wrap'}}>
                <ChooseChip selected={b.grammar.includes('__auto__')} onClick={() => set('grammar', b.grammar.includes('__auto__') ? [] : ['__auto__'])}/>
                {GRAMMAR_TOPICS.map(g => (
                  <button key={g} className={'chip' + (b.grammar.includes(g) ? ' selected' : '')} onClick={() => {
                    const cleaned = b.grammar.filter(x => x !== '__auto__');
                    set('grammar', cleaned.includes(g) ? cleaned.filter(x=>x!==g) : [...cleaned, g]);
                  }}>{g}</button>
                ))}
              </div>
              <p className="small" style={{marginTop:12,fontStyle:'italic',fontFamily:'var(--serif)',fontSize:14}}>Grammar appears as practical speaking moments — not drills with rules on a page.</p>
            </div>
          )}

          {/* Difficulty + length */}
          <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:32}}>
            <div>
              <span className="label">Difficulty · base level B1</span>
              <DifficultySlider value={b.diffOffset || 0} onChange={(v) => set('diffOffset', v)} levelOf={offsetToLevel} labelOf={offsetLabel}/>
              <span className="small" style={{marginTop:10,display:'block'}}>{offsetDesc(b.diffOffset || 0)}</span>
            </div>
            <div>
              <span className="label">Length</span>
              <div className="row" style={{border:'1px solid var(--line)',borderRadius:4,overflow:'hidden'}}>
                {[10,15,25,40].map(n => (
                  <button key={n} onClick={() => set('length', n)} style={{flex:1,padding:'12px 0',background: n===b.length ? 'var(--ink)' : 'transparent', color: n===b.length ? '#100e0c' : 'var(--ink-2)',border:0,borderLeft: n!==10 ? '1px solid var(--line)' : 0,cursor:'pointer',fontSize:13,fontVariantNumeric:'tabular-nums'}}>{n} min</button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom prompt */}
          <div>
            <span className="label">Custom instruction · optional</span>
            <textarea className="textarea" placeholder={'E.g. "I\u2019m at a bar watching Boca play and I want to make small talk with people around me." or "I need to tell my landlord that the hot water stopped working."'} value={b.custom} onChange={e => set('custom', e.target.value)}/>
            <p className="small" style={{marginTop:8,fontStyle:'italic',fontFamily:'var(--serif)',fontSize:14}}>Custom prompts override or supplement the choices above.</p>
          </div>
        </div>

        {/* Summary rail */}
        <aside style={{position:'sticky',top:120}}>
          <div className="card" style={{padding:24}}>
            <span className="eyebrow">Lesson summary</span>
            <h3 className="h-3" style={{marginTop:14,marginBottom:18}}>{b.custom ? 'Custom-shaped lesson' : (SCENARIOS.find(s=>s.id===b.scenario)?.label || '—') + ' · ' + (FOCUSES.find(f=>f.id===b.focus)?.label || '—')}</h3>
            <div className="col gap-3">
              {[
                ['Level', offsetToLevel(b.diffOffset || 0) + ' · ' + offsetLabel(b.diffOffset || 0)],
                ['Length', b.length + ' minutes'],
                ['Scenario', b.scenario === 'auto' ? 'Choose for me' : (SCENARIOS.find(s=>s.id===b.scenario)?.label || '—')],
                ['Focus', b.focus === 'auto' ? 'Choose for me' : (FOCUSES.find(f=>f.id===b.focus)?.label || '—')],
                ...(showMistakes && b.mistakes.length ? [['Mistakes', b.mistakes.length + ' selected']] : []),
                ...(showGrammar && b.grammar.length ? [['Grammar', b.grammar.length + ' selected']] : []),
              ].map(([k,v]) => (
                <div key={k} className="row between" style={{borderTop:'1px solid var(--line)',paddingTop:10}}>
                  <span className="small">{k}</span>
                  <span className="small" style={{color:'var(--ink)',fontFamily:'var(--mono)',fontSize:12}}>{v}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-lg" style={{width:'100%',marginTop:24}} onClick={() => go('preview')}><Icon.spark/> Generate lesson</button>
            <p className="small" style={{marginTop:10,textAlign:'center',color:'var(--mute-2)'}}>~3 sec · personalized to your profile</p>
          </div>
          <TutorStrip>Lessons get more useful the more you talk. Even a generic scenario will adapt to you.</TutorStrip>
        </aside>
      </div>
    </div>
  );
}

// — Generated Lesson Preview —
function PreviewScreen({ go, builder }) {
  const [generating, setGenerating] = useState(true);
  useEffect(() => { const t = setTimeout(() => setGenerating(false), 1200); return () => clearTimeout(t); }, []);

  return (
    <div className="page-narrow fade-in">
      <button className="btn btn-text small" style={{marginBottom:8,paddingLeft:0}} onClick={() => go('builder')}><Icon.arrowLeft/> Edit settings</button>
      <span className="eyebrow eyebrow-warm">{generating ? 'Generating…' : 'Lesson · ready'}</span>
      <h1 className="h-1" style={{marginTop:14,marginBottom:24,maxWidth:680}}>
        {generating ? <span className="shimmer" style={{display:'inline-block',width:'70%',height:48,borderRadius:2}}></span> : LESSON.title + '.'}
      </h1>
      {!generating && <p className="lede" style={{maxWidth:620,marginBottom:40}}>{LESSON.subtitle}.</p>}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,border:'1px solid var(--line)',marginBottom:40}}>
        {[['Duration','25 min'],['Level','B1 · normal'],['Scenario','Social plans'],['Focus','Recent mistakes + speed'],['Grammar','vos · near future · object pronouns'],['Speaking / Listening','60 / 40']].map(([k,v], i) => (
          <div key={k} style={{padding:'18px 22px',borderTop: i > 1 ? '1px solid var(--line)' : 'none',borderLeft: i % 2 ? '1px solid var(--line)' : 'none'}}>
            <span className="eyebrow">{k}</span>
            <div style={{marginTop:6,fontSize:15,color:'var(--ink)'}}>{generating ? <span className="shimmer" style={{display:'inline-block',width:80,height:14,borderRadius:1}}/> : v}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,marginBottom:48}}>
        <div>
          <span className="eyebrow">Outline</span>
          <ol style={{margin:'14px 0 0',padding:0,listStyle:'none'}}>
            {LESSON.outline.map((s, i) => (
              <li key={s.n} className="row gap-4" style={{padding:'14px 0',borderTop:'1px solid var(--line)',alignItems:'baseline'}}>
                <span className="mono" style={{fontSize:11,color:'var(--mute-2)',width:24}}>0{s.n}</span>
                <span className="serif" style={{fontSize:18,flex:1}}>{s.label}</span>
                <span className="kicker">~{Math.round((LESSON.outline[i+1]?.pct || 1) * 25 - s.pct * 25)} min</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <span className="eyebrow">By the end you'll practice</span>
          <ul style={{margin:'14px 0 0',padding:0,listStyle:'none'}}>
            {[
              'Asking someone if they want to do something',
              'Responding naturally to casual invitations',
              'Using querés, podés, te pinta',
              'Answering faster after audio prompts',
              'Hearing dale, capaz, bueno without missing a beat',
            ].map((g, i) => (
              <li key={i} className="row gap-3" style={{padding:'14px 0',borderTop:'1px solid var(--line)',alignItems:'baseline'}}>
                <span style={{color:'var(--warm)'}}>·</span>
                <span className="body">{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <TutorStrip>
        <span style={{color:'var(--mute)',fontStyle:'normal',fontFamily:'var(--mono)',fontSize:11,letterSpacing:'.06em',marginRight:8}}>WHY THIS LESSON ·</span>
        Built around your recent misses on "tenés", slow responses to direct questions, and your custom request to practice social plans.
      </TutorStrip>

      <div className="row gap-3" style={{marginTop:40}}>
        <button className="btn btn-primary btn-lg" disabled={generating} onClick={() => go('player')}><Icon.play/> Start lesson</button>
        <button className="btn btn-ghost btn-lg" onClick={() => setGenerating(true) || setTimeout(() => setGenerating(false), 1000)}><Icon.refresh/> Regenerate</button>
        <button className="btn btn-text" onClick={() => go('builder')}>Edit settings</button>
        <button className="btn btn-text" style={{marginLeft:'auto'}}>Save for later</button>
      </div>
    </div>
  );
}

// — Helpers used above —
function ChooseChip({ selected, onClick }) {
  return (
    <button onClick={onClick} className={'chip chip-square' + (selected ? ' selected' : '')} style={{borderStyle: selected ? 'solid' : 'dashed', borderColor: selected ? undefined : 'var(--warm)', color: selected ? undefined : 'var(--warm)'}}>
      <Icon.spark/> Choose for me
    </button>
  );
}

function DifficultySlider({ value, onChange, levelOf, labelOf }) {
  const steps = [-3,-2,-1,0,1,2,3];
  const idx = steps.indexOf(value);
  const pct = (idx / (steps.length - 1)) * 100;
  return (
    <div className="col gap-3" style={{paddingTop:6}}>
      <div style={{position:'relative',height:48}}>
        {/* track */}
        <div style={{position:'absolute',top:23,left:0,right:0,height:2,background:'var(--line)'}}/>
        <div style={{position:'absolute',top:23,left:0,width:`${pct}%`,height:2,background:'var(--ink)'}}/>
        {/* tick marks */}
        {steps.map((s, i) => {
          const left = (i / (steps.length - 1)) * 100;
          const active = s === value;
          return (
            <button key={s} onClick={() => onChange(s)} title={levelOf(s)}
              style={{position:'absolute',top:active ? 14 : 18,left:`calc(${left}% - 10px)`,width:20,height:active ? 20 : 12,borderRadius:active ? '50%' : '50%',background: active ? 'var(--warm)' : (i <= idx ? 'var(--ink-2)' : 'var(--bg-3)'),border:'2px solid var(--bg)',cursor:'pointer',padding:0,transition:'all .15s'}}/>
          );
        })}
        {/* center label */}
        <div style={{position:'absolute',top:-2,left:`calc(${pct}% - 50px)`,width:100,textAlign:'center',pointerEvents:'none'}}>
          <div className="mono" style={{fontSize:10,letterSpacing:'.1em',color:'var(--mute)'}}>{labelOf(value)}</div>
        </div>
      </div>
      <div className="row between" style={{padding:'0 4px'}}>
        <span className="kicker">A2.7 · easier</span>
        <span className="serif" style={{fontSize:32,fontStyle:'italic',color:'var(--warm)',letterSpacing:'-.01em',lineHeight:1}}>{levelOf(value)}</span>
        <span className="kicker" style={{textAlign:'right'}}>harder · B1.3</span>
      </div>
    </div>
  );
}

function DashboardCustomPrompt({ go, setBuilder }) {
  const [v, setV] = useState('');
  const ideas = ['Tell my landlord the hot water stopped working', 'Order at a parrilla in San Telmo', 'Make plans to watch Boca with friends', 'Argue with a taxi driver about the route'];
  const submit = () => {
    if (setBuilder && v.trim()) setBuilder(p => ({...p, custom: v, scenario: 'auto', focus: 'auto'}));
    go('preview');
  };
  return (
    <div style={{border:'1px solid var(--line)',background:'var(--bg-2)',borderRadius:4,padding:'18px 20px'}}>
      <div className="row gap-3" style={{alignItems:'flex-start'}}>
        <span className="mate-icon" style={{marginTop:8}}/>
        <textarea
          className="textarea"
          placeholder="Describe a real situation in your own words. e.g. I'm at a kiosco trying to pay with a 1000-peso bill but they don't have change."
          value={v}
          onChange={e => setV(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          style={{flex:1,background:'transparent',border:0,padding:0,minHeight:60,fontFamily:'var(--serif)',fontSize:18,fontStyle:'italic',color:'var(--ink)'}}/>
        <button className="btn btn-primary btn-sm" disabled={!v.trim()} onClick={submit}><Icon.spark/> Generate</button>
      </div>
      <div className="row gap-2" style={{marginTop:14,flexWrap:'wrap',paddingTop:14,borderTop:'1px solid var(--line)'}}>
        <span className="kicker" style={{alignSelf:'center',marginRight:4}}>TRY ·</span>
        {ideas.map(i => (
          <button key={i} className="chip" onClick={() => setV(i)} style={{borderStyle:'dashed'}}>{i}</button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, BuilderScreen, PreviewScreen, ChooseChip, DifficultySlider, DashboardCustomPrompt });
