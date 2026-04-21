import { HUBSPOT_STAGES } from "@/lib/types";

export function StagePipeline({ currentIndex }: { currentIndex: number | null }) {
  return (
    <div className="flex items-center gap-0.5">
      {HUBSPOT_STAGES.map((stage, i) => {
        const isCompleted = currentIndex !== null && i < currentIndex;
        const isCurrent = currentIndex !== null && i === currentIndex;
        return (
          <div
            key={stage}
            title={stage}
            className={`h-2 rounded-sm transition-all ${
              isCompleted
                ? "w-4 bg-central-600"
                : isCurrent
                  ? "w-5 bg-central-400"
                  : "w-3 bg-sage-200"
            }`}
          />
        );
      })}
    </div>
  );
}
