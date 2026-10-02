"use client";

import { useEffect, useState } from "react";
import type { T } from "./i18n";
import { fmtClipDuration, waveformBars } from "./waveform";

// What a viewer who may not hear a student's recording sees in its place:
// the real length and a decorative waveform (waveform.ts — nothing from the
// audio). Pressing it opens SampleAudioModal with a stand-in clip.
export const SAMPLE_AUDIO_URL = "/sample-child-response.wav";

export function MaskedAudio({ mediaId, durationMs, onRequest, t }: { mediaId: string; durationMs: number | null | undefined; onRequest: () => void; t: T }) {
  const bars = waveformBars(mediaId);
  const W = 84;
  const H = 18;
  const gap = W / bars.length;
  return (
    <button
      type="button"
      onClick={onRequest}
      title={t("Only the student's own teacher can play this recording")}
      className="mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-0.5 align-middle text-xs text-zinc-500 hover:bg-zinc-50"
      data-testid="masked-audio"
      aria-label={t("Recording not available")}
    >
      <span aria-hidden>🔒</span>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="text-zinc-400">
        {bars.map((h, i) => {
          const bh = Math.max(2, h * H);
          return <rect key={i} x={i * gap + gap * 0.2} y={(H - bh) / 2} width={gap * 0.6} height={bh} rx={1} fill="currentColor" />;
        })}
      </svg>
      <span className="tabular-nums" data-testid="masked-audio-duration">
        {fmtClipDuration(durationMs)}
      </span>
    </button>
  );
}

export function SampleAudioModal({ onClose, t }: { onClose: () => void; t: T }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-900/60 p-4" onClick={onClose} role="dialog" aria-modal="true" data-testid="sample-audio-modal">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-bold text-zinc-900">{t("This recording is private")}</div>
        <p className="mt-2 text-sm text-zinc-600">{t("Only the student's own teacher can listen to their voice notes. Here is an example of what a child's response sounds like.")}</p>
        <audio className="mt-4 w-full" controls src={SAMPLE_AUDIO_URL} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} data-testid="sample-audio" data-playing={playing ? "1" : undefined} />
        <div className="mt-4 text-right">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
            ✕ {t("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
