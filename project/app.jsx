// app.jsx — main App, navigation, Tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "player": "orb",
  "density": "regular",
  "argentineFlavor": "medium",
  "fontPair": "newsreader-inter"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState('welcome');
  const [builder, setBuilder] = useState({
    scenario: 'restaurant',
    focus: 'recent',
    mistakes: ['tenes','slow'],
    grammar: [],
    difficulty: 'Normal',
    length: 25,
    custom: '',
  });

  const go = useCallback((s) => {
    setScreen(s);
    window.scrollTo({top:0, behavior:'instant'});
  }, []);

  // Apply density and font pairing
  useEffect(() => {
    document.body.classList.toggle('density-compact', t.density === 'compact');
    if (t.fontPair === 'fraunces-inter') {
      document.documentElement.style.setProperty('--serif', "'Fraunces', 'Newsreader', Georgia, serif");
    } else if (t.fontPair === 'newsreader-mono') {
      document.documentElement.style.setProperty('--sans', "'JetBrains Mono', ui-monospace, monospace");
    } else {
      document.documentElement.style.removeProperty('--serif');
      document.documentElement.style.removeProperty('--sans');
    }
  }, [t.density, t.fontPair]);

  const screenLabels = {
    welcome:'01 Welcome', leveltest:'02 Level test', levelresult:'03 Level result',
    dashboard:'04 Dashboard', builder:'05 Builder', preview:'06 Preview',
    player:'07 Player', report:'08 Report', finished:'09 Finished lessons',
    mistakes:'10 Mistakes', 'mistake-detail':'11 Mistake detail', settings:'12 Settings'
  };

  // Map alias from screens
  const realScreen = screen === 'finished-detail' ? 'finished' : screen;

  const renderScreen = () => {
    switch (realScreen) {
      case 'welcome':       return <WelcomeScreen go={go}/>;
      case 'leveltest':     return <LevelTestScreen go={go}/>;
      case 'levelresult':   return <LevelResultScreen go={go}/>;
      case 'dashboard':     return <Dashboard go={go} setBuilder={setBuilder}/>;
      case 'builder':       return <BuilderScreen go={go} builder={builder} setBuilder={setBuilder}/>;
      case 'preview':       return <PreviewScreen go={go} builder={builder}/>;
      case 'player':        return <PlayerScreen go={go} variant={t.player}/>;
      case 'report':        return <ReportScreen go={go}/>;
      case 'finished':      return <FinishedScreen go={go}/>;
      case 'mistakes':      return <MistakesScreen go={go}/>;
      case 'mistake-detail':return <MistakeDetailScreen go={go}/>;
      case 'settings':      return <SettingsScreen go={go}/>;
      default: return <WelcomeScreen go={go}/>;
    }
  };

  const showTopNav = !['welcome','leveltest','levelresult'].includes(realScreen);

  return (
    <div className="app" data-screen-label={screenLabels[realScreen] || realScreen}>
      {showTopNav && <TopNav current={realScreen} go={go}/>}
      {!showTopNav && (
        <div className="topnav" style={{borderBottom:'none',background:'transparent'}}>
          <div className="topnav-inner" style={{gridTemplateColumns:'auto 1fr auto'}}>
            <div className="brand"><span className="brand-mark"></span><span>Che <em>Spanish</em></span></div>
            <span></span>
            <span className="kicker">{screenLabels[realScreen]}</span>
          </div>
        </div>
      )}
      {renderScreen()}

      {/* Footer screen-jumper, helps the user / reviewer try every screen */}
      {showTopNav && (
        <footer style={{borderTop:'1px solid var(--line)',padding:'40px 32px 24px',marginTop:48}}>
          <div style={{maxWidth:1320,margin:'0 auto'}}>
            <div className="row between" style={{alignItems:'baseline',marginBottom:18}}>
              <span className="eyebrow">Prototype · jump to any screen</span>
              <span className="kicker">12 screens</span>
            </div>
            <div className="row gap-2" style={{flexWrap:'wrap'}}>
              {Object.entries(screenLabels).map(([k,v]) => (
                <button key={k} onClick={() => go(k)} className={'chip chip-square' + (realScreen === k ? ' selected' : '')}>{v}</button>
              ))}
            </div>
            <p className="small" style={{marginTop:24,color:'var(--mute-2)',maxWidth:560}}>Toggle <span className="mono">Tweaks</span> in the toolbar to switch lesson player layouts and visual density.</p>
          </div>
        </footer>
      )}

      <TweaksPanel>
        <TweakSection label="Lesson player" />
        <TweakRadio label="Layout"
          value={t.player}
          options={[
            { value:'editorial',    label:'Editorial' },
            { value:'orb',          label:'Audio orb' },
            { value:'conversation', label:'Conversation' },
          ]}
          onChange={(v) => { setTweak('player', v); if (realScreen !== 'player') go('player'); }} />
        <p style={{margin:'4px 2px 0',color:'rgba(41,38,27,.55)',fontSize:11,lineHeight:1.4}}>Editorial · horizontal scrubber. Orb · meditation/podcast feel. Conversation · chat-style turns.</p>

        <TweakSection label="Layout" />
        <TweakRadio label="Density"
          value={t.density}
          options={['regular', 'compact']}
          onChange={(v) => setTweak('density', v)} />
        <TweakRadio label="Argentine flavor"
          value={t.argentineFlavor}
          options={['subtle', 'medium', 'bold']}
          onChange={(v) => setTweak('argentineFlavor', v)} />
        <TweakSelect label="Font pairing"
          value={t.fontPair}
          options={[
            { value:'newsreader-inter', label:'Newsreader + Inter Tight' },
            { value:'fraunces-inter',   label:'Fraunces + Inter Tight' },
            { value:'newsreader-mono',  label:'Newsreader + Mono body' },
          ]}
          onChange={(v) => setTweak('fontPair', v)} />

        <TweakSection label="Demo" />
        <TweakButton onClick={() => go('player')}>Open lesson player</TweakButton>
        <TweakButton onClick={() => go('welcome')}>Restart from welcome</TweakButton>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
