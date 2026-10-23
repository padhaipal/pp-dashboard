"use client";

import { useState } from "react";

// The donor page's last two blocks. DonorContact: the "help us measure"
// ask, the contact email and the newsletter sign-up (the same mailing list
// as the /quiz page: POST /api/quiz/subscribe → pp-sketch
// mailing_list_entries; the lifteracy.ai form is Framer's and only accepts
// posts from that site). DonorFooter: www.lifteracy.ai's partner logo,
// policies (self-hosted PDFs at /privacy, /terms, /child-protection — see
// next.config.ts) and registration.
export const CONTACT_EMAIL = "hello@lifteracy.ai";
const POLICIES: [string, string][] = [
  ["Privacy Policy", "/privacy"],
  ["Terms of Use", "/terms"],
  ["Child Protection Policy", "/child-protection"],
];

export const SUBSCRIBE_URL = "/api/quiz/subscribe";

export function DonorContact() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const subscribe = async () => {
    setStatus("sending");
    try {
      const res = await fetch(SUBSCRIBE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  };
  return (
    <div className="grid gap-8 md:grid-cols-[3fr_2fr] md:gap-12" data-testid="donor-contact">
      <p className="text-lg leading-relaxed text-zinc-700">
        Our seed funding from Ambitious Impact covers the next stage: measuring how many children keep learning and how much reading they gain per hour. Those numbers decide how far LIFTeracy can scale, and that next step is where we’d love your help. Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-ink underline decoration-brand-mute underline-offset-2 hover:text-brand-deep">
          {CONTACT_EMAIL}
        </a>
        , or sign up for updates and we’ll share the results as they come in.
      </p>
      <form
        className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void subscribe();
        }}
      >
        <div className="text-lg font-bold text-zinc-900">Get updates</div>
        <label htmlFor="donor-newsletter-email" className="text-xs font-semibold text-zinc-600">
          Email
        </label>
        <div className="flex gap-2">
          <input
            id="donor-newsletter-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.org"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-ink focus:outline-none"
          />
          <button type="submit" disabled={status === "sending"} className="rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60">
            Submit
          </button>
        </div>
        {status === "done" && <div className="text-sm font-semibold text-emerald-700">Thanks — you’re signed up.</div>}
        {status === "error" && <div className="text-sm font-semibold text-red-600">That didn’t work. Please check the email and try again.</div>}
        <div className="text-xs text-zinc-500">Occasional updates on LIFTeracy. No more than monthly. Unsubscribe any time.</div>
      </form>
    </div>
  );
}

export function DonorFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-6 py-10" data-testid="donor-footer">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Partners &amp; Supporters</div>
          <a href="https://dignityeducation.org/" target="_blank" rel="noreferrer" className="mt-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG */}
            <img src="/donor/dignity-education.svg" alt="Dignity Education" className="h-16 w-auto" />
          </a>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm md:justify-end">
          {POLICIES.map(([n, u]) => (
            <a key={n} href={u} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-brand-ink">
              {n}
            </a>
          ))}
        </div>
      </div>
      <div className="mt-6 space-y-1 border-t border-zinc-200 pt-4 text-xs leading-relaxed text-zinc-500">
        <div className="font-bold text-zinc-700">LIFTeracy</div>
        <p>LIFTeracy is a project of Development Consortium, a society registered under the Societies Registration Act 1860 (Reg. No. S/57363 of 2006).</p>
        <p>Registered office: Narmada 7, Flat No. 6, Nelson Mandela Marg, Vasant Kunj, New Delhi 110070, India</p>
        <p>FCRA Registration Number: 231661457</p>
      </div>
    </footer>
  );
}
