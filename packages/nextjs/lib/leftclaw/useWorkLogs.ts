"use client";

import { LEFTCLAW_ABI } from "./constants";
import type { EnrichedJob, WorkLog } from "./types";
import { useReadContract } from "wagmi";

export function useWorkLogs(job: EnrichedJob | null, enabled = true) {
  const query = useReadContract({
    address: job?.contractAddress,
    abi: LEFTCLAW_ABI,
    functionName: "getWorkLogs",
    args: job ? [job.id] : undefined,
    query: {
      enabled: Boolean(job) && enabled,
      staleTime: 60_000,
    },
  });

  return {
    workLogs: (query.data ?? []) as readonly WorkLog[],
    isLoading: query.isLoading,
    error: query.error,
  };
}
