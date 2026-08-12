"use client";

import { Languages } from "lucide-react";
import { INDIAN_LANGUAGES } from "@/lib/indian-languages";
import { PORTAL_TRANSLATIONS } from "@/lib/portal-i18n";

export const PORTAL_LANGUAGE_STORAGE_KEY = "panditconnect_app_language";

export function PortalLanguageSwitcher({ value, onChange, label }: { value:string; onChange:(value:string)=>void; label:string }) {
  return <label className="portal-language-switcher" title="Change app language">
    <Languages size={17} aria-hidden="true" />
    <span className="sr-only">{label}</span>
    <select aria-label={label} value={value} onChange={(event)=>onChange(event.target.value)}>
      {INDIAN_LANGUAGES.filter((language)=>Boolean(PORTAL_TRANSLATIONS[language.value])).map((language)=><option key={language.value} value={language.value}>{language.native} · {language.value}</option>)}
    </select>
  </label>;
}
