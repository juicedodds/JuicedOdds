"use client";

import type { PlusEvBet } from "@/lib/oddsMath";
import { formatAmerican, formatKickoff, formatMarket, formatPct } from "@/lib/format";

export default function EvTable({ bets }: { bets: PlusEvBet[] }) {
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
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[900px] text-sm">
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
              <th className="px-3 py-2"># Books</th>
              <th className="px-3 py-2">Kickoff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {bets.map((bet, i) => (
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
                <td className="px-3 py-2 text-gray-500">{bet.booksUsedForFair}</td>
                <td className="px-3 py-2 text-gray-400">{formatKickoff(bet.commenceTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
