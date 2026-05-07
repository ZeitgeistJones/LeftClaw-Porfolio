"use client";

import { useEffect, useRef, useState } from "react";
import { SUMMARY_API_URL } from "./constants";
import type { EnrichedJob, WorkLog } from "./types";

/** In-memory cache keyed by `contract:jobId` so re-renders don't refetch. */
const summaryCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

const cacheKey = (job: EnrichedJob) => `${job.contractAddress}:${job.id.toString()}`;

async function fetchSummary(job: EnrichedJob, workLogs: WorkLog[]): Promise<string | null> {
  const body = {
    description: job.description,
    serviceTypeId: Number(job.serviceTypeId),
    workLogs: workLogs.map(w => ({ note: w.note, timestamp: Number(w.timestamp) })),
    jobId: Number(job.id),
    contractAddress: job.contractAddress,
    status: job.status,
  };

  // Try POST first; fall back to GET if the val rejects POST.
  try {
    const res = await fetch(SUMMARY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const text = (await res.text()).trim();
      // Some Val.town vals return JSON-wrapped strings, some return plain text.
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "string") return parsed;
        if (parsed?.summary) return String(parsed.summary);
        if (parsed?.text) return String(parsed.text);
        return text;
      } catch {
        return text;
      }
    }
  } catch {
    /* network error — try GET below */
  }

  try {
    const params = new URLSearchParams({
      description: job.description.slice(0, 1000),
      serviceTypeId: String(Number(job.serviceTypeId)),
      jobId: String(Number(job.id)),
    });
    const res = await fetch(`${SUMMARY_API_URL}?${params.toString()}`);
    if (res.ok) {
      const text = (await res.text()).trim();
      return text;
    }
  } catch {
    /* swallow */
  }

  return null;
}

/**
 * useSummary — fetches the AI-generated summary for a job lazily, only after
 * the calling card scrolls into view. Returns { summary, loading, error, ref };
 * the caller must attach `ref` to a DOM element so the intersection observer
 * can trigger the fetch.
 *
 * The effect intentionally does NOT depend on `workLogs` identity — that array
 * gets a fresh reference on every render of the calling card, which would
 * re-attach the observer and re-flash the skeleton. The latest workLogs are
 * read via a ref at fetch time instead.
 */
export function useSummary(job: EnrichedJob, workLogs: WorkLog[] | undefined) {
  const key = cacheKey(job);
  const [summary, setSummary] = useState<string | null>(summaryCache.get(key) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  // Always read the freshest workLogs at fetch time without re-running the
  // effect when their reference changes.
  const workLogsRef = useRef<WorkLog[] | undefined>(workLogs);
  workLogsRef.current = workLogs;

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
                p = fetchSummary(job, workLogsRef.current ?? []);
                inflight.set(key, p);
              }
              const result = await p;
              // Cache BEFORE clearing inflight so a concurrent caller
              // observes the cached value rather than racing into a second
              // fetch in the gap between delete() and set().
              if (result) {
                summaryCache.set(key, result);
              }
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
