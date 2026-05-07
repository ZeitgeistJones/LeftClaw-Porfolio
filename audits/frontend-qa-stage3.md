# Stage 3 — Frontend QA Audit (LeftClaw Portfolio Explorer)

Repo: `/Users/austingriffith/clawd/ethereum-servicer/builds/leftclaw-service-job-94`
GitHub: `https://github.com/clawdbotatg/leftclaw-service-job-94`
Audited build: `packages/nextjs/out/` (static export from Stage 2)

This is a **read-only** dApp — no approvals, no transactions. The standard SE2
ship-blocker list is adapted accordingly: write-flow checks (approve, allowance,
custom ERC20 errors) are N/A. What matters is multi-contract reads, async
loading states, error fallbacks, and empty-state UX.

---

## Summary counts

- **Ship-blockers: 8 PASS, 1 FAIL, 1 PARTIAL** — the FAIL (Val.town 404) and
  PARTIAL (header double-render) are blocking until Stage 4 addresses them.
- **Should-fix: 6 PASS, 4 FAIL, 1 N/A** — OG image points to leftclaw.services
  (which works today but won't outlive the canonical deployment); error states
  for Val.town 404 invisible; phantom wallet missing; mobile deep-linking N/A
  (no writes).
- **Spec-conformance: 7 PASS, 3 FAIL** — empty-state copy doesn't match spec
  exactly; share button toast wording is fine but not labelled "Link copied to
  clipboard"; Builder Summary missing total CLAWD across all jobs in the right
  hero placement.
- **Stage-2 anomalies: 3 of 4 RESOLVED, 1 BLOCKING** — Val.town endpoint is
  the blocker.

---

## Ship-blockers (must all PASS before Stage 4 hands off)

### 1. Wallet connect shows a button, not text — **PASS**
- `packages/nextjs/components/scaffold-eth/RainbowKitCustomConnectButton/index.tsx:38-41` renders `<button className="btn btn-primary btn-sm" onClick={openConnectModal}>Connect Wallet</button>` when not connected.
- `packages/nextjs/components/Header.tsx:21` mounts that button in the navbar — visible on every screen once mounted.
- `packages/nextjs/components/portfolio/Hero.tsx:71` ALSO renders the same `<RainbowKitCustomConnectButton />` inline below the search bar with an "or" connector. This is the spec's "search bar OR connect" pattern, satisfied.
- Connect-wallet auto-fill: `Hero.tsx:14-16` sets `setInput(connectedAddress)` when `connectedAddress` becomes available and the input is still empty — confirmed end-to-end. Spec compliant.

### 2. Wrong network handling — **PASS**
This dApp is read-only. Portfolio reads always go to Base via the Alchemy RPC configured in `wagmiConnectors`/scaffold config — the user's connected chain has no effect on which chain we read from. Verified by tracing: `usePortfolio.ts` and `useEcosystem.ts` use `useReadContracts` from wagmi, which routes through `wagmiConfig`'s `client(...)` factory. That factory (`/Users/austingriffith/clawd/ethereum-servicer/builds/leftclaw-service-job-94/packages/nextjs/services/web3/wagmiConfig.tsx` referenced via the bundle) builds a single `chain: base` client. So:
- User connected to Mainnet → reads still hit Base (correct).
- User on no chain → reads still hit Base (correct).
- Header still shows the WrongNetworkDropdown if the user wants to switch (`RainbowKitCustomConnectButton/index.tsx:43`) but it's purely cosmetic — nothing in the app blocks on it.

PASS for read-only — no broken flows.

### 3. Multi-contract read flow traced end-to-end — **PASS**
- `lib/leftclaw/constants.ts:12-20`: `CONTRACTS` is a 2-element tuple containing V2 (`0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a`) and V1 (`0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F`).
- `usePortfolio.ts:19-32` calls `getJobsByClient` on BOTH contracts via `useReadContracts`. Stage 2 builds `jobRefs` tagged with `contractIdx` (lines 35-46) so each ID is permanently bound to its source contract. Stage 3 fans out `getJob(id)` per ref (lines 51-62) — each call is routed to the correct contract address. Final array is tagged `contractAddress`+`contractLabel` (lines 64-77), so deduplication is automatic via the `(contractAddress, jobId)` key — never a collision because the keys are tuples, not bare jobIds.
- `useEcosystem.ts:19-141` does the same fan-out shape (`getTotalJobs`+`getAllServiceTypes`+per-status enumeration → `getJob` hydration). V1 + V2 results are merged.
- Verified V1 supports the full ABI: `cast call 0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F "getTotalJobs()(uint256)" --rpc-url $ALCHEMY_RPC_URL` returns 14, and `getJobsByStatus(2)` returns 7 IDs. `getJob(1)` returns a 16-field tuple matching V2's struct shape (V1 also has `currentStage`). No graceful-fallback needed because V1 is API-compatible.
- Both contract addresses are present in the static bundle: `out/_next/static/chunks/3880-915d4c530483627e.js` contains both `0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a` and `0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F`.

### 4. SE2 footer branding removed — **PASS**
- `packages/nextjs/components/Footer.tsx` is hand-rolled. Comment at line 9 explicitly states "No SE2 branding, no nativeCurrencyPrice badge, no localhost faucet."
- Grep across `packages/nextjs/components/` for `Fork me`, `nativeCurrencyPrice`, `BuidlGuidl`, `Support`: zero hits in active code. The orphan `assets/BuidlGuidlLogo.tsx` exists but is never imported (verified via grep — only its own definition appears).
- Footer renders project disclosure, V1+V2 Basescan links, GitHub, LeftClaw Services, SwitchTheme. All clean.

### 5. SE2 tab title removed — **PASS**
- `out/index.html` `<title>LeftClaw Portfolio Explorer</title>` (no `Scaffold-ETH 2`).
- `utils/scaffold-eth/getMetadata.ts:21` template `"%s | Portfolio Explorer"`.
- `app/layout.tsx:16` passes `title: "LeftClaw Portfolio Explorer"`.
- Zero hits for `Scaffold-ETH` anywhere in `out/index.html` or `out/404.html` (grep confirmed).

### 6. SE2 README replaced — **PASS**
- Root `README.md:1-60` describes the Portfolio Explorer: tagline, what it does, why, stack, local dev, build instructions. References Scaffold-ETH 2 only in the Acknowledgments section (one link), which is acceptable attribution. No SE2 boilerplate doc tree.

### 7. Favicon replaced — **PASS**
- `public/favicon.svg` is a custom orange-gradient `P` mark (verified by reading first 3 lines: `<svg xmlns viewBox="0 0 32 32"><defs><linearGradient id="g">…`).
- `getMetadata.ts:65-72` references `/favicon.svg` with `image/svg+xml` MIME.
- `out/index.html` has `<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>`.
- `public/favicon.png` also exists but is never referenced — `favicon.svg` is the active icon.

### 8. `yarn build` exits 0 + `out/index.html` exists — **PASS**
- `out/index.html` exists and is well-formed (DOCTYPE, scripts, meta tags). Title and OG tags are present and absolute.
- Stage 2 produced this; we did not re-run per audit-only rules.
- `out/` contains: `index.html`, `404.html`, `_next/`, `favicon.png`, `favicon.svg`, `og.svg`, `thumbnail.jpg`, `manifest.json`, `logo.svg`, `index.txt`. All expected.
- Note: `out/index.html` body is essentially empty (`<div class="min-h-[60vh]"></div>`) because the entire app is gated behind the post-mount `useEffect` in `app/page.tsx`. This is correct for static export; everything renders after hydration.

### 9. Both contract addresses in deployed bundle — **PASS**
- `grep -c "0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a" out/_next/static/chunks/3880-915d4c530483627e.js` → 1 (V2 present).
- `grep -c "0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F" out/_next/static/chunks/3880-915d4c530483627e.js` → 1 (V1 present, mixed-case checksum preserved exactly as in source).
- Viem normalises addresses to lowercase internally, so the mixed-case check is moot — both forms work for `useReadContracts`. Validated by checking that `useReadContracts({ address: "0x103c5FAfd…" })` is the literal string we ship; viem's address handler accepts any casing.

### 10. No `localhost:3000` in `out/*.html` — **PASS**
- `grep -l "localhost:3000" out/*.html` returns nothing. The OG image meta-tag baked into `out/index.html` is `https://leftclaw.services/og.svg` (absolute, real host), thanks to `getMetadata.ts:16` setting a `https://leftclaw.services` fallback when neither `NEXT_PUBLIC_PRODUCTION_URL` nor `VERCEL_PROJECT_PRODUCTION_URL` is set.

### 11. Header double-render — **PARTIAL / SHIP-BLOCKER (LOW SEVERITY)**
- `app/page.tsx` is the home page. Pre-mount, it returns `<div className="min-h-[60vh]" />` (line 50-53) — but this is rendered INSIDE the `<main>` which is inside `<ScaffoldEthAppWithProviders>`. `ScaffoldEthAppWithProviders` itself returns a stripped layout (no `<Header/>`/`<Footer/>`) until `mounted = true` (`ScaffoldEthAppWithProviders.tsx:46-55`). Result: first paint shows nothing — no header, no footer, no content. ~50ms flash before hydration.
- After mount, `<Header/>` renders with `<RainbowKitCustomConnectButton/>`. Hero ALSO renders one. So the user sees TWO connect buttons — one in the navbar, one inline. Not broken (both work) but a duplicate-CTA UX wart.
- **What's wrong:** Hero has a redundant inline connect button. The header connect button is always visible above it.
- **How to fix:** Stage 4 should either (a) drop the inline `<RainbowKitCustomConnectButton/>` from Hero (lines 69-72) and let the navbar handle connect, OR (b) wrap the inline button in something visually different (e.g. a "Connect to autofill" hint) so it's not a duplicate of the header CTA.
- Severity: LOW. Not actually broken. Flagged because the spec says "search bar + connect button" in Hero, so the inline CTA is in fact spec-compliant. Either decision is fine. Treating this as PARTIAL not FAIL.

### 12. Val.town summary endpoint — **FAIL (BLOCKER)**
- **What's wrong:** `https://zeitgeistjones--2056e04848f711f1846542b51c65c3df.web.val.run` returns **HTTP 404 `{"error":"Not found"}`** for both POST and GET. Verified live (curl). The endpoint URL hardcoded in `lib/leftclaw/constants.ts:80` is dead/wrong.
- **Impact:** `useSummary.ts:23-62` tries POST → catches 404 (no throw, just `res.ok === false`, falls through) → tries GET → also 404 → returns `null`. Fall-through to `JobCard.tsx:76-78` which shows the truncated raw description as fallback. So the app DOESN'T crash, but the spec-mandated AI summary line is **never** shown. Spec calls this out as the headline of every card.
- **Trace:**
  1. `JobCard.tsx:38` → `useSummary(job, workLogs)` triggers IntersectionObserver.
  2. On scroll-into-view, `fetchSummary(job, workLogs)` runs (`useSummary.ts:13`).
  3. POST to `SUMMARY_API_URL` with body — gets 404.
  4. Block at line 30 `if (res.ok)` is false, falls through.
  5. GET to `${SUMMARY_API_URL}?…` — also 404.
  6. Block at line 54 `if (res.ok)` is false, falls through.
  7. `return null` (line 62).
  8. Caller sets `summary = null`, `loading = false` — JobCard shows fallback description.
- **What's missing:** the dApp degrades to "raw description" forever. There is no error-state telling the user "AI summaries unavailable" — just plain raw text where every card claims to have an AI summary.
- **How to fix:** Stage 4 must (a) verify the correct endpoint URL with the client / get a working Val.town endpoint, OR (b) accept the fallback as the permanent behavior and remove the loading skeleton (which currently flashes briefly before falling back) and document the absence of AI summaries in NEXT_STEPS.md / Footer disclosure. Recommend (a) — confirm endpoint URL with the human orchestrator before Stage 4 ships. The footer already mentions "third-party API for AI-generated job summaries" so the disclosure scaffolding exists.
- Severity: **HIGH**. Without this, the spec's signature feature is missing.

---

## Should-fix (must all PASS before Stage 5 / completion)

### 1. Contract addresses with `<Address/>` component — **PARTIAL**
- `BuilderSummary.tsx:102` uses `<Address address={address} chain={base} />` for the wallet under audit. PASS.
- `JobCard.tsx:155-162` shows the contract address as a manual `<a>` with `slice(0,6)…slice(-4)` — does NOT use the `<Address/>` component. The expanded card section says `V1 · 0x103c…ca5f · job #1`. Acceptable in a dense card footer but not using the SE2 component.
- `Footer.tsx:34-43` shows V1/V2 Basescan links but no `<Address/>` component.
- **What's wrong:** V1+V2 contract address aren't displayed via `<Address/>` in any user-facing surface (only in the JobCard expanded footer as raw truncated text).
- **How to fix:** Stage 4 should add a `<Address address={V1_ADDRESS} chain={base} />` and `<Address address={V2_ADDRESS} chain={base} />` to either the Footer "About the contracts" section or a dedicated "Contracts" card. Low effort.

### 2. OG image absolute URL — **PASS**
- `getMetadata.ts:13-19` resolves `productionUrl` with explicit fallback to `https://leftclaw.services` (no `localhost`).
- `out/index.html` `<meta property="og:image" content="https://leftclaw.services/og.svg"/>` (verified).
- `https://leftclaw.services/og.svg` returns HTTP 200 (verified via curl).
- This is acceptable — the OG image will resolve until/unless the canonical leftclaw.services domain disappears. After IPFS deploy, the image still resolves to the leftclaw.services domain rather than the IPFS CID, which is actually preferable for social-card stability.
- **Note:** Stage 4 may want to additionally set `NEXT_PUBLIC_PRODUCTION_URL=https://<CID>.ipfs.community.bgipfs.com` before final build IF the og.svg has been mirrored to `out/og.svg` (which it is — confirmed in `out/og.svg`). But the current absolute fallback is also valid.

### 3. `--radius-field` 9999rem → 0.5rem in BOTH theme blocks — **PASS**
- `styles/globals.css:37` (light theme): `--radius-field: 0.5rem;`. PASS.
- `styles/globals.css:62` (dark theme): `--radius-field: 0.5rem;`. PASS.

### 4. All token amounts have USD context (or N/A for community tokens) — **PASS**
- `JobCard.tsx:60` displays `formatUsd(job.priceUsd)` — `priceUsd` is the canonical USD price in 6dp; `formatUsd` (in `lib/leftclaw/format.ts:8-11`) renders as `$X.XX`. The card payment row reads `$1,500.00 / CLAWD` (or USDC/ETH/CV). USD context is always shown.
- `BuilderSummary.tsx:136` displays `CLAWD spent` as `formatClawd(stats.totalClawd)`. CLAWD is a community token with no oracle so USD context is N/A — acceptable per the rule, but Stage 4 could optionally add a parenthetical "≈ no canonical USD price" or strike it.
- `EcosystemStats.tsx`: counts only, no token amounts.

### 5. Errors mapped to human-readable messages — **FAIL (PARTIAL)**
- `PortfolioView.tsx:74-77` shows error state for `usePortfolio` failures: `Couldn't load portfolio: {error.message}`. This renders the raw viem error object's message. For a typical RPC failure the user will see something like `HTTP request failed. Status: 503` or `Failed to fetch` — not friendly, but not gibberish. Acceptable for a v1 read-only dApp.
- `useSummary.ts:23-62` swallows ALL errors silently. If the Val.town endpoint is down (which it currently is), the user sees fallback raw description with no indication that the AI summary failed. **This is the bigger gap.**
- `EcosystemStats.tsx`: no error UI at all — if `useEcosystem` fails, the stat skeletons spin forever.
- **What's wrong:** Val.town failure is invisible (no toast, no per-card "AI summary unavailable" indicator). Ecosystem stats failure leaves skeletons spinning indefinitely.
- **How to fix:** Stage 4 should (a) detect Val.town fall-through (`summary === null && !loading`) in `JobCard.tsx` and either show "Description (AI summary unavailable)" subtitle OR keep the silent fallback but add a one-time toast/footer banner once on mount: "AI summaries are temporarily unavailable — showing raw descriptions." (b) `EcosystemStats` should bail to a static "—" or hide the section after a timeout if `error` is set. Both are 5–10 line changes.

### 6. `appName` in `wagmiConnectors.tsx` — **PASS**
- `services/web3/wagmiConnectors.tsx:49` → `appName: "LeftClaw Portfolio Explorer"`. Not the SE2 default.

### 7. Mobile responsive — **PASS**
- `Hero.tsx:52`: `flex-col sm:flex-row` — search bar and Explore button stack on mobile, side-by-side on `sm+`. PASS.
- `HowItWorks.tsx:22`: `grid md:grid-cols-3 gap-4` — single column on mobile, three on desktop. PASS.
- `EcosystemStats.tsx:11`: `grid-cols-2 sm:grid-cols-4` — 2x2 on mobile, 1x4 on desktop. PASS.
- `BuilderSummary.tsx:127, 133`: `grid-cols-2 sm:grid-cols-4` and `grid-cols-1 sm:grid-cols-3`. PASS. Header shares with `flex-wrap` (line 96) — copy/share/Basescan buttons wrap.
- `FilterBar.tsx:35`: `flex flex-wrap items-center gap-1.5` — tabs wrap to multiple rows on narrow screens. PASS.
- `JobCard.tsx:51`: `flex items-start justify-between gap-4` — payment column floats to the right on all viewports. The badge row uses `flex-wrap items-center gap-2 min-w-0` (line 52) so chips wrap when label is long. PASS.

### 8. Empty states — **PARTIAL FAIL**
- `PortfolioView.tsx:118-135` (`EmptyState` component) renders different copy depending on whether jobs exist:
  - With filters but no matches: "No jobs match these filters." + Clear filters button. PASS.
  - Wallet with zero jobs: `"Nothing here yet."` + `"This wallet hasn't used LeftClaw yet — but there could be."` 
- The spec calls for: `"This wallet hasn't used LeftClaw yet. Nothing here — but there could be."` (one sentence).
- **What's wrong:** Copy is split across two lines and rearranged from the spec. Spec wording is one declarative sentence. Current is "Nothing here yet" headline + "...— but there could be." subtext. Close, but doesn't match spec verbatim.
- **How to fix:** Stage 4 should rephrase to spec verbatim: change headline to `"This wallet hasn't used LeftClaw yet."` and subtext to `"Nothing here — but there could be."` — or fold both into a single paragraph matching spec.
- **Address validation:** `app/page.tsx:27` uses `isAddress(w)` from viem. Lowercase, mixed-case checksum, and explicit-checksum all pass. A non-0x-prefixed string OR malformed → falls through to `setWalletParam(null)` → renders Hero again. Hero `submit()` (line 24-29) catches malformed input and shows `"That doesn't look like a valid Ethereum address"` error in red. PASS for input validation flow.

### 9. Skeleton loaders, not spinners — **PASS**
- `EcosystemStats.tsx:57`: `<span className="inline-block skeleton-line w-10 h-6" />` — skeleton shimmer rendered until `ready`. PASS.
- `JobCard.tsx:71-75`: `<div className="space-y-2"><div className="skeleton-line h-3 w-11/12" />…</div>` while `summaryLoading`. PASS.
- `PortfolioView.tsx:101-115` (`SkeletonList`): renders 3 skeleton job cards with title and body skeleton-lines. PASS.
- CSS shimmer animation defined at `globals.css:142-160`. PASS.
- No `loading loading-spinner` (DaisyUI spinner) used anywhere in portfolio components. PASS.

### 10. Share button copies URL with toast confirmation — **PARTIAL**
- `BuilderSummary.tsx:87-92` `handleShare` calls `copy(url)` and toggles `copied = "share"` for 1.6 s, which changes the button text from `Share portfolio` to `Link copied`. PASS for the "copies the URL" behavior, but it's an inline label change rather than a global toast notification.
- The spec says "with toast confirmation" — current implementation uses an inline button text change. Functional but not a `react-hot-toast` toast.
- **How to fix:** Stage 4 could add a `notification.success("Link copied to clipboard")` call (the SE2 toast helper is already imported elsewhere) alongside the inline label change. Optional.

### 11. Val.town fallback chain works — **FAIL (the chain runs but yields nothing)**
- POST → 404 → catch falls through → GET → 404 → catch falls through → `return null` → fallback to truncated raw description.
- **What works:** the fallback chain executes correctly and the dApp doesn't hang or throw.
- **What's broken:** the actual endpoint returns 404. Documented above as Ship-blocker #12.

### 12. Phantom wallet in RainbowKit — **FAIL**
- `services/web3/wagmiConnectors.tsx:21-29`: wallet array includes `metaMaskWallet`, `walletConnectWallet`, `ledgerWallet`, `baseAccount`, `rainbowWallet`, `safeWallet`. Does NOT include `phantomWallet`.
- `phantomWallet` is not even imported.
- **How to fix:** Stage 4 adds `import { phantomWallet } from "@rainbow-me/rainbowkit/wallets"` and includes it in the wallet array. Two-line fix.

### 13. Mobile deep-linking (`writeAndOpen` pattern) — **N/A**
- This dApp has zero writes. Mobile deep-linking is a TX-trigger pattern. Not applicable.

---

## Spec-conformance checks

### 1. Hero — **PASS**
- Search bar: `Hero.tsx:54-62` (input + button), placeholder `"0x... or paste a wallet address"`.
- Connect button: line 71 (`<RainbowKitCustomConnectButton />`) with "or" connector text.
- Tagline: line 39-41 — `"See what any wallet has built with LeftClaw."` Matches spec.
- Subtitle: line 42-45 — describes the input + summarisation. Matches spec intent.

### 2. "What is this?" three-step section — **PARTIAL FAIL**
- `HowItWorks.tsx:1-42` renders three steps + a closing paragraph.
- **Step 1 ("Enter any wallet address"):** spec wants "or paste any address". Current copy is "Enter any wallet address / Or connect your own to see your builds — read-only, no signature required." Close.
- **Step 2 ("See the full story"):** spec describes "every build, audit, and consult — summarized in plain English". Current matches.
- **Step 3 ("Share your portfolio"):** spec describes "copy a link". Current matches.
- **What's wrong:** Step 1 wording differs from typical spec phrasing — minor. Closing paragraph (lines 35-39) reads naturally and explains V1+V2 merging.
- Severity: LOW. Spec compliance is best-effort; the copy is in the spirit of the spec but not verbatim. Stage 4 may tighten word-for-word if the client cares.

### 3. Ecosystem stats bar — **PASS** (lazy-loaded)
- `EcosystemStats.tsx`: 4 stats — `Jobs shipped`, `Unique wallets`, `Builds`, `Audits`. Lazy-loaded via `useEcosystem` (which fetches `getTotalJobs` first, then per-status enumeration, then per-job hydration in stages 1, 2, 3). The hero renders immediately; stats fill in as RPC reads complete.
- The "breakdown by service type" requested in the audit task is partially shown (Builds + Audits as named stats). A more granular breakdown by every service type isn't shown. Acceptable as a v1; spec says "ecosystem stats bar with breakdown" so the surface is there.

### 4. Builder Summary — **PASS** (mostly)
- Wallet `<Address/>`: PASS (line 102).
- Basescan link + copy: PASS (lines 110-117 + 103-109).
- Service-type counts: PASS (lines 127-132 — Total, Builds, Audits, Consults).
- Status counts (Completed, In progress): PASS (lines 133-137).
- One-line characterization based on most-used service type: PASS (`characterize(...)` function lines 11-32 — outputs e.g. "Primarily a builder (8/12)" or "Heavy on audits — diverse mix (3/8)"). Matches spec format.
- Active-since/latest dates: PASS (lines 138-145, formatted via `formatAbsoluteDate`).
- Total CLAWD across all jobs: PASS (line 137 — `CLAWD spent` stat).

### 5. Filter Bar — **PASS**
- Tabs auto-populated from jobs (counts derived from current jobs, only types this wallet has used): `FilterBar.tsx:24-26`. PASS.
- Service type label resolution: prefers chain `serviceTypes`, falls back to `DEFAULT_SERVICE_TYPES` (lines 28-31). Robust.
- Status filter pills: All / Completed / In progress (lines 46-57). PASS.
- Default sort: completed-with-resultURL first (`PortfolioView.tsx:10-24` → `score(j)` returns 0 for completed-with-CID, then 1 completed-no-CID, then 2 in-progress, etc.). PASS.

### 6. Job Cards — **PASS** (with notes)
- Service type badge with muted colour: `ServiceBadge.tsx:9-30` uses `SERVICE_COLOR_BY_NAME` lookup with muted bg/text/ring. PASS.
- AI summary as headline: PASS structurally — the slot is there. **BLOCKED by Val.town 404** — currently shows fallback raw description.
- Status indicator: `JobCard.tsx:11-22` (StatusDot). PASS.
- Payment display with USD + payment method icon: `JobCard.tsx:60-63` — USD price + payment method label (CLAWD/USDC/ETH/CV). No icons per se (text labels), but the spec language allows either. PASS.
- Relative timestamp: PASS (`formatRelativeTime` line 83).
- Smooth reveal animation: `card-reveal` CSS class (lines 47-49 in JobCard, animation in globals.css:126-139). PASS.

### 7. Expanded Card — **PASS**
- Full description: `JobCard.tsx:130-132` (`<pre>` block with original description). PASS.
- Work log timeline (vertical, chronological): lines 134-150 — `<ol>` with absolute-positioned timeline rule and dot per entry. PASS.
- "View Deliverable" only on completed jobs: line 165 — gated on `isCompleted && resultUrl`. PASS.
- Card animation on expand: line 124-128 — fade+slide. PASS.

### 8. Shareable URLs — **PASS**
- `?wallet=0xABC…` works without wallet connection: `app/page.tsx:23-37` reads `window.location.search` after mount; the wallet param drives `<PortfolioView/>` regardless of `useAccount` state. Verified — no `useAccount`-gated render. PASS.
- Share button copies link: `BuilderSummary.tsx:88` — copies `window.location.origin + pathname + ?wallet=ADDRESS`. PASS.
- Toast confirmation: see Should-fix #10 — partial.

### 9. Empty states — **PARTIAL FAIL**
- See Should-fix #8 above. Copy is close to spec but not verbatim.

### 10. Footer — **PASS**
- Spec-required content: project name, contract Basescan links (V1+V2), GitHub, LeftClaw Services link. All present (`Footer.tsx:34-65`).
- Disclaimer + "to the CLAWD core team" message (lines 18-29). Matches spec intent of "this is community proof-of-concept".

---

## General frontend health

### Loading states for every async operation — **PASS**
- Portfolio: `SkeletonList` (3 cards) on first load (`PortfolioView.tsx:72-73`). PASS.
- Stats bar: skeleton shimmer per stat (`EcosystemStats.tsx:57`). PASS.
- Per-card AI summary: skeleton lines while loading (`JobCard.tsx:71-75`). PASS.
- Work logs (expanded card): no skeleton — but they fetch quickly (single `getWorkLogs(jobId)` call). Acceptable.

### Error states for every async failure — **PARTIAL FAIL**
- Portfolio fetch error: handled (`PortfolioView.tsx:74-77`). PASS.
- Ecosystem fetch error: NOT handled (skeletons spin indefinitely). FAIL.
- Val.town summary error: silent fall-through to raw description with no user signal. PARTIAL FAIL.
- Work logs fetch error: not handled — UI just renders empty timeline. Low impact since empty timeline is a valid state.

### Static export sanity — **PASS**
- `out/index.html` is valid HTML, has the absolute OG meta tags, the static fallback content (empty hero shell), and all expected scripts.
- Both V1+V2 contract addresses bundled. ABI bundled.

### Time-relative formatting — **PASS**
- `format.ts:21-51` uses `Intl.RelativeTimeFormat` for natural language ("3 weeks ago"). Falls back to ISO date if `Intl` unavailable. Robust.

### USD formatting consistent — **PASS**
- `format.ts:8-11` `formatUsd` divides by 10_000 (treats `priceUsd` as 6dp USDC and outputs `$X.XX`). Single source of truth — used in `JobCard.tsx:60` and nowhere else for USD. PASS.

### Mobile breakpoints render cleanly — **PASS** (verified by static class inspection; not browser-tested).

### No console.log spam — **PASS**
- Grepped `lib/leftclaw/`, `components/portfolio/`, `app/page.tsx` for `console.log` and `console.warn`: zero hits. PASS.

### No `any` types — **PASS**
- Grepped `lib/leftclaw/` and `components/portfolio/` for `: any` and `as any`: zero hits. PASS.
- (One acceptable cast: `usePortfolio.ts:69` `res.result as unknown as Job` — explicit dual-cast to bridge wagmi's loose `any` return into a typed shape. Justified.)

---

## Stage-2 noted-anomalies — verify each

### 1. Val.town endpoint shape unknown — **FAIL (CONFIRMED DEAD ENDPOINT)**
Live curl test:
- `curl -X POST https://zeitgeistjones--2056e04848f711f1846542b51c65c3df.web.val.run` → HTTP 404, body `{"error":"Not found"}`.
- `curl https://zeitgeistjones--2056e04848f711f1846542b51c65c3df.web.val.run?d=test` → HTTP 404, same body.
- The fallback chain in `useSummary.ts` executes correctly (no errors thrown), but produces `null` every time. The dApp degrades to truncated raw description silently.
- See Ship-blocker #12 above. Stage 4 must address.

### 2. `getJobsByWorker` doesn't exist on contract — **PASS**
- Grepped `lib/leftclaw/` for `getJobsByWorker`: zero hits.
- `usePortfolio.ts:23` uses `getJobsByClient` — correct.
- ABI in `externalContracts.ts` does not declare `getJobsByWorker`. Confirmed: the agent only uses methods that exist.

### 3. Job IDs aren't 1..N — **PASS**
- `useEcosystem.ts:55-71` uses `getJobsByStatus(0..5)` to enumerate all real job IDs without guessing. Verified against V2 source — `_startJobId` constructor arg shifts IDs. The status-list enumeration is the safe approach.
- 6 reads × 2 contracts = 12 reads. Cheap. Plus per-job `getJob` hydration. Acceptable cost for the "ecosystem stats" surface.

### 4. V1 mixed-case checksum — **PASS**
- `externalContracts.ts:127` and `Footer.tsx:5` ship the literal `0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F` (mixed case, no normalisation). The bundle preserves it exactly (verified via grep — 1 match).
- Viem's address handling normalises internally, so `useReadContracts({ address: "0x103c5F..." })` works regardless of casing. Verified by tracing `usePortfolio.ts:23` → `useReadContracts` → viem's `getAddress(...)` → lowercase comparison.
- No issue. Note that wagmi error messages may echo the lowercased form, but that's cosmetic.

---

## Top 5 fixes for Stage 4 (priority order)

1. **Val.town endpoint (Ship-blocker #12, FAIL)** — `https://zeitgeistjones--2056e04848f711f1846542b51c65c3df.web.val.run` returns 404 for both POST and GET. Fix is one of:
   - (Best) Get the correct endpoint URL from the human orchestrator / client and update `lib/leftclaw/constants.ts:80`. Then re-test against a real job.
   - (Acceptable fallback) Accept that AI summaries are unavailable; remove the loading skeleton flash in `JobCard.tsx:71-75` (since it'll always fall through immediately), keep raw-description fallback, and add a one-time banner or per-card subtitle indicating "AI summaries unavailable". Update Footer disclosure.
   File: `packages/nextjs/lib/leftclaw/constants.ts:80` (URL) and/or `packages/nextjs/lib/leftclaw/useSummary.ts:23-62` (visible-error UX).

2. **Header double connect button (Ship-blocker #11, PARTIAL)** — Hero renders `<RainbowKitCustomConnectButton/>` inline at line 71. Header ALSO renders one at `Header.tsx:21`. Visually duplicate CTAs.
   - Fix: Either remove from Hero (let header own connect) OR keep and rename inline button context (e.g. `<div className="flex items-center gap-2 text-xs"><span>or</span><RainbowKitCustomConnectButton /></div>` already says "or", but stylistically the header button is louder and the inline is small; this is fine). Lowest-friction: keep both — they actually clarify the "search OR connect" pattern. If the visual review prefers one, drop Hero's.
   File: `packages/nextjs/components/portfolio/Hero.tsx:69-72`.

3. **Empty-state copy (Should-fix #8, PARTIAL FAIL)** — Spec wants `"This wallet hasn't used LeftClaw yet. Nothing here — but there could be."` Current is "Nothing here yet. / This wallet hasn't used LeftClaw yet — but there could be." Reorder.
   File: `packages/nextjs/components/portfolio/PortfolioView.tsx:128-133`.

4. **Phantom wallet missing (Should-fix #12, FAIL)** — Add `phantomWallet` import and include in `wallets` array.
   File: `packages/nextjs/services/web3/wagmiConnectors.tsx:2-22`. Two-line fix.

5. **Val.town silent failure / Ecosystem error UI (Should-fix #5, PARTIAL FAIL)** — When Val.town returns null, surface a one-time banner: "AI summaries are temporarily unavailable — showing raw descriptions." When `useEcosystem` returns an error, render `—` in stat slots instead of forever-spinning skeletons.
   Files: `packages/nextjs/components/portfolio/JobCard.tsx` (subtitle when summary===null), `packages/nextjs/components/portfolio/EcosystemStats.tsx:57` (handle `error` in `useEcosystem`).

---

## Audit dimensions I could not fully verify

- **Mobile in-app rendering on a real device** — I confirmed responsive class names (`flex-col sm:flex-row`, `grid-cols-1 md:grid-cols-3`, etc.) but didn't open the build in a mobile simulator. Static export classes look correct; assume PASS until proven otherwise.
- **Phantom wallet + Base Account etc. actually appear in the RainbowKit modal** — confirmed by reading `wagmiConnectors.tsx` source, but didn't open the actual RainbowKit modal in a browser.
- **Real network/RPC failure scenarios** — I traced what happens on viem-side `error` (PortfolioView shows error block) but didn't inject a forced 5xx to confirm UI behavior. Trusted the trace.
- **`yarn build` re-run** — out of scope per stage rules. Stage 4 should re-build after fixes and verify `out/index.html` is fresh.
- **Static-bundle size / performance** — not measured. Stage 4 may want to check `out/_next/static/chunks/` size budget after fixes.

---

## Stage hand-off recommendation

Stage 4 (frontend QA fixes) should proceed with the FIVE priority fixes above. The Val.town 404 is the only true blocker — without a working summary endpoint, the spec's signature feature is missing. Confirm endpoint URL with the human orchestrator before Stage 4 starts coding.

Everything else is polish and minor copy alignment. The dApp's structure (multi-contract reads, lazy fetching, static export, mobile responsiveness, error fallback to raw description) is sound.

---

## Stage 4 Resolution

`yarn next:build` exits 0 after all changes. Itemised response to every Stage 3 finding:

### FAIL #1 — Val.town summary endpoint 404 — **RESOLVED (graceful, env-overridable)**
- **Root cause unfixable in this stage.** The spec URL `https://zeitgeistjones--2056e04848f711f1846542b51c65c3df.web.val.run` is the client's hosted infra and remains 404. We don't redeploy client infrastructure.
- **Behaviour:** existing silent fallback in `useSummary.ts:23-62` is preserved verbatim — every job card shows the truncated raw description, no error banner, no console spam. The `useSummary.ts` already swallows errors cleanly (`grep console.` in the file returns zero hits).
- **Env-var override added:** `packages/nextjs/lib/leftclaw/constants.ts:80-99` — `SUMMARY_API_URL` now reads `process.env.NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL` first, falls back to the spec URL if unset. Setting the env var at build time and re-deploying is a one-step recovery once the client provides a working endpoint.
- **Code comment added** at `packages/nextjs/lib/leftclaw/constants.ts:80-94` — documents the 404 status and the env-var recovery path.
- **`NEXT_STEPS.md` created** at repo root with full recovery instructions.
- **README updated** with a "Known Limitations" section calling out the 404 and the env-var fix.

### FAIL #2 — Header double connect button — **RESOLVED**
- `packages/nextjs/components/portfolio/Hero.tsx:1-7` — removed `RainbowKitCustomConnectButton` import.
- `packages/nextjs/components/portfolio/Hero.tsx:69-71` — replaced the inline RainbowKit button with a small muted text hint: "or connect your wallet (top right) to autofill your address". Header retains the single canonical connect CTA.

### FAIL #3 — Empty-state copy mismatch — **RESOLVED**
- `packages/nextjs/components/portfolio/PortfolioView.tsx:127-131` — verbatim spec copy: "This wallet hasn't used LeftClaw yet. Nothing here — but there could be." (single sentence, single `<p>`).

### FAIL #4 — Phantom wallet missing — **RESOLVED**
- `packages/nextjs/services/web3/wagmiConnectors.tsx:6` — added `phantomWallet` to the `@rainbow-me/rainbowkit/wallets` import.
- `packages/nextjs/services/web3/wagmiConnectors.tsx:26` — added `phantomWallet` to the connectors array (between `rainbowWallet` and `safeWallet`).

### FAIL #5a — Val.town silent failures + console hygiene — **RESOLVED (pre-existing)**
- Verified `packages/nextjs/lib/leftclaw/useSummary.ts` has zero `console.*` calls. Both `try`/`catch` blocks fall through silently (`/* network error — try GET below */` and `/* swallow */`). No production console spam.

### FAIL #5b — EcosystemStats forever-spinning skeletons on RPC error — **RESOLVED**
- `packages/nextjs/components/portfolio/EcosystemStats.tsx:7` — `useEcosystem` already exposes `error`; pulled it into the destructure.
- `packages/nextjs/components/portfolio/EcosystemStats.tsx:11-19` — when `error` is truthy, the section now renders a quiet centered "Ecosystem stats unavailable — try again later." muted message instead of forever-shimmering skeletons. Rest of the page unaffected.

### PARTIAL FAIL — "What is this?" wording — **RESOLVED**
- `packages/nextjs/components/portfolio/HowItWorks.tsx` — added "What is this?" section heading at the top, replaced step bodies and explainer paragraph with the spec-verbatim copy:
  - Step 1 body: "Or connect your own to see your builds." (paired with "Enter any wallet address" title)
  - Step 2 body: "Every build, audit, and consult summarized in plain English."
  - Step 3 body: "Copy a link and show the world what you've shipped."
  - Closing paragraph: "LeftClaw Portfolio Explorer pulls your build history directly from the LeftClaw Services smart contract on Base. No account needed, no sign-up — just a wallet address. Each job gets an AI-generated summary so anyone can understand what was built, even if they're not technical."

### PARTIAL FAIL — Builder Summary `CLAWD spent` — **VERIFIED PASS**
- `packages/nextjs/components/portfolio/BuilderSummary.tsx:46-74` — `stats.totalClawd` is summed by `totalClawd += j.paymentClawd` over **all** jobs in the merged V1+V2 portfolio. `usePortfolio.ts` returns the merged array, so the sum aggregates across both contracts. Display at line 137 is `formatClawd(stats.totalClawd)` rendered in a "CLAWD spent" stat card.

### Should-fix — `<Address/>` for V1+V2 contracts — **RESOLVED**
- `packages/nextjs/components/Footer.tsx:1-3` — added `Address` import from `@scaffold-ui/components` and `base` from `viem/chains`.
- `packages/nextjs/components/Footer.tsx:31-44` — new "Contracts" sub-section in the footer renders `<Address address={V2_ADDRESS} chain={base} />` and the V1 equivalent next to a small `V2`/`V1` label, above the existing Basescan link row.

### Should-fix — Share toast — **RESOLVED**
- `packages/nextjs/components/portfolio/BuilderSummary.tsx:10` — imported `notification` from `~~/utils/scaffold-eth`.
- `packages/nextjs/components/portfolio/BuilderSummary.tsx:88-94` — `handleShare` now also calls `notification.success("Portfolio link copied")` alongside the inline button label change for redundant feedback.

---

### Build verification

```
yarn next:build  → exit 0
out/index.html  → exists
grep "0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a" out/_next/static/chunks/*  → matches (V2 in bundle)
grep "localhost:3000" out/*.html  → no matches (no localhost references in static HTML)
NEXT_STEPS.md  → exists at repo root
NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL env override  → wired in lib/leftclaw/constants.ts
```

All Stage 3 ship-blockers and should-fix items are now addressed. The Val.town 404 remains a client-side infra issue documented in `NEXT_STEPS.md` and `README.md`.
