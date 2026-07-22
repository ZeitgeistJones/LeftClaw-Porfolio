"use client";

import { Address } from "@scaffold-ui/components";
import { base } from "viem/chains";
import type { WalletLeaderboardEntry } from "~~/lib/leftclaw/types";

type WalletLeaderboardProps = {
  wallets: WalletLeaderboardEntry[];
  ready: boolean;
  error: Error | null;
  onExplore: (address: `0x${string}`) => void;
};

export const WalletLeaderboard = ({ wallets, ready, error, onExplore }: WalletLeaderboardProps) => {
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
            <li key={w.address}>
              <button
                type="button"
                onClick={() => onExplore(w.address)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-base-100 hover:bg-base-200/60 transition-colors text-left"
              >
                <span className="w-7 text-xs font-mono text-base-content/40 tabular-nums shrink-0">{i + 1}</span>
                <span className="min-w-0 flex-1 pointer-events-none">
                  <Address address={w.address} chain={base} disableAddressLink onlyEnsOrAddress />
                </span>
                <span className="text-xs text-base-content/55 tabular-nums shrink-0">
                  {w.jobCount} {w.jobCount === 1 ? "job" : "jobs"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
