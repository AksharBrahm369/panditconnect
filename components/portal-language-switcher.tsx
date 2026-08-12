"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { INDIAN_LANGUAGES } from "@/lib/indian-languages";
import { PORTAL_TRANSLATIONS } from "@/lib/portal-i18n";

export const PORTAL_LANGUAGE_STORAGE_KEY = "panditconnect_app_language";
export const PORTAL_LANGUAGE_EVENT = "panditconnect:language-change";

export function usePortalLanguage() {
  const [language, setLanguageState] = useState("English");

  useEffect(() => {
    const sync = () => setLanguageState(window.localStorage.getItem(PORTAL_LANGUAGE_STORAGE_KEY) || "English");
    sync();
    window.addEventListener(PORTAL_LANGUAGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PORTAL_LANGUAGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setLanguage = (nextLanguage: string) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(PORTAL_LANGUAGE_STORAGE_KEY, nextLanguage);
    document.documentElement.lang = nextLanguage === "English" ? "en" : nextLanguage.toLowerCase();
    document.documentElement.dir = nextLanguage === "Urdu" ? "rtl" : "ltr";
    window.dispatchEvent(new Event(PORTAL_LANGUAGE_EVENT));
  };

  return [language, setLanguage] as const;
}

export function PortalLanguageSwitcher({ value, onChange, label }: { value:string; onChange:(value:string)=>void; label:string }) {
  return <label className="portal-language-switcher" title="Change app language">
    <Languages size={17} aria-hidden="true" />
    <span className="sr-only">{label}</span>
    <select aria-label={label} value={value} onChange={(event)=>onChange(event.target.value)}>
      {INDIAN_LANGUAGES.filter((language)=>Boolean(PORTAL_TRANSLATIONS[language.value])).map((language)=><option key={language.value} value={language.value}>{language.native} · {language.value}</option>)}
    </select>
  </label>;
}
