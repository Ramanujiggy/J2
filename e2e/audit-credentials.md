# E2E Audit Account — Live Railway

Used by `roadmap-audit.spec.ts` for visual audits against the production deployment.

| Field    | Value                          |
|----------|-------------------------------|
| Email    | audit@journada-audit.dev      |
| Password | AuditPass123!                  |
| URL      | https://extraordinary-freedom-production.up.railway.app |

> Account was registered directly on the live app. No email validation required.
> Onboarding completed (name "Audit", white belt, one seeded session).

## Running

```
npx playwright test --config=e2e/playwright-remote.config.ts e2e/roadmap-audit.spec.ts
```

`roadmap-audit.setup.ts` logs in once and writes `e2e/.auth/audit-state.json`
(contains the JWT — do not commit). Prod rate-limits `/auth/*` to
**10 requests / 15 min per IP**; if setup reports "Too many attempts", wait
15 minutes before re-running.
