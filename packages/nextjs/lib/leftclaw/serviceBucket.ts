import { DEFAULT_SERVICE_TYPES } from "./constants";
import type { ServiceType } from "./types";

export type ServiceBucket = "builds" | "audits" | "other";

/**
 * Landing + gallery share this mapping so Builds/Audits counts match the browse lists.
 * Word-boundary checks avoid accidental substring hits; audits win over builds
 * (e.g. "Feature Audit" → audits).
 */
export function serviceBucket(name: string): ServiceBucket {
  const lower = name.toLowerCase();
  if (/\baudit\b/.test(lower) || lower.includes("humanqa") || /\bqa\b/.test(lower)) return "audits";
  if (/\bbuild\b/.test(lower) || /\bfeature\b/.test(lower)) return "builds";
  return "other";
}

export function resolveServiceName(serviceTypeId: number | bigint, serviceTypes: ServiceType[]): string {
  const id = Number(serviceTypeId);
  return serviceTypes.find(s => Number(s.id) === id)?.name ?? DEFAULT_SERVICE_TYPES[id] ?? `Type ${id}`;
}

export function jobActivity(job: { createdAt: bigint; startedAt: bigint; completedAt: bigint }): number {
  return Math.max(Number(job.createdAt), Number(job.startedAt), Number(job.completedAt));
}
