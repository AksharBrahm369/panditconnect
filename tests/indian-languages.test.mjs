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
