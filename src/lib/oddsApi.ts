import { americanToDecimal, type MarketGroup, type OutcomeGroup, type BookPrice } from "./oddsMath";

const BASE_URL = "https://api.the-odds-api.com/v4";

export interface SportConfig {
  key: string;
  title: string;
  markets: string; // comma-separated markets this sport actually supports
}

// Evergreen sport keys that don't rotate (as opposed to tennis/golf tournaments
// below, which change throughout the year and are discovered dynamically).
const STATIC_SPORTS: SportConfig[] = [
  { key: "americanfootball_nfl", title: "NFL", markets: "h2h,spreads,totals" },
  { key: "basketball_nba", title: "NBA", markets: "h2h,spreads,totals" },
  { key: "baseball_mlb", title: "MLB", markets: "h2h,spreads,totals" },
  { key: "icehockey_nhl", title: "NHL", markets: "h2h,spreads,totals" },
  { key: "basketball_wnba", title: "WNBA", markets: "h2h,spreads,totals" },
  { key: "mma_mixed_martial_arts", title: "MMA", markets: "h2h,spreads,totals" },
  { key: "boxing_boxing", title: "Boxing", markets: "h2h" }, // no spreads/totals for boxing
  { key: "soccer_epl", title: "Soccer", markets: "h2h,spreads,totals" },
  { key: "soccer_spain_la_liga", title: "Soccer", markets: "h2h,spreads,totals" },
  { key: "soccer_italy_serie_a", title: "Soccer", markets: "h2h,spreads,totals" },
  { key: "soccer_usa_mls", title: "Soccer", markets: "h2h,spreads,totals" },
  { key: "soccer_fifa_world_cup", title: "Soccer", markets: "h2h,spreads,totals" },
];

// Tennis tournaments and golf events rotate throughout the year (e.g.
// "tennis_atp_wimbledon" only exists while Wimbledon is on), so instead of
// hardcoding keys that go stale, we ask the (free, unbilled) /v4/sports
// endpoint which ones are currently active.
const DYNAMIC_GROUPS: { group: string; title: string; markets: string }[] = [
  { group: "Tennis", title: "Tennis", markets: "h2h,spreads,totals" },
  { group: "Golf", title: "Golf", markets: "outrights" },
];

interface SportsListEntry {
  key: string;
  group: string;
  title: string;
  active: boolean;
  has_outrights: boolean;
}

// This lookup does not consume Odds API quota (confirmed via response
// headers: x-requests-last is 0 for this endpoint).
async function fetchActiveSportsInGroup(group: string, apiKey: string): Promise<SportsListEntry[]> {
  const url = `${BASE_URL}/sports/?apiKey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } }); // tournament calendar barely changes hour to hour
  if (!res.ok) return [];
  const all: SportsListEntry[] = await res.json();
  return all.filter((s) => s.group === group && s.active);
}

export async function getAllSports(apiKey: string): Promise<SportConfig[]> {
  const dynamicLists = await Promise.all(
    DYNAMIC_GROUPS.map(async (dg) => {
      const entries = await fetchActiveSportsInGroup(dg.group, apiKey);
      return entries.map((e): SportConfig => ({ key: e.key, title: dg.title, markets: dg.markets }));
    }),
  );
  return [...STATIC_SPORTS, ...dynamicLists.flat()];
}

// The Odds API bills quota as (markets requested) x (regions requested), and
// treats every 10 bookmakers named via the `bookmakers` param as 1 "region"
// for that formula. Naming an explicit list of <=10 regulated US books (vs.
// requesting regions=us,us2, which is 2 regions and pulls in offshore books
// like Bovada/MyBookie.ag we'd just filter out anyway) cuts quota cost in
// half: 3 markets x 1 region-equivalent = 3 credits/sport instead of 6.
const REGULATED_US_BOOKS = [
  "draftkings",
  "fanduel",
  "betmgm",
  "betrivers",
  "espnbet", // theScore Bet, formerly ESPN Bet
  "ballybet",
  "betparx",
  "hardrockbet",
  "williamhill_us", // Caesars
  "fanatics",
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
  home_team: string | null;
  away_team: string | null;
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

export async function fetchRawEvents(sportKey: string, markets: string, apiKey: string): Promise<RawEvent[]> {
  const url = `${BASE_URL}/sports/${sportKey}/odds?apiKey=${apiKey}&bookmakers=${BOOKMAKERS_PARAM}&markets=${markets}&oddsFormat=american&dateFormat=iso`;

  const res = await fetch(url, {
    // Shared cache across all visitors. Must stay >= the client's poll
    // interval (see Dashboard.tsx) — otherwise every poll forces a fresh,
    // quota-billed upstream call instead of reusing the cache. Short window
    // is affordable on the paid Odds API plan; the old 10-minute window was
    // sized for the free tier's 500/month quota.
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OddsApiError(`The Odds API error (${res.status}): ${body}`, res.status);
  }

  return res.json();
}

const KNOWN_MARKETS = new Set(["h2h", "spreads", "totals", "outrights"]);

// Converts raw API events into MarketGroups: one group per (event, market, point).
// h2h/outrights have no point; spreads/totals are grouped so only identical
// lines are compared. Outright markets (golf) have no home/away team.
export function transformToMarketGroups(events: RawEvent[], sportTitle: string): MarketGroup[] {
  const groups: MarketGroup[] = [];

  for (const event of events) {
    const eventLabel =
      event.home_team && event.away_team ? `${event.away_team} @ ${event.home_team}` : event.sport_title;

    // key: marketKey|point -> outcomeName -> OutcomeGroup
    const byMarket = new Map<string, Map<string, OutcomeGroup>>();

    for (const bookmaker of event.bookmakers) {
      if (!REGULATED_US_BOOKS_SET.has(bookmaker.key)) continue;
      for (const market of bookmaker.markets) {
        if (!KNOWN_MARKETS.has(market.key)) continue;

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
        eventLabel,
        commenceTime: event.commence_time,
        marketKey: marketKey as MarketGroup["marketKey"],
        point: pointKey === "none" ? undefined : Number(pointKey),
        outcomes: Array.from(outcomeMap.values()),
      });
    }
  }

  return groups;
}
