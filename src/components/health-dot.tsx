import type { HealthStatus } from "@/lib/types";

const COLORS: Record<HealthStatus, string> = {
  green: "bg-central-600",
  yellow: "bg-warning",
  red: "bg-error",
  gray: "bg-sage-400",
};

const LABELS: Record<HealthStatus, string> = {
  green: "Healthy",
  yellow: "At Risk",
  red: "Critical",
  gray: "No Data",
};

export function HealthDot({ status, showLabel = false }: { status: HealthStatus; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${COLORS[status]}`}
        title={LABELS[status]}
      />
      {showLabel && (
        <span className="text-xs font-medium text-sage-600">{LABELS[status]}</span>
      )}
    </span>
  );
}
