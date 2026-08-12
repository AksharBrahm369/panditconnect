import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("customer and Pandit flows support the full scheduled Indian language catalogue", async () => {
  const [catalogue, customer, profile, onboarding, profileApi, bookingApi] = await Promise.all([
    read("lib/indian-languages.ts"),
    read("components/customer-portal.tsx"),
    read("components/profile-editor.tsx"),
    read("components/pandit-onboarding.tsx"),
    read("app/api/profile/route.ts"),
    read("app/api/bookings/route.ts"),
  ]);
  for (const language of ["English", "Assamese", "Bengali", "Bodo", "Dogri", "Gujarati", "Hindi", "Kannada", "Kashmiri", "Konkani", "Maithili", "Malayalam", "Manipuri", "Marathi", "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali", "Sindhi", "Tamil", "Telugu", "Urdu"]) {
    assert.match(catalogue, new RegExp(`value: "${language}"`));
  }
  assert.match(customer, /IndianLanguageSelect/);
  assert.match(customer, /preferred_language/);
  assert.match(profile, /IndianLanguageMultiSelect/);
  assert.match(onboarding, /IndianLanguageMultiSelect/);
  assert.match(profileApi, /INDIAN_LANGUAGE_VALUES/);
  assert.match(bookingApi, /isIndianLanguage/);
});

test("Customer and Pandit navbars expose a persistent app-language selector", async () => {
  const [shell, switcher, translations, css] = await Promise.all([
    read("components/app-shell.tsx"),
    read("components/portal-language-switcher.tsx"),
    read("lib/portal-i18n.ts"),
    read("app/globals.css"),
  ]);
  assert.match(shell, /PortalLanguageSwitcher/);
  assert.match(shell, /usePortalLanguage/);
  assert.match(switcher, /localStorage\.setItem/);
  assert.match(switcher, /document\.documentElement\.lang/);
  assert.match(switcher, /panditconnect:language-change/);
  assert.match(switcher, /Change app language/);
  for (const language of ["English", "Hindi", "Marathi", "Gujarati", "Bengali", "Tamil", "Telugu", "Malayalam"]) assert.match(translations, new RegExp(`${language}:`));
  assert.match(css, /\.portal-language-switcher/);
  assert.match(css, /@media\(max-width:720px\)/);
});

test("the selected app language updates customer dashboard content", async () => {
  const [customer, translations] = await Promise.all([
    read("components/customer-portal.tsx"),
    read("lib/portal-i18n.ts"),
  ]);
  assert.match(customer, /translatePortalText/);
  assert.match(customer, /tr\("What do you need help with today\?"\)/);
  assert.match(translations, /આજે તમને કઈ મદદ જોઈએ છે\?/);
  assert.match(translations, /export function translatePortalText/);
});

test("the selected app language localizes the complete Pandit workspace", async () => {
  const [shell, localizer, translations] = await Promise.all([
    readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/pandit-page-localizer.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pandit-page-translations.ts", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /usePanditPageLocalizer\(portalMainRef, appLanguage, role === "Pandit"\)/);
  assert.match(localizer, /MutationObserver/);
  assert.match(localizer, /placeholder.*title.*aria-label/s);
  for (const language of ["Hindi", "Marathi", "Gujarati", "Bengali", "Tamil", "Telugu", "Malayalam", "Kannada", "Punjabi", "Odia", "Urdu"]) {
    assert.match(translations, new RegExp(`"${language}"\\s*:`));
  }
  assert.match(translations, /"Complete your verified professional profile"/);
  assert.match(translations, /"Still needed before submission"/);
  assert.match(translations, /"Save draft"/);
});
