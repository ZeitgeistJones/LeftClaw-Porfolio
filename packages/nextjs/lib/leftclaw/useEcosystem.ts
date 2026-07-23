"use client";

import { useEffect, useMemo, useState } from "react";
import { useReadContracts } from "wagmi";
import { BASE_CHAIN_ID, CONTRACTS, HIDDEN_SERVICE_TYPE_IDS, LEFTCLAW_ABI } from "./constants";
import type { Job, ServiceType, WalletLeaderboardEntry } from "./types";

/**
 * Aggregate ecosystem-wide stats — same shape as Job #102 (the IPFS build
 * that reliably populated Unique wallets / Builds / Audits):
 *   1. getTotalJobs + getAllServiceTypes
 *   2. getJobsByStatus(0..5) × V1/V2
 *   3. getJob(id) for every ID via one wagmi useReadContracts multicall
 *
 * Also ranks client wallets for the home-page leaderboard (visible jobs only).
 */
export function useEcosystem() {
  // Stage 1: getTotalJobs on each contract + getAllServiceTypes.
  const meta = useReadContracts({
    contracts: [
      ...CONTRACTS.map(c => ({
        address: c.address,
        abi: LEFTCLAW_ABI,
        functionName: "getTotalJobs" as const,
        chainId: BASE_CHAIN_ID,
      })),
      {
        address: CONTRACTS[0].address, // service types live on V2 (current)
        abi: LEFTCLAW_ABI,
        functionName: "getAllServiceTypes" as const,
        chainId: BASE_CHAIN_ID,
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

  // Stage 2: enumerate real job IDs (V2 IDs don't start at 1).
  const idLists = useReadContracts({
    contracts: totalsByContract
      ? totalsByContract.flatMap(t =>
          [0, 1, 2, 3, 4, 5].map(status => ({
            address: t.address,
            abi: LEFTCLAW_ABI,
            functionName: "getJobsByStatus" as const,
            args: [status] as const,
            chainId: BASE_CHAIN_ID,
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

  // Stage 3: hydrate every job in one wagmi multicall (Job #102 pattern).
  const jobsBatch = useReadContracts({
    contracts: allJobRefs.map(ref => ({
      address: CONTRACTS[ref.contractIdx].address,
      abi: LEFTCLAW_ABI,
      functionName: "getJob" as const,
      args: [ref.id] as const,
      chainId: BASE_CHAIN_ID,
    })),
    query: { enabled: allJobRefs.length > 0, staleTime: 5 * 60_000 },
  });

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

      if (HIDDEN_SERVICE_TYPE_IDS.has(svcId)) continue;

      const key = job.client.toLowerCase();
      const activity = Math.max(Number(job.createdAt), Number(job.startedAt), Number(job.completedAt));
      const existing = byClient.get(key);
      if (existing) {
        existing.jobCount += 1;
        if (activity > existing.lastActivity) existing.lastActivity = activity;
      } else {
        byClient.set(key, {
          address: job.client,
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
