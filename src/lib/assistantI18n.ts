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
  helpful: string; notHelpful: string; thanks: string; sendToSupport: string; sentToSupport: string; sending: string; thisScreen: string;
  thinking: string; footnote: string; expand: string; dock: string; close: string;
  lookingAt: (page: string) => string; answeredIn: (secs: number) => string;
  basedOn: string; fixIt: string; attention: string; allClear: string; why: string;
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
  helpful: "Helpful",
  notHelpful: "Not helpful",
  thanks: "Thanks for the feedback",
  sendToSupport: "Send this to support",
  sentToSupport: "Sent to support. They'll follow up by email.",
  sending: "Sending…",
  thisScreen: "What can I do on this screen?",
  thinking: "Looking through your records…",
  footnote: "Answers come from your own records. Check important details.",
  expand: "Open as a window",
  dock: "Dock to the side",
  close: "to close",
  lookingAt: (page) => `Looking at ${page}`,
  answeredIn: (secs) => `Answered in ${secs}s`,
    basedOn: "Based on", fixIt: "Fix it", attention: "Needs attention today", allClear: "All clear. Nothing needs attention today.", why: "Why?",
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
    helpful: "काम का",
    notHelpful: "काम का नहीं",
    thanks: "फ़ीडबैक के लिए धन्यवाद",
    sendToSupport: "इसे सपोर्ट को भेजें",
    sentToSupport: "सपोर्ट को भेज दिया गया। वे ईमेल से संपर्क करेंगे।",
    sending: "भेजा जा रहा है…",
    thisScreen: "इस स्क्रीन पर मैं क्या कर सकता हूँ?",
    thinking: "आपके रिकॉर्ड देख रहा हूँ…",
    footnote: "जवाब आपके अपने रिकॉर्ड से आते हैं। ज़रूरी बातें जाँच लें।",
    expand: "विंडो में खोलें",
    dock: "किनारे पर लगाएँ",
    close: "बंद करने के लिए",
    lookingAt: (page) => `${page} देख रहा है`,
    answeredIn: (secs) => `${secs} सेकंड में जवाब`,
    basedOn: "आधार", fixIt: "ठीक करें", attention: "आज ध्यान देने योग्य", allClear: "सब ठीक है। आज कुछ भी ध्यान देने योग्य नहीं है।", why: "क्यों?",
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
    helpful: "مددگار",
    notHelpful: "مددگار نہیں",
    thanks: "رائے کا شکریہ",
    sendToSupport: "اسے سپورٹ کو بھیجیں",
    sentToSupport: "سپورٹ کو بھیج دیا گیا۔ وہ ای میل پر رابطہ کریں گے۔",
    sending: "بھیجا جا رہا ہے…",
    thisScreen: "اس اسکرین پر میں کیا کر سکتا ہوں؟",
    thinking: "آپ کے ریکارڈ دیکھ رہا ہوں…",
    footnote: "جوابات آپ کے اپنے ریکارڈ سے آتے ہیں۔ اہم باتیں چیک کر لیں۔",
    expand: "ونڈو میں کھولیں",
    dock: "سائیڈ پر لگائیں",
    close: "بند کرنے کے لیے",
    lookingAt: (page) => `${page} دیکھ رہا ہے`,
    answeredIn: (secs) => `${secs} سیکنڈ میں جواب`,
    basedOn: "ماخذ", fixIt: "درست کریں", attention: "آج توجہ طلب", allClear: "سب ٹھیک ہے۔ آج کوئی چیز توجہ طلب نہیں۔", why: "کیوں؟",
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
    helpful: "उपयोगी",
    notHelpful: "उपयोगी भएन",
    thanks: "प्रतिक्रियाका लागि धन्यवाद",
    sendToSupport: "यसलाई सपोर्टमा पठाउनुहोस्",
    sentToSupport: "सपोर्टमा पठाइयो। उनीहरूले इमेलमा सम्पर्क गर्नेछन्।",
    sending: "पठाइँदैछ…",
    thisScreen: "यो स्क्रिनमा म के गर्न सक्छु?",
    thinking: "तपाईंका रेकर्ड हेर्दै…",
    footnote: "जवाफ तपाईंकै रेकर्डबाट आउँछन्। महत्त्वपूर्ण कुरा जाँच गर्नुहोस्।",
    expand: "विन्डोमा खोल्नुहोस्",
    dock: "छेउमा राख्नुहोस्",
    close: "बन्द गर्न",
    lookingAt: (page) => `${page} हेर्दै`,
    answeredIn: (secs) => `${secs} सेकेन्डमा जवाफ`,
    basedOn: "आधार", fixIt: "समाधान गर्नुहोस्", attention: "आज ध्यान दिनुपर्ने", allClear: "सबै ठीक छ। आज कुनै कुरामा ध्यान दिनुपर्ने छैन।", why: "किन?",
  },
};

/** The words to show: the chosen language, or English while it is on Auto. */
export const stringsFor = (lang: AssistantLang): Strings => STRINGS[lang === "auto" ? "en" : lang];
export const isAssistantLang = (v: unknown): v is AssistantLang => LANGUAGE_OPTIONS.some((o) => o.value === v);
