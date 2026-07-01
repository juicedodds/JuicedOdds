export function formatAmerican(american: number): string {
  if (!isFinite(american)) return "—";
  return american > 0 ? `+${american}` : `${american}`;
}

export function formatPct(pct: number, digits = 1): string {
  return `${pct.toFixed(digits)}%`;
}

export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMarket(marketKey: string, point?: number): string {
  if (marketKey === "h2h") return "Moneyline";
  if (marketKey === "spreads") return `Spread ${point !== undefined && point > 0 ? "+" : ""}${point ?? ""}`;
  if (marketKey === "totals") return `Total ${point ?? ""}`;
  if (marketKey === "outrights") return "Tournament Winner";
  return marketKey;
}
