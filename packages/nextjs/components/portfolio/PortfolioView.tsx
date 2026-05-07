"use client";

import { useMemo, useState } from "react";
import { BuilderSummary } from "./BuilderSummary";
import { FilterBar, type StatusFilter } from "./FilterBar";
import { JobCard } from "./JobCard";
import { useEcosystem } from "~~/lib/leftclaw/useEcosystem";
import { usePortfolio } from "~~/lib/leftclaw/usePortfolio";

const sortJobs = (a: { status: number; resultCID: string; createdAt: bigint }, b: typeof a): number => {
  // Completed-with-deliverable first, then in-progress/open, then cancelled.
  const score = (j: typeof a) => {
    if (j.status === 2 && j.resultCID && j.resultCID.length > 0) return 0;
    if (j.status === 2) return 1;
    if (j.status === 1) return 2;
    if (j.status === 0) return 3;
    if (j.status === 5) return 4;
    return 5; // declined / cancelled
  };
  const sa = score(a);
  const sb = score(b);
  if (sa !== sb) return sa - sb;
  return Number(b.createdAt - a.createdAt);
};

export const PortfolioView = ({ address, onBack }: { address: `0x${string}`; onBack: () => void }) => {
  const { jobs, isLoading, error } = usePortfolio(address);
  const { serviceTypes } = useEcosystem();

  const [selectedTypeId, setSelectedTypeId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    let out = jobs;
    if (selectedTypeId !== "all") {
      out = out.filter(j => Number(j.serviceTypeId) === selectedTypeId);
    }
    if (statusFilter === "completed") {
      out = out.filter(j => j.status === 2);
    } else if (statusFilter === "active") {
      out = out.filter(j => j.status === 0 || j.status === 1);
    }
    return [...out].sort(sortJobs);
  }, [jobs, selectedTypeId, statusFilter]);

  return (
    <section className="max-w-4xl mx-auto px-6 pt-8 pb-16">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-base-content/55 hover:text-base-content transition-colors"
        >
          ← Search another wallet
        </button>
      </div>

      <BuilderSummary address={address} jobs={jobs} serviceTypes={[...serviceTypes]} />

      <div className="mt-8">
        <FilterBar
          jobs={jobs}
          serviceTypes={[...serviceTypes]}
          selectedTypeId={selectedTypeId}
          onSelectTypeId={setSelectedTypeId}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
        />
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && jobs.length === 0 ? (
          <SkeletonList />
        ) : error ? (
          <div className="text-sm text-error bg-error/5 border border-error/20 rounded-lg p-4">
            Couldn&apos;t load portfolio: {String((error as Error).message ?? error)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasAnyJobs={jobs.length > 0}
            onClear={() => {
              setSelectedTypeId("all");
              setStatusFilter("all");
            }}
          />
        ) : (
          filtered.map((job, i) => (
            <JobCard
              key={`${job.contractAddress}-${job.id.toString()}`}
              job={job}
              serviceTypes={[...serviceTypes]}
              index={i}
            />
          ))
        )}
      </div>
    </section>
  );
};

const SkeletonList = () => (
  <div className="space-y-3">
    {[0, 1, 2].map(i => (
      <div key={i} className="bg-base-100 border border-base-300/60 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="skeleton-line h-4 w-32" />
          <div className="skeleton-line h-4 w-16" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="skeleton-line h-3 w-full" />
          <div className="skeleton-line h-3 w-3/4" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ hasAnyJobs, onClear }: { hasAnyJobs: boolean; onClear: () => void }) => (
  <div className="text-center py-16 px-4 border border-dashed border-base-300/60 rounded-xl bg-base-100/40">
    {hasAnyJobs ? (
      <>
        <p className="text-base-content/60 my-0">No jobs match these filters.</p>
        <button onClick={onClear} className="btn btn-ghost btn-sm mt-3 text-xs">
          Clear filters
        </button>
      </>
    ) : (
      <p className="text-sm text-base-content/65 my-0">
        This wallet hasn&apos;t used LeftClaw yet. Nothing here — but there could be.
      </p>
    )}
  </div>
);
