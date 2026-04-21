"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { ARRDataPoint } from "@/lib/types";

export function MiniChart({ data }: { data: ARRDataPoint[] }) {
  if (data.length === 0) {
    return <div className="h-10 w-[120px] rounded bg-sage-75" />;
  }

  return (
    <div className="h-10 w-[120px]">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="var(--color-sage-300)"
            strokeWidth={1}
            fill="var(--color-sage-75)"
            strokeDasharray="3 3"
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="var(--color-central-600)"
            strokeWidth={1.5}
            fill="var(--color-central-50)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
