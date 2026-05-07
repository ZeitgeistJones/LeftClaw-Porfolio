/**
 * Tiny formatting helpers — kept pure so they can be used in both Server
 * Components (currently none, but the static export pipeline counts) and
 * Client Components without dragging in extra deps.
 */

/** Format USDC-6dp price (uint256) as `$X.XX`. */
export const formatUsd = (priceUsd: bigint): string => {
  const cents = Number(priceUsd / 10_000n);
  return `$${(cents / 100).toFixed(2)}`;
};

/** Format CLAWD wei (18dp) to a 2-decimal display string. */
export const formatClawd = (paymentClawd: bigint): string => {
  if (paymentClawd === 0n) return "0";
  const whole = paymentClawd / 10n ** 18n;
  const frac = (paymentClawd % 10n ** 18n) / 10n ** 16n; // two decimal places
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
};

const RTF =
  typeof Intl !== "undefined" && Intl.RelativeTimeFormat
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" })
    : null;

/** Convert a unix-seconds bigint into a "3 weeks ago" string. */
export const formatRelativeTime = (timestamp: bigint): string => {
  if (!timestamp || timestamp === 0n) return "—";
  if (!RTF) return new Date(Number(timestamp) * 1000).toISOString().slice(0, 10);
  const ts = Number(timestamp) * 1000;
  const diff = ts - Date.now();
  const seconds = diff / 1000;

  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secsPerUnit] of ranges) {
    const value = seconds / secsPerUnit;
    if (Math.abs(value) >= 1 || unit === "second") {
      return RTF.format(Math.round(value), unit);
    }
  }
  return "just now";
};

/** Convert a unix-seconds bigint into an absolute date label. */
export const formatAbsoluteDate = (timestamp: bigint): string => {
  if (!timestamp || timestamp === 0n) return "—";
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Truncate a string in the middle, keeping the first `head` and last `tail`
 * characters. Useful for inline raw-description fallbacks when the AI summary
 * fails to load.
 */
export const truncate = (s: string, max = 140): string => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

/**
 * resultCID may be a bare CID, a full bgipfs URL, an http(s):// URL, or empty.
 * Normalise to an absolute https:// URL we can drop into <a href>.
 */
export const resolveResultUrl = (resultCID: string): string | null => {
  if (!resultCID) return null;
  const trimmed = resultCID.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("ipfs://")) {
    const cid = trimmed.slice("ipfs://".length).split("/")[0];
    return `https://${cid}.ipfs.community.bgipfs.com/`;
  }
  // Assume bare CID
  return `https://${trimmed}.ipfs.community.bgipfs.com/`;
};
