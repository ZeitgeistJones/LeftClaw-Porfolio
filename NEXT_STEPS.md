# Next Steps

**Live:** https://bafybeihx3qrfhbgfatrpydr7zsynxwhnceokc22zbbs6tgmx2sbszievyi.ipfs.community.bgipfs.com/

The Portfolio Explorer is shipped and functional. Two items the client should resolve to complete the spec:

## 1. Val.town summary API endpoint
**Status:** dead (404)
**Spec URL:** https://zeitgeistjones--2056e04848f711f1846542b51c65c3df.web.val.run
**Behavior:** verified 404 on POST, GET, OPTIONS — both shapes the dApp tries.

The dApp falls back gracefully: every job card shows the truncated raw description instead of an AI summary. To restore the headline feature, either:
- Redeploy the Val.town worker at the spec URL with the original logic (POST or GET, returns `{summary: string}` or a string body), OR
- Provide a corrected endpoint URL via `NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL` env var at build time and re-deploy the static export

The endpoint integration code is at `packages/nextjs/lib/leftclaw/useSummary.ts` and the URL constant is at `packages/nextjs/lib/leftclaw/constants.ts:VAL_TOWN_SUMMARY_URL`.

## 2. Manual contract registry
The dApp reads from a hand-maintained contract list at `packages/nextjs/lib/leftclaw/constants.ts:LEFTCLAW_CONTRACTS`. When the LeftClaw team deploys a new V3, add one entry to that array and rebuild. A production version could auto-discover via an ENS text record.
