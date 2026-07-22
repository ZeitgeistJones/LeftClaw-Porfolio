"use client";

import { useEffect, useMemo, useState } from "react";
import { CONTRACTS, HIDDEN_SERVICE_TYPE_IDS, LEFTCLAW_ABI } from "./constants";
import type { Job, ServiceType, WalletLeaderboardEntry } from "./types";
import { useReadContracts } from "wagmi";
import { getAddress } from "viem";

/**
 * Aggregate ecosystem-wide stats:
 *   - total jobs across V1 + V2
 *   - unique client wallets
 *   - service-type counts
 *   - ranked client leaderboard (visible jobs only)
 *
 * Lazy: total job counts fetch first (cheap) and the heavy per-job hydration
 * is queued in batches so the hero can render while stats fill in.
 */
export function useEcosystem() {
  // Stage 1: getTotalJobs on each contract + getAllServiceTypes.
  const meta = useReadContracts({
    contracts: [
      ...CONTRACTS.map(c => ({
        address: c.address,
        abi: LEFTCLAW_ABI,
        functionName: "getTotalJobs" as const,
      })),
      {
        address: CONTRACTS[0].address, // service types live on V2 (current)
        abi: LEFTCLAW_ABI,
        functionName: "getAllServiceTypes" as const,
      },
    ],
    query: { staleTime: 5 * 60_000 },
  });

  const totalsByContract = useMemo(() => {
    if (!meta.data) return null;
    return CONTRACTS.map((c, i) => {
      const r = meta.data[i];
      return {
        contractIdx: i,
        label: c.label,
        address: c.address,
        total: r?.status === "success" ? Number(r.result as bigint) : 0,
      };
    });
  }, [meta.data]);

  const serviceTypes = useMemo<ServiceType[]>(() => {
    if (!meta.data) return [];
    const r = meta.data[CONTRACTS.length];
    if (!r || r.status !== "success") return [];
    return r.result as unknown as ServiceType[];
  }, [meta.data]);

  // Use getJobsByStatus to enumerate all real job IDs without guessing.
  // Job IDs in V2 don't start at 1 (constructor passes _startJobId), so
  // iterating 1..total would miss real entries. Pulling each status list
  // (6 reads per contract, 12 total) gives us exact coverage cheaply.
  const idLists = useReadContracts({
    contracts: totalsByContract
      ? totalsByContract.flatMap(t =>
          [0, 1, 2, 3, 4, 5].map(status => ({
            address: t.address,
            abi: LEFTCLAW_ABI,
            functionName: "getJobsByStatus" as const,
            args: [status] as const,
          })),
        )
      : [],
    query: { enabled: Boolean(totalsByContract), staleTime: 5 * 60_000 },
  });

  const allJobRefs = useMemo(() => {
    if (!idLists.data || !totalsByContract) return [] as { contractIdx: number; id: bigint }[];
    const refs: { contractIdx: number; id: bigint }[] = [];
    let i = 0;
    for (let cIdx = 0; cIdx < totalsByContract.length; cIdx++) {
      for (let s = 0; s < 6; s++) {
        const r = idLists.data[i++];
        if (r?.status === "success") {
          for (const id of r.result as readonly bigint[]) {
            refs.push({ contractIdx: cIdx, id });
          }
        }
      }
    }
    return refs;
  }, [idLists.data, totalsByContract]);

  // Stage 3: hydrate each job to read `client` (for unique-wallets) and
  // `serviceTypeId` (for breakdown). This is the heavy step — but it's
  // lazy/non-blocking and runs once.
  const jobsBatch = useReadContracts({
    contracts: allJobRefs.map(ref => ({
      address: CONTRACTS[ref.contractIdx].address,
      abi: LEFTCLAW_ABI,
      functionName: "getJob" as const,
      args: [ref.id] as const,
    })),
    query: { enabled: allJobRefs.length > 0, staleTime: 5 * 60_000 },
  });

  // Show whatever we have so far; the UI shimmers until counts land.
  const [stats, setStats] = useState({
    totalJobs: 0,
    uniqueWallets: 0,
    serviceTypeCounts: {} as Record<number, number>,
    wallets: [] as WalletLeaderboardEntry[],
    ready: false,
  });

  useEffect(() => {
    if (!totalsByContract) return;
    const totalJobs = totalsByContract.reduce((acc, t) => acc + t.total, 0);
    if (!jobsBatch.data || jobsBatch.data.length === 0) {
      setStats(s => ({ ...s, totalJobs }));
      return;
    }
    const wallets = new Set<string>();
    const counts: Record<number, number> = {};
    const byClient = new Map<string, WalletLeaderboardEntry>();

    for (const r of jobsBatch.data) {
      if (r.status !== "success" || !r.result) continue;
      const job = r.result as unknown as Job;
      wallets.add(job.client.toLowerCase());
      const svcId = Number(job.serviceTypeId);
      counts[svcId] = (counts[svcId] ?? 0) + 1;

      // Leaderboard only counts visible jobs (same privacy filter as portfolio).
      if (HIDDEN_SERVICE_TYPE_IDS.has(svcId)) continue;

      const key = job.client.toLowerCase();
      const activity = Math.max(Number(job.createdAt), Number(job.startedAt), Number(job.completedAt));
      const existing = byClient.get(key);
      if (existing) {
        existing.jobCount += 1;
        if (activity > existing.lastActivity) existing.lastActivity = activity;
      } else {
        byClient.set(key, {
          address: getAddress(job.client),
          jobCount: 1,
          lastActivity: activity,
        });
      }
    }

    const ranked = Array.from(byClient.values()).sort((a, b) => {
      if (b.jobCount !== a.jobCount) return b.jobCount - a.jobCount;
      return b.lastActivity - a.lastActivity;
    });

    setStats({
      totalJobs,
      uniqueWallets: wallets.size,
      serviceTypeCounts: counts,
      wallets: ranked,
      ready: true,
    });
  }, [totalsByContract, jobsBatch.data]);

  return {
    ...stats,
    serviceTypes,
    isLoading: meta.isLoading || idLists.isLoading || jobsBatch.isLoading,
    error: meta.error || idLists.error || jobsBatch.error,
  };
}
