import { americanToDecimal, type MarketGroup, type OutcomeGroup, type BookPrice } from "./oddsMath";

const BASE_URL = "https://api.the-odds-api.com/v4";

export const SPORTS: { key: string; title: string }[] = [
  { key: "americanfootball_nfl", title: "NFL" },
  { key: "basketball_nba", title: "NBA" },
  { key: "baseball_mlb", title: "MLB" },
  { key: "icehockey_nhl", title: "NHL" },
];

const MARKETS = "h2h,spreads,totals";

// The Odds API bills quota as (markets requested) x (regions requested), and
// treats every 10 bookmakers named via the `bookmakers` param as 1 "region"
// for that formula. Naming an explicit list of <=10 regulated US books (vs.
// requesting regions=us,us2, which is 2 regions and pulls in offshore books
// like Bovada/MyBookie.ag we'd just filter out anyway) cuts quota cost in
// half: 3 markets x 1 region-equivalent = 3 credits/sport instead of 6.
// Caesars (williamhill_us) and Fanatics only return data on paid Odds API
// plans; they're included so the dashboard picks them up automatically if
// the plan is ever upgraded, at no extra quota cost since they return no
// data on the free tier.
const REGULATED_US_BOOKS = [
  "draftkings",
  "fanduel",
  "betmgm",
  "betrivers",
  "espnbet", // theScore Bet, formerly ESPN Bet
  "ballybet",
  "betparx",
  "hardrockbet",
  "williamhill_us", // Caesars — paid Odds API plans only
  "fanatics", // paid Odds API plans only
];
const REGULATED_US_BOOKS_SET = new Set(REGULATED_US_BOOKS);
const BOOKMAKERS_PARAM = REGULATED_US_BOOKS.join(",");

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
  const url = `${BASE_URL}/sports/${sportKey}/odds?apiKey=${apiKey}&bookmakers=${BOOKMAKERS_PARAM}&markets=${MARKETS}&oddsFormat=american&dateFormat=iso`;

  const res = await fetch(url, {
    // Shared cache across all visitors. Must stay >= the client's poll
    // interval (see Dashboard.tsx) — otherwise every poll forces a fresh,
    // quota-billed upstream call instead of reusing the cache.
    next: { revalidate: 600 },
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
      if (!REGULATED_US_BOOKS_SET.has(bookmaker.key)) continue;
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
