"use client";

import { useEffect, useRef, useState } from "react";
import { resolveServiceName } from "./serviceBucket";
import type { EnrichedJob, ServiceType } from "./types";

const summaryCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

async function fetchBuilderSummary(
  address: string,
  jobs: EnrichedJob[],
  serviceTypes: ServiceType[],
): Promise<string | null> {
  try {
    const res = await fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "builder",
        address,
        jobs: jobs.slice(0, 12).map(j => ({
          serviceTypeName: resolveServiceName(j.serviceTypeId, serviceTypes),
          description: j.description,
          status: j.status,
        })),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { summary?: string };
    return data.summary?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Lazy 3-sentence AI summary for a builder wallet (intersection observer + cache).
 */
export function useBuilderSummary(address: `0x${string}`, jobs: EnrichedJob[], serviceTypes: ServiceType[]) {
  const key = `builder:${address.toLowerCase()}:${jobs.length}`;
  const [summary, setSummary] = useState<string | null>(summaryCache.get(key) ?? null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const jobsRef = useRef(jobs);
  const typesRef = useRef(serviceTypes);
  jobsRef.current = jobs;
  typesRef.current = serviceTypes;

  useEffect(() => {
    if (summary || jobs.length === 0) return;
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
                p = fetchBuilderSummary(address, jobsRef.current, typesRef.current);
                inflight.set(key, p);
              }
              const result = await p;
              if (result) summaryCache.set(key, result);
              inflight.delete(key);
              if (cancelled) return;
              if (result) setSummary(result);
              setLoading(false);
            })();
            return;
          }
        }
      },
      { rootMargin: "160px 0px" },
    );

    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [address, key, jobs.length, summary]);

  return { summary, loading, ref };
}
