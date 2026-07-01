"use client";

import type { PlusEvBet } from "@/lib/oddsMath";
import { formatAmerican, formatKickoff, formatMarket, formatPct, formatUSD } from "@/lib/format";
import { getBookUrl } from "@/lib/bookLinks";

export default function EvTable({ bets, totalStake }: { bets: PlusEvBet[]; totalStake: number }) {
  if (bets.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
        No +EV bets above threshold right now. Check back after the next refresh.
      </div>
    );
  }

  const hasCautionRows = bets.some((b) => b.needsVerification);

  return (
    <div className="space-y-2">
      {hasCautionRows && (
        <p className="text-xs text-yellow-400">
          ⚠ = a larger edge, usually on a thin or alternate line. Double-check the live price on the book before
          betting — it may have moved or the line may not take real stakes at that price.
        </p>
      )}
      <p className="text-xs text-gray-500">
        &quot;Bet&quot; opens the book&apos;s sportsbook homepage — sportsbooks don&apos;t offer a public way to
        pre-fill a specific selection and stake, so you&apos;ll still need to find the game once there.
      </p>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-3 py-2">EV</th>
              <th className="px-3 py-2">Sport</th>
              <th className="px-3 py-2">Matchup</th>
              <th className="px-3 py-2">Market</th>
              <th className="px-3 py-2">Selection</th>
              <th className="px-3 py-2">Book</th>
              <th className="px-3 py-2">Offered</th>
              <th className="px-3 py-2">Fair</th>
              <th className="px-3 py-2">Stake</th>
              <th className="px-3 py-2">To Win</th>
              <th className="px-3 py-2">Kickoff</th>
              <th className="w-20 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {bets.map((bet, i) => {
              const toWin = totalStake * (bet.offeredDecimal - 1);
              const bookUrl = getBookUrl(bet.bookKey);
              return (
                <tr key={i} className="hover:bg-white/5">
                  <td className="px-3 py-2 font-semibold text-positive">
                    {formatPct(bet.evPct)}
                    {bet.needsVerification && (
                      <span
                        title="Large edge — likely a thin/alternate line. Verify the live price on the book before betting."
                        className="ml-1 cursor-help text-yellow-400"
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-400">{bet.sportTitle}</td>
                  <td className="px-3 py-2">{bet.matchup}</td>
                  <td className="px-3 py-2 text-gray-400">{formatMarket(bet.marketKey, bet.point)}</td>
                  <td className="px-3 py-2">{bet.selection}</td>
                  <td className="px-3 py-2 font-medium">{bet.bookTitle}</td>
                  <td className="px-3 py-2">{formatAmerican(bet.offeredAmerican)}</td>
                  <td className="px-3 py-2 text-gray-400">{formatAmerican(bet.fairAmerican)}</td>
                  <td className="px-3 py-2">{formatUSD(totalStake)}</td>
                  <td className="px-3 py-2 text-positive">{formatUSD(toWin)}</td>
                  <td className="px-3 py-2 text-gray-400">{formatKickoff(bet.commenceTime)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {bookUrl && (
                      <a
                        href={bookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block whitespace-nowrap rounded border border-white/20 px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-positive hover:bg-positive/10 hover:text-positive"
                      >
                        Bet →
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
