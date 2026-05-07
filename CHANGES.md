# CHANGES — Job #102 (Feature iteration on Job #94)

This iteration applies six fixes from the QA audit report (Job #97). The
contracts (V1 + V2 LeftClaw Services) are unchanged — frontend only.

## Summary of fixes

### FIX #1 — BUG-1: Audits counter always shows 0
- **Cause:** exact-string match `name === "Audit"` doesn't match the actual
  on-chain names `"Contract Audit"` or `"Frontend QA Audit"`.
- **Files:**
  - `packages/nextjs/lib/leftclaw/constants.ts` — `DEFAULT_SERVICE_TYPES`
    updated to the canonical V2 on-chain names (Type 4 = `Contract Audit`,
    Type 5 = `Frontend QA Audit`, Type 8 = `Judge / Oracle`, Type 10 =
    `Feature`, etc.). `SERVICE_COLOR_BY_NAME` extended with the new lower-case
    keys so badges keep their colors.
  - `packages/nextjs/components/portfolio/EcosystemStats.tsx:32-58` — both
    `Builds` and `Audits` counters now use case-insensitive
    `name.toLowerCase().includes(...)` matching.
  - `packages/nextjs/components/portfolio/BuilderSummary.tsx:12-37, 87-95` —
    `characterize()` and the build/audit/consult counters now use
    case-insensitive substring matching across all keys.

### FIX #2 — BUG-2: Summary info blinks
- **Cause:** `useSummary(job, workLogs ? [...workLogs] : [])` produced a fresh
  array reference on every render, which re-ran `useSummary`'s `useEffect`,
  which disconnected + reattached the `IntersectionObserver`, which flashed
  the skeleton.
- **Files:**
  - `packages/nextjs/components/portfolio/JobCard.tsx:39-44` — wrapped the
    `workLogs` array in `useMemo` so its identity is stable across renders.
  - `packages/nextjs/lib/leftclaw/useSummary.ts:71-141` — removed `workLogs`
    from the effect dependency array; the latest `workLogs` are read at fetch
    time via a ref so the effect only re-runs on `job` / `key` / `summary`
    changes. Also fixed the race window: `summaryCache.set(...)` now happens
    BEFORE `inflight.delete(...)` so concurrent observers see the cached
    value rather than racing into a duplicate fetch.

### FIX #3 — SF-2: AddressInput in Hero
- **Cause:** Raw `<input>` was used in the Hero, missing ENS resolution and
  consistent SE-2 input styling.
- **Files:**
  - `packages/nextjs/components/portfolio/Hero.tsx` — replaced the raw
    `<input>` with `<AddressInput/>` from `@scaffold-ui/components`. ENS
    resolution is wired via `useAddressInput` from `@scaffold-ui/hooks` so
    users can paste e.g. `vitalik.eth` and the form resolves it before
    navigation. Validation now accepts either a 0x address OR an ENS-resolved
    address.

### FIX #4 — SF-5: pollingInterval to 3000
- **Files:**
  - `packages/nextjs/scaffold.config.ts:20` — `pollingInterval: 3000` (was
    `30000`). Base produces blocks every ~2s so 30s made the UI feel stale.

### FIX #5 — SF-6: RPC config gaps (three sub-fixes)
- **Files:**
  - `packages/nextjs/scaffold.config.ts:14-29` —
    1. `NEXT_PUBLIC_ALCHEMY_API_KEY` is read at build time (still falls back
       to `DEFAULT_ALCHEMY_API_KEY` if unset).
    2. `rpcOverrides` populated for Base (chain `8453`) pointing at
       `https://base-mainnet.g.alchemy.com/v2/<KEY>`.
  - `packages/nextjs/services/web3/wagmiConfig.tsx` — removed the bare
    `http()` fallback for non-mainnet chains. The fallback chain is now
    Alchemy-only for Base. Mainnet keeps its existing BuidlGuidl public RPC
    fallback for ENS / ETH-price lookups. Block reformatted from the
    single-line scaffold-eth original for legibility.

### FIX #6 — SF-9 / UX-7: Val.town summary fallback indicator
- **Cause:** the Val.town summary endpoint is currently DEAD (HTTP 404). The
  dApp silently fell through to the truncated description with no signal that
  the AI summary failed.
- **Decision:** added a tiny opacity-30 `⊘ summary unavailable` suffix at the
  end of the fallback description text. Subtle (12px-equivalent, near-invisible
  contrast) — visible if you look but does not draw attention away from the
  description itself. Implemented via a new `error` boolean returned from
  `useSummary`.
- **Files:**
  - `packages/nextjs/lib/leftclaw/useSummary.ts` — added `error` state,
    surfaced from the fetch path: `error = true` when both POST and GET
    return null.
  - `packages/nextjs/components/portfolio/JobCard.tsx` — destructure `error`
    from `useSummary` and conditionally render the suffix.

## Out of scope / not changed

- Contracts (V1 + V2 LeftClaw Services). Read-only consumers; no redeploys.
- Val.town summary endpoint itself. Still 404 — see the existing
  `NEXT_STEPS.md` for the post-launch fix-it guide.
