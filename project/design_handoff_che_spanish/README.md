# Handoff: Che Spanish — Audio-First Rioplatense Spanish Tutor

## Overview

Che Spanish is an audio-first Spanish learning web app built for adult learners who want to speak natural Argentine (Rioplatense) Spanish. The app generates personalized speaking lessons, pauses for the learner to respond out loud, transcribes & grades the response, logs mistakes, and adapts future lessons.

This handoff documents a complete hi-fi design prototype covering all 12 screens of the v1 product loop, from welcome → level test → dashboard → lesson builder → preview → player → report → review surfaces (mistakes, finished lessons, settings).

The hero surface is the **lesson player**, designed with three layout variants (orb, editorial, conversation) toggleable via the in-prototype Tweaks panel. The default is the **orb** — a circular waveform-with-section-arcs visualization with hover-to-preview behavior, sentence-by-sentence subtitles, mistake markup, and an "ask a question" interrupt flow.

---

## About the Design Files

The `prototype/` folder contains a working **HTML/JSX design reference** — a high-fidelity, clickable mockup that demonstrates the intended look, feel, and interaction model of the app. **It is not production code.**

The expected build target (per the original spec) is:

- **Next.js + React** (app router)
- **Tailwind CSS** for styling
- **Supabase** (Postgres + auth) for the backend
- **Desktop browser only** for v1

Recreate the screens in that environment using its conventions. The CSS variables in `styles.css` translate cleanly into a Tailwind theme; the component shapes in the JSX files are a faithful starting point but should be re-expressed as proper React components with TypeScript types.

---

## Fidelity

**High-fidelity.** Final colors, typography, spacing, copy, micro-interactions, and animation feel are all settled. The developer should reproduce these pixel-faithfully — substituting backend/audio/STT plumbing for the in-prototype fakes.

---

## Design System

### Aesthetic direction

Editorial dark — closer to a meditation app or NYT Audio than a classroom. Generous whitespace, italic serif headlines, monospaced eyebrows for chrome/labels, warm amber accent inspired by mate / pampas / Buenos Aires sunset.

### Color tokens

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#0a0908` | App background |
| `--bg-1` | `#100e0c` | Slightly raised surfaces (input fields) |
| `--bg-2` | `#15130f` | Card background |
| `--bg-3` | `#1c1a15` | Hover state for cards / pills |
| `--bg-4` | `#25221c` | Selected/raised surfaces |
| `--line` | `#2a2620` | Default border |
| `--line-2` | `#3a342b` | Hover/emphasized border |
| `--ink` | `#f5f1e8` | Primary text + primary button bg |
| `--ink-2` | `#d6cfbf` | Secondary text |
| `--mute` | `#8a8478` | Tertiary text / kicker labels |
| `--mute-2` | `#5e584d` | Disabled / placeholder text |
| `--warm` | `#d4a574` | Accent — mate / pampas / argentine sunset |
| `--warm-deep` | `#b8814c` | Accent on hover / brand mark gradient |
| `--leaf` | `#7d8a6a` | Yerba green — used sparingly for "good" status |
| `--crit` | `#c97064` | Faded brick — mistakes, errors, recording dot |
| `--ok` | `#9bb591` | Success state |

### Typography

| Family | Loaded as | Use |
|---|---|---|
| Newsreader (Google Fonts) | `--serif` | Display, headlines, italic flourishes, transcripts |
| Inter Tight (Google Fonts) | `--sans` | Body, buttons, navigation, dense UI |
| JetBrains Mono (Google Fonts) | `--mono` | Eyebrows, kickers, timestamps, numeric labels |

Type scale (see `.h-display` … `.small` in `styles.css`):

- Display 88px / line 0.95 / weight 300 — used once, on Welcome
- H1 56px — section openers
- H2 38px — primary screen titles
- H3 26px — card titles
- H4 20px — sub-section titles
- Lede 22px serif weight 300 — intro paragraphs
- Body 14.5px sans
- Small 12.5px sans
- Eyebrow 10.5px mono uppercase, letter-spacing .18em
- Kicker 11px mono, letter-spacing .06em

### Spacing

Tailwind-compatible 4px scale. Helpers: `.gap-1` (4) … `.gap-12` (48). Page horizontal padding 32px, vertical 56–96px. Max content width 1320px (1320 wide), 920px narrow.

### Radius & elevation

- Cards: 6px
- Inputs/buttons: 4px
- Small buttons: 3px
- Pills/chips: 999px
- No drop shadows by default (editorial dark relies on contrast). One shadow exists on the orb's centre-play button: `0 8px 32px rgba(0,0,0,.5)`.

### Iconography

Currently a small inline-SVG set (`Icon.*` in `components.jsx`). Replace with a real icon library (Lucide is a good fit — same stroke style). Icons used: play, pause, mic, arrow-right, arrow-left, refresh, x, sparkle, plus, check, settings.

### Branding moments

- **`.brand-mark`** — a 22px circular gradient (warm amber → warm-deep → brown) with a tiny straw/bombilla sticking out the top. Stands in for a logo. Drawn in CSS via `radial-gradient` + `::after`.
- **Wordmark** — "che" in italic warm serif + "spanish" in upright `--ink` serif.
- **"che" voice** — micro-copy uses Argentine flavor sparingly: "buen laburo" (well done), "dale" (alright), "che" interjections in example phrases. Never slangy or showy; it should feel native, not novelty.

---

## App Structure & Navigation

### Top-level routes

```
/welcome          (no nav, full-bleed)
/level-test       (no nav, focus mode)
/dashboard        Home
/lessons          Finished Lessons
/mistakes         Mistakes overview
/mistakes/:id     Mistake detail
/settings         Profile & preferences
```

The lesson flow lives inside `/dashboard` → `/builder` → `/preview` → `/player` → `/report`. Player is full-bleed with its own minimal top bar (exit + title + ask button).

### Navigation component

Sticky top nav at 60px height, blurred backdrop. Three columns: brand (left), pill nav (center), profile chip + level pill (right). The level pill (e.g. "B1 · 12 lessons") is a fast-glance summary.

Hide top nav entirely during welcome, level test, lesson player, and lesson preview — these are focus modes.

---

## Screen-by-screen documentation

### 1. Welcome (`screens-onboarding.jsx → Welcome`)

**Purpose** — entry point. First-time users get a level test; returning users continue.

**Layout** — split layout, 60/40. Left column: large display headline ("Speak Spanish, *che.*" — italic warm), one-line lede, two stacked buttons (primary "Test my level", ghost "Continue"). Right column: an `<image-slot>` placeholder for a tutor portrait, square aspect ratio, with kicker label "YOUR TUTOR · MARTÍN" beneath.

**Behavior** — primary CTA → `/level-test`. Secondary CTA → `/dashboard` (assumes existing profile).

**State** — first-time vs returning toggles whether "Continue" is shown. For multiple profiles, "Continue" should open a profile selector (future).

---

### 2. Level Test (`screens-onboarding.jsx → LevelTest`)

**Purpose** — ~10 minute placement test, audio-first, that estimates A1–C2 level.

**Layout** — narrow (920px), centered. Top bar: thin progress ladder (8 steps, current filled warm), "EXIT" text button right. Below: prompt-type eyebrow ("LISTEN AND UNDERSTAND" / "SPEAK THE PHRASE" / "COMPLETE THE IDEA" / "GRAMMAR CHECK" / "MINI ROLEPLAY"). Below: large serif italic prompt cue. Then waveform/play row. Then mic button when ready. Then transcript reveal area.

**Prompt types** — five distinct types, see spec. Each shares the same chrome; only the cue text and the response affordance change.

**Mic states** (shared across player + level test):
1. **Disabled** — audio playing
2. **Ready** — pulsing warm halo, label "Tap to respond"
3. **Recording** — red `.crit` halo, timer counting up, stop button replaces mic, faint waveform animation
4. **Processing** — spinner, "Hearing you…"
5. **Complete** — transcript appears, brief feedback chip

**Brief feedback** — "Good." / "Understandable, but not Argentine." / "Close. The Argentine form would be 'tenés.'" / "We'll mark this for review." Never long during the test.

**Completion** — Result screen showing level (e.g. "B1"), four-bullet skill summary, recommended first lesson card with primary CTA "Start lesson" and secondary "Go to dashboard."

---

### 3. Dashboard (`screens-build.jsx → Dashboard`)

**Purpose** — home. Configure & generate today's lesson, see profile snapshot, navigate.

**Layout** — single column, page width 1320. Top: numbered section heads ("01 / Generate", "02 / Recent activity") set the editorial rhythm.

**Section 01 — "What do you want to practice today?"**
1. **Custom prompt box** (`DashboardCustomPrompt`) — full-width card, mate-icon glyph at left, italic serif textarea, primary "Generate" button at right. 4 dashed example chips below as inspiration. ⌘/Ctrl+Enter submits. Submitting jumps directly to `/preview`, passing the typed text as `builder.custom` and setting scenario/focus to `auto`.
2. **Or pick a scenario** — section divider with kicker count "8 of 14". 4-column grid of 8 scenario tiles (Restaurant, Café, Taxi, Soccer game, Apartment, Date, Small talk, WhatsApp voice). Tile = 1×1 square card, name in serif, faint motif (mate, gaucho, etc).

**Section 02 — Recommended next**
- Wide card: italic serif "Practice making plans and responding faster" + reasoning paragraph ("You hesitate on open-ended responses and still miss some vos forms.") + tag chips for the focus areas + primary CTA "Start recommended lesson".

**Sidebar/right column** — profile snapshot card: current level (B1), lessons completed (12), current streak, last lesson date. Below: "Recent mistakes" preview (3 most recent linking to `/mistakes`).

**Top nav level pill** — `B1 · 12 lessons` always visible.

---

### 4. Lesson Builder (`screens-build.jsx → BuilderScreen`)

**Purpose** — fine-grained lesson configuration.

**Layout** — narrow page. Stacked sections, each with monospaced label.

**Sections (in order)**:
1. **Scenario** — pills wrap. First pill is `✦ Choose for me` (warm dashed border). Then 14 scenario chips. Selecting "Choose for me" sets `scenario: 'auto'`; selecting anything else replaces it.
2. **Focus** — pills wrap. `✦ Choose for me` first, then 8 focus options (Recent mistakes, Common mistakes, Grammar, Listening, Faster responses, Pronunciation, Conversation flow, Balanced). Warm-tinted selected style.
3. **Recent mistakes** — *only renders when focus = "Recent mistakes" or "Common mistakes"*. Multi-select checkbox list of 5 actual mistakes from the user's profile.
4. **Grammar targets** — *only renders when focus = "Grammar"*. Multi-select pill cluster, with a `✦ Choose for me` pill that's mutually exclusive with the manual options. 12 topics from spec.
5. **Difficulty** (`DifficultySlider` component) — 7-step custom slider, ticks at -3..+3. Track is a thin line; 7 dots; the active dot is enlarged and warm. Center label *floats* above the active step in mono uppercase ("EASIER" / "NORMAL" / "HARDER"). Below the slider, three columns: left kicker `A2.7 · easier`, center large italic serif level (computed: -3=A2.7, -2=A2.8, -1=A2.9, 0=B1.0, +1=B1.1, +2=B1.2, +3=B1.3), right kicker `harder · B1.3`. Description line below.
6. **Length** — radio segmented control, 4 options (10/15/25/40 min). Default 25.
7. **Custom prompt** — textarea, italic serif placeholder.

**Right rail summary card (sticky)** — summarizes Level/Length/Scenario/Focus/Grammar values, then a primary CTA "Generate lesson". Shows "Choose for me" when scenario or focus = `auto`.

---

### 5. Generated Lesson Preview (`screens-build.jsx → PreviewScreen`)

**Purpose** — show what will be practiced before opening the player.

**Layout** — wide page, two columns.

**Left** — italic serif lesson title ("Making plans with a friend"), metadata row (duration / level / scenario / focus / grammar tags), then numbered outline (1. Warm-up review, 2. New phrases, 3. Prompt-response drills, 4. Listening dialogue, 5. Roleplay, 6. Recap). Then "Expected goals" bullet list.

**Right** — sticky action card. Primary "Start lesson", secondary buttons: "Regenerate", "Edit settings", "Save for later". Below, a "Why this lesson?" italic paragraph explaining personalization ("This lesson is based on your recent mistakes with 'tenés,' slow responses…").

---

### 6. Lesson Player — three variants (`player.jsx`)

The player is the hero of the app. Three layouts, switchable via Tweaks panel. **Default = `orb`.**

#### Shared state machine — `useFakePlayer`

```
idle → playing → prompting (audio paused at a checkpoint)
                  → recording (mic active)
                  → processing (transcribing/grading)
                  → feedback (correction shown)
                  → next() → playing again, OR complete
asking (overlay) → answering (overlay) → resume previous state
```

`progress` is 0..1. Prompts have timestamps `t` ∈ [0,1]. Sections (`SECTIONS` constant) are arcs `[pct, end]` — six of them, named per spec.

#### 6a. Orb player (DEFAULT)

**Hero element** — a 380×380 SVG orb, centered.

Construction:
- **Outer faint ring** at r=175, hairline `--line`.
- **Inner faint ring** at r=130 — visual anchor for the audio bars.
- **Six section arcs** between r=142 (the main ring). Each arc spans its `[pct, end]` range. Inactive: hairline `--line-2`. Past: `--ink-2`. Active: thick (4px) `--warm`. Hovered: same warm treatment as active. Click an arc to scrub.
- **Prompt dots** at each `prompts[i].t` on the main ring. Tiny circles (r=5), faint border when not yet reached, filled warm when past.
- **Progress head** — solid 6px `--ink` dot at the current progress angle.
- **Audio bars** — 72 thin lines radiating inward from r=110, each animated to a height when active. Color flips to `--crit` while recording.
- **Section labels around the perimeter** — *positioned outside the orb* using polar coordinates at r=195. Each label = mono number ("01") above serif name ("Warm-up review"). Labels fade to 55% opacity unless their section is active or hovered. Click to scrub. Labels right-align when on the left half of the orb.
- **Soft warm halo** — a radial-gradient div behind the SVG that pulses (`pulse 2.4s ease-in-out infinite`) when audio is playing.

**Centre control** swaps based on state:
- idle/playing: 84×84 round `--ink` button with play/pause icon, soft black drop shadow
- prompting: warm `mic-btn` at 96×96
- recording: red pulsing `mic-btn.recording`
- processing: 36px spinner
- feedback: small "● Almost" tag + "2 ISSUES" mono caption
- asking/answering: spark icon + status caption ("PAUSED · ASK" / "ANSWERING")

**Below the orb** (in order):
1. **Section description** — fades in when a section is active or hovered. Eyebrow ("SECTION 01 · WARM-UP REVIEW") + italic serif blurb ("Quick recap of phrases from your last lesson…"). 64px reserved height to prevent layout jump.
2. **"Show text" toggle** — ghost small button.
3. **Subtitle card** (when text on) — 680px wide blurred-backdrop card. Shows ONE sentence at a time from `SUBTITLE_LINES`, cycling every 3.2s while audio plays. Counter "CC · 1/3" at top. Italic serif sentence in quotes. Mimics YouTube subtitles but slower and editorial.
4. **Prompt cue** — when state is `prompting`, replaces subtitle with "Your turn · respond now" + the cue in big italic serif.
5. **Feedback panel** (`UserResponseAnalysis`) — when state is `feedback`. See below.
6. **Continue / Try again / Hear correct** action row.

**`UserResponseAnalysis` component** — central to the player's value:
- Card with eyebrow "YOU SAID" + counter "2 issues · tap a word".
- Italic serif sentence with **wrong tokens marked as buttons**, styled with red wavy underlines (`text-decoration: underline wavy var(--crit)`, offset 5px).
- Tap a wrong token → expands an inline panel beneath the sentence with a left border in `--crit`, eyebrow showing category ("Conjugation · 'Tienes'"), a serif italic explanation ("Use the vos form: 'Tenés'"), and two CTAs: **"✦ Explain it to me"** (jumps to `/mistakes/:id`), **"▶ Hear it correctly"**.
- Below a hairline divider: "TARGET" eyebrow + the correct sentence.

**Top bar** — exit button (left) | centred title + progress mono caption | **"✦ Ask a question"** button (right).

**Bottom dock** — full-width scrubber with section markers, current time / total time mono labels.

#### Ask-a-question flow (orb only, but available in all variants)

1. User taps "✦ Ask a question" anywhere in the player.
2. State transitions: `prevState = currentState; pause everything; state = 'asking'`.
3. Modal overlay (z-200) fades in over a blurred dark scrim.
4. Card content — eyebrow "● PAUSED · ASK YOUR TUTOR", h3 "What do you want to know?", italic serif textarea with placeholder ("Why did she say 'dale' there?"). 3 quick-ask chips. Cancel + "✦ Ask" buttons.
5. On submit, state → `'answering'`. The same modal swaps content: shows the question, then a streaming-style answer with brand mark, italic serif response with key terms warm-tinted.
6. After ~2.2s (or user dismiss), state restores to `prevState`. If it was `playing`, lesson resumes; if `prompting`, the prompt is still waiting for the user.

#### 6b. Editorial player (variant)

- 920px narrow page. Top scrubber with section markers. Below: an 80×80 round play button + waveform stack + show-text toggle + ask button. Linear, editorial, more like a podcast app.
- Feedback shown as a card below the controls.

#### 6c. Conversation player (variant)

- 760px chat-style. Tutor messages on the left with brand mark, user responses on the right in `--ink` bubbles. Sticky action bar at bottom that swaps Play / Hold to respond / Continue / See report based on state. Ask button in the top bar.

---

### 7. Lesson Report (`screens-review.jsx → ReportScreen`)

**Purpose** — post-lesson summary + recommended next steps.

**Layout** — narrow. "Lesson complete · 100%" eyebrow, italic serif title, large display tabular numerals for completion time + average response time. Two-column grid: "What went well" (3 bullets) + "Keep working on" (3 bullets, each linking to mistake detail).

**Mistakes section** — numbered list, each row clickable: prompt audio, your response, correction, replay button.

**Concepts covered + Why these matter** — italic serif paragraphs.

**Action footer** — Practice mistakes, Replay hard parts, Generate next lesson, Return to dashboard.

---

### 8. Finished Lessons (`screens-review.jsx → FinishedScreen`)

**Purpose** — browse + replay completed lessons.

**Layout** — wide page. Filter row at top (chips: All, This week, This month, By scenario). Card grid (3-up). Each card: title, date, duration mono, level + scenario chips, mistake count, hover scrubs into 6 dots showing concepts.

**Detail page** — full report + "Replay hard parts" subnav (Full lesson / Only missed prompts / Only slow responses / Only roleplay).

---

### 9. Mistakes (`screens-review.jsx → MistakesScreen`)

**Purpose** — diagnostic surface. Most-common + recent + by-category.

**Layout** — narrow. Three sections.
1. **Most common** — ranked list, 5 items. Each row: number, mistake name in italic serif, frequency caption ("Missed 7 times · last today"), arrow.
2. **Recent** — chronological list grouped by day ("Today", "Yesterday", "Last week").
3. **By category** — grid of category tiles (Grammar, Conjugation, Pronunciation, Listening, Response speed, Vocabulary, Dialect/naturalness, Word order, Verb tense, Conversation flow). Tile shows count.

---

### 10. Mistake Detail (`screens-review.jsx → MistakeDetail`)

**Purpose** — explain one mistake; offer drills.

**Layout** — narrow. Title in italic serif ("*Vos* conjugation: tenés vs tienes"). Then:
1. **Short explanation** — italic serif lede paragraph.
2. **Examples** — 5–10 example phrases in italic serif, each with a tiny play button.
3. **Wrong vs target** — two-column compare card.
4. **Practical usage note** — short paragraph explaining why this is the default Argentine form, not slang.
5. **Practice actions** — "Generate short drill", "Generate medium drill", "Add to next lesson", "Test me on this".
6. **Explanation length** — segmented control: Short / Medium / Deep (only Short + Medium for v1).

---

### 11. Settings (`screens-review.jsx → SettingsScreen`)

**Purpose** — profile + preferences.

**Layout** — narrow. Sections:
1. **Profile** — current level, lessons completed, last test date, "Retest my level" ghost button.
2. **Dialect** — Rioplatense (only option for v1; show others greyed with "coming soon").
3. **Explanations during lessons** — Minimal / Moderate / Detailed segmented control.
4. **Audio** — Default voice (placeholder list), Playback speed slider, Show transcript by default toggle, Show translation by default toggle.
5. **Lesson defaults** — Default length, Default difficulty, Default focus, Default correction strictness.

---

## Interactions & Behavior

### Animations & transitions

- **Page transitions** — 200ms `.fade-in` (opacity + 4px translateY) on screen mount.
- **Orb halo pulse** — `pulse 2.4s ease-in-out infinite` while audio plays.
- **Mic recording halo** — `pulse-record 1.2s ease-in-out infinite` red.
- **Subtitle cycling** — 3200ms interval; transitions at 200ms opacity.
- **Difficulty slider** — dot enlargement transitions at 150ms.
- **Buttons** — 150ms ease, primary lifts 1px on hover.
- **Chip selection** — 150ms ease.

### State management

For Next.js + React, expect this state shape:

```ts
interface AppState {
  profile: {
    level: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2';
    decimalLevel: number;     // e.g. 1.0 for B1.0; offset slider ±3 = ±0.3
    lessonsCompleted: number;
    streak: number;
    lastLessonAt: Date;
    lastLevelTestAt: Date;
    settings: {
      dialect: 'rioplatense';
      explanations: 'minimal'|'moderate'|'detailed';
      defaultLength: 10|15|25|40;
      defaultDifficultyOffset: number;
      showTranscriptByDefault: boolean;
      showTranslationByDefault: boolean;
      playbackSpeed: number;
    };
  };
  mistakes: Mistake[];
  lessons: Lesson[];
  currentBuilder: {
    scenario: string|'auto';
    focus: string|'auto';
    grammar: string[];        // ['__auto__'] for "Choose for me"
    diffOffset: -3..3;
    length: 10|15|25|40;
    custom: string;
  };
  currentLesson: {
    id: string;
    progress: number;
    promptIdx: number;
    state: PlayerState;
    transcript: string[];
    feedbackByPrompt: Record<number, FeedbackRecord>;
  };
}
```

### Mistake record shape (per spec §15)

```ts
interface Mistake {
  id: string;
  lessonId: string;
  promptText: string;
  promptAudioUrl: string;
  expectedAnswer: string;
  acceptableAnswers: string[];
  userTranscript: string;
  feedback: 'good'|'understandable'|'almost'|'needs_work';
  category: MistakeCategory;
  severity: 1|2|3;
  responseTimeMs: number;
  retried: boolean;
  eventuallyCorrect: boolean;
  replayAudioRef: string;
  createdAt: Date;
}
```

### Audio + STT integration points

The prototype fakes audio playback and STT. In production:

1. **Audio playback** — TTS-generated MP3s per prompt, OR pre-generated lesson audio with timestamp markers. Use HTMLAudioElement; bind `currentTime` to `progress`.
2. **STT** — Browser MediaRecorder → POST to a server route → Whisper or equivalent. Stream partial transcripts to update the `processing` state in real-time if possible.
3. **Grading** — Server-side LLM call comparing userTranscript to expectedAnswer + acceptableAnswers, returning `{ feedback, category, correctedForm, explanation }`.
4. **Lesson generation** — Server-side LLM call given the builder config + recent mistakes + level → returns a structured lesson plan (sections, prompts, expected answers, audio cues to TTS).
5. **Ask-a-question** — Server-side LLM call given user question + current lesson context → returns concise tutor answer. Should target ~2 sentences. Optionally TTS the answer back.

---

## File map

```
prototype/
├── Che Spanish.html        ← entry point; loads React + Babel + all JSX modules
├── styles.css              ← all design tokens + utility classes (no Tailwind in prototype)
├── app.jsx                 ← root component, navigation router, Tweaks integration
├── data.jsx                ← mock data (LESSON, MISTAKES, SCENARIOS, FOCUSES, GRAMMAR_TOPICS, etc.)
├── components.jsx          ← shared UI: Icon, Tag, SectionHead, TopNav, Wave, Scrubber, etc.
├── screens-onboarding.jsx  ← Welcome, LevelTest, LevelResult
├── screens-build.jsx       ← Dashboard, BuilderScreen, PreviewScreen
├── player.jsx              ← PlayerScreen (orb / editorial / conversation)
├── screens-review.jsx      ← ReportScreen, FinishedScreen, MistakesScreen, MistakeDetail, SettingsScreen
├── tweaks-panel.jsx        ← in-prototype controls (player variant, accent, density)
└── image-slot.js           ← drag-and-drop image placeholder web component (Welcome tutor)
```

---

## Mapping the prototype to Tailwind

The CSS variables in `:root` map cleanly to a `tailwind.config.ts` theme. Sketch:

```ts
theme: {
  extend: {
    colors: {
      bg: { DEFAULT: '#0a0908', 1: '#100e0c', 2: '#15130f', 3: '#1c1a15', 4: '#25221c' },
      line: { DEFAULT: '#2a2620', 2: '#3a342b' },
      ink: { DEFAULT: '#f5f1e8', 2: '#d6cfbf' },
      mute: { DEFAULT: '#8a8478', 2: '#5e584d' },
      warm: { DEFAULT: '#d4a574', deep: '#b8814c' },
      leaf: '#7d8a6a',
      crit: '#c97064',
      ok: '#9bb591',
    },
    fontFamily: {
      serif: ['Newsreader', 'Source Serif Pro', 'Georgia', 'serif'],
      sans: ['Inter Tight', 'ui-sans-serif', 'system-ui'],
      mono: ['JetBrains Mono', 'ui-monospace'],
    },
  },
}
```

Custom utilities to add: `.eyebrow`, `.kicker`, `.lede`, `.h-display`, `.h-1`..`.h-4`. See `styles.css` for exact values.

---

## Out of scope for v1 (per spec §24)

Don't build: gamification, social features, leaderboards, multi-user accounts, full curriculum maps, lesson marketplace, perfect pronunciation scoring, writing practice, flashcards, mobile-native flows, payments. Validate the core tutoring loop first.

---

## Open questions for the team

1. **Audio voice** — does this app need cloned/branded voices (Martín, María) for consistency, or is generic Argentine TTS enough for v1?
2. **Transcription** — Whisper-1 vs gpt-4o-transcribe vs server-side fast Whisper. Latency matters here.
3. **Lesson generation cost** — full audio per session vs cached "warm-up" + dynamic prompt-response? Impacts billing.
4. **Persistence boundary** — lessons saved locally + synced to Supabase, or always cloud-first?
5. **Streak definition** — calendar-day or 24-hour rolling?

---

*Designed by Claude. Implemented by you.*
