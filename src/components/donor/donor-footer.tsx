"use client";

import { useState } from "react";

// The footer of www.lifteracy.ai: partner logo, newsletter sign-up,
// contact, policies, registration. The sign-up joins the same mailing list
// as the /quiz page (POST /api/quiz/subscribe → pp-sketch
// mailing_list_entries; the lifteracy.ai form is Framer's and only accepts
// posts from that site).
const CONTACT_EMAIL = "hello@lifteracy.ai";
const POLICIES: [string, string][] = [
  ["Privacy Policy", "https://drive.google.com/file/d/1U1eMbmRu1NUVKAcSXsJzFhMUkaZTsXVE/view?usp=drive_link"],
  ["Terms and Conditions", "https://drive.google.com/file/d/1lgUB2JxpuX6MjdvSL0fLdKohYGXZ6HW7/view?usp=drive_link"],
  ["Child Protection Policy", "https://drive.google.com/file/d/1imqEMVpaPaERlr6RZrhtcYTf_cxe-sNV/view?usp=drive_link"],
];

export const SUBSCRIBE_URL = "/api/quiz/subscribe";

export function DonorFooter() {
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
    <footer className="mt-2 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8" data-testid="donor-footer">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">Partners &amp; Supporters</div>
          <a href="https://dignityeducation.org/" target="_blank" rel="noreferrer" className="mt-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG */}
            <img src="/donor/dignity-education.svg" alt="Dignity Education" className="h-20 w-auto" />
          </a>
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void subscribe();
          }}
        >
          <div className="text-lg font-bold text-zinc-800">Sign up for Updates!</div>
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
              placeholder="jane@gmail.com"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button type="submit" disabled={status === "sending"} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              Submit
            </button>
          </div>
          {status === "done" && <div className="text-sm font-semibold text-emerald-700">Thanks — you’re signed up.</div>}
          {status === "error" && <div className="text-sm font-semibold text-red-600">That didn’t work. Please check the email and try again.</div>}
          <div className="text-xs text-zinc-500">Occasional updates on LIFTeracy. No more than monthly. Unsubscribe any time.</div>
          <div className="text-sm text-zinc-700">
            Contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-blue-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </div>
        </form>
      </div>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-100 pt-4 text-sm">
        {POLICIES.map(([n, u]) => (
          <a key={n} href={u} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-blue-600">
            {n}
          </a>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-xs leading-relaxed text-zinc-500">
        <div className="font-bold text-zinc-700">LIFTeracy</div>
        <p>LIFTeracy is a project of Development Consortium, a society registered under the Societies Registration Act 1860 (Reg. No. S/57363 of 2006).</p>
        <p>Registered office: Narmada 7, Flat No. 6, Nelson Mandela Marg, Vasant Kunj, New Delhi 110070, India</p>
        <p>FCRA Registration Number: 231661457</p>
      </div>
    </footer>
  );
}
