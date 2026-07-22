/**
 * Strongly-typed shapes used throughout the Portfolio Explorer.
 *
 * `Job` is the on-chain getJob() return tuple after viem decodes it into a
 * named-fields object. We keep the bigint -> bigint mapping here so callers
 * always work with bigints; cast to Number / format only at the render edge.
 */

export type Job = {
  id: bigint;
  client: `0x${string}`;
  serviceTypeId: bigint;
  paymentClawd: bigint;
  priceUsd: bigint;
  description: string;
  status: number;
  createdAt: bigint;
  startedAt: bigint;
  completedAt: bigint;
  resultCID: string;
  worker: `0x${string}`;
  paymentClaimed: boolean;
  paymentMethod: number;
  cvAmount: bigint;
  currentStage: string;
};

export type WorkLog = {
  note: string;
  timestamp: bigint;
};

export type ServiceType = {
  id: bigint;
  name: string;
  slug: string;
  priceUsd: bigint;
  cvDivisor: bigint;
  status: string;
};

// Job tagged with which contract it came from so we can route detail RPC
// reads (work logs) at the right address.
export type EnrichedJob = Job & {
  contractAddress: `0x${string}`;
  contractLabel: "V1" | "V2";
};

/** Client wallet ranked by visible (non-consult) job activity. */
export type WalletLeaderboardEntry = {
  address: `0x${string}`;
  jobCount: number;
  lastActivity: number;
};
