export type TargetLanguage = {
  code: string;
  name: string;
  native?: string;
};

export const NATIVE_TARGET = "en";

export const TARGET_LANGUAGES: TargetLanguage[] = [
  { code: "af", name: "Afrikaans" },
  { code: "sq", name: "Albanian", native: "shqip" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "hy", name: "Armenian", native: "հայերեն" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "az", name: "Azerbaijani", native: "azərbaycan" },
  { code: "bn", name: "Bangla", native: "বাংলা" },
  { code: "ba", name: "Bashkir" },
  { code: "eu", name: "Basque", native: "euskara" },
  { code: "be", name: "Belarusian", native: "беларуская" },
  { code: "bs", name: "Bosnian", native: "bosanski" },
  { code: "br", name: "Breton", native: "brezhoneg" },
  { code: "bg", name: "Bulgarian", native: "български" },
  { code: "my", name: "Burmese", native: "မြန်မာ" },
  { code: "yue", name: "Cantonese", native: "粵語" },
  { code: "ca", name: "Catalan", native: "català" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "hr", name: "Croatian", native: "hrvatski" },
  { code: "cs", name: "Czech", native: "čeština" },
  { code: "da", name: "Danish", native: "dansk" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "en", name: "English" },
  { code: "et", name: "Estonian", native: "eesti" },
  { code: "fo", name: "Faroese", native: "føroyskt" },
  { code: "tl", name: "Filipino" },
  { code: "fi", name: "Finnish", native: "suomi" },
  { code: "fr", name: "French", native: "français" },
  { code: "gl", name: "Galician", native: "galego" },
  { code: "ka", name: "Georgian", native: "ქართული" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "ht", name: "Haitian Creole" },
  { code: "ha", name: "Hausa" },
  { code: "haw", name: "Hawaiian", native: "ʻŌlelo Hawaiʻi" },
  { code: "he", name: "Hebrew", native: "עברית" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "hu", name: "Hungarian", native: "magyar" },
  { code: "is", name: "Icelandic", native: "íslenska" },
  { code: "id", name: "Indonesian", native: "Indonesia" },
  { code: "it", name: "Italian", native: "italiano" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "jw", name: "Javanese", native: "Jawa" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "kk", name: "Kazakh", native: "қазақ тілі" },
  { code: "km", name: "Khmer", native: "ខ្មែរ" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "lo", name: "Lao", native: "ລາວ" },
  { code: "la", name: "Latin" },
  { code: "lv", name: "Latvian", native: "latviešu" },
  { code: "ln", name: "Lingala", native: "lingála" },
  { code: "lt", name: "Lithuanian", native: "lietuvių" },
  { code: "lb", name: "Luxembourgish", native: "Lëtzebuergesch" },
  { code: "mk", name: "Macedonian", native: "македонски" },
  { code: "mg", name: "Malagasy" },
  { code: "ms", name: "Malay", native: "Melayu" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mt", name: "Maltese", native: "Malti" },
  { code: "mi", name: "Māori" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "mn", name: "Mongolian", native: "монгол" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "no", name: "Norwegian", native: "norsk" },
  { code: "nn", name: "Norwegian Nynorsk", native: "norsk nynorsk" },
  { code: "oc", name: "Occitan" },
  { code: "ps", name: "Pashto", native: "پښتو" },
  { code: "fa", name: "Persian", native: "فارسی" },
  { code: "pl", name: "Polish", native: "polski" },
  { code: "pt", name: "Portuguese", native: "português" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ro", name: "Romanian", native: "română" },
  { code: "ru", name: "Russian", native: "русский" },
  { code: "sa", name: "Sanskrit", native: "संस्कृत भाषा" },
  { code: "sr", name: "Serbian", native: "српски" },
  { code: "sn", name: "Shona", native: "chiShona" },
  { code: "sd", name: "Sindhi", native: "سنڌي" },
  { code: "si", name: "Sinhala", native: "සිංහල" },
  { code: "sk", name: "Slovak", native: "slovenčina" },
  { code: "sl", name: "Slovenian", native: "slovenščina" },
  { code: "so", name: "Somali", native: "Soomaali" },
  { code: "es", name: "Spanish", native: "español" },
  { code: "su", name: "Sundanese", native: "Basa Sunda" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "sv", name: "Swedish", native: "svenska" },
  { code: "tg", name: "Tajik", native: "тоҷикӣ" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "tt", name: "Tatar", native: "татар" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "bo", name: "Tibetan", native: "བོད་སྐད་" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "tk", name: "Turkmen", native: "türkmen dili" },
  { code: "uk", name: "Ukrainian", native: "українська" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "uz", name: "Uzbek", native: "o‘zbek" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "cy", name: "Welsh", native: "Cymraeg" },
  { code: "yi", name: "Yiddish", native: "ייִדיש" },
  { code: "yo", name: "Yoruba", native: "Èdè Yorùbá" },
];

export function languageByCode(code: string) {
  return TARGET_LANGUAGES.find((l) => l.code === code);
}

export function searchLanguages(query: string): TargetLanguage[] {
  const q = query.trim().toLowerCase();
  if (!q) return TARGET_LANGUAGES;

  const scored: { lang: TargetLanguage; rank: number }[] = [];
  for (const lang of TARGET_LANGUAGES) {
    const name = lang.name.toLowerCase();
    const native = (lang.native ?? "").toLowerCase();
    let rank = -1;
    if (lang.code === q) rank = 0;
    else if (name.startsWith(q)) rank = 1;
    else if (native.startsWith(q)) rank = 2;
    else if (lang.code.startsWith(q)) rank = 3;
    else if (name.includes(q) || native.includes(q)) rank = 4;
    if (rank >= 0) scored.push({ lang, rank });
  }

  return scored
    .sort((a, b) => a.rank - b.rank || a.lang.name.localeCompare(b.lang.name))
    .map((s) => s.lang);
}
