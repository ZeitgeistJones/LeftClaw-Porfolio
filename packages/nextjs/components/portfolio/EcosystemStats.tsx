"use client";

import { useMemo } from "react";
import { resolveServiceName, serviceBucket } from "~~/lib/leftclaw/serviceBucket";
import type { ServiceType } from "~~/lib/leftclaw/types";

type EcosystemStatsProps = {
  totalJobs: number;
  uniqueWallets: number;
  serviceTypeCounts: Record<number, number>;
  serviceTypes: ServiceType[];
  ready: boolean;
  error: Error | null;
  onBrowse?: (view: "builds" | "audits") => void;
};

export const EcosystemStats = ({
  totalJobs,
  uniqueWallets,
  serviceTypeCounts,
  serviceTypes,
  ready,
  error,
  onBrowse,
}: EcosystemStatsProps) => {
  const { builds, audits } = useMemo(() => {
    let buildsCount = 0;
    let auditsCount = 0;
    for (const [id, n] of Object.entries(serviceTypeCounts)) {
      const bucket = serviceBucket(resolveServiceName(Number(id), serviceTypes));
      if (bucket === "builds") buildsCount += n;
      else if (bucket === "audits") auditsCount += n;
    }
    return { builds: buildsCount, audits: auditsCount };
  }, [serviceTypeCounts, serviceTypes]);

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
          value={ready ? String(builds) : null}
          ready={ready}
          onClick={ready && onBrowse ? () => onBrowse("builds") : undefined}
          hint={ready && onBrowse ? "Browse builds" : undefined}
        />
        <Stat
          label="Audits"
          value={ready ? String(audits) : null}
          ready={ready}
          onClick={ready && onBrowse ? () => onBrowse("audits") : undefined}
          hint={ready && onBrowse ? "Browse audits" : undefined}
        />
      </div>
    </section>
  );
};

const Stat = ({
  label,
  value,
  ready,
  onClick,
  hint,
}: {
  label: string;
  value: string | null;
  ready: boolean;
  onClick?: () => void;
  hint?: string;
}) => {
  const inner = (
    <>
      <div className="text-[10px] uppercase tracking-wider text-base-content/45">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {ready && value !== null ? value : <span className="inline-block skeleton-line w-10 h-6" />}
      </div>
      {hint ? (
        <div className="mt-1 text-[10px] text-base-content/40 opacity-0 group-hover:opacity-100 transition-opacity">
          {hint}
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group text-center rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-base-200/50 transition-colors cursor-pointer"
      >
        {inner}
      </button>
    );
  }

  return <div className="text-center">{inner}</div>;
};
