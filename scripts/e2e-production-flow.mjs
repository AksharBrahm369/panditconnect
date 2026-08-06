import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";

const baseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, "");
if (!baseUrl?.startsWith("https://")) throw new Error("E2E_BASE_URL must be an HTTPS deployment URL");

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL is required");

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
const ids = { customer: crypto.randomUUID(), pandit: crypto.randomUUID(), outsider: crypto.randomUUID(), booking: crypto.randomUUID() };
const tokens = { customer: crypto.randomBytes(32).toString("hex"), pandit: crypto.randomBytes(32).toString("hex"), outsider: crypto.randomBytes(32).toString("hex") };
const phoneSeed = crypto.randomInt(0, 99_999_997);
const phones = [0, 1, 2].map((offset) => `+9188${String(phoneSeed + offset).padStart(8, "0")}`);
const arrivalOtp = "731946";
const cookie = (token) => `pim_v2_session=${token}`;
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function api(path, token, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { cookie: cookie(token), "content-type": "application/json", ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function transition(token, status, expected, extra = {}) {
  const result = await api(`/api/bookings/${ids.booking}`, token, { method: "PATCH", body: JSON.stringify({ status, ...extra }) });
  assert.equal(result.response.status, expected, `${status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

await client.connect();
try {
  await client.query(
    `INSERT INTO pim_v2.users(id,phone,role,name,city) VALUES
      ($1,$4,'CUSTOMER','Automated Customer','Mumbai'),
      ($2,$5,'PANDIT','Automated Pandit','Mumbai'),
      ($3,$6,'CUSTOMER','Outside Customer','Mumbai')`,
    [ids.customer, ids.pandit, ids.outsider, ...phones],
  );
  await client.query(
    `INSERT INTO pim_v2.pandit_profiles(user_id,verification_status,is_online,latitude,longitude,experience_years,languages,specialities,base_charge)
     VALUES($1,'APPROVED',true,19.086,72.908,8,ARRAY['Hindi'],ARRAY['Ganesh Puja'],1100)`,
    [ids.pandit],
  );
  await client.query(`INSERT INTO pim_v2.pandit_services(pandit_id,service_id,charge) VALUES($1,'ganesh-puja',1100)`, [ids.pandit]);
  for (const [role, userId] of [["CUSTOMER", ids.customer], ["PANDIT", ids.pandit], ["CUSTOMER", ids.outsider]]) {
    const token = role === "PANDIT" ? tokens.pandit : userId === ids.customer ? tokens.customer : tokens.outsider;
    await client.query(
      `INSERT INTO pim_v2.sessions(id,user_id,token_hash,session_role,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')`,
      [crypto.randomUUID(), userId, digest(token), role],
    );
  }
  await client.query(
    `INSERT INTO pim_v2.bookings(id,customer_id,pandit_id,service_id,address,latitude,longitude,amount,status,arrival_otp,request_type,materials_option)
     VALUES($1,$2,$3,'ganesh-puja','Automated E2E test address',19.086,72.908,1100,'REQUESTED',$4,'KNOWN_PUJA','NEED_GUIDANCE')`,
    [ids.booking, ids.customer, ids.pandit, arrivalOtp],
  );

  const customerList = await api("/api/bookings", tokens.customer);
  assert.equal(customerList.response.status, 200);
  assert.ok(customerList.body.bookings.some((booking) => booking.id === ids.booking));
  const outsiderList = await api("/api/bookings", tokens.outsider);
  assert.equal(outsiderList.response.status, 200);
  assert.ok(!outsiderList.body.bookings.some((booking) => booking.id === ids.booking));

  await transition(tokens.outsider, "CANCELLED", 403);
  await transition(tokens.pandit, "ACCEPTED", 200);
  await transition(tokens.pandit, "ON_THE_WAY", 200);
  await transition(tokens.pandit, "ARRIVED", 200);
  await transition(tokens.pandit, "IN_PROGRESS", 400, { arrivalOtp: "000000" });
  await transition(tokens.pandit, "IN_PROGRESS", 200, { arrivalOtp });
  await transition(tokens.pandit, "COMPLETED", 200);

  const unavailableGateway = await api(`/api/bookings/${ids.booking}/payment`, tokens.customer, {
    method: "POST",
    body: JSON.stringify({ method: "UPI" }),
  });
  assert.equal(unavailableGateway.response.status, 409);
  const payment = await api(`/api/bookings/${ids.booking}/payment`, tokens.customer, {
    method: "POST",
    body: JSON.stringify({ method: "CASH" }),
  });
  assert.equal(payment.response.status, 200, JSON.stringify(payment.body));
  assert.equal(payment.body.paymentMethod, "CASH");
  assert.equal(payment.body.paymentStatus, "CONFIRMED");

  const rating = await api(`/api/bookings/${ids.booking}/rating`, tokens.customer, {
    method: "POST",
    body: JSON.stringify({ rating: 5, comment: "Automated E2E verification" }),
  });
  assert.equal(rating.response.status, 200, JSON.stringify(rating.body));
  const duplicateRating = await api(`/api/bookings/${ids.booking}/rating`, tokens.customer, {
    method: "POST",
    body: JSON.stringify({ rating: 4 }),
  });
  assert.equal(duplicateRating.response.status, 409);

  console.log(JSON.stringify({ success: true, checks: 17, baseUrl }));
} finally {
  await client.query(`DELETE FROM pim_v2.bookings WHERE customer_id=ANY($1::uuid[]) OR pandit_id=ANY($1::uuid[])`, [[ids.customer, ids.pandit, ids.outsider]]).catch(() => undefined);
  await client.query(`DELETE FROM pim_v2.users WHERE id=ANY($1::uuid[])`, [[ids.customer, ids.pandit, ids.outsider]]).catch(() => undefined);
  await client.end();
}
