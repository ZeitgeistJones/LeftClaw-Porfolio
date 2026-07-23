"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";
import { useReadContracts } from "wagmi";
import { BASE_CHAIN_ID, CONTRACTS, HIDDEN_SERVICE_TYPE_IDS, LEFTCLAW_ABI } from "./constants";
import type { Job, ServiceType, WalletLeaderboardEntry } from "./types";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

/** Keep chunks small — getJob returns full description strings. */
const JOB_HYDRATE_CHUNK = 12;
const MAX_CHUNK_RETRIES = 3;

type JobRef = { contractIdx: number; id: bigint };

type EcosystemStatsState = {
  totalJobs: number;
  uniqueWallets: number;
  serviceTypeCounts: Record<number, number>;
  wallets: WalletLeaderboardEntry[];
  hydratedJobs: number;
  ready: boolean;
};

/**
 * Stable Base client for ecosystem hydration.
 * Avoids usePublicClient() flickering undefined / remounting mid-scan
 * (that left Unique wallets / Builds / Audits stuck on skeletons while
 * Jobs shipped — from useReadContracts — already showed a number).
 */
const alchemyUrl = getAlchemyHttpUrl(BASE_CHAIN_ID);
const ecosystemClient = createPublicClient({
  chain: base,
  transport: fallback(
    [
      http("https://mainnet.base.org", { timeout: 20_000 }),
      ...(alchemyUrl ? [http(alchemyUrl, { timeout: 20_000 })] : []),
    ],
    { rank: false },
  ),
});

function aggregateJobs(jobs: Job[], totalJobs: number): Omit<EcosystemStatsState, "ready"> {
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

  return {
    totalJobs,
    uniqueWallets: wallets.size,
    serviceTypeCounts: counts,
    wallets: ranked,
    hydratedJobs: jobs.length,
  };
}

/**
 * Aggregate ecosystem-wide stats from LeftClaw V1 + V2.
 *
 * Stage 1 (totals) uses wagmi useReadContracts — already reliable on Vercel.
 * Stage 2 (job IDs by status) also uses useReadContracts.
 * Stage 3 hydrates getJob via a module-level public client so the scan
 * cannot be cancelled by wagmi client identity churn.
 */
export function useEcosystem() {
  const meta = useReadContracts({
    contracts: [
      ...CONTRACTS.map(c => ({
        address: c.address,
        abi: LEFTCLAW_ABI,
        functionName: "getTotalJobs" as const,
        chainId: BASE_CHAIN_ID,
      })),
      {
        address: CONTRACTS[0].address,
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

  const totalJobsFromMeta = useMemo(
    () => (totalsByContract ? totalsByContract.reduce((acc, t) => acc + t.total, 0) : 0),
    [totalsByContract],
  );

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

  // Stage 2: enumerate real job IDs via the same wagmi path as totals.
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
    query: {
      enabled: Boolean(totalsByContract) && totalJobsFromMeta > 0,
      staleTime: 5 * 60_000,
    },
  });

  const allJobRefs = useMemo(() => {
    if (!idLists.data || !totalsByContract) return [] as JobRef[];
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

  const [stats, setStats] = useState<EcosystemStatsState>({
    totalJobs: 0,
    uniqueWallets: 0,
    serviceTypeCounts: {},
    wallets: [],
    hydratedJobs: 0,
    ready: false,
  });
  const [hydrateLoading, setHydrateLoading] = useState(false);

  const bestHydratedRef = useRef({ jobs: [] as Job[], totalJobs: 0 });
  const hydrateKeyRef = useRef("");

  useEffect(() => {
    if (totalJobsFromMeta <= 0) return;
    setStats(s => ({ ...s, totalJobs: totalJobsFromMeta }));
  }, [totalJobsFromMeta]);

  // If status lists finished but found nothing, stop shimmering.
  useEffect(() => {
    if (!idLists.isFetched || totalJobsFromMeta <= 0) return;
    if (allJobRefs.length > 0) return;
    if (bestHydratedRef.current.jobs.length > 0) return;
    setStats(s => ({
      ...s,
      totalJobs: totalJobsFromMeta,
      uniqueWallets: 0,
      serviceTypeCounts: {},
      wallets: [],
      hydratedJobs: 0,
      ready: true,
    }));
  }, [idLists.isFetched, allJobRefs.length, totalJobsFromMeta]);

  useEffect(() => {
    if (allJobRefs.length === 0 || totalJobsFromMeta <= 0) return;

    const key = `${totalJobsFromMeta}:${allJobRefs.length}`;
    if (hydrateKeyRef.current === key && bestHydratedRef.current.jobs.length > 0) return;
    hydrateKeyRef.current = key;

    let cancelled = false;
    setHydrateLoading(true);

    const applyJobs = (jobs: Job[], ready: boolean) => {
      if (jobs.length < bestHydratedRef.current.jobs.length) {
        if (ready) setHydrateLoading(false);
        return;
      }
      bestHydratedRef.current = { jobs, totalJobs: totalJobsFromMeta };
      setStats({ ...aggregateJobs(jobs, totalJobsFromMeta), ready });
    };

    const hydrateChunk = async (chunk: JobRef[]): Promise<Job[]> => {
      for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
        try {
          const results = await ecosystemClient.multicall({
            allowFailure: true,
            contracts: chunk.map(ref => ({
              address: CONTRACTS[ref.contractIdx].address,
              abi: LEFTCLAW_ABI,
              functionName: "getJob" as const,
              args: [ref.id] as const,
            })),
          });

          const jobs: Job[] = [];
          const failed: JobRef[] = [];
          results.forEach((r, idx) => {
            if (r.status === "success" && r.result) {
              jobs.push(r.result as unknown as Job);
            } else {
              failed.push(chunk[idx]);
            }
          });

          for (const ref of failed) {
            try {
              const job = (await ecosystemClient.readContract({
                address: CONTRACTS[ref.contractIdx].address,
                abi: LEFTCLAW_ABI,
                functionName: "getJob",
                args: [ref.id],
              })) as unknown as Job;
              jobs.push(job);
            } catch {
              // skip
            }
          }
          return jobs;
        } catch {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      return [];
    };

    (async () => {
      try {
        const jobs: Job[] = [];
        for (let i = 0; i < allJobRefs.length; i += JOB_HYDRATE_CHUNK) {
          if (cancelled) return;
          const chunkJobs = await hydrateChunk(allJobRefs.slice(i, i + JOB_HYDRATE_CHUNK));
          jobs.push(...chunkJobs);
          // Paint progressively so Unique wallets / Builds appear ASAP.
          applyJobs(jobs, true);
        }
        if (cancelled) return;
        applyJobs(jobs, true);
        setHydrateLoading(false);
      } catch {
        if (!cancelled) {
          if (bestHydratedRef.current.jobs.length > 0) {
            applyJobs(bestHydratedRef.current.jobs, true);
          } else {
            setStats(s => ({ ...s, ready: true }));
          }
          setHydrateLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allJobRefs, totalJobsFromMeta]);

  const fatalError =
    (stage1Failed || meta.error) && stats.totalJobs === 0
      ? meta.error || new Error("Failed to read job totals from LeftClaw contracts")
      : null;

  return {
    ...stats,
    serviceTypes,
    isLoading: meta.isLoading || idLists.isLoading || hydrateLoading,
    error: fatalError,
  };
}
