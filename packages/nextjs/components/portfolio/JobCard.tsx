"use client";

import { useEffect, useMemo, useState } from "react";
import { ServiceBadge } from "./ServiceBadge";
import { JOB_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "~~/lib/leftclaw/constants";
import { formatAbsoluteDate, formatRelativeTime, formatUsd, resolveResultUrl } from "~~/lib/leftclaw/format";
import type { EnrichedJob, ServiceType } from "~~/lib/leftclaw/types";
import { useSummary } from "~~/lib/leftclaw/useSummary";
import { useWorkLogs } from "~~/lib/leftclaw/useWorkLogs";

const StatusDot = ({ status }: { status: number }) => {
  // 0 OPEN, 1 IN_PROGRESS, 2 COMPLETED, 3 DECLINED, 4 CANCELLED, 5 REASSIGNED
  if (status === 2) return <span className="text-emerald-400">✓</span>;
  if (status === 1)
    return (
      <span className="relative inline-flex items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      </span>
    );
  if (status === 4 || status === 3) return <span className="text-base-content/40">·</span>;
  return <span className="text-base-content/60">○</span>;
};

export const JobCard = ({
  job,
  serviceTypes,
  index,
}: {
  job: EnrichedJob;
  serviceTypes: ServiceType[];
  index: number;
}) => {
  const [open, setOpen] = useState(false);
  const { workLogs } = useWorkLogs(job, open);
  const summaryWorkLogs = useMemo(() => (workLogs ? [...workLogs] : []), [workLogs]);
  const { summary, loading: summaryLoading, ref: summaryRef } = useSummary(job, summaryWorkLogs, serviceTypes);

  const isCancelled = job.status === 3 || job.status === 4;
  const isCompleted = job.status === 2;
  const resultUrl = resolveResultUrl(job.resultCID);

  return (
    <div
      className="card-reveal bg-base-100 border border-base-300/60 rounded-xl px-5 py-4 transition-all hover:border-base-300 hover:shadow-sm"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      ref={summaryRef}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <ServiceBadge serviceTypeId={job.serviceTypeId} serviceTypes={serviceTypes} isCancelled={isCancelled} />
          <span className="text-[11px] uppercase tracking-wide text-base-content/40">{job.contractLabel}</span>
          <span className="text-[11px] text-base-content/40">#{job.id.toString()}</span>
          <StatusDot status={job.status} />
          <span className="text-[11px] text-base-content/50">{JOB_STATUS_LABEL[job.status] ?? "Unknown"}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-sm font-medium tabular-nums">{formatUsd(job.priceUsd)}</span>
          <span className="text-[10px] uppercase tracking-wide text-base-content/40">
            {PAYMENT_METHOD_LABEL[job.paymentMethod] ?? "—"}
          </span>
        </div>
      </div>

      {/* Summary line — AI-generated only; no raw description shown */}
      <div className="mt-3 min-h-[1.5rem]">
        {summary ? (
          <p className="text-sm leading-relaxed text-base-content/85 my-0">{summary}</p>
        ) : summaryLoading ? (
          <div className="space-y-2 my-0">
            <div className="skeleton-line h-3 w-11/12" />
            <div className="skeleton-line h-3 w-3/5" />
          </div>
        ) : null}
      </div>

      {/* Footer row */}
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-base-content/50">
        <span title={formatAbsoluteDate(job.createdAt)}>{formatRelativeTime(job.createdAt)}</span>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="btn btn-ghost btn-xs h-7 min-h-7 px-2 text-[11px] text-base-content/60 hover:text-base-content"
        >
          {open ? "Hide details" : "View details"}
        </button>
      </div>

      {/* Expanded section */}
      {open && (
        <ExpandedSection
          job={job}
          workLogs={workLogs ? [...workLogs] : []}
          resultUrl={resultUrl}
          isCompleted={isCompleted}
        />
      )}
    </div>
  );
};

const ExpandedSection = ({
  job,
  workLogs,
  resultUrl,
  isCompleted,
}: {
  job: EnrichedJob;
  workLogs: { note: string; timestamp: bigint }[];
  resultUrl: string | null;
  isCompleted: boolean;
}) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`mt-4 pt-4 border-t border-base-300/60 transition-all duration-300 ease-out ${
        show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
      }`}
    >
      {workLogs.length > 0 && (
        <div>
          <h4 className="text-[11px] uppercase tracking-wider text-base-content/50 mb-3">Work timeline</h4>
          <ol className="relative pl-5 my-0">
            <span className="absolute left-1.5 top-1.5 bottom-1.5 w-px bg-base-300" aria-hidden />
            {workLogs.map((log, i) => (
              <li key={i} className="relative pb-4 last:pb-0 my-0">
                <span className="absolute -left-[18px] top-1.5 w-3 h-3 rounded-full bg-base-100 border-2 border-base-300" />
                <div className="text-[10px] uppercase tracking-wide text-base-content/40">
                  {formatRelativeTime(log.timestamp)}
                </div>
                <p className="text-sm text-base-content/80 my-0 mt-0.5 leading-relaxed">{log.note}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-base-content/40 font-mono break-all">
          {job.contractLabel} ·{" "}
          <a
            className="link link-hover"
            href={`https://basescan.org/address/${job.contractAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            {job.contractAddress.slice(0, 6)}…{job.contractAddress.slice(-4)}
          </a>{" "}
          · job #{job.id.toString()}
        </div>
        {isCompleted && resultUrl && (
          <a
            href={resultUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary btn-sm h-8 min-h-8 px-3 text-xs"
          >
            View deliverable →
          </a>
        )}
      </div>
    </div>
  );
};
