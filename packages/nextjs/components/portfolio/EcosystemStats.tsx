"use client";

import { DEFAULT_SERVICE_TYPES } from "~~/lib/leftclaw/constants";
import type { ServiceType } from "~~/lib/leftclaw/types";

type EcosystemStatsProps = {
  totalJobs: number;
  uniqueWallets: number;
  serviceTypeCounts: Record<number, number>;
  serviceTypes: ServiceType[];
  ready: boolean;
  error: Error | null;
};

export const EcosystemStats = ({
  totalJobs,
  uniqueWallets,
  serviceTypeCounts,
  serviceTypes,
  ready,
  error,
}: EcosystemStatsProps) => {
  // RPC failure: render a quiet error message in place of the spinning
  // skeletons so the section doesn't shimmer forever.
  if (error) {
    return (
      <section className="border-y border-base-300/50 bg-base-100/50">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-base-content/55 my-0">Ecosystem stats unavailable — try again later.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-y border-base-300/50 bg-base-100/50">
      <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Jobs shipped" value={totalJobs > 0 ? totalJobs.toString() : null} ready={totalJobs > 0} />
        <Stat label="Unique wallets" value={ready ? String(uniqueWallets) : null} ready={ready} />
        <Stat
          label="Builds"
          value={
            ready
              ? String(
                  Object.entries(serviceTypeCounts).reduce((acc, [id, n]) => {
                    const numId = Number(id);
                    const name = (
                      serviceTypes.find(s => Number(s.id) === numId)?.name ??
                      DEFAULT_SERVICE_TYPES[numId] ??
                      ""
                    ).toLowerCase();
                    // Build + Feature (and any on-chain name containing those words).
                    return name.includes("build") || name.includes("feature") ? acc + n : acc;
                  }, 0),
                )
              : null
          }
          ready={ready}
        />
        <Stat
          label="Audits"
          value={
            ready
              ? String(
                  Object.entries(serviceTypeCounts).reduce((acc, [id, n]) => {
                    const numId = Number(id);
                    const name = (
                      serviceTypes.find(s => Number(s.id) === numId)?.name ??
                      DEFAULT_SERVICE_TYPES[numId] ??
                      ""
                    ).toLowerCase();
                    // Contract/Frontend audits + HumanQA.
                    return name.includes("audit") || name.includes("humanqa") || name.includes("qa")
                      ? acc + n
                      : acc;
                  }, 0),
                )
              : null
          }
          ready={ready}
        />
      </div>
    </section>
  );
};

const Stat = ({ label, value, ready }: { label: string; value: string | null; ready: boolean }) => (
  <div className="text-center">
    <div className="text-[10px] uppercase tracking-wider text-base-content/45">{label}</div>
    <div className="mt-1 text-2xl font-semibold tabular-nums">
      {ready && value !== null ? value : <span className="inline-block skeleton-line w-10 h-6" />}
    </div>
  </div>
);
