const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  UK: "🇬🇧",
  SE: "🇸🇪",
  DE: "🇩🇪",
  FR: "🇫🇷",
  ES: "🇪🇸",
  IT: "🇮🇹",
  NL: "🇳🇱",
  BR: "🇧🇷",
  MX: "🇲🇽",
  JP: "🇯🇵",
  AU: "🇦🇺",
  CA: "🇨🇦",
  Ireland: "🇮🇪",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Spain: "🇪🇸",
  Italy: "🇮🇹",
  Netherlands: "🇳🇱",
  Brazil: "🇧🇷",
  Mexico: "🇲🇽",
  Japan: "🇯🇵",
  Australia: "🇦🇺",
  Canada: "🇨🇦",
  Sweden: "🇸🇪",
};

export function labelToFlag(label: string): string | null {
  // Try the last word of the label (e.g., "Klarna US" → "US")
  const lastWord = label.split(/\s+/).pop() ?? "";
  return COUNTRY_FLAGS[lastWord] ?? null;
}
