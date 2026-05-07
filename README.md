# LeftClaw Portfolio Explorer

A read-only, client-side dApp that turns any wallet's LeftClaw Services
history into a clean, shareable portfolio.

> See what any wallet has built with LeftClaw — every build, audit, and
> consult, summarized in plain English.

**Iteration:** Feature job #102 — applies six fixes from QA audit #97
on top of the original Job #94 build. See `CHANGES.md` for the diff
summary and `DEPLOYMENT.md` for the live URL of this iteration.

**Live (Job #102):** https://bafybeihd5quz4rxekpnvw5fqe3674q7llktx2dbr3grsadnznjhblogqlq.ipfs.community.bgipfs.com/
**Live (Job #94, original):** https://bafybeihx3qrfhbgfatrpydr7zsynxwhnceokc22zbbs6tgmx2sbszievyi.ipfs.community.bgipfs.com/

## What it does

- Reads on-chain job history for any address from **both** LeftClaw
  contracts on Base mainnet (V1 + V2) and merges the results so no
  historical builds are lost.
- For each job, fetches an AI-generated one-line summary from a community
  Val.town endpoint (lazy-loaded as cards scroll into view).
- Surfaces ecosystem-wide stats: total jobs shipped, unique wallets, and a
  service-type breakdown.
- Generates shareable URLs (`?wallet=0xABC…`) so any portfolio can be
  copied into a tweet or DM.

## Why it exists

LeftClaw Services is great at producing on-chain reputation as a side
effect of getting work done — but the raw history is a series of opaque
contract reads. This tool is a community-built proof-of-concept for what a
proper, native portfolio could look like once the production pipeline
generates plain-English summaries from day one.

## Stack

- **Smart contracts** — read-only against
  - V2 `0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a`
  - V1 `0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F`
- **Frontend** — Next.js 15 (static export), wagmi, viem, RainbowKit,
  TailwindCSS + DaisyUI.
- **Hosting** — IPFS via bgipfs.

## Local dev

```bash
yarn install
yarn workspace @se-2/nextjs dev
# http://localhost:3000
```

## Build for IPFS

```bash
yarn workspace @se-2/nextjs build
# Output: packages/nextjs/out/
```

## Known Limitations

- **AI summary endpoint is currently 404.** The Val.town worker hard-coded as
  the default summary URL
  (`https://zeitgeistjones--2056e04848f711f1846542b51c65c3df.web.val.run`)
  returns HTTP 404 for both POST and GET. The dApp falls back silently: every
  job card shows the truncated raw on-chain description instead of an
  AI-generated headline. To restore the feature without a code change, set
  `NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL` at build time to a working endpoint with
  the same shape (see `packages/nextjs/lib/leftclaw/useSummary.ts` for the
  request/response contract). See `NEXT_STEPS.md` for details.
- **Manual contract registry.** Historical LeftClaw contract addresses are
  hand-maintained in `packages/nextjs/lib/leftclaw/constants.ts`. Adding a
  future V3 requires a one-line edit and a rebuild.

## Acknowledgments

- Built on top of [Scaffold-ETH 2](https://scaffoldeth.io).
- Job summaries powered by a community Val.town endpoint.
- The CLAWD core team for shipping LeftClaw Services.
