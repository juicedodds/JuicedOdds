"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlusEvBet, ArbitrageOpportunity } from "@/lib/oddsMath";
import EvTable from "./EvTable";
import ArbTable from "./ArbTable";

interface OddsResponse {
  generatedAt: string;
  sportsChecked: string[];
  eventCount: number;
  plusEv: PlusEvBet[];
  arbitrage: ArbitrageOpportunity[];
  errors?: string[];
  error?: string;
}

const SPORT_TABS = ["All", "NFL", "NBA", "WNBA", "MLB", "NHL", "Soccer", "Tennis", "Golf", "MMA", "Boxing"];
// Must stay >= the server cache window (see revalidate in oddsApi.ts) —
// polling faster than the cache refreshes just burns Odds API quota for no
// new data.
const AUTO_REFRESH_MS = 600_000;

export default function Dashboard() {
  const [data, setData] = useState<OddsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sport, setSport] = useState("All");
  const [tab, setTab] = useState<"ev" | "arb">("ev");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async (selectedSport: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const qs = selectedSport === "All" ? "" : `?sport=${encodeURIComponent(selectedSport)}`;
      const res = await fetch(`/api/odds${qs}`, { cache: "no-store" });
      const json: OddsResponse = await res.json();
      if (!res.ok) {
        setFetchError(json.error ?? `Request failed (${res.status})`);
      } else {
        setData(json);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(sport);
  }, [sport, load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(sport), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, sport, load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Positive Bets</h1>
          <p className="text-sm text-gray-400">
            Live +EV and arbitrage odds across DraftKings, FanDuel, Caesars, BetMGM, and more.
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          {data && <p>Updated {new Date(data.generatedAt).toLocaleTimeString()}</p>}
          {data && <p>{data.eventCount} events scanned</p>}
          <p className="mt-1">Data cached up to 10 min to conserve API quota</p>
          <div className="mt-1 flex items-center justify-end gap-2">
            <label className="flex items-center gap-1 text-gray-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-positive"
              />
              Auto-refresh (10 min)
            </label>
            <button
              onClick={() => load(sport)}
              className="rounded border border-white/20 px-2 py-1 text-gray-300 hover:bg-white/10"
            >
              Refresh now
            </button>
          </div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {SPORT_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              sport === s ? "bg-positive text-black font-semibold" : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 border-b border-white/10">
        <button
          onClick={() => setTab("ev")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "ev" ? "border-b-2 border-positive text-white" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          +EV Bets {data ? `(${data.plusEv.length})` : ""}
        </button>
        <button
          onClick={() => setTab("arb")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "arb" ? "border-b-2 border-positive text-white" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Arbitrage {data ? `(${data.arbitrage.length})` : ""}
        </button>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-lg border border-negative/40 bg-negative/10 p-4 text-sm text-red-300">
          {fetchError}
        </div>
      )}

      {data?.errors && (
        <div className="mb-4 rounded-lg border border-yellow-600/40 bg-yellow-600/10 p-3 text-xs text-yellow-300">
          {data.errors.join(" · ")}
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
          Loading odds…
        </div>
      ) : tab === "ev" ? (
        <EvTable bets={data?.plusEv ?? []} />
      ) : (
        <ArbTable opportunities={data?.arbitrage ?? []} />
      )}

      <footer className="mt-10 space-y-2 border-t border-white/10 pt-4 text-xs text-gray-500">
        <p>
          <strong>Not financial or betting advice.</strong> Odds and EV estimates are computed from a
          consensus of book prices and can be wrong, stale, or based on limited liquidity. Always verify
          the price on the sportsbook before placing a bet.
        </p>
        <p>
          Arbitrage and +EV betting can lead to limited stakes or closed accounts at some sportsbooks —
          that&apos;s a business risk of the strategy, not a bug in this tool.
        </p>
        <p>Gambling problem? Call or text 1-800-GAMBLER. 21+ and available where legal.</p>
      </footer>
    </div>
  );
}
