export const INDIAN_LANGUAGES = [
  { value: "English", native: "English" },
  { value: "Assamese", native: "অসমীয়া" },
  { value: "Bengali", native: "বাংলা" },
  { value: "Bodo", native: "बड़ो" },
  { value: "Dogri", native: "डोगरी" },
  { value: "Gujarati", native: "ગુજરાતી" },
  { value: "Hindi", native: "हिन्दी" },
  { value: "Kannada", native: "ಕನ್ನಡ" },
  { value: "Kashmiri", native: "کٲشُر" },
  { value: "Konkani", native: "कोंकणी" },
  { value: "Maithili", native: "मैथिली" },
  { value: "Malayalam", native: "മലയാളം" },
  { value: "Manipuri", native: "মৈতৈলোন্" },
  { value: "Marathi", native: "मराठी" },
  { value: "Nepali", native: "नेपाली" },
  { value: "Odia", native: "ଓଡ଼ିଆ" },
  { value: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { value: "Sanskrit", native: "संस्कृतम्" },
  { value: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { value: "Sindhi", native: "سنڌي" },
  { value: "Tamil", native: "தமிழ்" },
  { value: "Telugu", native: "తెలుగు" },
  { value: "Urdu", native: "اردو" },
] as const;

export const INDIAN_LANGUAGE_VALUES = INDIAN_LANGUAGES.map((language) => language.value) as [string, ...string[]];

export function isIndianLanguage(value: string): boolean {
  return INDIAN_LANGUAGES.some((language) => language.value === value);
}
