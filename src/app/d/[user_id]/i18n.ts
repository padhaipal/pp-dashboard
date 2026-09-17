// EN / हिं dictionary for the public dashboard, ported from mvp2.html's I18N
// table (report strings only). English is the source: `t(s)` returns the Hindi
// string when one exists, else `s` unchanged — so an untranslated string is
// never a runtime error. No React, no DOM.

export type Lang = "en" | "hi";
export const LANGS: [Lang, string][] = [
  ["en", "EN"],
  ["hi", "हिं"],
];
export const LANG_STORAGE_KEY = "lifteracy-dashboard-lang";

const HI: Record<string, string> = {
  // nav / header
  Top: "ऊपर",
  Performance: "प्रदर्शन",
  Spotlight: "स्पॉटलाइट",
  Detail: "विवरण",
  "Your Profile": "आपकी प्रोफ़ाइल",
  "Generate report": "रिपोर्ट बनाएँ",
  "Up a level": "एक स्तर ऊपर",
  "Go up a level": "एक स्तर ऊपर जाएँ",
  // nouns
  Country: "देश",
  State: "राज्य",
  District: "ज़िला",
  Block: "ब्लॉक",
  School: "विद्यालय",
  Student: "छात्र",
  countries: "देश",
  states: "राज्य",
  districts: "ज़िले",
  blocks: "ब्लॉक",
  schools: "विद्यालय",
  students: "छात्र",
  Area: "क्षेत्र",
  areas: "क्षेत्र",
  Teacher: "शिक्षक",
  Principal: "प्रधानाचार्य",
  Official: "अधिकारी",
  BEO: "BEO",
  BSA: "BSA",
  DGSE: "DGSE",
  "National Director": "राष्ट्रीय निदेशक",
  // kpis
  average: "औसत",
  "using Lifteracy": "लिफ्टरेसी उपयोग कर रहे",
  "Not using Lifteracy": "लिफ्टरेसी उपयोग नहीं",
  "not using Lifteracy": "लिफ्टरेसी उपयोग नहीं",
  "Loading your dashboard…": "आपका डैशबोर्ड लोड हो रहा है…",
  "No results yet — share your link to get started.": "अभी कोई परिणाम नहीं — शुरू करने के लिए अपना लिंक साझा करें।",
  "This user is not linked to a location yet.": "यह उपयोगकर्ता अभी किसी स्थान से जुड़ा नहीं है।",
  // detail / performance
  Latest: "नवीनतम",
  Trend: "रुझान",
  "Weekly trend": "साप्ताहिक रुझान",
  Average: "औसत",
  "Most improved": "सर्वाधिक सुधार",
  "Most improved this week": "इस सप्ताह सर्वाधिक सुधार",
  "this week": "इस सप्ताह",
  "last week": "पिछले सप्ताह",
  last: "पिछले",
  days: "दिन",
  pts: "अंक",
  "Oral Literacy NIPUN Proxy percentage pass rate": "मौखिक साक्षरता निपुण प्रॉक्सी प्रतिशत उत्तीर्ण दर",
  "80% NIPUN target": "80% निपुण लक्ष्य",
  "No results in this window": "इस अवधि में कोई परिणाम नहीं",
  "Download CSV": "CSV डाउनलोड करें",
  attempts: "प्रयास",
  "No students yet.": "अभी कोई छात्र नहीं।",
  "No teachers yet.": "अभी कोई शिक्षक नहीं।",
  "No Lifteracy user yet": "अभी कोई लिफ्टरेसी उपयोगकर्ता नहीं",
  "No spotlight message yet.": "अभी कोई स्पॉटलाइट संदेश नहीं।",
  "qualifies yet.": "अभी योग्य नहीं।",
  "of": "में से",
  in: "में",
  "Loading boundaries…": "सीमाएँ लोड हो रही हैं…",
  "Government school": "सरकारी विद्यालय",
  "Private school": "निजी विद्यालय",
  "private school": "निजी विद्यालय",
  "Boundaries pending": "सीमाएँ लंबित",
  "are not using Lifteracy at all": "लिफ्टरेसी बिल्कुल उपयोग नहीं कर रहे",
  "Hover or click a row or map area to see its details.": "विवरण देखने के लिए किसी पंक्ति या मानचित्र क्षेत्र पर माउस ले जाएँ या क्लिक करें।",
  // profile
  "Upload profile photo": "प्रोफ़ाइल फ़ोटो अपलोड करें",
  "Shuffle avatar": "अवतार बदलें",
  "Display name": "प्रदर्शित नाम",
  "Your name": "आपका नाम",
  "Spotlight message": "स्पॉटलाइट संदेश",
  "shown when you're top or most-improved in your cohort": "जब आप अपने समूह में शीर्ष या सर्वाधिक सुधार वाले हों तब दिखाया जाता है",
  "Preview · top of your cohort": "पूर्वावलोकन · आपके समूह में शीर्ष",
  "Your spotlight message will appear here.": "आपका स्पॉटलाइट संदेश यहाँ दिखाई देगा।",
  Save: "सहेजें",
  Saved: "सहेजा गया",
  // footer
  "Teaching every child to read, over WhatsApp.": "व्हाट्सऐप के माध्यम से हर बच्चे को पढ़ना सिखाना।",
  Lifteracy: "लिफ्टरेसी",
  About: "हमारे बारे में",
  "How it works": "यह कैसे काम करता है",
  Contact: "संपर्क",
  Safety: "सुरक्षा",
  "Child protection policy": "बाल संरक्षण नीति",
  "Privacy policy": "गोपनीयता नीति",
  "Terms and Conditions": "नियम और शर्तें",
  // student modal
  Close: "बंद करें",
  At: "समय",
  on: "को",
  "weeks ago": "सप्ताह पहले",
  "the student said": "छात्र ने कहा",
  audio: "ऑडियो",
  "nothing (no recording)": "कुछ नहीं (रिकॉर्डिंग नहीं)",
  "and the correct answer was": "और सही उत्तर था",
  "and so was marked as": "और इसलिए इसे अंकित किया गया",
  correct: "सही",
  incorrect: "गलत",
  "not assessed": "मूल्यांकन नहीं",
  "No voice notes yet.": "अभी कोई वॉइस नोट नहीं।",
  "Student's name": "छात्र का नाम",
  Rename: "नाम बदलें",
  "Loading…": "लोड हो रहा है…",
  // misc
  Yes: "हाँ",
  No: "नहीं",
  India: "भारत",
  "Uttar Pradesh": "उत्तर प्रदेश",
  Lucknow: "लखनऊ",
};

export type T = (s: string) => string;

export const translate = (lang: Lang, s: string): string => (lang === "hi" && HI[s]) || s;
export const makeT =
  (lang: Lang): T =>
  (s) =>
    translate(lang, s);

export const isLang = (v: unknown): v is Lang => v === "en" || v === "hi";
