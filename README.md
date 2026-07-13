# AirCare Challenge — Customer Feedback Website

Real Next.js site (not a mockup) implementing the customer-facing QR feedback
flow from Phase 6's design, wired to the actual FastAPI backend from Phases
5–7. Statically exported — deploys to S3 + CloudFront per the Phase 14
infrastructure.

## What's real vs. still a gap

**Real and tested:**
- 127 statically-generated pages, one per RO, generated directly from the
  same seed data (`db/007_seed_master_data.sql`) used for the printed QR
  codes — every printed QR code has a matching page in this build.
- Full API integration: RO validation, mobile number entry, feedback
  submission, all calling the real backend endpoints (`src/lib/api.ts`).
- **Bot-detection is currently OFF by default** (per explicit decision —
  bots aren't considered a realistic threat for this campaign's audience).
  Customers go straight from entering their mobile number to rating their
  experience — no checkbox, no waiting. The self-check (checkbox +
  honeypot + timing) and WhatsApp-OTP-escalation code are still fully built
  and tested, just dormant — flip `SELF_CHECK_ENABLED=true` on the backend
  and this frontend picks it up automatically on next load via
  `GET /api/v1/config/public`, no frontend redeploy needed.
- The one-submission-per-mobile-number-per-outlet-per-day rule is enforced
  regardless of this toggle — verified structurally, both code paths
  converge on the same duplicate check.
- Photo upload — direct-to-S3 presigned upload, feedback still submits
  successfully even if the photo upload fails.
- Verified with an actual `npm run build` (TypeScript passes, ESLint clean,
  131 pages generated).

**Still a gap:** the backend's photo verification (confirming an uploaded
object actually exists before trusting a submitted `photo_url`) is built and
unit-tested (`app/tests/test_feedback_service.py`), but not yet wired into
the live `/api/v1/feedback` endpoint by default — it requires a `StorageService`
instance to be passed in, and doing that on every submission adds an S3
round-trip to the core write path, which trades off against the "keep the
customer-facing write path fast" design principle from Phase 3. Left as an
opt-in call site change rather than silently adding that latency — your call
whether the extra verification is worth it in production.

## Local development

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your running backend
npm run dev
```
Visit `http://localhost:3000/feedback/AIRCARE-219578` (or any of the 127 real
RO codes in `src/data/ro-codes.json`) with the backend running separately.

## Production build

```bash
npm run build
```
Output goes to `out/` — a fully static site, ready to sync to S3:
```bash
aws s3 sync out/ s3://aircare-frontend-production/ --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

**Important:** `NEXT_PUBLIC_API_URL` is baked in at build time (static
export has no server to read env vars at runtime). Rebuild whenever the
backend's real domain changes — e.g., once Phase 14's ALB is live, set it to
the real API domain and rebuild before deploying.

## Regenerating after RO list changes

If the RO master data changes (outlets added/removed), re-run the same
generation step used to build `src/data/ro-codes.json` from
`db/007_seed_master_data.sql`, then rebuild — the QR code generation script
from earlier should be re-run at the same time so both stay in sync.
