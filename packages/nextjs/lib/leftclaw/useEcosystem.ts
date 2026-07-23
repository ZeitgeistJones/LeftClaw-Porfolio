"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BASE_CHAIN_ID, CONTRACTS, HIDDEN_SERVICE_TYPE_IDS, LEFTCLAW_ABI } from "./constants";
import type { Job, ServiceType, WalletLeaderboardEntry } from "./types";
import { usePublicClient, useReadContracts } from "wagmi";

/** Keep chunks small — getJob returns full description strings. */
const JOB_HYDRATE_CHUNK = 8;
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
 * Aggregate ecosystem-wide stats from LeftClaw V1 + V2.
 *
 * No Vercel env required — Base RPC falls back to mainnet.base.org when the
 * shared Alchemy key is dead. Stage 1 paints job totals immediately; stages
 * 2–3 hydrate in small chunks. A failed re-fetch never overwrites good stats
 * with zeros.
 */
export function useEcosystem() {
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });

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

  const [stats, setStats] = useState<EcosystemStatsState>({
    totalJobs: 0,
    uniqueWallets: 0,
    serviceTypeCounts: {},
    wallets: [],
    hydratedJobs: 0,
    ready: false,
  });
  const [hydrateLoading, setHydrateLoading] = useState(false);

  // Keep latest good hydrate so a flaky re-run cannot wipe the UI to zeros.
  const bestHydratedRef = useRef({ jobs: [] as Job[], totalJobs: 0 });

  useEffect(() => {
    if (totalJobsFromMeta <= 0) return;
    setStats(s => ({ ...s, totalJobs: totalJobsFromMeta }));
  }, [totalJobsFromMeta]);

  useEffect(() => {
    if (!totalsByContract || !publicClient || totalJobsFromMeta <= 0) return;

    let cancelled = false;
    setHydrateLoading(true);

    const applyJobs = (jobs: Job[], ready: boolean) => {
      // Never replace a richer result with a poorer one (empty re-fetch / cancel race).
      if (jobs.length < bestHydratedRef.current.jobs.length) {
        if (ready) setHydrateLoading(false);
        return;
      }
      bestHydratedRef.current = { jobs, totalJobs: totalJobsFromMeta };

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

      setStats({
        totalJobs: totalJobsFromMeta,
        uniqueWallets: wallets.size,
        serviceTypeCounts: counts,
        wallets: ranked,
        hydratedJobs: jobs.length,
        ready,
      });
    };

    const readStatusIds = async (address: `0x${string}`, status: number): Promise<readonly bigint[]> => {
      for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
        try {
          return (await publicClient.readContract({
            address,
            abi: LEFTCLAW_ABI,
            functionName: "getJobsByStatus",
            args: [status],
          })) as readonly bigint[];
        } catch {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      return [];
    };

    const hydrateChunk = async (chunk: JobRef[]): Promise<Job[]> => {
      for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
        try {
          const results = await publicClient.multicall({
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
              const job = (await publicClient.readContract({
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
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      return [];
    };

    (async () => {
      try {
        const refs: JobRef[] = [];
        for (let cIdx = 0; cIdx < totalsByContract.length; cIdx++) {
          const address = totalsByContract[cIdx].address;
          for (let status = 0; status < 6; status++) {
            if (cancelled) return;
            const ids = await readStatusIds(address, status);
            for (const id of ids) refs.push({ contractIdx: cIdx, id });
          }
        }

        if (cancelled) return;

        // Empty enumerate — mark ready via applyJobs so we don't wipe a richer
        // prior hydrate; on first load this clears skeletons with zeros.
        if (refs.length === 0) {
          applyJobs([], true);
          setHydrateLoading(false);
          return;
        }

        const jobs: Job[] = [];
        for (let i = 0; i < refs.length; i += JOB_HYDRATE_CHUNK) {
          if (cancelled) return;
          const chunkJobs = await hydrateChunk(refs.slice(i, i + JOB_HYDRATE_CHUNK));
          jobs.push(...chunkJobs);
          applyJobs(jobs, true);
        }

        if (cancelled) return;
        applyJobs(jobs, true);
        setHydrateLoading(false);
      } catch {
        if (!cancelled) setHydrateLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- publicClient identity churns; totals gate the run
  }, [totalJobsFromMeta, Boolean(publicClient)]);

  const fatalError =
    (stage1Failed || meta.error) && stats.totalJobs === 0
      ? meta.error || new Error("Failed to read job totals from LeftClaw contracts")
      : null;

  return {
    ...stats,
    serviceTypes,
    isLoading: meta.isLoading || hydrateLoading,
    error: fatalError,
  };
}
