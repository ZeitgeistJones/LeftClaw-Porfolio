"use client";

import { useMemo, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { useCopyToClipboard } from "usehooks-ts";
import { base } from "viem/chains";
import { formatAbsoluteDate, formatClawd } from "~~/lib/leftclaw/format";
import { resolveServiceName, serviceBucket } from "~~/lib/leftclaw/serviceBucket";
import type { EnrichedJob, ServiceType } from "~~/lib/leftclaw/types";
import { notification } from "~~/utils/scaffold-eth";

// Map a (case-insensitive) service-type name to a friendly characterization.
// Uses substring matching so both old and new on-chain names resolve correctly
// (e.g. "Contract Audit" + "Frontend QA Audit" both match on "audit").
const phraseForName = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes("frontend qa")) return "Frontend QA specialist";
  if (lower.includes("audit")) return "Heavy on audits";
  if (lower.includes("build")) return "Primarily a builder";
  if (lower.includes("research")) return "Research-driven";
  if (lower.includes("consult")) return "Mostly consults";
  if (lower.includes("pfp")) return "PFP collector";
  if (lower.includes("judge") || lower.includes("oracle")) return "Oracle / AI Judge user";
  if (lower.includes("humanqa")) return "QA-focused";
  if (lower.includes("feature")) return "Feature iterator";
  return `Mostly ${lower}`;
};

const characterize = (counts: Record<string, number>): string => {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) return "Just getting started";
  entries.sort((a, b) => b[1] - a[1]);
  const [top, n] = entries[0];
  const total = entries.reduce((acc, [, c]) => acc + c, 0);
  const ratio = n / total;
  const phraseFor = phraseForName(top);
  if (ratio > 0.7) return `${phraseFor} (${n}/${total})`;
  return `${phraseFor} — diverse mix (${n}/${total})`;
};

export const BuilderSummary = ({
  address,
  jobs,
  serviceTypes,
}: {
  address: `0x${string}`;
  jobs: EnrichedJob[];
  serviceTypes: ServiceType[];
}) => {
  const [, copy] = useCopyToClipboard();
  const [copied, setCopied] = useState<"addr" | "share" | null>(null);

  const stats = useMemo(() => {
    const byTypeName: Record<string, number> = {};
    let totalClawd = 0n;
    let firstAt = 0n;
    let lastAt = 0n;
    let completed = 0;
    let active = 0;
    for (const j of jobs) {
      const typeName = resolveServiceName(j.serviceTypeId, serviceTypes);
      byTypeName[typeName] = (byTypeName[typeName] ?? 0) + 1;
      totalClawd += j.paymentClawd;
      if (firstAt === 0n || j.createdAt < firstAt) firstAt = j.createdAt;
      if (j.createdAt > lastAt) lastAt = j.createdAt;
      if (j.status === 2) completed++;
      if (j.status === 1 || j.status === 0) active++;
    }
    return {
      byTypeName,
      totalClawd,
      firstAt,
      lastAt,
      completed,
      active,
      total: jobs.length,
    };
  }, [jobs, serviceTypes]);

  const characterization = characterize(stats.byTypeName);
  const buildCount = Object.entries(stats.byTypeName).reduce(
    (acc, [name, n]) => (serviceBucket(name) === "builds" ? acc + n : acc),
    0,
  );
  const auditCount = Object.entries(stats.byTypeName).reduce(
    (acc, [name, n]) => (serviceBucket(name) === "audits" ? acc + n : acc),
    0,
  );
  const consultCount = Object.entries(stats.byTypeName).reduce(
    (acc, [name, n]) => (name.toLowerCase().includes("consult") ? acc + n : acc),
    0,
  );

  const handleCopyAddr = async () => {
    await copy(address);
    setCopied("addr");
    setTimeout(() => setCopied(null), 1600);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?wallet=${address}`;
    await copy(url);
    setCopied("share");
    notification.success("Portfolio link copied");
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <section className="bg-base-100 border border-base-300/60 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-base-content/50 my-0">Wallet</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Address address={address} chain={base} />
            <button
              type="button"
              onClick={handleCopyAddr}
              className="btn btn-ghost btn-xs h-6 min-h-6 px-2 text-[10px] text-base-content/50"
            >
              {copied === "addr" ? "Copied" : "Copy"}
            </button>
            <a
              href={`https://basescan.org/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-xs h-6 min-h-6 px-2 text-[10px] text-base-content/50"
            >
              Basescan ↗
            </a>
          </div>
        </div>
        <button type="button" onClick={handleShare} className="btn btn-outline btn-sm h-9 min-h-9 px-3 text-xs">
          {copied === "share" ? "Link copied" : "Share portfolio"}
        </button>
      </div>

      {stats.total > 0 ? (
        <>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Total jobs" value={stats.total.toString()} />
            <Stat label="Builds" value={buildCount.toString()} />
            <Stat label="Audits" value={auditCount.toString()} />
            <Stat label="Consults" value={consultCount.toString()} />
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Completed" value={stats.completed.toString()} />
            <Stat label="In progress" value={stats.active.toString()} />
            <Stat label="CLAWD spent" value={formatClawd(stats.totalClawd)} />
          </div>
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-base-content/60">
            <p className="my-0 italic">{characterization}</p>
            <p className="my-0">
              Active <span className="text-base-content/80">{formatAbsoluteDate(stats.firstAt)}</span>
              {" → "}
              <span className="text-base-content/80">{formatAbsoluteDate(stats.lastAt)}</span>
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-base-200/40 border border-base-300/40 rounded-lg px-3 py-2.5">
    <div className="text-[10px] uppercase tracking-wider text-base-content/45">{label}</div>
    <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
  </div>
);
