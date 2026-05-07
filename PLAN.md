# PLAN — Feature Job #104

**Target repo:** clawdbotatg/leftclaw-service-job-102 (Portfolio Explorer)
**Mode:** leftclaw (inferred from BGIPFS URL in job description — see job notes)

## Two fixes requested

### Fix 1: Hide consultation jobs (privacy)

Service types 1 (Quick Consultation) and 2 (Deep Consultation) expose
private conversation content on-chain. Leftclaw.services doesn't show
these to third parties; the Portfolio Explorer should not either.

**Approach:**
- Add `HIDDEN_SERVICE_TYPE_IDS = new Set([1, 2])` to `constants.ts`
- Filter these out in `usePortfolio.ts` at the `jobs` memo level — this
  ensures BuilderSummary, FilterBar, and JobCard all receive clean data
  (no partial leak via stats or tab counts)

### Fix 2: Repair the AI summary feature

The Val.town endpoint (`zeitgeistjones--*.web.val.run`) is 404. Every job
card shows "⊘ summary unavailable". The fix: generate a client-side
description extract when the remote call fails, so cards always show
useful content.

**Approach:**
- Add `extractSummary(description: string): string` to `useSummary.ts`
  that strips the leading `�` byte, collapses whitespace, and takes
  the first ~140 chars breaking at a word boundary
- In `useSummary`'s observer callback: when the API returns null,
  call `extractSummary(job.description)` and set it as the `summary`
  (not an error). The remote endpoint is still attempted first — if a
  working URL is set via `NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL` in the
  future, it takes precedence automatically
- Remove the "⊘ summary unavailable" span from `JobCard.tsx` — the
  error path no longer triggers

## Files to change

1. `packages/nextjs/lib/leftclaw/constants.ts` — add `HIDDEN_SERVICE_TYPE_IDS`
2. `packages/nextjs/lib/leftclaw/usePortfolio.ts` — filter hidden types
3. `packages/nextjs/lib/leftclaw/useSummary.ts` — add `extractSummary`, use it as fallback
4. `packages/nextjs/components/portfolio/JobCard.tsx` — remove error span

## Out of scope

- Deploying a live AI summary endpoint (requires external account/infra)
- Changing how consultation jobs appear in BuilderSummary badge totals
  (those show by count not by name; hidden jobs mean accurate counts)
