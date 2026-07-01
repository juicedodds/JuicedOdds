"use client";

import type { ArbitrageOpportunity } from "@/lib/oddsMath";
import { formatAmerican, formatKickoff, formatMarket, formatPct } from "@/lib/format";

export default function ArbTable({ opportunities }: { opportunities: ArbitrageOpportunity[] }) {
  if (opportunities.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
        No arbitrage opportunities right now. These are rare and disappear fast once found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {opportunities.map((arb, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs uppercase tracking-wide text-gray-400">{arb.sportTitle}</span>
              <h3 className="font-semibold">{arb.matchup}</h3>
              <p className="text-xs text-gray-400">
                {formatMarket(arb.marketKey, arb.point)} · {formatKickoff(arb.commenceTime)}
              </p>
            </div>
            <span className="rounded-full bg-positive/20 px-3 py-1 text-sm font-bold text-positive">
              {formatPct(arb.profitPct)} guaranteed
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {arb.legs.map((leg, j) => (
              <div key={j} className="rounded-md bg-black/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{leg.selection}</span>
                  <span className="text-gray-300">{formatAmerican(leg.american)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                  <span>{leg.bookTitle}</span>
                  <span>Stake: {formatPct(leg.stakePct)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
