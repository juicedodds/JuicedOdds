"use client";

import type { ArbitrageOpportunity } from "@/lib/oddsMath";
import { formatAmerican, formatKickoff, formatMarket, formatPct, formatUSD } from "@/lib/format";
import { getBookUrl } from "@/lib/bookLinks";

export default function ArbTable({
  opportunities,
  totalStake,
}: {
  opportunities: ArbitrageOpportunity[];
  totalStake: number;
}) {
  if (opportunities.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
        No arbitrage opportunities right now. These are rare and disappear fast once found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Stake amounts below split {formatUSD(totalStake)} total across all legs of each opportunity, sized to lock
        in the same profit regardless of outcome. Place every leg before lines move — arbitrage only works if all
        legs go in near-simultaneously.
      </p>
      {opportunities.map((arb, i) => {
        const guaranteedProfit = totalStake * (arb.profitPct / 100);
        return (
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
                {formatPct(arb.profitPct)} · {formatUSD(guaranteedProfit)} guaranteed
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {arb.legs.map((leg, j) => {
                const legStake = totalStake * (leg.stakePct / 100);
                const bookUrl = getBookUrl(leg.bookKey);
                return (
                  <div key={j} className="rounded-md bg-black/30 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{leg.selection}</span>
                      <span className="text-gray-300">{formatAmerican(leg.american)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                      <span>{leg.bookTitle}</span>
                      <span>
                        Bet {formatUSD(legStake)} ({formatPct(leg.stakePct)})
                      </span>
                    </div>
                    {bookUrl && (
                      <a
                        href={bookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block whitespace-nowrap rounded border border-white/20 px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-positive hover:bg-positive/10 hover:text-positive"
                      >
                        Bet on {leg.bookTitle} →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
