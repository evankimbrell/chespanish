"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "closed" | "idle" | "loading" | "checking" | "pass" | "fail";

const FALLBACK_FILENAME = "session_sample.ogg";
const TICK_MS = 120;
const ANALYSIS_MS = 2600;

const LIVE_STATUS: Partial<Record<Phase, string>> = {
  loading: "Uploading your sample",
  checking: "Checking your sample",
  pass: "Result: we can work with this recording",
  fail: "Result: sadly, this recording is a no-go",
};

/**
 * CTA actions + the "Check my recording" modal. The upload and analysis are
 * simulated front-end only (per the design prototype): progress ticks up on a
 * timer and the verdict alternates pass/fail on each new sample.
 */
export function CheckRecording() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [pct, setPct] = useState(0);
  const [fileName, setFileName] = useState(FALLBACK_FILENAME);
  const [dragOver, setDragOver] = useState(false);

  const pctRef = useRef(0);
  const nextVerdict = useRef<Phase>("pass");
  const tickTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearTimers = useCallback(() => {
    clearInterval(tickTimer.current);
    clearTimeout(doneTimer.current);
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setPhase("closed");
    openerRef.current?.focus();
  }, [clearTimers]);

  const backToIdle = useCallback(() => {
    clearTimers();
    pctRef.current = 0;
    setPct(0);
    setPhase("idle");
  }, [clearTimers]);

  const startUpload = useCallback(
    (name: string | undefined) => {
      clearTimers();
      setFileName(name || FALLBACK_FILENAME);
      pctRef.current = 0;
      setPct(0);
      setPhase("loading");
      tickTimer.current = setInterval(() => {
        pctRef.current = Math.min(100, pctRef.current + 4 + Math.random() * 7);
        setPct(pctRef.current);
        if (pctRef.current >= 100) {
          clearInterval(tickTimer.current);
          setPhase("checking");
          doneTimer.current = setTimeout(() => {
            setPhase(nextVerdict.current);
            nextVerdict.current = nextVerdict.current === "pass" ? "fail" : "pass";
          }, ANALYSIS_MS);
        }
      }, TICK_MS);
    },
    [clearTimers],
  );

  useEffect(() => clearTimers, [clearTimers]);

  const isOpen = phase !== "closed";

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add("cc-scroll-lock");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => {
      document.body.classList.remove("cc-scroll-lock");
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  return (
    <>
      <div className="cc-cta-actions">
        <button
          ref={openerRef}
          type="button"
          className="cc-btn-ember"
          onClick={() => {
            pctRef.current = 0;
            setPct(0);
            setPhase("idle");
          }}
        >
          Check My Recording
        </button>
        <Link href="/campaign-cut/start-your-podcast" className="cc-link-dashed">
          Create Your Podcast
        </Link>
      </div>

      {isOpen && (
        <div className="cc-modal-overlay" role="presentation" onClick={close}>
          <div
            ref={dialogRef}
            className="cc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-check-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="cc-modal-close" aria-label="Close" onClick={close}>
              ×
            </button>
            <p className="cc-sr-only" aria-live="polite">
              {LIVE_STATUS[phase] ?? ""}
            </p>

            {phase === "idle" && (
              <>
                <h2 id="cc-check-title" className="cc-modal-title">
                  Check my recording
                </h2>
                <p className="cc-modal-sub">
                  Upload a minute of your session audio and we’ll tell you whether it can become an episode — before
                  you spend a copper.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.ogg,.oga,.opus,.mp3,.m4a,.aac,.wav,.flac,.webm,.wma,.aiff"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) startUpload(file.name);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className={`cc-dropzone${dragOver ? " cc-dragover" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    startUpload(e.dataTransfer.files?.[0]?.name);
                  }}
                >
                  <div className="cc-dropzone-main">⬆ Upload a sample</div>
                  <div className="cc-dropzone-hint">or drop a file here</div>
                </button>
                <div className="cc-modal-notes">
                  <div className="cc-modal-note">
                    <span className="cc-star" aria-hidden="true">
                      ✦
                    </span>
                    <span>Only upload 1 track. We’ll sample it and generate our thoughts.</span>
                  </div>
                  <div className="cc-modal-note">
                    <span className="cc-star" aria-hidden="true">
                      ✦
                    </span>
                    <span>Any audio file type will work.</span>
                  </div>
                </div>
              </>
            )}

            {phase === "loading" && (
              <>
                <h2 id="cc-check-title" className="cc-modal-title">
                  Uploading…
                </h2>
                <p className="cc-modal-sub">{fileName}</p>
                <div
                  className="cc-progress-track"
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="cc-progress-fill" style={{ width: `${Math.round(pct)}%` }} />
                </div>
                <div className="cc-progress-pct">{Math.round(pct)}%</div>
              </>
            )}

            {phase === "checking" && (
              <div className="cc-checking">
                <div className="cc-checking-glass" aria-hidden="true">
                  🔎
                </div>
                <h2 id="cc-check-title" className="cc-modal-title">
                  The gnomes are checking…
                </h2>
                <p className="cc-modal-sub" style={{ margin: 0 }}>
                  Measuring voices, hunting echoes, judging your microphone placement (gently).
                </p>
                <div className="cc-checking-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            {phase === "pass" && (
              <>
                <div className="cc-verdict-badge cc-verdict-badge--pass" aria-hidden="true">
                  ✓
                </div>
                <h2 id="cc-check-title" className="cc-verdict-title cc-verdict-title--pass">
                  We can work with this
                </h2>
                <ul className="cc-verdict-list">
                  <li>
                    <span className="cc-verdict-mark cc-verdict-mark--good" aria-hidden="true">
                      ✓
                    </span>
                    <span>Voices are clear and well separated — all four speakers are easy to distinguish.</span>
                  </li>
                  <li>
                    <span className="cc-verdict-mark cc-verdict-mark--good" aria-hidden="true">
                      ✓
                    </span>
                    <span>Background noise is low; a light cleanup pass will handle the keyboard clicks we found.</span>
                  </li>
                  <li>
                    <span className="cc-verdict-mark cc-verdict-mark--warn" aria-hidden="true">
                      !
                    </span>
                    <span>One voice sits ~6dB quieter than the rest — we’ll boost it during mixing.</span>
                  </li>
                  <li>
                    <span className="cc-verdict-mark cc-verdict-mark--warn" aria-hidden="true">
                      !
                    </span>
                    <span>Mild room reverb on one speaker; expect a noticeable (not perfect) reduction.</span>
                  </li>
                </ul>
                <div className="cc-verdict-actions">
                  <Link href="/campaign-cut/start-your-podcast" className="cc-btn-ember cc-btn-ember--compact">
                    Create Your Podcast
                  </Link>
                  <button type="button" className="cc-btn-text" onClick={backToIdle}>
                    Try another sample
                  </button>
                </div>
              </>
            )}

            {phase === "fail" && (
              <>
                <div className="cc-verdict-badge cc-verdict-badge--fail" aria-hidden="true">
                  ✕
                </div>
                <h2 id="cc-check-title" className="cc-verdict-title cc-verdict-title--fail">
                  Sadly, it’s a no-go
                </h2>
                <ul className="cc-verdict-list">
                  <li>
                    <span className="cc-verdict-mark cc-verdict-mark--bad" aria-hidden="true">
                      ✕
                    </span>
                    <span>Voices overlap into a single muddy channel — we can’t separate the speakers reliably.</span>
                  </li>
                  <li>
                    <span className="cc-verdict-mark cc-verdict-mark--bad" aria-hidden="true">
                      ✕
                    </span>
                    <span>Heavy room echo drowns quieter players; dialogue past 3 metres is unrecoverable.</span>
                  </li>
                  <li>
                    <span className="cc-verdict-mark cc-verdict-mark--bad" aria-hidden="true">
                      ✕
                    </span>
                    <span>Sustained clipping on the loudest voice — the distortion is baked into the file.</span>
                  </li>
                  <li>
                    <span className="cc-verdict-mark cc-verdict-mark--warn" aria-hidden="true">
                      →
                    </span>
                    <span>
                      Next session: move the mic to the middle of the table, or record on Discord with separate tracks
                      — then send us a new sample.
                    </span>
                  </li>
                </ul>
                <div className="cc-verdict-actions">
                  <button type="button" className="cc-btn-outline" onClick={close}>
                    Back to the tips
                  </button>
                  <button type="button" className="cc-btn-text" onClick={backToIdle}>
                    Try another sample
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
