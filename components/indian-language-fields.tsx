"use client";

import { Check, Languages } from "lucide-react";
import { INDIAN_LANGUAGES } from "@/lib/indian-languages";

export function IndianLanguageSelect({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  return <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
    {INDIAN_LANGUAGES.map((language) => <option value={language.value} key={language.value}>{language.native} — {language.value}</option>)}
  </select>;
}

export function IndianLanguageMultiSelect({ value, onChange, label = "Languages you can serve customers in" }: { value: string[]; onChange: (value: string[]) => void; label?: string }) {
  const selected = new Set(value);
  function toggle(language: string) {
    const next = selected.has(language) ? value.filter((item) => item !== language) : [...value, language];
    onChange(next);
  }
  return <fieldset className="indian-language-picker">
    <legend><Languages size={18} /><span><strong>{label}</strong><small>Select every language in which you can clearly explain and perform a Puja.</small></span></legend>
    <div className="indian-language-grid">
      {INDIAN_LANGUAGES.map((language) => <button type="button" className={selected.has(language.value) ? "selected" : ""} aria-pressed={selected.has(language.value)} onClick={() => toggle(language.value)} key={language.value}>
        <span><b>{language.native}</b><small>{language.value}</small></span>{selected.has(language.value) && <Check size={16} />}
      </button>)}
    </div>
    <p>{value.length ? `${value.length} selected: ${value.join(", ")}` : "Select at least one language."}</p>
  </fieldset>;
}
