"use client";

import { useEffect, useMemo, useState } from "react";
import { BASE_CHAIN_ID, CONTRACTS, HIDDEN_SERVICE_TYPE_IDS, LEFTCLAW_ABI } from "./constants";
import type { Job, ServiceType, WalletLeaderboardEntry } from "./types";
import { getAddress } from "viem";
import { usePublicClient, useReadContracts } from "wagmi";

/** Jobs per multicall — each getJob returns a full description string, so a
 *  single 500-call batch blows past public RPC response limits and silently
 *  drops most results (under-counting wallets / builds / audits). */
const JOB_HYDRATE_CHUNK = 25;

type JobRef = { contractIdx: number; id: bigint };

const EMPTY_JOB_REFS: JobRef[] = [];

/**
 * Aggregate ecosystem-wide stats:
 *   - total jobs across V1 + V2
 *   - unique client wallets
 *   - service-type counts
 *   - ranked client leaderboard (visible jobs only)
 *
 * Lazy: total job counts fetch first (cheap) and the heavy per-job hydration
 * is queued in chunks so the hero can render while stats fill in.
 */
export function useEcosystem() {
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });

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

  const stage1Failed =
    Boolean(meta.isFetched) &&
    Boolean(meta.data) &&
    !meta.isError &&
    meta.data!.slice(0, CONTRACTS.length).every(r => r.status !== "success");

  const serviceTypes = useMemo<ServiceType[]>(() => {
    if (!meta.data) return [];
    const r = meta.data[CONTRACTS.length];
    if (!r || r.status !== "success") return [];
    return r.result as unknown as ServiceType[];
  }, [meta.data]);

  // Stage 2: enumerate real job IDs via getJobsByStatus (V2 IDs don't start at 1).
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
    if (!idLists.data || !totalsByContract) return EMPTY_JOB_REFS;
    const refs: JobRef[] = [];
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

  // Show whatever we have so far; the UI shimmers until counts land.
  const [stats, setStats] = useState({
    totalJobs: 0,
    uniqueWallets: 0,
    serviceTypeCounts: {} as Record<number, number>,
    wallets: [] as WalletLeaderboardEntry[],
    ready: false,
  });
  const [hydrateLoading, setHydrateLoading] = useState(false);
  const [hydrateError, setHydrateError] = useState<Error | null>(null);

  // Stage 1 total as soon as it lands.
  useEffect(() => {
    if (!totalsByContract) return;
    const totalJobs = totalsByContract.reduce((acc, t) => acc + t.total, 0);
    setStats(s => ({ ...s, totalJobs }));
  }, [totalsByContract]);

  // Stage 3: hydrate jobs in small multicall chunks (descriptions are large).
  useEffect(() => {
    if (!totalsByContract) return;
    const totalJobs = totalsByContract.reduce((acc, t) => acc + t.total, 0);

    if (!idLists.isFetched) return;

    if (allJobRefs.length === 0) {
      setStats({
        totalJobs,
        uniqueWallets: 0,
        serviceTypeCounts: {},
        wallets: [],
        ready: true,
      });
      setHydrateLoading(false);
      setHydrateError(null);
      return;
    }

    if (!publicClient) return;

    let cancelled = false;
    setHydrateLoading(true);
    setHydrateError(null);

    (async () => {
      const jobs: Job[] = [];
      try {
        for (let i = 0; i < allJobRefs.length; i += JOB_HYDRATE_CHUNK) {
          if (cancelled) return;
          const chunk = allJobRefs.slice(i, i + JOB_HYDRATE_CHUNK);
          const results = await publicClient.multicall({
            allowFailure: true,
            contracts: chunk.map(ref => ({
              address: CONTRACTS[ref.contractIdx].address,
              abi: LEFTCLAW_ABI,
              functionName: "getJob" as const,
              args: [ref.id] as const,
            })),
          });
          for (const r of results) {
            if (r.status === "success" && r.result) {
              jobs.push(r.result as unknown as Job);
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          setHydrateError(e instanceof Error ? e : new Error("Failed to hydrate jobs"));
          setHydrateLoading(false);
        }
        return;
      }

      if (cancelled) return;

      const wallets = new Set<string>();
      const counts: Record<number, number> = {};
      const byClient = new Map<string, WalletLeaderboardEntry>();

      for (const job of jobs) {
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
            address: getAddress(job.client) as `0x${string}`,
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
      setHydrateLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [totalsByContract, idLists.isFetched, allJobRefs, publicClient]);

  const metaError = meta.error || (stage1Failed ? new Error("Failed to read job totals from LeftClaw contracts") : null);

  return {
    ...stats,
    serviceTypes,
    isLoading: meta.isLoading || idLists.isLoading || hydrateLoading,
    error: metaError || idLists.error || hydrateError,
  };
}
