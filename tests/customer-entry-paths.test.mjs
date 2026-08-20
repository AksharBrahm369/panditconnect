import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customer home keeps booking, replacement and online guidance visibly distinct", async () => {
  const portal = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(portal, /My Pandit cancelled/);
  assert.match(homepage, /title: "Find a replacement"/);
  assert.doesNotMatch(portal, /<strong>Choose a specific Puja<\/strong>/);
  assert.doesNotMatch(homepage, /<strong>Choose a specific Puja<\/strong>/);
  assert.match(portal, /Help me choose and book/);
  assert.match(portal, /Ask a Pandit online/);
  assert.match(portal, /choosePath\("PANDIT_SOS"\)/);
  assert.match(portal, /onClick=\{openOnlineGuidance\}/);
  assert.doesNotMatch(portal, /onlinePayments&&<button className="customer-choice-card online"/);
  assert.match(portal, /Direct Puja booking/);
  assert.match(portal, /Compare nearby Pandits/);
  assert.match(portal, /Check nearby Pandits again/);
  assert.match(portal, /requestType === "KNOWN_PUJA" \? "Selected Puja" : "Recommended"/);
});

test("beginner help uses distinct guided, walkthrough and app-support paths", async () => {
  const [homepage, helpPage, loginPage, loginForm, customerPage, portal] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/help/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/login-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/customer/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(homepage, /Need help using the app\?/);
  assert.doesNotMatch(homepage, /Choose the kind of help you want/);
  assert.match(helpPage, /Guide me step by step/);
  assert.match(helpPage, /Show me how it works/);
  assert.match(helpPage, /Talk to app support/);
  assert.match(helpPage, /Book a Pandit in three steps/);
  assert.match(helpPage, /App support is only for help using the website/);
  assert.match(loginPage, /nextPath/);
  assert.match(loginForm, /role === "CUSTOMER" && nextPath/);
  assert.match(customerPage, /initialStart=/);
  assert.match(portal, /initialStart === "guided" \? "NEED_GUIDANCE"/);
  assert.doesNotMatch(portal, /customer-help-fab/);
  assert.match(helpPage, /Talk to app support/);
});

test("public homepage uses the expressive task-first PujaOne service design", async () => {
  const [homepage, layout, styles, signatureStyles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pujaone-v2.css", import.meta.url), "utf8"),
    readFile(new URL("../app/pujaone-signature.css", import.meta.url), "utf8"),
  ]);

  assert.match(homepage, /A simpler way to arrange your Puja\./);
  assert.match(homepage, /title: "Book a Pandit"/);
  assert.match(homepage, /title: "Find a replacement"/);
  assert.match(homepage, /title: "Ask a Pandit"/);
  assert.match(homepage, /next=%2Fcustomer%3Fstart%3Dguided/);
  assert.match(homepage, /next=%2Fcustomer%3Fstart%3Dsos/);
  assert.match(homepage, /next=%2Fcustomer%3Fstart%3Donline/);
  assert.match(homepage, /One clear next step, every time/);
  assert.match(homepage, /pujaone-ritual-art-v2\.webp/);
  assert.match(layout, /import "\.\/public-home\.css"/);
  assert.match(layout, /import "\.\/pujaone-v2\.css"/);
  assert.match(layout, /import "\.\/pujaone-signature\.css"/);
  assert.match(styles, /--po-saffron/);
  assert.match(styles, /home-start-panel/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(signatureStyles, /public-home-v3/);
  assert.match(signatureStyles, /home-event-demo/);
});

test("public service choices retain their destination through sign-in", async () => {
  const [loginPage, loginForm, customerPage, portal] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/login-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/customer/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(loginPage, /params\.next\?\.startsWith\("\/customer"\)/);
  assert.match(loginForm, /role === "CUSTOMER" && nextPath \? nextPath : data\.redirectTo/);
  assert.match(customerPage, /params\.start === "guided" \|\| params\.start === "sos" \|\| params\.start === "online"/);
  assert.match(portal, /initialStart === "sos" \? "PANDIT_SOS"/);
  assert.match(portal, /useState\(initialStart === "online"\)/);
});
