"use client";

import { useEffect, useMemo, useState } from "react";
import { BASE_CHAIN_ID, CONTRACTS, HIDDEN_SERVICE_TYPE_IDS, LEFTCLAW_ABI } from "./constants";
import type { EnrichedJob, Job, ServiceType, WalletLeaderboardEntry } from "./types";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { useReadContracts } from "wagmi";

const JOB_HYDRATE_CHUNK = 25;
const MAX_CHUNK_RETRIES = 2;
/** Bump when hydrate strategy changes so in-memory doneKey cannot short-circuit a better scan. */
const HYDRATE_VERSION = "v6-serial";
/** Prefer completed jobs first so the UI fills with real portfolios ASAP. */
const STATUS_ORDER = [2, 1, 0, 5, 3, 4] as const;

type JobRef = { contractIdx: number; id: bigint };
type HydrateListener = () => void;

/**
 * Stages 1–2 match Job #102 (wagmi useReadContracts).
 * Stage 3 chunks getJob via a stable public Base client.
 */
const ecosystemClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org", { timeout: 25_000, retryCount: 2, retryDelay: 750 }),
});

/** One multicall at a time — concurrent storms rate-limit Base and break stage1. */
let rpcTail: Promise<unknown> = Promise.resolve();
function enqueueRpc<T>(fn: () => Promise<T>): Promise<T> {
  const next = rpcTail.then(fn, fn);
  rpcTail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * Survives Strict Mode remounts. Listeners let a remounted hook keep receiving
 * progressive updates without restarting the scan.
 */
const hydrateGate = {
  gen: 0,
  bestJobs: [] as EnrichedJob[],
  doneKey: "",
  activeKey: "",
  listeners: new Set<HydrateListener>(),
};

function notifyHydrateListeners() {
  for (const listener of hydrateGate.listeners) listener();
}

function enrich(job: Job, ref: JobRef): EnrichedJob {
  const c = CONTRACTS[ref.contractIdx];
  return {
    ...job,
    contractAddress: c.address,
    contractLabel: c.label,
  };
}

function buildStats(jobs: EnrichedJob[], totalJobs: number) {
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
    jobs,
  };
}

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
    query: {
      staleTime: 5 * 60_000,
      retry: 4,
      retryDelay: (n: number) => Math.min(1000 * 2 ** n, 8_000),
      refetchInterval: (q: { state: { error: Error | null; data?: readonly { status: string }[] | undefined } }) => {
        const data = q.state.data;
        const allFail = Array.isArray(data) && data.slice(0, CONTRACTS.length).every(r => r.status !== "success");
        return q.state.error || allFail ? 4_000 : false;
      },
    },
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

  const idLists = useReadContracts({
    contracts: totalsByContract
      ? totalsByContract.flatMap(t =>
          STATUS_ORDER.map(status => ({
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
      for (let s = 0; s < STATUS_ORDER.length; s++) {
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
    jobs: [] as EnrichedJob[],
    ready: false,
  });
  const [hydrateLoading, setHydrateLoading] = useState(false);

  useEffect(() => {
    if (totalJobsFromMeta <= 0) return;
    setStats(s => ({ ...s, totalJobs: totalJobsFromMeta }));
  }, [totalJobsFromMeta]);

  useEffect(() => {
    if (!idLists.isFetched || idLists.isLoading || idLists.isFetching) return;
    if (totalJobsFromMeta <= 0) return;
    if (allJobRefs.length > 0) return;
    if (hydrateGate.bestJobs.length > 0) return;
    setStats(s => ({
      ...s,
      totalJobs: totalJobsFromMeta,
      uniqueWallets: 0,
      serviceTypeCounts: {},
      wallets: [],
      jobs: [],
      ready: true,
    }));
  }, [idLists.isFetched, idLists.isLoading, idLists.isFetching, allJobRefs.length, totalJobsFromMeta]);

  useEffect(() => {
    if (allJobRefs.length === 0 || totalJobsFromMeta <= 0) return;

    const runKey = `${HYDRATE_VERSION}:${totalJobsFromMeta}:${allJobRefs.length}`;

    const syncFromGate = () => {
      if (hydrateGate.bestJobs.length > 0) {
        setStats({ ...buildStats(hydrateGate.bestJobs, totalJobsFromMeta), ready: true });
      }
      if (hydrateGate.doneKey === runKey) {
        setHydrateLoading(false);
      }
    };

    hydrateGate.listeners.add(syncFromGate);

    if (hydrateGate.doneKey === runKey && hydrateGate.bestJobs.length > 0) {
      syncFromGate();
      return () => {
        hydrateGate.listeners.delete(syncFromGate);
      };
    }

    if (hydrateGate.activeKey === runKey) {
      setHydrateLoading(true);
      syncFromGate();
      return () => {
        hydrateGate.listeners.delete(syncFromGate);
      };
    }

    const gen = ++hydrateGate.gen;
    hydrateGate.activeKey = runKey;
    const refs = allJobRefs;
    setHydrateLoading(true);

    const apply = (jobs: EnrichedJob[], { final }: { final?: boolean } = {}) => {
      if (gen !== hydrateGate.gen) return;

      if (jobs.length === 0) {
        if (final && hydrateGate.bestJobs.length === 0) {
          setStats(s => ({
            ...s,
            totalJobs: totalJobsFromMeta,
            uniqueWallets: 0,
            serviceTypeCounts: {},
            wallets: [],
            jobs: [],
            ready: true,
          }));
          setHydrateLoading(false);
          notifyHydrateListeners();
        }
        return;
      }

      if (jobs.length > hydrateGate.bestJobs.length) {
        hydrateGate.bestJobs = jobs.slice();
      }
      notifyHydrateListeners();
      if (final) setHydrateLoading(false);
    };

    const hydrateChunk = async (chunk: JobRef[]): Promise<EnrichedJob[]> => {
      for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
        if (gen !== hydrateGate.gen) return [];
        try {
          const results = await enqueueRpc(() =>
            ecosystemClient.multicall({
              allowFailure: true,
              contracts: chunk.map(ref => ({
                address: CONTRACTS[ref.contractIdx].address,
                abi: LEFTCLAW_ABI,
                functionName: "getJob" as const,
                args: [ref.id] as const,
              })),
            }),
          );
          const jobs: EnrichedJob[] = [];
          let skipped = 0;
          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r.status === "success" && r.result) {
              jobs.push(enrich(r.result as unknown as Job, chunk[i]));
            } else {
              skipped++;
            }
          }
          if (jobs.length === 0 && skipped === chunk.length) {
            if (attempt < MAX_CHUNK_RETRIES - 1) {
              await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
              continue;
            }
            if (chunk.length > 1) {
              const recovered: EnrichedJob[] = [];
              for (const ref of chunk) {
                if (gen !== hydrateGate.gen) return recovered;
                recovered.push(...(await hydrateChunk([ref])));
              }
              return recovered;
            }
            return [];
          }
          return jobs;
        } catch {
          if (attempt < MAX_CHUNK_RETRIES - 1) {
            await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
            continue;
          }
          if (chunk.length > 1) {
            const recovered: EnrichedJob[] = [];
            for (const ref of chunk) {
              if (gen !== hydrateGate.gen) return recovered;
              recovered.push(...(await hydrateChunk([ref])));
            }
            return recovered;
          }
        }
      }
      return [];
    };

    (async () => {
      try {
        const jobs: EnrichedJob[] = [];
        for (let i = 0; i < refs.length; i += JOB_HYDRATE_CHUNK) {
          if (gen !== hydrateGate.gen) return;
          jobs.push(...(await hydrateChunk(refs.slice(i, i + JOB_HYDRATE_CHUNK))));
          apply(jobs);
        }
        if (gen !== hydrateGate.gen) return;
        hydrateGate.doneKey = runKey;
        if (hydrateGate.activeKey === runKey) hydrateGate.activeKey = "";
        apply(jobs, { final: true });
      } catch {
        if (gen === hydrateGate.gen) {
          if (hydrateGate.activeKey === runKey) hydrateGate.activeKey = "";
          apply(hydrateGate.bestJobs, { final: true });
        }
      }
    })();

    return () => {
      hydrateGate.listeners.delete(syncFromGate);
    };
  }, [allJobRefs, totalJobsFromMeta]);

  const stage1Failed =
    Boolean(meta.isFetched) &&
    !meta.isFetching &&
    Boolean(meta.data) &&
    meta.data!.slice(0, CONTRACTS.length).every(r => r.status !== "success");

  const fatalError =
    !meta.isFetching && (stage1Failed || Boolean(meta.error)) && stats.totalJobs === 0
      ? meta.error || new Error("Failed to read job totals from LeftClaw contracts")
      : null;

  return {
    ...stats,
    serviceTypes,
    isLoading: meta.isLoading || idLists.isLoading || hydrateLoading || (Boolean(meta.error) && stats.totalJobs === 0),
    error: fatalError,
  };
}
