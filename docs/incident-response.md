# Security incident response

## Immediate response

1. Record the incident, severity, time, affected systems and owner in `pim_v2.security_incidents`.
2. Contain access: revoke exposed credentials, invalidate affected sessions, suspend compromised accounts and preserve audit logs.
3. Assess whether identity documents, bank information, locations, messages or payment records were accessed.
4. Notify the designated security/legal owner and payment/SMS/storage providers where relevant.
5. Restore only from a verified backup or reviewed release; monitor for recurrence.
6. Complete a post-incident review with root cause, timeline, affected users, corrective actions and credential-rotation dates.

## Credential rotation

Rotate database, Supabase service-role, OTP, VAPID, payment, webhook and application secrets at least every 90 days and immediately after suspected disclosure. Record only the credential name and dates in `credential_rotation_log`, never the secret value.

## Before commercial launch

Arrange an independent penetration test covering authentication, role boundaries, IDOR, injection, file upload, webhook replay, session handling, business logic and mobile/PWA behaviour. Remediate high/critical findings before launch.
