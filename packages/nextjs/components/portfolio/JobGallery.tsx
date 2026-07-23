"use client";

import { useMemo, useState } from "react";
import { JobCard } from "./JobCard";
import { Address } from "@scaffold-ui/components";
import { base } from "viem/chains";
import { HIDDEN_SERVICE_TYPE_IDS } from "~~/lib/leftclaw/constants";
import { type ServiceBucket, jobActivity, resolveServiceName, serviceBucket } from "~~/lib/leftclaw/serviceBucket";
import type { EnrichedJob, ServiceType } from "~~/lib/leftclaw/types";

export type GalleryView = "builds" | "audits";
type StatusFilter = "all" | "completed" | "active";

type JobGalleryProps = {
  view: GalleryView;
  jobs: EnrichedJob[];
  serviceTypes: ServiceType[];
  ready: boolean;
  error: Error | null;
  onBack: () => void;
  onExplore: (address: `0x${string}`) => void;
  onViewChange: (view: GalleryView) => void;
};

export const JobGallery = ({
  view,
  jobs,
  serviceTypes,
  ready,
  error,
  onBack,
  onExplore,
  onViewChange,
}: JobGalleryProps) => {
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const bucket: ServiceBucket = view;
    return jobs
      .filter(j => !HIDDEN_SERVICE_TYPE_IDS.has(Number(j.serviceTypeId)))
      .filter(j => serviceBucket(resolveServiceName(j.serviceTypeId, serviceTypes)) === bucket)
      .filter(j => {
        if (status === "completed") return j.status === 2;
        if (status === "active") return j.status === 0 || j.status === 1;
        return true;
      })
      .sort((a, b) => jobActivity(b) - jobActivity(a));
  }, [jobs, serviceTypes, view, status]);

  if (error) {
    return (
      <section className="max-w-4xl mx-auto px-6 py-10">
        <BackRow onBack={onBack} />
        <p className="text-center text-xs text-base-content/55 my-0">Gallery unavailable — try again later.</p>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-6 py-10">
      <BackRow onBack={onBack} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-2">
          <TabButton active={view === "builds"} onClick={() => onViewChange("builds")} label="Builds" />
          <TabButton active={view === "audits"} onClick={() => onViewChange("audits")} label="Audits" />
        </div>
        <div className="flex gap-1.5">
          {(["all", "completed", "active"] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`btn btn-xs h-7 min-h-7 px-2.5 capitalize ${
                status === s ? "btn-primary" : "btn-ghost text-base-content/55"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-base-content/55 mb-4 my-0">
        {ready ? (
          <>
            {filtered.length} {view === "builds" ? "build" : "audit"}
            {filtered.length === 1 ? "" : "s"}
            {status !== "all" ? ` · ${status}` : ""}
          </>
        ) : (
          "Loading jobs…"
        )}
      </p>

      {!ready ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-base-100 border border-base-300/60 rounded-xl px-5 py-4 space-y-3">
              <span className="inline-block skeleton-line w-24 h-4" />
              <span className="inline-block skeleton-line w-full h-3" />
              <span className="inline-block skeleton-line w-2/3 h-3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-base-content/55 my-0 py-8">No {view} matching this filter yet.</p>
      ) : (
        <ul className="space-y-3 my-0 list-none p-0">
          {filtered.map((job, index) => (
            <li key={`${job.contractAddress}-${job.id.toString()}`}>
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <span className="min-w-0 pointer-events-none">
                  <Address address={job.client} chain={base} disableAddressLink onlyEnsOrAddress />
                </span>
                <button
                  type="button"
                  onClick={() => onExplore(job.client)}
                  className="btn btn-ghost btn-xs h-7 min-h-7 px-2 text-[11px] text-base-content/60 shrink-0"
                >
                  View portfolio →
                </button>
              </div>
              <JobCard job={job} serviceTypes={serviceTypes} index={index} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const BackRow = ({ onBack }: { onBack: () => void }) => (
  <button
    type="button"
    onClick={onBack}
    className="btn btn-ghost btn-sm h-8 min-h-8 px-2 mb-4 text-base-content/60 hover:text-base-content"
  >
    ← Back to overview
  </button>
);

const TabButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`btn btn-sm h-9 min-h-9 px-4 ${active ? "btn-primary" : "btn-ghost border border-base-300/60"}`}
  >
    {label}
  </button>
);
