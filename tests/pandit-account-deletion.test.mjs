import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("Pandit deletion creates an Admin request without deleting the profile", async () => {
  const account = await source("../app/api/account/privacy/route.ts");
  assert.match(account, /requestType==="ACCOUNT_DELETION"/);
  assert.match(account, /account_status='DELETION_REQUESTED'/);
  assert.match(account, /notifyAdmins/);
  assert.match(account, /Complete or cancel active bookings/);
  assert.doesNotMatch(account, /DELETE FROM pim_v2\.pandit_profiles/);
});

test("only the Admin approval route removes and anonymises a Pandit profile", async () => {
  const admin = await source("../app/api/admin/privacy-requests/route.ts");
  assert.match(admin, /requireAdmin\(\)/);
  assert.match(admin, /Active services or an unresolved balance still block deletion/);
  assert.match(admin, /removePanditDocuments/);
  assert.match(admin, /DELETE FROM pim_v2\.pandit_service_pricing/);
  assert.match(admin, /DELETE FROM pim_v2\.pandit_profiles/);
  assert.match(admin, /email=NULL/);
  assert.match(admin, /account_status='DELETED'/);
  assert.match(admin, /recordAdminAction/);
});

test("Admin UI provides a clear deletion decision from the verified Pandit card", async () => {
  const portal = await source("../components/admin-portal.tsx");
  const requests = await source("../components/admin-privacy-requests.tsx");
  const settings = await source("../components/privacy-rights-settings.tsx");
  assert.match(portal, /Account deletion needs your decision/);
  assert.match(portal, /Review deletion request/);
  assert.match(requests, /Approve deletion/);
  assert.match(requests, /Keep account/);
  assert.match(requests, /active_services/);
  assert.match(settings, /Your profile has not been deleted yet/);
  assert.match(settings, /only after Admin approval/);
});

test("deletion-requested Pandits stay excluded from customer discovery", async () => {
  for (const route of ["../app/api/pandits/nearby/route.ts"]) {
    assert.match(await source(route), /u\.account_status='ACTIVE'/);
  }
});
