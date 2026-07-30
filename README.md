# PanditConnect

PanditConnect is an urgent religious-assistance web application. Customers can
describe their situation, receive practical ritual guidance, and connect with
the closest suitable approved Pandit instead of browsing a generic catalogue.

## Core flows

- **Pandit SOS:** find an urgent replacement when a planned Pandit cancels.
- **Guided help:** describe an occasion by text or voice and receive a suggested
  ritual with a preparation checklist.
- **Known Puja:** request a familiar Puja directly.
- **Live matching:** use customer and Pandit GPS coordinates for distance,
  availability, and ongoing location updates.
- **Private booking:** keep phone numbers private and reveal the exact service
  address only after acceptance.
- **Pandit portal:** register, complete a profile, receive admin approval, go
  online, and progress a request from acceptance to completion.
- **Admin portal:** review Pandit applications and monitor platform activity.

## Local development

1. Copy the required environment variables into a local `.env` file.
2. Apply the SQL files in `db/migrations` in filename order.
3. Run `npm install`.
4. Run `npm run dev`.

The optional records in `db/seeds` are for isolated demos only and are not
required for a clean database.

## OTP delivery

Development OTPs are displayed on screen when `OTP_PROVIDER="development"`.
For MSG91 delivery, configure an approved OTP template containing `##OTP##`,
then set `OTP_PROVIDER="msg91"` and `SMS_PROVIDER_TEMPLATE_ID` in `.env`.

## Validation

```bash
npx tsc --noEmit
npm run build
```
