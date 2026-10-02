/** The assistant's own on-screen words, in the languages it can answer in. Replies come from the model, not from here. */
export type AssistantLang = "auto" | "en" | "hi" | "ur" | "ne";

export const LANGUAGE_OPTIONS: { value: AssistantLang; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "ur", label: "اردو" },
  { value: "ne", label: "नेपाली" },
];

type Strings = {
  ready: string; hello: string; sub: string; placeholder: string; newChat: string; language: string;
  suggestions: [string, string, string, string];
  downloadCsv: string; showing: (shown: number, total: number) => string;
};

const EN: Strings = {
  ready: "Ready to help",
  hello: "Hi, how can I help?",
  sub: "Ask where something is, how a task works, or look up a worker, project or client.",
  placeholder: "Ask My Assistant…",
  newChat: "New chat",
  language: "Language",
  suggestions: ["Where do I renew a visa?", "How do I get workers onto a project?", "Who is absent today?", "What work is approved but not yet invoiced?"],
  downloadCsv: "Download CSV",
  showing: (shown, total) => `Showing ${shown} of ${total}`,
};

export const STRINGS: Record<Exclude<AssistantLang, "auto">, Strings> = {
  en: EN,
  hi: {
    ready: "मदद के लिए तैयार",
    hello: "नमस्ते! मैं आपकी क्या मदद करूँ?",
    sub: "पूछिए कि कोई चीज़ कहाँ है, कोई काम कैसे होता है, या किसी वर्कर, प्रोजेक्ट या क्लाइंट को खोजिए।",
    placeholder: "My Assistant से पूछिए…",
    newChat: "नई चैट",
    language: "भाषा",
    suggestions: ["वीज़ा का नवीनीकरण कहाँ करें?", "वर्कर्स को प्रोजेक्ट पर कैसे भेजें?", "आज कौन अनुपस्थित है?", "किस काम का बिल बनना अभी बाकी है?"],
    downloadCsv: "CSV डाउनलोड करें",
    showing: (shown, total) => `कुल ${total} में से ${shown} दिखाए गए`,
  },
  ur: {
    ready: "مدد کے لیے تیار",
    hello: "السلام علیکم! میں آپ کی کیا مدد کروں؟",
    sub: "پوچھیں کہ کوئی چیز کہاں ہے، کوئی کام کیسے ہوتا ہے، یا کسی ورکر، پروجیکٹ یا کلائنٹ کو تلاش کریں۔",
    placeholder: "My Assistant سے پوچھیں…",
    newChat: "نئی چیٹ",
    language: "زبان",
    suggestions: ["ویزا کی تجدید کہاں کریں؟", "ورکرز کو پروجیکٹ پر کیسے بھیجیں؟", "آج کون غیر حاضر ہے؟", "کن کاموں کا بل بننا ابھی باقی ہے؟"],
    downloadCsv: "CSV ڈاؤن لوڈ کریں",
    showing: (shown, total) => `کل ${total} میں سے ${shown} دکھائے گئے`,
  },
  ne: {
    ready: "सहयोगका लागि तयार",
    hello: "नमस्ते! म तपाईंलाई कसरी मद्दत गर्न सक्छु?",
    sub: "कुनै कुरा कहाँ छ, कुनै काम कसरी गर्ने भनेर सोध्नुहोस्, वा कुनै कामदार, प्रोजेक्ट वा क्लाइन्ट खोज्नुहोस्।",
    placeholder: "My Assistant लाई सोध्नुहोस्…",
    newChat: "नयाँ च्याट",
    language: "भाषा",
    suggestions: ["भिसा नवीकरण कहाँ गर्ने?", "कामदारहरूलाई प्रोजेक्टमा कसरी पठाउने?", "आज को अनुपस्थित छ?", "कुन कामको बिल बनाउन बाँकी छ?"],
    downloadCsv: "CSV डाउनलोड गर्नुहोस्",
    showing: (shown, total) => `जम्मा ${total} मध्ये ${shown} देखाइएको`,
  },
};

/** The words to show: the chosen language, or English while it is on Auto. */
export const stringsFor = (lang: AssistantLang): Strings => STRINGS[lang === "auto" ? "en" : lang];
export const isAssistantLang = (v: unknown): v is AssistantLang => LANGUAGE_OPTIONS.some((o) => o.value === v);
