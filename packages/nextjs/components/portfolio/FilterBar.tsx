"use client";

import { DEFAULT_SERVICE_TYPES } from "~~/lib/leftclaw/constants";
import type { EnrichedJob, ServiceType } from "~~/lib/leftclaw/types";

export type StatusFilter = "all" | "completed" | "active";

export const FilterBar = ({
  jobs,
  serviceTypes,
  selectedTypeId,
  onSelectTypeId,
  statusFilter,
  onStatusFilter,
}: {
  jobs: EnrichedJob[];
  serviceTypes: ServiceType[];
  selectedTypeId: number | "all";
  onSelectTypeId: (id: number | "all") => void;
  statusFilter: StatusFilter;
  onStatusFilter: (s: StatusFilter) => void;
}) => {
  // Only show service-type tabs that this wallet actually has at least one of.
  const counts = new Map<number, number>();
  for (const j of jobs) counts.set(Number(j.serviceTypeId), (counts.get(Number(j.serviceTypeId)) ?? 0) + 1);
  const presentIds = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));

  const labelFor = (id: number) => {
    const fromChain = serviceTypes.find(s => Number(s.id) === id)?.name;
    return fromChain ?? DEFAULT_SERVICE_TYPES[id] ?? `Type ${id}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Tab active={selectedTypeId === "all"} onClick={() => onSelectTypeId("all")}>
          All <span className="opacity-50 ml-1">{jobs.length}</span>
        </Tab>
        {presentIds.map(id => (
          <Tab key={id} active={selectedTypeId === id} onClick={() => onSelectTypeId(id)}>
            {labelFor(id)} <span className="opacity-50 ml-1">{counts.get(id)}</span>
          </Tab>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-base-content/40 mr-1">Status</span>
        <Pill active={statusFilter === "all"} onClick={() => onStatusFilter("all")}>
          All
        </Pill>
        <Pill active={statusFilter === "completed"} onClick={() => onStatusFilter("completed")}>
          Completed
        </Pill>
        <Pill active={statusFilter === "active"} onClick={() => onStatusFilter("active")}>
          In progress
        </Pill>
      </div>
    </div>
  );
};

const Tab = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
      active
        ? "bg-base-content/90 text-base-100"
        : "bg-base-200/60 text-base-content/70 hover:bg-base-200 hover:text-base-content border border-base-300/50"
    }`}
  >
    {children}
  </button>
);

const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${
      active ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "text-base-content/60 hover:text-base-content"
    }`}
  >
    {children}
  </button>
);
