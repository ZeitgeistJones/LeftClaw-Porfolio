import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * LeftClaw Services V1 + V2 contract ABI (read-only methods).
 *
 * Both contracts share the same Job/ServiceType/WorkLog struct shape — V1 is
 * the historical contract (~14 jobs) and V2 is the current production
 * contract (90+ jobs). The Portfolio Explorer reads from BOTH and merges
 * results so no historical builds are lost.
 *
 * Job struct (V2 source) field order:
 *   id, client, serviceTypeId, paymentClawd, priceUsd, description, status,
 *   createdAt, startedAt, completedAt, resultCID, worker, paymentClaimed,
 *   paymentMethod, cvAmount, currentStage
 *
 * JobStatus enum: 0=OPEN, 1=IN_PROGRESS, 2=COMPLETED, 3=DECLINED, 4=CANCELLED, 5=REASSIGNED
 * PaymentMethod enum: 0=CLAWD, 1=USDC, 2=ETH, 3=CV
 */

const leftClawAbi = [
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        type: "tuple",
        name: "",
        internalType: "struct LeftClawServicesV2.Job",
        components: [
          { name: "id", type: "uint256", internalType: "uint256" },
          { name: "client", type: "address", internalType: "address" },
          { name: "serviceTypeId", type: "uint256", internalType: "uint256" },
          { name: "paymentClawd", type: "uint256", internalType: "uint256" },
          { name: "priceUsd", type: "uint256", internalType: "uint256" },
          { name: "description", type: "string", internalType: "string" },
          { name: "status", type: "uint8", internalType: "enum LeftClawServicesV2.JobStatus" },
          { name: "createdAt", type: "uint256", internalType: "uint256" },
          { name: "startedAt", type: "uint256", internalType: "uint256" },
          { name: "completedAt", type: "uint256", internalType: "uint256" },
          { name: "resultCID", type: "string", internalType: "string" },
          { name: "worker", type: "address", internalType: "address" },
          { name: "paymentClaimed", type: "bool", internalType: "bool" },
          { name: "paymentMethod", type: "uint8", internalType: "enum LeftClawServicesV2.PaymentMethod" },
          { name: "cvAmount", type: "uint256", internalType: "uint256" },
          { name: "currentStage", type: "string", internalType: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getJobsByClient",
    stateMutability: "view",
    inputs: [{ name: "client", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
  },
  {
    type: "function",
    name: "getTotalJobs",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "getWorkLogs",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        name: "",
        internalType: "struct LeftClawServicesV2.WorkLog[]",
        components: [
          { name: "note", type: "string", internalType: "string" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getAllServiceTypes",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        name: "",
        internalType: "struct LeftClawServicesV2.ServiceType[]",
        components: [
          { name: "id", type: "uint256", internalType: "uint256" },
          { name: "name", type: "string", internalType: "string" },
          { name: "slug", type: "string", internalType: "string" },
          { name: "priceUsd", type: "uint256", internalType: "uint256" },
          { name: "cvDivisor", type: "uint256", internalType: "uint256" },
          { name: "status", type: "string", internalType: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getOpenJobs",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
  },
  {
    type: "function",
    name: "getJobsByStatus",
    stateMutability: "view",
    inputs: [{ name: "status", type: "uint8", internalType: "enum LeftClawServicesV2.JobStatus" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
  },
] as const;

const externalContracts = {
  8453: {
    LeftClawServicesV2: {
      address: "0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a",
      abi: leftClawAbi,
    },
    LeftClawServicesV1: {
      address: "0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F",
      abi: leftClawAbi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
