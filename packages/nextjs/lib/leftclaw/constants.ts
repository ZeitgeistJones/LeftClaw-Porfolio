/**
 * Shared constants for the LeftClaw Portfolio Explorer.
 *
 * Contract addresses come from externalContracts.ts but we re-export concrete
 * lowercase strings here for places where the wagmi typed config can't be
 * indexed (e.g. when fanning out raw multicall reads).
 */
import externalContracts from "~~/contracts/externalContracts";

export const BASE_CHAIN_ID = 8453 as const;

export const LEFTCLAW_V2_ADDRESS = externalContracts[BASE_CHAIN_ID].LeftClawServicesV2.address as `0x${string}`;
export const LEFTCLAW_V1_ADDRESS = externalContracts[BASE_CHAIN_ID].LeftClawServicesV1.address as `0x${string}`;

export const LEFTCLAW_ABI = externalContracts[BASE_CHAIN_ID].LeftClawServicesV2.abi;

export const CONTRACTS = [
  { label: "V2", address: LEFTCLAW_V2_ADDRESS },
  { label: "V1", address: LEFTCLAW_V1_ADDRESS },
] as const;

// JobStatus enum mirrors the V2 contract.
export const JOB_STATUS = {
  OPEN: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
  DECLINED: 3,
  CANCELLED: 4,
  REASSIGNED: 5,
} as const;

export const JOB_STATUS_LABEL: Record<number, string> = {
  0: "Open",
  1: "In progress",
  2: "Completed",
  3: "Declined",
  4: "Cancelled",
  5: "Reassigned",
};

// PaymentMethod enum.
export const PAYMENT_METHOD_LABEL: Record<number, string> = {
  0: "CLAWD",
  1: "USDC",
  2: "ETH",
  3: "CV",
};

// Default service-type fallback names used if `getAllServiceTypes` hasn't
// loaded yet — matches the on-chain defaults (V2 contract).
export const DEFAULT_SERVICE_TYPES: Record<number, string> = {
  1: "Quick Consultation",
  2: "Deep Consultation",
  3: "PFP Generator",
  4: "Contract Audit",
  5: "Frontend QA Audit",
  6: "Build",
  7: "Research Report",
  8: "Judge / Oracle",
  9: "HumanQA",
  10: "Feature",
};

// Muted color palette per service type. Keys are the canonical lowercase
// slugs we expect from `getAllServiceTypes()`; we also fall back to numeric
// IDs in case slugs ever shift.
export const SERVICE_COLOR_BY_NAME: Record<string, { bg: string; text: string; ring: string }> = {
  build: { bg: "bg-emerald-500/15", text: "text-emerald-400", ring: "ring-emerald-500/30" },
  audit: { bg: "bg-blue-500/15", text: "text-blue-400", ring: "ring-blue-500/30" },
  "contract audit": { bg: "bg-blue-500/15", text: "text-blue-400", ring: "ring-blue-500/30" },
  "frontend qa audit": { bg: "bg-teal-500/15", text: "text-teal-400", ring: "ring-teal-500/30" },
  "quick consult": { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/30" },
  "deep consult": { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/30" },
  "quick consultation": { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/30" },
  "deep consultation": { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/30" },
  consult: { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/30" },
  pfp: { bg: "bg-purple-500/15", text: "text-purple-400", ring: "ring-purple-500/30" },
  "pfp generator": { bg: "bg-purple-500/15", text: "text-purple-400", ring: "ring-purple-500/30" },
  "frontend qa": { bg: "bg-teal-500/15", text: "text-teal-400", ring: "ring-teal-500/30" },
  research: { bg: "bg-yellow-500/15", text: "text-yellow-400", ring: "ring-yellow-500/30" },
  "research report": { bg: "bg-yellow-500/15", text: "text-yellow-400", ring: "ring-yellow-500/30" },
  "ai judge": { bg: "bg-slate-500/15", text: "text-slate-400", ring: "ring-slate-500/30" },
  "judge / oracle": { bg: "bg-slate-500/15", text: "text-slate-400", ring: "ring-slate-500/30" },
  humanqa: { bg: "bg-pink-500/15", text: "text-pink-400", ring: "ring-pink-500/30" },
  feature: { bg: "bg-indigo-500/15", text: "text-indigo-400", ring: "ring-indigo-500/30" },
  default: { bg: "bg-base-300/60", text: "text-base-content/70", ring: "ring-base-300" },
};

/**
 * AI summary endpoint (Val.town).
 *
 * KNOWN ISSUE — as of the initial deploy this URL returns HTTP 404 on both
 * POST and GET. The dApp falls through to the truncated raw on-chain
 * description silently (see `useSummary.ts`), so cards still render — they
 * just don't show an AI summary.
 *
 * To restore the headline AI-summary feature without a code change, set
 * `NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL` at build time to a working endpoint
 * with the same shape (POST `{description, serviceTypeId, workLogs, ...}`
 * returning a string body or `{summary: string}` JSON; GET fallback with
 * query-string params is also accepted). See `NEXT_STEPS.md` for the full
 * post-launch fix-it guide.
 */
const FALLBACK_SUMMARY_URL = "https://zeitgeistjones--2056e04848f711f1846542b51c65c3df.web.val.run";
export const SUMMARY_API_URL =
  process.env.NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL && process.env.NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL.length > 0
    ? process.env.NEXT_PUBLIC_VAL_TOWN_SUMMARY_URL
    : FALLBACK_SUMMARY_URL;
// Alias for clarity in NEXT_STEPS.md and inline comments.
export const VAL_TOWN_SUMMARY_URL = SUMMARY_API_URL;
