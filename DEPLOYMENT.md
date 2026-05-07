# Deployment — LeftClaw Portfolio Explorer (Job #102, Feature iteration on Job #94)

**Date:** 2026-05-06
**Job:** LeftClaw Services Job #102 (Feature, iterating on Job #94)
**Source GitHub repo:** https://github.com/clawdbotatg/leftclaw-service-job-102

## Live URL

https://bafybeihd5quz4rxekpnvw5fqe3674q7llktx2dbr3grsadnznjhblogqlq.ipfs.community.bgipfs.com/

## IPFS

- **CID:** `bafybeihd5quz4rxekpnvw5fqe3674q7llktx2dbr3grsadnznjhblogqlq`
- **Gateway:** `community.bgipfs.com`
- **Verified:** HTTP/2 200
- **Previous CID (Job #94):** `bafybeihx3qrfhbgfatrpydr7zsynxwhnceokc22zbbs6tgmx2sbszievyi`
  (different — confirms this deploy contains the new fixes)

## Contracts (read-only references on Base mainnet — unchanged from Job #94)

The dApp does not deploy any new contracts — it reads from existing LeftClaw
Services contracts:

- **LeftClaw Services V2:** `0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a`
- **LeftClaw Services V1:** `0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F`

Both are the canonical deployed addresses; the registry is hand-maintained
in `packages/nextjs/lib/leftclaw/constants.ts`.

## What changed from Job #94

Six fixes from the Job #97 QA audit. See `CHANGES.md` for the full
file:line breakdown of each change.

1. BUG-1: Audits counter shows 0 → case-insensitive substring match
   across all "audit" service-type names.
2. BUG-2: Summary skeleton blinks on every render → workLogs reference
   stabilized via useMemo + effect deps tightened.
3. SF-2: Hero now uses `<AddressInput/>` with ENS resolution.
4. SF-5: `pollingInterval` 30000 → 3000 (Base produces blocks every ~2s).
5. SF-6: RPC config: NEXT_PUBLIC_ALCHEMY_API_KEY honored, `rpcOverrides`
   populated for Base, bare-public-RPC fallback removed for non-mainnet.
6. SF-9 / UX-7: Subtle "summary unavailable" indicator when Val.town
   summary fetch fails.

## Build artifacts

- Static export: `packages/nextjs/out/`
- Build framework: Next.js 15 (static export, no server)

## Stack

- Next.js 15 (static export)
- wagmi + viem + RainbowKit
- TailwindCSS + DaisyUI
- Scaffold-ETH 2 base

## Notes

- AI summary endpoint (Val.town) is still 404; dApp falls back to truncated
  on-chain descriptions, now with a subtle visual indicator (FIX #6). To
  restore the summary feature without a code change, set
  `NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL` at build time. See `NEXT_STEPS.md`.
- Polyfill `polyfill-localstorage.cjs` lives in `packages/nextjs/` and is
  required by the static-export build via `NODE_OPTIONS`.
