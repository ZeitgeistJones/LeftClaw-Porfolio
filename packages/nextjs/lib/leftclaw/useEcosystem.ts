"use client";

import { useEffect, useMemo, useState } from "react";
import { BASE_CHAIN_ID, CONTRACTS, HIDDEN_SERVICE_TYPE_IDS, LEFTCLAW_ABI } from "./constants";
import type { Job, ServiceType, WalletLeaderboardEntry } from "./types";
import { getAddress } from "viem";
import { usePublicClient, useReadContracts } from "wagmi";

/** Keep chunks small — getJob returns full description strings. */
const JOB_HYDRATE_CHUNK = 8;
const MAX_CHUNK_RETRIES = 3;

type JobRef = { contractIdx: number; id: bigint };

/**
 * Aggregate ecosystem-wide stats:
 *   - total jobs across V1 + V2
 *   - unique client wallets
 *   - service-type counts
 *   - ranked client leaderboard (visible jobs only)
 *
 * Stage 1 (totals) is cheap and paints immediately. Stages 2–3 enumerate
 * every job ID then hydrate in tiny multicall chunks with retries so we
 * don't silently drop jobs when an RPC response is too large.
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

  const [stats, setStats] = useState({
    totalJobs: 0,
    uniqueWallets: 0,
    serviceTypeCounts: {} as Record<number, number>,
    wallets: [] as WalletLeaderboardEntry[],
    hydratedJobs: 0,
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

  // Stages 2–3: enumerate IDs per-status (with retry), then hydrate in chunks.
  useEffect(() => {
    if (!totalsByContract || !publicClient) return;
    const totalJobs = totalsByContract.reduce((acc, t) => acc + t.total, 0);

    let cancelled = false;
    setHydrateLoading(true);
    setHydrateError(null);

    const applyJobs = (jobs: Job[], ready: boolean) => {
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
        hydratedJobs: jobs.length,
        ready,
      });
    };

    const readStatusIds = async (address: `0x${string}`, status: number): Promise<readonly bigint[]> => {
      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
        try {
          return (await publicClient.readContract({
            address,
            abi: LEFTCLAW_ABI,
            functionName: "getJobsByStatus",
            args: [status],
          })) as readonly bigint[];
        } catch (e) {
          lastError = e;
          await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
        }
      }
      throw lastError instanceof Error ? lastError : new Error(`getJobsByStatus(${status}) failed`);
    };

    const hydrateChunk = async (chunk: JobRef[]): Promise<Job[]> => {
      let lastError: unknown;
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

          // Retry failures one-by-one so one fat description can't sink the chunk.
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
              // leave missing — counted via hydratedJobs vs totalJobs
            }
          }
          return jobs;
        } catch (e) {
          lastError = e;
          await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
        }
      }
      throw lastError instanceof Error ? lastError : new Error("Job hydration chunk failed");
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
          // Paint after the first chunk; subsequent chunks climb the totals.
          applyJobs(jobs, true);
        }

        if (cancelled) return;
        applyJobs(jobs, true);
        setHydrateLoading(false);
      } catch (e) {
        if (!cancelled) {
          setHydrateError(e instanceof Error ? e : new Error("Failed to load ecosystem jobs"));
          setHydrateLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [totalsByContract, publicClient]);

  const metaError = meta.error || (stage1Failed ? new Error("Failed to read job totals from LeftClaw contracts") : null);

  return {
    ...stats,
    serviceTypes,
    isLoading: meta.isLoading || hydrateLoading,
    error: metaError || hydrateError,
  };
}
