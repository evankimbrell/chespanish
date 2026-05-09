// screens-review.jsx — Lesson Report, Finished Lessons + detail, Mistakes, Mistake detail, Settings

function ReportScreen({ go }) {
  return (
    <div className="page-narrow fade-in">
      <span className="eyebrow eyebrow-warm">Lesson complete · 100%</span>
      <h1 className="h-1" style={{marginTop:14,marginBottom:18}}>{LESSON.title}.</h1>
      <p className="lede" style={{maxWidth:560}}>You finished in 27 minutes. Most prompts were natural; a few still slipped into <span className="serif" style={{fontStyle:'italic'}}>tú</span> forms.</p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0,border:'1px solid var(--line)',marginTop:40,marginBottom:48}}>
        {[
          ['Score','88',  'of 100'],
          ['Time','27 min','vs 25 estimated'],
          ['Avg response','5.2s','target 4.0s'],
          ['Mistakes','6',   '3 new · 3 recurring'],
        ].map(([k,v,s], i) => (
          <div key={k} style={{padding:'24px 24px',borderLeft: i ? '1px solid var(--line)' : 'none'}}>
            <span className="eyebrow">{k}</span>
            <div className="serif" style={{fontSize:42,marginTop:8,letterSpacing:'-.015em'}}>{v}</div>
            <span className="kicker">{s}</span>
          </div>
        ))}
      </div>

      {/* Mistakes from this lesson */}
      <SectionHead num="01 / Misses" title="Where you slipped." sub="Each is now in your Mistakes log. Tap to replay the exact moment or generate a drill."/>
      <div className="col" style={{border:'1px solid var(--line)',marginBottom:48}}>
        {[
          { name:'Used "tienes" instead of "tenés"', cat:'Conjugation', sev:'high', t:'04:12', user:'¿Tienes tiempo mañana?', right:'¿Tenés tiempo mañana?' },
          { name:'Confused "me traés" with "me das"', cat:'Naturalness', sev:'med', t:'09:48', user:'¿Me das un café?', right:'¿Me traés un café?' },
          { name:'Slow response to future-tense prompt', cat:'Speed', sev:'med', t:'14:33', user:'(8.4 sec hesitation)', right:'Voy a ir mañana.' },
          { name:'Misheard "capaz"', cat:'Listening', sev:'low', t:'19:06', user:'(asked tutor to repeat)', right:'capaz = "maybe"' },
        ].map((m, i) => (
          <div key={i} style={{padding:'20px 24px',borderTop: i ? '1px solid var(--line)' : 'none',cursor:'pointer'}} className="card-hover" onClick={() => go('mistake-detail')}>
            <div className="row between" style={{alignItems:'baseline',marginBottom:8}}>
              <div className="row gap-3" style={{alignItems:'baseline'}}>
                <span className="mono" style={{fontSize:11,color:'var(--mute-2)',width:36}}>{String(i+1).padStart(2,'0')}</span>
                <span className="serif" style={{fontSize:19}}>{m.name}</span>
              </div>
              <div className="row gap-2" style={{alignItems:'center'}}>
                <Tag kind={m.sev==='high'?'crit':m.sev==='med'?'warm':'mute'}>{m.cat}</Tag>
                <span className="mono" style={{fontSize:11,color:'var(--mute)'}}>{m.t}</span>
                <Icon.arrow style={{color:'var(--mute)'}}/>
              </div>
            </div>
            <div className="row gap-6" style={{paddingLeft:48}}>
              <div className="col gap-1"><span className="kicker">YOU SAID</span><span className="serif" style={{fontStyle:'italic',color:'var(--ink-2)'}}>“{m.user}”</span></div>
              <div className="col gap-1"><span className="kicker eyebrow-warm">TARGET</span><span className="serif" style={{fontStyle:'italic'}}>“{m.right}”</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* What went well */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,marginBottom:48}}>
        <div>
          <span className="eyebrow">What went well</span>
          <ul style={{margin:'14px 0 0',padding:0,listStyle:'none'}}>
            {['Understanding café and restaurant phrases','Responding naturally to simple questions','Using "quiero" and "dale" correctly','Recovering after corrections without freezing'].map((g,i)=>(
              <li key={i} className="row gap-3" style={{padding:'12px 0',borderTop:'1px solid var(--line)',alignItems:'baseline'}}>
                <Icon.check style={{color:'var(--leaf)'}}/>
                <span className="body">{g}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="eyebrow">Concepts covered · why they matter</span>
          <ul style={{margin:'14px 0 0',padding:0,listStyle:'none'}}>
            {[
              ['Asking for things','Highest-frequency pattern in service interactions.'],
              ['Vos form of tener','You hear "tenés" constantly. It is the everyday form.'],
              ['Casual "te pinta"','Lets you sound natural with friends without slang overload.'],
              ['Near future "voy a"','Replaces the simple future in spoken Argentine.'],
            ].map(([t,d],i) => (
              <li key={i} style={{padding:'12px 0',borderTop:'1px solid var(--line)'}}>
                <div className="serif" style={{fontSize:17,marginBottom:4}}>{t}</div>
                <p className="small" style={{margin:0}}>{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <TutorStrip><span className="kicker" style={{fontStyle:'normal',marginRight:8}}>RECOMMENDED NEXT ·</span>Fast-response drills with <span style={{fontFamily:'var(--mono)',fontSize:13}}>tenés / querés / podés</span>. ~12 min.</TutorStrip>

      <div className="row gap-3" style={{marginTop:32,flexWrap:'wrap'}}>
        <button className="btn btn-primary" onClick={() => go('builder')}><Icon.spark/> Generate next lesson</button>
        <button className="btn btn-ghost" onClick={() => go('mistakes')}>Practice mistakes</button>
        <button className="btn btn-ghost" onClick={() => go('player')}><Icon.refresh/> Replay hard parts</button>
        <button className="btn btn-text" style={{marginLeft:'auto'}} onClick={() => go('dashboard')}>Back to dashboard</button>
      </div>
    </div>
  );
}

// — Finished Lessons (list + detail toggle) —
function FinishedScreen({ go }) {
  const [detail, setDetail] = useState(null);
  if (detail) return <FinishedDetail lesson={detail} back={() => setDetail(null)} go={go}/>;
  return (
    <div className="page fade-in">
      <SectionHead num="01 / Library" title="Finished lessons." sub="Replay full lessons, just the prompts you missed, or only the listening sections."/>
      <div className="row gap-2" style={{marginBottom:24,flexWrap:'wrap'}}>
        {['All', 'This week', 'Restaurant', 'Social', 'B1', 'High mistakes'].map((f,i) => (
          <button key={f} className={'chip' + (i===0 ? ' selected' : '')}>{f}</button>
        ))}
        <button className="btn btn-text small" style={{marginLeft:'auto'}}>Sort: most recent <Icon.arrow style={{transform:'rotate(90deg)'}}/></button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:1,background:'var(--line)',border:'1px solid var(--line)'}}>
        {RECENT_LESSONS.map(l => (
          <div key={l.id} className="card-hover" style={{background:'var(--bg)',padding:28,cursor:'pointer'}} onClick={() => setDetail(l)}>
            <div className="row between" style={{marginBottom:14,alignItems:'center'}}>
              <span className="kicker">{l.date} · {l.duration} min · {l.level}</span>
              <Tag kind={l.score >= 85 ? 'leaf' : 'warm'}>{l.score}</Tag>
            </div>
            <h3 className="h-3" style={{marginBottom:10}}>{l.title}.</h3>
            <p className="small" style={{marginBottom:18}}>Focus · {l.focus}</p>
            <div className="row gap-2" style={{alignItems:'center'}}>
              <Tag kind="mute">{l.mistakes} mistakes</Tag>
              <button className="btn btn-text small" style={{marginLeft:'auto',padding:0}}>Open <Icon.arrow/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinishedDetail({ lesson, back, go }) {
  return (
    <div className="page-narrow fade-in">
      <button className="btn btn-text small" style={{paddingLeft:0,marginBottom:12}} onClick={back}><Icon.arrowLeft/> All lessons</button>
      <span className="eyebrow">Completed {lesson.date} · {lesson.duration} min · {lesson.level}</span>
      <h1 className="h-1" style={{marginTop:14,marginBottom:24}}>{lesson.title}.</h1>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:0,border:'1px solid var(--line)',marginBottom:40}}>
        {[['Score',lesson.score,'of 100'],['Mistakes',lesson.mistakes,'mostly conjugation'],['Avg response','5.2s','vs target 4.0s']].map(([k,v,s],i) => (
          <div key={k} style={{padding:'20px 24px',borderLeft: i ? '1px solid var(--line)' : 'none'}}>
            <span className="eyebrow">{k}</span>
            <div className="serif" style={{fontSize:32,marginTop:6}}>{v}</div>
            <span className="kicker">{s}</span>
          </div>
        ))}
      </div>

      <SectionHead title="Replay sections" sub="The point of an old lesson is the audio, not the transcript. Replay only what was hard."/>
      <div className="col gap-2" style={{marginBottom:48}}>
        {[
          ['Full lesson','26 min','from start',true],
          ['Just the prompts you missed','3 prompts · ~2 min','the value cut'],
          ['Slow-response prompts','5 prompts · ~3 min'],
          ['Listening dialogue only','one section · 4 min'],
          ['Roleplay only','one scene · 5 min'],
        ].map(([t,m,note,hi], i) => (
          <button key={i} className="row gap-4" style={{padding:'16px 20px',background: hi ? 'var(--bg-2)' : 'transparent',border:'1px solid var(--line)',borderRadius:4,alignItems:'center',cursor:'pointer',textAlign:'left',width:'100%',color:'inherit'}} onClick={() => go('player')}>
            <Icon.play style={{color: hi ? 'var(--warm)' : 'var(--ink-2)'}}/>
            <div className="col" style={{flex:1}}>
              <span className="serif" style={{fontSize:18}}>{t}</span>
              <span className="small">{m}{note ? ' · ' + note : ''}</span>
            </div>
            <Icon.arrow style={{color:'var(--mute)'}}/>
          </button>
        ))}
      </div>

      <SectionHead title="Outline + transcript"/>
      <div className="col" style={{border:'1px solid var(--line)'}}>
        {LESSON.outline.map((s,i) => (
          <div key={s.n} style={{padding:'16px 20px',borderTop: i ? '1px solid var(--line)' : 'none'}} className="row between">
            <div className="row gap-4" style={{alignItems:'baseline'}}>
              <span className="mono" style={{fontSize:11,color:'var(--mute-2)'}}>0{s.n}</span>
              <span className="serif" style={{fontSize:18}}>{s.label}</span>
            </div>
            <button className="btn btn-text small" onClick={() => go('player')}><Icon.play/> Replay</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// — Mistakes overview —
function MistakesScreen({ go }) {
  const [tab, setTab] = useState('common');
  return (
    <div className="page fade-in">
      <SectionHead num="01 / Diagnostic" title="What's tripping you up." sub="Patterns we've seen across 12 lessons. Practice anything here, or push it into the next lesson."/>

      <div className="row gap-2" style={{marginBottom:32,borderBottom:'1px solid var(--line)'}}>
        {[['common','Most common (12)'],['recent','Recent (this week)'],['categories','By category']].map(([id,l]) => (
          <button key={id} onClick={() => setTab(id)} style={{background:'transparent',border:0,padding:'12px 16px',cursor:'pointer',color: tab===id ? 'var(--ink)' : 'var(--mute)',borderBottom: tab===id ? '1px solid var(--ink)' : '1px solid transparent',marginBottom:-1,fontFamily:'var(--mono)',fontSize:11,letterSpacing:'.1em',textTransform:'uppercase'}}>{l}</button>
        ))}
      </div>

      {tab === 'common' && (
        <div className="col" style={{border:'1px solid var(--line)'}}>
          {COMMON_MISTAKES.map((m,i) => (
            <div key={m.id} style={{padding:'24px 28px',borderTop: i ? '1px solid var(--line)' : 'none'}} className="card-hover" onClick={() => go('mistake-detail')}>
              <div className="row between" style={{alignItems:'baseline'}}>
                <div className="row gap-4" style={{alignItems:'baseline',flex:1}}>
                  <span className="mono" style={{fontSize:11,color:'var(--mute-2)',width:24}}>{String(i+1).padStart(2,'0')}</span>
                  <div className="col gap-2" style={{flex:1}}>
                    <div className="row gap-3" style={{alignItems:'baseline'}}>
                      <span className="serif" style={{fontSize:24,letterSpacing:'-.005em'}}>{m.name}</span>
                      <Tag kind={m.severity==='high'?'crit':m.severity==='med'?'warm':'mute'}>{m.severity}</Tag>
                      <Tag kind="mute">{m.cat}</Tag>
                    </div>
                    <div className="row gap-6">
                      <span className="kicker">Missed <span className="tabular" style={{color:'var(--ink-2)'}}>{m.count}×</span></span>
                      <span className="kicker">Last · {m.last}</span>
                      {m.wrong && <span className="kicker">Common wrong · <span style={{fontFamily:'var(--serif)',fontStyle:'italic',color:'var(--mute)'}}>{m.wrong}</span></span>}
                      {m.right && <span className="kicker">Target · <span style={{fontFamily:'var(--serif)',fontStyle:'italic',color:'var(--warm)'}}>{m.right}</span></span>}
                    </div>
                  </div>
                </div>
                <div className="row gap-2" style={{alignSelf:'center'}}>
                  <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); go('builder'); }}>Practice</button>
                  <button className="btn btn-text small" onClick={e => { e.stopPropagation(); go('mistake-detail'); }}>Explain <Icon.arrow/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'recent' && (
        <div className="col gap-6">
          {[['Today',['Used "quieres" instead of "querés" · in "Making plans"','Forgot "me" in "me traés" · in "Making plans"','Took 9.2 sec to respond to a future-tense prompt']],
            ['Yesterday',['Misheard "dale" as "vale"','Slow response to "¿De dónde sos?"']],
            ['May 7',['"Deseo un café" instead of "Quiero un café"','Confused "por" and "para" twice']]
          ].map(([day, items]) => (
            <div key={day}>
              <span className="eyebrow">{day}</span>
              <ul style={{margin:'12px 0 0',padding:0,listStyle:'none'}}>
                {items.map((t,i) => (
                  <li key={i} className="row gap-3" style={{padding:'12px 0',borderTop:'1px solid var(--line)',alignItems:'baseline'}}>
                    <span style={{color:'var(--crit)',fontSize:9,marginTop:6}}>●</span>
                    <span className="body" style={{flex:1}}>{t}</span>
                    <button className="btn btn-text small" style={{padding:'0 4px'}} onClick={() => go('mistake-detail')}>Explain</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === 'categories' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:'var(--line)',border:'1px solid var(--line)'}}>
          {[['Conjugation',14,'Mostly vos forms'],['Speed',11,'Direct questions hesitation'],['Grammar',8,'Object pronouns'],['Tense',6,'Pretérito vs imperfecto'],['Listening',5,'Fast casual phrases'],['Naturalness',3,'Overformal word choices'],['Pronunciation',2,'STT had trouble'],['Vocabulary',1,'Scenario-specific gaps'],['Flow',1,'Socially abrupt answer']].map(([n,c,s],i) => (
            <div key={n} className="card-hover" style={{background:'var(--bg)',padding:24,cursor:'pointer'}}>
              <div className="row between" style={{marginBottom:12}}>
                <span className="eyebrow">{n}</span>
                <span className="serif" style={{fontSize:20}}>{c}</span>
              </div>
              <p className="small" style={{margin:0}}>{s}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MistakeDetailScreen({ go }) {
  return (
    <div className="page-narrow fade-in">
      <button className="btn btn-text small" style={{paddingLeft:0,marginBottom:12}} onClick={() => go('mistakes')}><Icon.arrowLeft/> All mistakes</button>
      <span className="eyebrow eyebrow-warm">Conjugation · 14 misses</span>
      <h1 className="h-1" style={{marginTop:14,marginBottom:24}}>Vos: <em style={{fontStyle:'italic',color:'var(--warm)'}}>tenés</em> vs <em style={{fontStyle:'italic',textDecoration:'line-through',textDecorationColor:'var(--mute-2)'}}>tienes</em>.</h1>
      <p className="lede" style={{maxWidth:640,marginBottom:40}}>In Argentine Spanish, people use <span className="serif" style={{fontStyle:'italic'}}>vos</span> instead of <span className="serif" style={{fontStyle:'italic'}}>tú</span>. So "you have" is usually <span className="serif" style={{fontStyle:'italic'}}>vos tenés</span>, not <span className="serif" style={{fontStyle:'italic'}}>tú tienes</span>. This is not slang — it's the normal everyday form.</p>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,border:'1px solid var(--line)',marginBottom:48}}>
        <div style={{padding:'28px 28px',background:'var(--bg-2)'}}>
          <span className="eyebrow eyebrow-warm">Target · Argentine</span>
          <p className="serif" style={{fontSize:32,fontStyle:'italic',marginTop:14}}>“¿Tenés tiempo?”</p>
          <p className="small" style={{marginTop:6}}>What you'll hear in BA, Mendoza, Rosario.</p>
        </div>
        <div style={{padding:'28px 28px',borderLeft:'1px solid var(--line)'}}>
          <span className="eyebrow">Less Argentine</span>
          <p className="serif" style={{fontSize:32,fontStyle:'italic',marginTop:14,color:'var(--mute)'}}>“¿Tienes tiempo?”</p>
          <p className="small" style={{marginTop:6}}>Understandable, but immediately marks you as not local.</p>
        </div>
      </div>

      <SectionHead title="Hear it in context" right={<button className="btn btn-text small"><Icon.play/> Play all</button>}/>
      <div className="col" style={{border:'1px solid var(--line)',marginBottom:48}}>
        {TENES_EXAMPLES.map((e, i) => (
          <div key={i} className="row gap-4 card-hover" style={{padding:'14px 20px',borderTop: i ? '1px solid var(--line)' : 'none',alignItems:'center'}}>
            <button className="btn btn-icon btn-ghost" style={{width:32,height:32}}><Icon.play/></button>
            <span className="mono" style={{fontSize:11,color:'var(--mute-2)',width:28}}>{String(i+1).padStart(2,'0')}</span>
            <span className="serif" style={{fontSize:20,fontStyle:'italic',flex:1}}>“{e}”</span>
            <Wave count={20} height={16}/>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32,marginBottom:48}}>
        <div>
          <span className="eyebrow">Pattern</span>
          <table style={{width:'100%',borderCollapse:'collapse',marginTop:14,fontFamily:'var(--mono)',fontSize:13}}>
            <tbody>
              {[['tener','tenés'],['querer','querés'],['poder','podés'],['venir','venís'],['decir','decís'],['saber','sabés']].map(([a,b]) => (
                <tr key={a}>
                  <td style={{padding:'10px 0',borderBottom:'1px solid var(--line)',color:'var(--mute)'}}>{a}</td>
                  <td style={{padding:'10px 0',borderBottom:'1px solid var(--line)',textAlign:'right',color:'var(--warm)'}}>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <span className="eyebrow">Why it matters</span>
          <p className="lede" style={{marginTop:14,fontSize:18,lineHeight:1.5,maxWidth:480}}>You'll hear "tenés" constantly in Argentina. Saying "tienes" is grammatically fine but immediately marks you as not from here. Once it's automatic, the rest of <span className="serif" style={{fontStyle:'italic'}}>vos</span> conjugation falls into place.</p>
          <div className="row gap-2" style={{marginTop:16}}>
            <button className="chip">Short explanation</button>
            <button className="chip selected">Medium</button>
            <button className="chip">Deep dive</button>
          </div>
        </div>
      </div>

      <div className="row gap-3" style={{flexWrap:'wrap'}}>
        <button className="btn btn-warm" onClick={() => go('player')}><Icon.spark/> Generate short drill · 5 min</button>
        <button className="btn btn-ghost" onClick={() => go('builder')}>Generate medium drill · 12 min</button>
        <button className="btn btn-ghost">Add to next lesson</button>
        <button className="btn btn-text" style={{marginLeft:'auto'}}>Test me on this <Icon.arrow/></button>
      </div>
    </div>
  );
}

function SettingsScreen({ go }) {
  const [showRetest, setShowRetest] = useState(false);
  return (
    <div className="page-narrow fade-in">
      <SectionHead num="01 / Settings" title="Profile and preferences."/>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,border:'1px solid var(--line)',marginBottom:48}}>
        {[['Level','B1','last tested Apr 14'],['Lessons','12','since Apr 7'],['Streak','5 days','best 11'],['Total speaking','4h 32m','avg 22 min']].map(([k,v,s],i) => (
          <div key={k} style={{padding:'24px',borderTop: i > 1 ? '1px solid var(--line)' : 'none',borderLeft: i % 2 ? '1px solid var(--line)' : 'none'}}>
            <span className="eyebrow">{k}</span>
            <div className="serif" style={{fontSize:32,marginTop:6}}>{v}</div>
            <span className="kicker">{s}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" style={{marginBottom:48}} onClick={() => setShowRetest(true)}><Icon.refresh/> Retest my level</button>
      {showRetest && <div className="card fade-in" style={{padding:24,marginBottom:48,borderColor:'var(--warm)'}}><span className="eyebrow eyebrow-warm">Retest available</span><p className="body" style={{marginTop:8,marginBottom:16}}>Takes ~10 minutes. Your profile and recommendations will update.</p><div className="row gap-2"><button className="btn btn-warm btn-sm" onClick={() => { setShowRetest(false); go('leveltest'); }}>Start retest</button><button className="btn btn-text btn-sm" onClick={() => setShowRetest(false)}>Cancel</button></div></div>}

      <SettingGroup title="Dialect" sub="What kind of Spanish you're learning. Argentine is the default and the recommended target.">
        <SettingRow label="Target Spanish" right={<select className="select-field" style={{width:280}} defaultValue="rio"><option value="rio">Rioplatense / Argentine</option><option value="latam" disabled>Neutral Latin American · soon</option><option value="es" disabled>Spain · soon</option><option value="mx" disabled>Mexico · soon</option></select>}/>
      </SettingGroup>

      <SettingGroup title="Lesson behavior">
        <SettingRow label="Explanation depth during lessons" right={<Segmented options={['Minimal','Moderate','Detailed']} value="Minimal"/>}/>
        <SettingRow label="Default lesson length" right={<Segmented options={['10','15','25','40']} value="25" suffix=" min"/>}/>
        <SettingRow label="Default difficulty" right={<Segmented options={['Easier','Normal','Harder']} value="Normal"/>}/>
        <SettingRow label="Default focus" right={<select className="select-field" style={{width:280}} defaultValue="recent">{FOCUSES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>}/>
        <SettingRow label="Correction strictness" right={<Segmented options={['Lenient','Standard','Strict']} value="Standard"/>}/>
      </SettingGroup>

      <SettingGroup title="Audio">
        <SettingRow label="Default voice" right={<select className="select-field" style={{width:280}} defaultValue="lucia"><option value="lucia">Lucía · Buenos Aires, female, 30s</option><option value="diego">Diego · Rosario, male, 40s</option><option value="vale">Valentina · Córdoba, female, 20s</option></select>}/>
        <SettingRow label="Playback speed" right={<Segmented options={['0.85×','1.0×','1.1×','1.25×']} value="1.0×"/>}/>
        <SettingRow label="Replay speed" right={<Segmented options={['0.7×','0.85×','1.0×']} value="0.85×"/>}/>
        <SettingRow label="Show transcript by default" right={<Toggle value={false}/>}/>
        <SettingRow label="Show translation by default" right={<Toggle value={false}/>}/>
      </SettingGroup>

      <SettingGroup title="Account">
        <SettingRow label="Email" right={<span className="small mono">mateo@example.com</span>}/>
        <SettingRow label="Export your data" right={<button className="btn btn-text small">Export JSON</button>}/>
        <SettingRow label="Reset profile" right={<button className="btn btn-text small" style={{color:'var(--crit)'}}>Reset everything</button>}/>
      </SettingGroup>
    </div>
  );
}

function SettingGroup({ title, sub, children }) {
  return (
    <div style={{marginBottom:40}}>
      <div style={{paddingBottom:16,borderBottom:'1px solid var(--line)',marginBottom:0}}>
        <h3 className="h-4" style={{fontFamily:'var(--serif)',fontWeight:400,fontSize:22}}>{title}</h3>
        {sub && <p className="small" style={{marginTop:6,maxWidth:520}}>{sub}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}
function SettingRow({ label, right }) {
  return (
    <div className="row between" style={{padding:'18px 0',borderBottom:'1px solid var(--line)',alignItems:'center',gap:24}}>
      <span style={{fontSize:14,color:'var(--ink-2)'}}>{label}</span>
      <div>{right}</div>
    </div>
  );
}
function Segmented({ options, value, suffix='' }) {
  const [v, setV] = useState(value);
  return (
    <div className="row" style={{border:'1px solid var(--line)',borderRadius:4,overflow:'hidden'}}>
      {options.map((o, i) => (
        <button key={o} onClick={() => setV(o)} style={{padding:'8px 14px',background: o===v ? 'var(--ink)' : 'transparent',color: o===v ? '#100e0c' : 'var(--ink-2)',border:0,borderLeft: i ? '1px solid var(--line)' : 0,cursor:'pointer',fontSize:12,fontFamily:'var(--sans)',fontVariantNumeric:'tabular-nums'}}>{o}{suffix}</button>
      ))}
    </div>
  );
}
function Toggle({ value }) {
  const [on, setOn] = useState(value);
  return (
    <button onClick={() => setOn(o => !o)} style={{width:40,height:22,borderRadius:999,background: on ? 'var(--ink)' : 'var(--bg-3)',border:'1px solid var(--line-2)',position:'relative',cursor:'pointer',padding:0}}>
      <span style={{position:'absolute',top:1,left: on ? 19 : 1,width:18,height:18,borderRadius:'50%',background: on ? '#100e0c' : 'var(--mute)',transition:'all .18s'}}/>
    </button>
  );
}

Object.assign(window, { ReportScreen, FinishedScreen, MistakesScreen, MistakeDetailScreen, SettingsScreen });
