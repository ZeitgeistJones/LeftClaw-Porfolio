import { DEFAULT_SERVICE_TYPES, SERVICE_COLOR_BY_NAME } from "~~/lib/leftclaw/constants";
import type { ServiceType } from "~~/lib/leftclaw/types";

const colorFor = (name: string) => {
  const key = name.trim().toLowerCase();
  return SERVICE_COLOR_BY_NAME[key] ?? SERVICE_COLOR_BY_NAME.default;
};

export const ServiceBadge = ({
  serviceTypeId,
  serviceTypes,
  isCancelled,
}: {
  serviceTypeId: bigint;
  serviceTypes: ServiceType[];
  isCancelled?: boolean;
}) => {
  const id = Number(serviceTypeId);
  const fromChain = serviceTypes.find(s => Number(s.id) === id);
  const name = fromChain?.name ?? DEFAULT_SERVICE_TYPES[id] ?? `Service #${id}`;
  const color = isCancelled ? { bg: "bg-red-500/10", text: "text-red-400", ring: "ring-red-500/20" } : colorFor(name);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium tracking-tight ${color.bg} ${color.text} ring-1 ring-inset ${color.ring}`}
    >
      {name}
    </span>
  );
};
