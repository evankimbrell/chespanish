import type { Metadata } from "next";
import { CheckRecording } from "@/components/campaign-cut/check-recording";

export const metadata: Metadata = {
  title: "Recording Tips",
  description:
    "How to get the best recording possible: multi-track audio, local recording, microphones that are good enough, Discord recording bots, and virtual tabletop tips.",
};

const TIPS = [
  {
    numeral: "I",
    title: "Use multi-track recording when possible",
    body: (
      <p className="cc-tip-copy">
        One track per player is the single biggest upgrade you can give us. It lets us balance every voice
        individually, fix one person’s echo without touching anyone else, and place your party in stereo — like
        sitting around a real table. If you can only do one thing from this page, do this.
      </p>
    ),
  },
  {
    numeral: "II",
    title: "Record locally instead of relying on compressed calls",
    body: (
      <p className="cc-tip-copy">
        Discord and Zoom compress audio to save bandwidth — that compression is permanent. If each player records
        themselves on their own machine (even with the built-in voice recorder) and sends us the files, we get the
        full, uncompressed sound of their voice. It sounds harder than it is: press record at the start, stop at the
        end.
      </p>
    ),
  },
  {
    numeral: "III",
    title: "Microphones: good enough beats perfect",
    body: (
      <>
        <p className="cc-tip-copy">You don’t need studio gear. Roughly in order of impact:</p>
        <ul className="cc-checklist">
          <li>
            <span className="cc-check" aria-hidden="true">
              ✓
            </span>
            <span>A wired headset or earbuds with a mic — keeps your voice close and consistent</span>
          </li>
          <li>
            <span className="cc-check" aria-hidden="true">
              ✓
            </span>
            <span>Any USB microphone — a big step up if you want one</span>
          </li>
          <li>
            <span className="cc-check" aria-hidden="true">
              ✓
            </span>
            <span>Quiet room, soft surfaces — matters more than the mic itself</span>
          </li>
        </ul>
      </>
    ),
  },
  {
    numeral: "IV",
    title: "Discord recording tools",
    body: (
      <p className="cc-tip-copy">
        If your party plays on Discord, a recording bot like Craig can capture every speaker on a separate track
        automatically — invite it to your channel, start recording, and forget about it. That gives us multi-track
        audio with zero effort from your players. Whatever tool you use, do a 30-second test recording before session
        one.
      </p>
    ),
  },
  {
    numeral: "V",
    title: "Virtual tabletop tips",
    body: (
      <p className="cc-tip-copy">
        Playing on Foundry or Roll20? Keep voice chat in Discord and record there — it’s more reliable than
        in-browser audio. And if you can, send us a few screenshots of your maps and tokens along with the recording;
        they help us follow the action and make great episode artwork references.
      </p>
    ),
  },
];

export default function RecordingTipsPage() {
  return (
    <>
      <div className="cc-tips-header">
        <div className="cc-tips-header-inner">
          <p className="cc-eyebrow">A friendly guide</p>
          <h1 className="cc-tips-title">How to Get the Best Recording Possible</h1>
          <p className="cc-tips-sub">
            None of this is required — we work with what you have. But a few small habits make a big difference in
            the finished episode.
          </p>
        </div>
      </div>

      <div className="cc-tips">
        {TIPS.map((tip) => (
          <article key={tip.numeral} className="cc-tip">
            <div className="cc-tip-head">
              <div className="cc-tip-numeral" aria-hidden="true">
                {tip.numeral}
              </div>
              <h2 className="cc-tip-title">{tip.title}</h2>
            </div>
            {tip.body}
          </article>
        ))}

        <section className="cc-cta-card" aria-label="Check your recording">
          <h2 className="cc-cta-title">Not sure if your recording is good enough?</h2>
          <p className="cc-cta-sub">Send us a short sample — we’ll tell you honestly what we can do with it.</p>
          <CheckRecording />
        </section>
      </div>
    </>
  );
}
