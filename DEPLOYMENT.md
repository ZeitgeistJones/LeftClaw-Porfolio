# Deployment — LeftClaw Portfolio Explorer (Job #94)

**Date:** 2026-05-06

## Live URL

https://bafybeihx3qrfhbgfatrpydr7zsynxwhnceokc22zbbs6tgmx2sbszievyi.ipfs.community.bgipfs.com/

## IPFS

- **CID:** `bafybeihx3qrfhbgfatrpydr7zsynxwhnceokc22zbbs6tgmx2sbszievyi`
- **Gateway:** `community.bgipfs.com`
- **Verified:** HTTP/2 200

## Contracts (read-only references on Base mainnet)

The dApp does not deploy any new contracts — it reads from existing LeftClaw
Services contracts:

- **LeftClaw Services V2:** `0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a`
- **LeftClaw Services V1:** `0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F`

Both are the canonical deployed addresses; the registry is hand-maintained
in `packages/nextjs/lib/leftclaw/constants.ts`.

## Build artifacts

- Static export: `packages/nextjs/out/`
- Build framework: Next.js 15 (static export, no server)

## Stack

- Next.js 15 (static export)
- wagmi + viem + RainbowKit
- TailwindCSS + DaisyUI
- Scaffold-ETH 2 base

## Notes

- AI summary endpoint (Val.town) is 404; dApp falls back to truncated
  on-chain descriptions. See `NEXT_STEPS.md`.
