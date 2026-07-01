import { NextResponse } from "next/server";
import { SPORTS, fetchRawEvents, transformToMarketGroups, OddsApiError } from "@/lib/oddsApi";
import { findPlusEvBets, findArbitrageOpportunities, type MarketGroup } from "@/lib/oddsMath";

export const revalidate = 45;

export async function GET(request: Request) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing ODDS_API_KEY. Set it in .env.local (dev) or your host's env vars." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const sportFilter = searchParams.get("sport"); // e.g. "NFL", or omitted = all

  const sportsToFetch = sportFilter ? SPORTS.filter((s) => s.title === sportFilter) : SPORTS;

  const allGroups: MarketGroup[] = [];
  const errors: string[] = [];

  await Promise.all(
    sportsToFetch.map(async (sport) => {
      try {
        const raw = await fetchRawEvents(sport.key, apiKey);
        const groups = transformToMarketGroups(raw, sport.title);
        allGroups.push(...groups);
      } catch (err) {
        const message = err instanceof OddsApiError ? err.message : String(err);
        errors.push(`${sport.title}: ${message}`);
      }
    }),
  );

  const plusEv = findPlusEvBets(allGroups);
  const arbitrage = findArbitrageOpportunities(allGroups);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sportsChecked: sportsToFetch.map((s) => s.title),
    eventCount: new Set(allGroups.map((g) => g.eventId)).size,
    plusEv,
    arbitrage,
    errors: errors.length > 0 ? errors : undefined,
  });
}
