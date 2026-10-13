"use client";

// "Message for your WhatsApp group" — between the headline figures and the
// bar strip, only on the viewer's OWN unit one level in (a BEO on their
// block, a teacher on their class). pp-sketch writes a fresh Hindi message
// from the unit's numbers on every mount (GET geo-entities/:id/share-message,
// share-message.service.ts there); the viewer copies it, or opens WhatsApp
// with it pre-filled. Nothing is cached: a refresh is a new message.
//
// The card keeps one height while loading so the page never jumps; when
// pp-sketch refuses or fails, the card simply is not there.

import { useCallback, useEffect, useMemo, useState } from "react";
import { shareMessageUrl, whatsappShareUrl, type ShareMessageResponse } from "./dashboard-types";
import { withViewer } from "./viewer-url";
import { IconCopy } from "./icons";
import type { T } from "./i18n";

const same: T = (s) => s;

type State = { status: "loading" } | { status: "ok"; message: string } | { status: "failed" };

// One answer per request key (unit + viewer + attempt); the key the page is
// on decides loading / ok / failed — no state is set from inside the effect
// itself.
type Answer = { key: string; message: string | null };

export function ShareMessageCard({
  entityId,
  viewerId,
  audience,
  t = same,
}: {
  entityId: string;
  viewerId: string;
  // who the message is written for: the block's teachers, the class's parents
  audience: "teachers" | "parents";
  t?: T;
}) {
  // bumped by "Write it again": a new generation
  const [attempt, setAttempt] = useState(0);
  const key = `${entityId}|${viewerId}|${attempt}`;
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(withViewer(shareMessageUrl(entityId), viewerId))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ShareMessageResponse;
      })
      .then((body) => {
        if (cancelled) return;
        const message = (body.message ?? "").trim();
        setAnswer({ key, message: message || null });
      })
      .catch(() => {
        if (!cancelled) setAnswer({ key, message: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, entityId, viewerId]);

  const copied = copiedKey === key;
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopiedKey(null), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  const state: State = useMemo(() => {
    const current = answer && answer.key === key ? answer : null;
    return !current ? { status: "loading" } : current.message === null ? { status: "failed" } : { status: "ok", message: current.message };
  }, [answer, key]);

  const copy = useCallback(() => {
    if (state.status !== "ok") return;
    const done = () => setCopiedKey(key);
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.message).then(done, done);
    } else done();
  }, [state, key]);

  if (state.status === "failed") return null;
  const group = audience === "parents" ? t("your parents' WhatsApp group") : t("your teachers' WhatsApp group");
  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 shadow-sm sm:px-6" data-testid="share-message-card" data-status={state.status}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-bold text-emerald-900">{t("A message for your WhatsApp group")}</div>
        <div className="text-[11px] text-emerald-800/80">
          {t("Written just now from today's numbers — copy it and paste it into")} {group}.
        </div>
      </div>
      {state.status === "loading" ? (
        <div className="mt-3 min-h-[7.5rem] animate-pulse space-y-2" data-testid="share-message-loading" aria-busy="true">
          <div className="h-3 w-5/6 rounded bg-emerald-200/70" />
          <div className="h-3 w-2/3 rounded bg-emerald-200/70" />
          <div className="h-3 w-3/4 rounded bg-emerald-200/70" />
          <div className="h-3 w-1/2 rounded bg-emerald-200/70" />
        </div>
      ) : (
        <>
          <p className="mt-3 min-h-[7.5rem] whitespace-pre-wrap rounded-xl bg-white px-4 py-3 text-[15px] leading-relaxed text-zinc-800 ring-1 ring-emerald-100" lang="hi" data-testid="share-message-text">
            {state.message}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className={"inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold text-white shadow-sm transition " + (copied ? "bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-700")}
              data-testid="share-message-copy"
            >
              <IconCopy /> {copied ? t("Copied — now paste it into WhatsApp") : t("Copy message")}
            </button>
            <a
              href={whatsappShareUrl(state.message)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              data-testid="share-message-whatsapp"
            >
              {t("Open WhatsApp")}
            </a>
            <button type="button" onClick={() => setAttempt((a) => a + 1)} className="ml-auto text-xs font-semibold text-emerald-800/80 underline-offset-2 hover:underline" data-testid="share-message-again">
              {t("Write it again")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
