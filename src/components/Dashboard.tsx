"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlusEvBet, ArbitrageOpportunity } from "@/lib/oddsMath";
import { BOOKS } from "@/lib/books";
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
const AUTO_REFRESH_MS = 30_000;
const BOOK_FILTER_STORAGE_KEY = "positive-bets:hidden-books";

export default function Dashboard() {
  const [data, setData] = useState<OddsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sport, setSport] = useState("All");
  const [tab, setTab] = useState<"ev" | "arb">("ev");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [totalStake, setTotalStake] = useState(100);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [hiddenBooks, setHiddenBooks] = useState<Set<string>>(new Set());

  // Load saved book preferences after mount (avoids an SSR/client hydration
  // mismatch, since localStorage isn't available on the server).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BOOK_FILTER_STORAGE_KEY);
      if (saved) setHiddenBooks(new Set(JSON.parse(saved)));
    } catch {
      // ignore malformed/unavailable storage
    }
  }, []);

  const toggleBook = (bookKey: string) => {
    setHiddenBooks((prev) => {
      const next = new Set(prev);
      if (next.has(bookKey)) next.delete(bookKey);
      else next.add(bookKey);
      try {
        localStorage.setItem(BOOK_FILTER_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore unavailable storage (e.g. private browsing)
      }
      return next;
    });
  };

  const filteredPlusEv = useMemo(
    () => (data?.plusEv ?? []).filter((bet) => !hiddenBooks.has(bet.bookKey)),
    [data, hiddenBooks],
  );
  const filteredArbitrage = useMemo(
    () => (data?.arbitrage ?? []).filter((arb) => arb.legs.every((leg) => !hiddenBooks.has(leg.bookKey))),
    [data, hiddenBooks],
  );

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
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2000);
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
          <p className="mt-1">Data cached up to 30s.</p>
          <div className="mt-1 flex items-center justify-end gap-2">
            <label className="flex items-center gap-1 text-gray-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-positive"
              />
              Auto-refresh (30s)
            </label>
            <button
              onClick={() => load(sport)}
              disabled={loading}
              className="rounded border border-white/20 px-2 py-1 text-gray-300 hover:bg-white/10 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : justRefreshed ? "✓ Refreshed" : "Refresh now"}
            </button>
          </div>
        </div>
      </header>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="totalStake" className="text-gray-400">
          Total stake per bet: $
        </label>
        <input
          id="totalStake"
          type="number"
          min={1}
          step={1}
          value={totalStake}
          onChange={(e) => setTotalStake(Math.max(1, Number(e.target.value) || 1))}
          className="w-24 rounded border border-white/20 bg-white/5 px-2 py-1 text-white"
        />
        <span className="text-xs text-gray-500">
          Used to size the stake amounts shown below (arbitrage splits this across legs by implied probability).
        </span>
      </div>

      <div className="mb-4">
        <p className="mb-1 text-sm text-gray-400">
          Books to include{" "}
          <span className="text-xs text-gray-500">(uncheck any you don&apos;t have an account with)</span>
        </p>
        <div className="flex flex-wrap gap-3">
          {BOOKS.map((book) => (
            <label key={book.key} className="flex items-center gap-1.5 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={!hiddenBooks.has(book.key)}
                onChange={() => toggleBook(book.key)}
                className="accent-positive"
              />
              {book.title}
            </label>
          ))}
        </div>
      </div>

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
          +EV Bets {data ? `(${filteredPlusEv.length})` : ""}
        </button>
        <button
          onClick={() => setTab("arb")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "arb" ? "border-b-2 border-positive text-white" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Arbitrage {data ? `(${filteredArbitrage.length})` : ""}
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
        <EvTable bets={filteredPlusEv} totalStake={totalStake} />
      ) : (
        <ArbTable opportunities={filteredArbitrage} totalStake={totalStake} />
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
