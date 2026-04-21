import type { HexEmbed } from "@/lib/types";

export function HexEmbeds({ embeds }: { embeds: HexEmbed[] }) {
  if (embeds.length === 0) return null;

  return (
    <div className="rounded-xl border border-sage-200 bg-white">
      <div className="border-b border-sage-100 px-5 py-3">
        <h2 className="text-sm font-bold text-sage-900">Dashboards</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        {embeds.map((embed) => (
          <div
            key={embed.label}
            className="overflow-hidden rounded-lg border border-sage-100"
          >
            <div className="border-b border-sage-100 bg-sage-25 px-3 py-2">
              <span className="text-xs font-semibold text-sage-600">{embed.label}</span>
            </div>
            <iframe
              src={embed.url}
              className="h-[300px] w-full border-0"
              title={embed.label}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
