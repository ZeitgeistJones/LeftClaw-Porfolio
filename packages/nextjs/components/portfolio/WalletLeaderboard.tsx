"use client";

import { useMemo } from "react";
import { Address } from "@scaffold-ui/components";
import { base } from "viem/chains";
import { HIDDEN_SERVICE_TYPE_IDS } from "~~/lib/leftclaw/constants";
import type { EnrichedJob, ServiceType, WalletLeaderboardEntry } from "~~/lib/leftclaw/types";
import { useBuilderSummary } from "~~/lib/leftclaw/useBuilderSummary";

type WalletLeaderboardProps = {
  wallets: WalletLeaderboardEntry[];
  jobs: EnrichedJob[];
  serviceTypes: ServiceType[];
  ready: boolean;
  error: Error | null;
  onExplore: (address: `0x${string}`) => void;
};

export const WalletLeaderboard = ({ wallets, jobs, serviceTypes, ready, error, onExplore }: WalletLeaderboardProps) => {
  if (error) {
    return (
      <section className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-center text-xl font-semibold mb-2 my-0">Builders</h2>
        <p className="text-center text-xs text-base-content/55 my-0">Leaderboard unavailable — try again later.</p>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-6 py-10">
      <h2 className="text-center text-xl font-semibold mb-1 my-0">Builders</h2>
      <p className="text-center text-sm text-base-content/55 mb-6 my-0">
        Wallets that have shipped work with LeftClaw — click to open a portfolio.
      </p>

      {!ready ? (
        <ul className="divide-y divide-base-300/50 border border-base-300/60 rounded-xl overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3 bg-base-100">
              <span className="inline-block skeleton-line w-6 h-4" />
              <span className="inline-block skeleton-line w-36 h-4 flex-1" />
              <span className="inline-block skeleton-line w-10 h-4" />
            </li>
          ))}
        </ul>
      ) : wallets.length === 0 ? (
        <p className="text-center text-sm text-base-content/55 my-0">No public portfolios yet.</p>
      ) : (
        <ul className="divide-y divide-base-300/50 border border-base-300/60 rounded-xl overflow-hidden">
          {wallets.map((w, i) => (
            <BuilderRow
              key={w.address}
              rank={i + 1}
              wallet={w}
              jobs={jobs}
              serviceTypes={serviceTypes}
              onExplore={onExplore}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

const BuilderRow = ({
  rank,
  wallet,
  jobs,
  serviceTypes,
  onExplore,
}: {
  rank: number;
  wallet: WalletLeaderboardEntry;
  jobs: EnrichedJob[];
  serviceTypes: ServiceType[];
  onExplore: (address: `0x${string}`) => void;
}) => {
  const clientJobs = useMemo(
    () =>
      jobs.filter(
        j =>
          j.client.toLowerCase() === wallet.address.toLowerCase() &&
          !HIDDEN_SERVICE_TYPE_IDS.has(Number(j.serviceTypeId)),
      ),
    [jobs, wallet.address],
  );
  const { summary, loading, ref } = useBuilderSummary(wallet.address, clientJobs, serviceTypes);

  return (
    <li>
      <div ref={ref}>
        <button
          type="button"
          onClick={() => onExplore(wallet.address)}
          className="w-full px-4 py-3 bg-base-100 hover:bg-base-200/60 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 text-xs font-mono text-base-content/40 tabular-nums shrink-0">{rank}</span>
            <span className="min-w-0 flex-1 pointer-events-none">
              <Address address={wallet.address} chain={base} disableAddressLink onlyEnsOrAddress />
            </span>
            <span className="text-xs text-base-content/55 tabular-nums shrink-0">
              {wallet.jobCount} {wallet.jobCount === 1 ? "job" : "jobs"}
            </span>
          </div>
          <div className="mt-2 pl-10 pr-1">
            {summary ? (
              <p className="my-0 text-xs leading-relaxed text-base-content/65">{summary}</p>
            ) : loading ? (
              <div className="space-y-1.5">
                <div className="skeleton-line h-2.5 w-full" />
                <div className="skeleton-line h-2.5 w-5/6" />
                <div className="skeleton-line h-2.5 w-2/3" />
              </div>
            ) : null}
          </div>
        </button>
      </div>
    </li>
  );
};
