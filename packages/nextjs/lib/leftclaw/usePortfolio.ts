"use client";

import { useMemo } from "react";
import { CONTRACTS, LEFTCLAW_ABI } from "./constants";
import type { EnrichedJob, Job } from "./types";
import { useReadContracts } from "wagmi";

/**
 * Fetch every job for a given client wallet from BOTH LeftClaw V1 and V2,
 * then expand each job ID into a full Job tuple. Returns merged jobs sorted
 * newest-first.
 *
 * Two-stage fetch:
 *   1. getJobsByClient(addr) on V1 + V2 (cheap — two reads)
 *   2. getJob(id) per ID, fanned out via multicall (one batched RPC round)
 */
export function usePortfolio(address: `0x${string}` | undefined) {
  // Stage 1: collect job IDs from both contracts
  const idQueries = useReadContracts({
    contracts: address
      ? CONTRACTS.map(c => ({
          address: c.address,
          abi: LEFTCLAW_ABI,
          functionName: "getJobsByClient" as const,
          args: [address] as const,
        }))
      : [],
    query: {
      enabled: Boolean(address),
      staleTime: 60_000,
    },
  });

  // Flatten { contractIndex, jobId } pairs for the second-stage fan-out.
  const jobRefs = useMemo(() => {
    if (!idQueries.data) return [] as { contractIdx: number; id: bigint }[];
    const refs: { contractIdx: number; id: bigint }[] = [];
    idQueries.data.forEach((res, contractIdx) => {
      if (res.status === "success" && Array.isArray(res.result)) {
        for (const id of res.result as readonly bigint[]) {
          refs.push({ contractIdx, id });
        }
      }
    });
    return refs;
  }, [idQueries.data]);

  // Stage 2: fan out getJob calls. Multicall is automatic on chains where
  // wagmi has a Multicall3 deployment — Base does. If it ever fails, viem
  // falls back to N raw calls but we still get one waterfall.
  const jobQueries = useReadContracts({
    contracts: jobRefs.map(ref => ({
      address: CONTRACTS[ref.contractIdx].address,
      abi: LEFTCLAW_ABI,
      functionName: "getJob" as const,
      args: [ref.id] as const,
    })),
    query: {
      enabled: jobRefs.length > 0,
      staleTime: 60_000,
    },
  });

  const jobs = useMemo<EnrichedJob[]>(() => {
    if (!jobQueries.data) return [];
    const out: EnrichedJob[] = [];
    jobQueries.data.forEach((res, i) => {
      if (res.status !== "success" || !res.result) return;
      const job = res.result as unknown as Job;
      const ref = jobRefs[i];
      const contractMeta = CONTRACTS[ref.contractIdx];
      out.push({
        ...job,
        contractAddress: contractMeta.address,
        contractLabel: contractMeta.label,
      });
    });
    // Newest first (createdAt desc).
    out.sort((a, b) => Number(b.createdAt - a.createdAt));
    return out;
  }, [jobQueries.data, jobRefs]);

  const isLoading = idQueries.isLoading || (jobRefs.length > 0 && jobQueries.isLoading);
  const error = idQueries.error || jobQueries.error;

  return {
    jobs,
    isLoading,
    error,
    refetch: () => {
      idQueries.refetch();
      jobQueries.refetch();
    },
  };
}
