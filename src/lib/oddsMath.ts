// Core odds math: American<->decimal conversion, no-vig fair-probability
// devigging, +EV detection, and arbitrage detection.

export function americanToDecimal(american: number): number {
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

export function impliedProbFromDecimal(decimal: number): number {
  return 1 / decimal;
}

// Proportional (multiplicative) devig: scales each outcome's raw implied
// probability down so the set sums to 1. Simple, standard, and doesn't
// require knowing the book's specific vig-distribution model.
export function devig(rawProbs: number[]): number[] {
  const sum = rawProbs.reduce((a, b) => a + b, 0);
  if (sum <= 0) return rawProbs.map(() => 0);
  return rawProbs.map((p) => p / sum);
}

export interface BookPrice {
  bookKey: string;
  bookTitle: string;
  american: number;
  decimal: number;
  lastUpdate?: string;
}

export interface OutcomeGroup {
  name: string; // e.g. team name, "Over", "Under"
  point?: number; // spread/total line, undefined for h2h
  prices: BookPrice[]; // one entry per book offering this outcome
}

export interface MarketGroup {
  eventId: string;
  sportKey: string;
  sportTitle: string;
  // Human-readable event descriptor: "Away @ Home" for matchup sports, or
  // the tournament name for outright/futures markets (golf) which have no
  // home/away teams.
  eventLabel: string;
  commenceTime: string;
  marketKey: "h2h" | "spreads" | "totals" | "outrights";
  point?: number; // shared line for spreads/totals groups
  outcomes: OutcomeGroup[];
}

export interface FairOutcome {
  name: string;
  point?: number;
  fairProb: number;
  fairDecimal: number;
  fairAmerican: number;
  booksUsed: number;
}

// For each book that offers a complete set of outcomes in this market group,
// devig that book's own prices, then average per-outcome across books.
export function computeConsensusFairOdds(group: MarketGroup): FairOutcome[] {
  const bookKeys = new Set(group.outcomes.flatMap((o) => o.prices.map((p) => p.bookKey)));

  const perBookFair: Record<string, number[]> = {}; // bookKey -> fair prob per outcome index
  for (const bookKey of bookKeys) {
    const rawPrices = group.outcomes.map((o) => o.prices.find((p) => p.bookKey === bookKey));
    if (rawPrices.some((p) => !p)) continue; // incomplete set for this book, skip
    const rawProbs = rawPrices.map((p) => impliedProbFromDecimal(p!.decimal));
    perBookFair[bookKey] = devig(rawProbs);
  }

  const contributingBooks = Object.keys(perBookFair);

  return group.outcomes.map((o, idx) => {
    const probs = contributingBooks.map((bk) => perBookFair[bk][idx]);
    const avg = probs.length > 0 ? probs.reduce((a, b) => a + b, 0) / probs.length : NaN;
    const fairDecimal = 1 / avg;
    return {
      name: o.name,
      point: o.point,
      fairProb: avg,
      fairDecimal,
      fairAmerican: isFinite(fairDecimal) ? decimalToAmerican(fairDecimal) : NaN,
      booksUsed: contributingBooks.length,
    };
  });
}

export interface PlusEvBet {
  eventId: string;
  sportTitle: string;
  matchup: string;
  commenceTime: string;
  marketKey: string;
  point?: number;
  selection: string;
  bookKey: string;
  bookTitle: string;
  offeredAmerican: number;
  offeredDecimal: number;
  fairAmerican: number;
  fairProb: number;
  evPct: number;
  booksUsedForFair: number;
  needsVerification: boolean;
}

const MIN_BOOKS_FOR_FAIR = 3; // need enough books to trust the consensus
const MIN_EV_PCT = 1.5; // filter noise below this threshold
// Real cross-book +EV on liquid lines is typically low single digits to
// low teens. Above this, it's overwhelmingly more likely to be a stale or
// thinly-traded alternate line than genuine edge, so we drop it rather than
// send the user chasing a number the book won't actually honor.
const MAX_EV_PCT_SANITY = 25;
// Below this, still flagged in the UI for extra caution before betting.
export const EV_CAUTION_THRESHOLD_PCT = 12;

export function findPlusEvBets(groups: MarketGroup[]): PlusEvBet[] {
  const results: PlusEvBet[] = [];

  for (const group of groups) {
    const fair = computeConsensusFairOdds(group);

    group.outcomes.forEach((outcome, idx) => {
      const f = fair[idx];
      if (!f || f.booksUsed < MIN_BOOKS_FOR_FAIR || !isFinite(f.fairProb)) return;

      for (const price of outcome.prices) {
        const evPct = (price.decimal * f.fairProb - 1) * 100;
        if (evPct >= MIN_EV_PCT && evPct <= MAX_EV_PCT_SANITY) {
          results.push({
            eventId: group.eventId,
            sportTitle: group.sportTitle,
            matchup: group.eventLabel,
            commenceTime: group.commenceTime,
            marketKey: group.marketKey,
            point: outcome.point,
            selection: outcome.name,
            bookKey: price.bookKey,
            bookTitle: price.bookTitle,
            offeredAmerican: price.american,
            offeredDecimal: price.decimal,
            fairAmerican: f.fairAmerican,
            fairProb: f.fairProb,
            evPct,
            booksUsedForFair: f.booksUsed,
            needsVerification: evPct >= EV_CAUTION_THRESHOLD_PCT,
          });
        }
      }
    });
  }

  return results.sort((a, b) => b.evPct - a.evPct);
}

export interface ArbitrageLeg {
  selection: string;
  point?: number;
  bookKey: string;
  bookTitle: string;
  american: number;
  decimal: number;
  impliedProb: number;
  stakePct: number; // % of total stake to place on this leg
}

export interface ArbitrageOpportunity {
  eventId: string;
  sportTitle: string;
  matchup: string;
  commenceTime: string;
  marketKey: string;
  point?: number;
  legs: ArbitrageLeg[];
  profitPct: number;
}

const MIN_ARB_PROFIT_PCT = 0.5; // filter noise / stale-line false positives
// Real cross-book arbitrage on liquid lines is almost always under ~8%.
// Bigger gaps are overwhelmingly a stale/suspended price or a barely-traded
// alternate line that won't actually accept real stakes at that price by the
// time you get both bets down — so they're excluded rather than shown as
// "guaranteed profit."
const MAX_ARB_PROFIT_PCT_SANITY = 15;

export function findArbitrageOpportunities(groups: MarketGroup[]): ArbitrageOpportunity[] {
  const results: ArbitrageOpportunity[] = [];

  for (const group of groups) {
    // Outright/futures markets (e.g. golf tournament winner) can have 100+
    // outcomes — "arbitrage" would require covering every single one, which
    // isn't a realistic bet pattern and isn't what this feature means here.
    if (group.marketKey === "outrights") continue;
    if (group.outcomes.length < 2) continue;
    if (group.outcomes.some((o) => o.prices.length === 0)) continue;

    // Best (highest decimal) price per outcome, from potentially different books.
    const bestLegs = group.outcomes.map((o) => {
      const best = o.prices.reduce((a, b) => (b.decimal > a.decimal ? b : a));
      return { outcome: o, best };
    });

    const impliedSum = bestLegs.reduce((sum, l) => sum + impliedProbFromDecimal(l.best.decimal), 0);
    if (impliedSum >= 1) continue; // no arb

    // Must come from at least two different books to be a real cross-book arb.
    const distinctBooks = new Set(bestLegs.map((l) => l.best.bookKey));
    if (distinctBooks.size < 2) continue;

    const profitPct = (1 / impliedSum - 1) * 100;
    if (profitPct < MIN_ARB_PROFIT_PCT || profitPct > MAX_ARB_PROFIT_PCT_SANITY) continue;

    const legs: ArbitrageLeg[] = bestLegs.map((l) => {
      const ip = impliedProbFromDecimal(l.best.decimal);
      return {
        selection: l.outcome.name,
        point: l.outcome.point,
        bookKey: l.best.bookKey,
        bookTitle: l.best.bookTitle,
        american: l.best.american,
        decimal: l.best.decimal,
        impliedProb: ip,
        stakePct: (ip / impliedSum) * 100,
      };
    });

    results.push({
      eventId: group.eventId,
      sportTitle: group.sportTitle,
      matchup: group.eventLabel,
      commenceTime: group.commenceTime,
      marketKey: group.marketKey,
      point: group.outcomes[0]?.point,
      legs,
      profitPct,
    });
  }

  return results.sort((a, b) => b.profitPct - a.profitPct);
}
