"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";
import { useReadContracts } from "wagmi";
import { BASE_CHAIN_ID, CONTRACTS, HIDDEN_SERVICE_TYPE_IDS, LEFTCLAW_ABI } from "./constants";
import type { Job, ServiceType, WalletLeaderboardEntry } from "./types";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const JOB_HYDRATE_CHUNK = 15;
const MAX_CHUNK_RETRIES = 3;

type JobRef = { contractIdx: number; id: bigint };

/**
 * Stages 1–2 match Job #102 (wagmi useReadContracts).
 * Stage 3 chunks getJob — ~493 jobs in one multicall is too heavy and never
 * flips `ready`. Uses a module-level Base client (public RPC first).
 */
const alchemyUrl = getAlchemyHttpUrl(BASE_CHAIN_ID);
const ecosystemClient = createPublicClient({
  chain: base,
  transport: fallback([
    http("https://mainnet.base.org", { timeout: 25_000 }),
    ...(alchemyUrl ? [http(alchemyUrl, { timeout: 25_000 })] : []),
  ]),
});

function buildStats(jobs: Job[], totalJobs: number) {
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
  };
}

export function useEcosystem() {
  // Stage 1 — same as Job #102
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

  const serviceTypes = useMemo<ServiceType[]>(() => {
    if (!meta.data) return [];
    const r = meta.data[CONTRACTS.length];
    if (!r || r.status !== "success") return [];
    return r.result as unknown as ServiceType[];
  }, [meta.data]);

  // Stage 2 — same as Job #102
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
    query: { enabled: Boolean(totalsByContract) && totalJobsFromMeta > 0, staleTime: 5 * 60_000 },
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

  const [stats, setStats] = useState({
    totalJobs: 0,
    uniqueWallets: 0,
    serviceTypeCounts: {} as Record<number, number>,
    wallets: [] as WalletLeaderboardEntry[],
    ready: false,
  });
  const [hydrateLoading, setHydrateLoading] = useState(false);
  const bestCountRef = useRef(0);
  const runKeyRef = useRef("");

  // Paint Jobs shipped as soon as totals land (Job #102 behavior).
  useEffect(() => {
    if (totalJobsFromMeta <= 0) return;
    setStats(s => ({ ...s, totalJobs: totalJobsFromMeta }));
  }, [totalJobsFromMeta]);

  // Status lists done but empty → stop skeletons.
  useEffect(() => {
    if (!idLists.isFetched || totalJobsFromMeta <= 0) return;
    if (allJobRefs.length > 0) return;
    setStats(s => ({
      ...s,
      totalJobs: totalJobsFromMeta,
      uniqueWallets: 0,
      serviceTypeCounts: {},
      wallets: [],
      ready: true,
    }));
  }, [idLists.isFetched, allJobRefs.length, totalJobsFromMeta]);

  // Stage 3 — chunked getJob (Job #102 did one shot; we have ~5x more jobs now).
  useEffect(() => {
    if (allJobRefs.length === 0 || totalJobsFromMeta <= 0) return;

    const runKey = `${totalJobsFromMeta}:${allJobRefs.length}`;
    if (runKeyRef.current === runKey && bestCountRef.current > 0) return;
    runKeyRef.current = runKey;

    let cancelled = false;
    setHydrateLoading(true);

    const apply = (jobs: Job[]) => {
      if (jobs.length < bestCountRef.current) return;
      bestCountRef.current = jobs.length;
      setStats({ ...buildStats(jobs, totalJobsFromMeta), ready: true });
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
          for (let idx = 0; idx < results.length; idx++) {
            const r = results[idx];
            if (r.status === "success" && r.result) {
              jobs.push(r.result as unknown as Job);
            } else {
              try {
                const job = (await ecosystemClient.readContract({
                  address: CONTRACTS[chunk[idx].contractIdx].address,
                  abi: LEFTCLAW_ABI,
                  functionName: "getJob",
                  args: [chunk[idx].id],
                })) as unknown as Job;
                jobs.push(job);
              } catch {
                // skip
              }
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
          jobs.push(...(await hydrateChunk(allJobRefs.slice(i, i + JOB_HYDRATE_CHUNK))));
          apply(jobs); // progressive — Unique wallets appear after first chunk
        }
        if (!cancelled) setHydrateLoading(false);
      } catch {
        if (!cancelled) {
          setStats(s => ({ ...s, ready: true }));
          setHydrateLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allJobRefs, totalJobsFromMeta]);

  const stage1Failed =
    Boolean(meta.isFetched) &&
    Boolean(meta.data) &&
    meta.data!.slice(0, CONTRACTS.length).every(r => r.status !== "success");

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
