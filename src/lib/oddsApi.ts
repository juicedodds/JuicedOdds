import { americanToDecimal, type MarketGroup, type OutcomeGroup, type BookPrice } from "./oddsMath";

const BASE_URL = "https://api.the-odds-api.com/v4";

export const SPORTS: { key: string; title: string }[] = [
  { key: "americanfootball_nfl", title: "NFL" },
  { key: "basketball_nba", title: "NBA" },
  { key: "baseball_mlb", title: "MLB" },
  { key: "icehockey_nhl", title: "NHL" },
];

const MARKETS = "h2h,spreads,totals";
// The Odds API doesn't cleanly separate regulated vs. offshore books by
// region — "us" alone mixes DraftKings/FanDuel/BetMGM with offshore books
// like Bovada and MyBookie.ag. So we fetch both "us" and "us2" and filter to
// an explicit whitelist of regulated US sportsbooks below. Caesars
// (williamhill_us) and Fanatics only return data on paid Odds API plans.
const REGIONS = "us,us2";

const REGULATED_US_BOOKS = new Set([
  "draftkings",
  "fanduel",
  "betmgm",
  "williamhill_us", // Caesars — paid Odds API plans only
  "fanatics", // paid Odds API plans only
  "betrivers",
  "espnbet", // theScore Bet, formerly ESPN Bet
  "ballybet",
  "betparx",
  "hardrockbet",
  "hardrockbet_az",
  "hardrockbet_fl",
  "hardrockbet_oh",
]);

interface RawOutcome {
  name: string;
  price: number;
  point?: number;
}

interface RawMarket {
  key: string;
  last_update: string;
  outcomes: RawOutcome[];
}

interface RawBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: RawMarket[];
}

interface RawEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: RawBookmaker[];
}

export class OddsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "OddsApiError";
  }
}

export async function fetchRawEvents(sportKey: string, apiKey: string): Promise<RawEvent[]> {
  const url = `${BASE_URL}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=${REGIONS}&markets=${MARKETS}&oddsFormat=american&dateFormat=iso`;

  const res = await fetch(url, {
    next: { revalidate: 45 }, // shared cache across all visitors, refreshed at most every 45s
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OddsApiError(`The Odds API error (${res.status}): ${body}`, res.status);
  }

  return res.json();
}

// Converts raw API events into MarketGroups: one group per (event, market, point).
// h2h has no point; spreads/totals are grouped so only identical lines are compared.
export function transformToMarketGroups(events: RawEvent[], sportTitle: string): MarketGroup[] {
  const groups: MarketGroup[] = [];

  for (const event of events) {
    // key: marketKey|point -> outcomeName -> OutcomeGroup
    const byMarket = new Map<string, Map<string, OutcomeGroup>>();

    for (const bookmaker of event.bookmakers) {
      if (!REGULATED_US_BOOKS.has(bookmaker.key)) continue;
      for (const market of bookmaker.markets) {
        if (!["h2h", "spreads", "totals"].includes(market.key)) continue;

        for (const outcome of market.outcomes) {
          // Spreads: favorite/underdog carry opposite-signed points for the same
          // line (-3.5 / +3.5), so group by magnitude to keep both sides of a
          // line together. Totals already share the same point (Over/Under 8.5).
          const groupPoint =
            outcome.point !== undefined && market.key === "spreads" ? Math.abs(outcome.point) : outcome.point;
          const pointKey = groupPoint !== undefined ? String(groupPoint) : "none";
          const groupKey = `${market.key}|${pointKey}`;

          if (!byMarket.has(groupKey)) byMarket.set(groupKey, new Map());
          const outcomeMap = byMarket.get(groupKey)!;

          if (!outcomeMap.has(outcome.name)) {
            outcomeMap.set(outcome.name, { name: outcome.name, point: outcome.point, prices: [] });
          }

          const decimal = americanToDecimal(outcome.price);
          const bookPrice: BookPrice = {
            bookKey: bookmaker.key,
            bookTitle: bookmaker.title,
            american: outcome.price,
            decimal,
            lastUpdate: bookmaker.last_update,
          };
          outcomeMap.get(outcome.name)!.prices.push(bookPrice);
        }
      }
    }

    for (const [groupKey, outcomeMap] of byMarket.entries()) {
      const [marketKey, pointKey] = groupKey.split("|");
      groups.push({
        eventId: event.id,
        sportKey: event.sport_key,
        sportTitle,
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        commenceTime: event.commence_time,
        marketKey: marketKey as MarketGroup["marketKey"],
        point: pointKey === "none" ? undefined : Number(pointKey),
        outcomes: Array.from(outcomeMap.values()),
      });
    }
  }

  return groups;
}
