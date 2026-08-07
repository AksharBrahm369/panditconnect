import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customer-facing Pandit photographs expose only an approved verified profile photo", async () => {
  const route = await readFile(new URL("../app/api/pandits/[id]/photo/route.ts", import.meta.url), "utf8");
  const avatar = await readFile(new URL("../components/pandit-avatar.tsx", import.meta.url), "utf8");
  const portal = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  const publicProfile = await readFile(new URL("../app/customer/pandits/[id]/page.tsx", import.meta.url), "utf8");

  assert.match(route, /verification_status='APPROVED'/);
  assert.match(route, /document_type='PROFILE_PHOTO'/);
  assert.match(route, /review_status='VERIFIED'/);
  assert.match(route, /createPrivateSignedUrl/);
  assert.doesNotMatch(route, /GOVERNMENT_ID|BANK_PROOF|ADDRESS_PROOF/);
  assert.match(avatar, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(portal, /PanditAvatar/);
  assert.match(publicProfile, /PanditAvatar/);
});
