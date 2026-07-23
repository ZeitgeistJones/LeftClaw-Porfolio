"use client";

import { useEffect, useRef, useState } from "react";
import { resolveServiceName } from "./serviceBucket";
import type { EnrichedJob, ServiceType, WorkLog } from "./types";

/** In-memory cache keyed by `contract:jobId` so re-renders don't refetch. */
const summaryCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

const cacheKey = (job: EnrichedJob) => `${job.contractAddress}:${job.id.toString()}`;

async function fetchJobSummary(job: EnrichedJob, serviceTypes: ServiceType[]): Promise<string | null> {
  const fallback = (): string => {
    const cleaned = (job.description || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return "LeftClaw job with no on-chain description.";
    const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
    return sentence.length > 180 ? `${sentence.slice(0, 180)}…` : sentence;
  };

  try {
    const res = await fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "job",
        description: job.description,
        serviceTypeName: resolveServiceName(job.serviceTypeId, serviceTypes),
        status: job.status,
        jobId: Number(job.id),
      }),
    });
    if (!res.ok) return fallback();
    const data = (await res.json()) as { summary?: string };
    return data.summary?.trim() || fallback();
  } catch {
    return fallback();
  }
}

/**
 * Lazy 1-sentence AI summary for a job card (intersection observer + cache).
 */
export function useSummary(job: EnrichedJob, _workLogs: WorkLog[] | undefined, serviceTypes: ServiceType[] = []) {
  const key = cacheKey(job);
  const [summary, setSummary] = useState<string | null>(summaryCache.get(key) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const serviceTypesRef = useRef(serviceTypes);
  serviceTypesRef.current = serviceTypes;

  useEffect(() => {
    if (summary) return;
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            observer.disconnect();
            (async () => {
              if (summaryCache.has(key)) {
                if (!cancelled) setSummary(summaryCache.get(key)!);
                return;
              }
              if (!cancelled) setLoading(true);
              let p = inflight.get(key);
              if (!p) {
                p = fetchJobSummary(job, serviceTypesRef.current);
                inflight.set(key, p);
              }
              const result = await p;
              if (result) summaryCache.set(key, result);
              inflight.delete(key);
              if (cancelled) return;
              if (result) {
                setSummary(result);
                setError(false);
              } else {
                setError(true);
              }
              setLoading(false);
            })();
            return;
          }
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [job, key, summary]);

  return { summary, loading, error, ref };
}
