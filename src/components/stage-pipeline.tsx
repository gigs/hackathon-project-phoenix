"use client";

import { useState } from "react";
import { HUBSPOT_STAGES, IMPLEMENTATION_STAGES } from "@/lib/types";
import type { DealLifecycle } from "@/lib/types";

const ALL_STAGES = [...HUBSPOT_STAGES, ...IMPLEMENTATION_STAGES];
const PRESALES_COUNT = HUBSPOT_STAGES.length;

function resolveGlobalIndex(
  lifecycle: DealLifecycle,
  localIndex: number | null,
): number | null {
  if (localIndex === null) return null;
  if (lifecycle === "presales") return localIndex;
  return PRESALES_COUNT + localIndex;
}

export function StagePipeline({
  currentIndex,
  lifecycle,
  hubspotStageIndex,
  implementationStageIndex,
}: {
  currentIndex?: number | null;
  lifecycle: DealLifecycle;
  hubspotStageIndex?: number | null;
  implementationStageIndex?: number | null;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  let globalIndex: number | null = null;
  if (lifecycle === "post-launch") {
    globalIndex = ALL_STAGES.length;
  } else if (lifecycle === "implementation") {
    globalIndex = resolveGlobalIndex("implementation", implementationStageIndex ?? currentIndex ?? null);
  } else {
    globalIndex = resolveGlobalIndex("presales", hubspotStageIndex ?? currentIndex ?? null);
  }

  return (
    <div className="relative w-full pb-4">
      {/* Stepper track */}
      <div className="flex w-full items-center">
        {ALL_STAGES.map((stage, i) => {
          const isCompleted = globalIndex !== null && i < globalIndex;
          const isCurrent = globalIndex !== null && i === globalIndex;
          const isPresales = i < PRESALES_COUNT;
          const isFirst = i === 0;
          const isLast = i === ALL_STAGES.length - 1;
          const isBoundary = i === PRESALES_COUNT; // first impl stage

          return (
            <div
              key={stage}
              className="flex flex-1 items-center"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Connector line before dot (skip for first) */}
              {!isFirst && (
                <div
                  className={`h-0.5 flex-1 ${
                    isBoundary
                      ? "bg-gradient-to-r from-sage-300 to-sage-200"
                      : isCompleted || isCurrent
                        ? isPresales
                          ? "bg-sage-500"
                          : "bg-central-500"
                        : "bg-sage-200"
                  }`}
                />
              )}

              {/* Dot */}
              <div className="relative flex flex-col items-center">
                <div
                  className={`shrink-0 rounded-full transition-all ${
                    isCurrent
                      ? isPresales
                        ? "h-4 w-4 ring-3 ring-sage-200 bg-sage-600"
                        : "h-4 w-4 ring-3 ring-central-200 bg-central-500"
                      : isCompleted
                        ? isPresales
                          ? "h-2.5 w-2.5 bg-sage-500"
                          : "h-2.5 w-2.5 bg-central-600"
                        : isPresales
                          ? "h-2 w-2 bg-sage-300"
                          : "h-2 w-2 bg-central-200"
                  }`}
                />

                {/* Current stage label — always visible */}
                {isCurrent && (
                  <div className="absolute top-full mt-1 whitespace-nowrap text-center">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-3xs font-semibold ${
                        isPresales
                          ? "bg-sage-100 text-sage-700"
                          : "bg-central-50 text-central-700"
                      }`}
                    >
                      {stage}
                    </span>
                  </div>
                )}
              </div>

              {/* Connector line after dot (skip for last) */}
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 ${
                    i + 1 === PRESALES_COUNT
                      ? "bg-gradient-to-r from-sage-400 to-sage-200"
                      : isCompleted && globalIndex !== null && i + 1 <= globalIndex
                        ? isPresales
                          ? "bg-sage-500"
                          : "bg-central-500"
                        : "bg-sage-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Phase labels at edges */}
      <div className="pointer-events-none absolute bottom-0 left-0 flex w-full items-end justify-between">
        <span className="text-sage-400" style={{ fontSize: "8px", letterSpacing: "0.05em" }}>
          PRESALES
        </span>
        <span className="text-central-400" style={{ fontSize: "8px", letterSpacing: "0.05em" }}>
          IMPLEMENTATION
        </span>
      </div>

      {/* Hover tooltip */}
      {hovered !== null && hovered !== globalIndex && (
        <div className="pointer-events-none absolute -top-7 left-0 z-10 whitespace-nowrap rounded bg-sage-900 px-2 py-1 text-3xs text-white shadow">
          {ALL_STAGES[hovered]}
        </div>
      )}
    </div>
  );
}
