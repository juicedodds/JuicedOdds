# Positive Bets

Live +EV and arbitrage dashboard across major US sportsbooks (DraftKings, FanDuel,
Caesars, BetMGM, and more), powered by [The Odds API](https://the-odds-api.com/).

## How it works

- Odds are pulled server-side from The Odds API for NFL, NBA, MLB, and NHL (`h2h`,
  `spreads`, `totals` markets).
- **Fair odds** are computed as a no-vig consensus: each book's own two/three-way
  price is devigged (proportional method), then averaged across every book that
  offers the full outcome set for that market/line. A minimum of 3 contributing
  books is required before a fair price is trusted.
- **+EV bets** are book prices that beat the consensus fair price by at least 1.5%.
- **Arbitrage** opportunities are found by taking the best price per outcome across
  books (only when outcomes come from at least two different books) and checking if
  the combined implied probability is under 100%, with a 0.5% minimum profit filter
  to cut down on noise from stale lines.
- Odds are cached server-side for 45 seconds (`fetch` revalidate) so multiple people
  viewing the dashboard don't multiply API usage.

See [`src/lib/oddsMath.ts`](src/lib/oddsMath.ts) for the calculations and
[`src/lib/oddsApi.ts`](src/lib/oddsApi.ts) for the API integration.

## Local setup

1. Copy `.env.local.example` to `.env.local` and fill in your API key:
   ```
   ODDS_API_KEY=your_key_here
   ```
2. Install dependencies: `npm install`
3. Run the dev server: `npm run dev`
4. Open http://localhost:3000

## Deploying (to share with friends)

Deploy to Vercel: push this repo to GitHub, import it in Vercel, and set the
`ODDS_API_KEY` environment variable in the Vercel project settings. Vercel's shared
edge cache means friends viewing the same dashboard won't each burn a separate API
call — everyone hits the 45-second server cache.

## Important caveats

- **API quota**: The Odds API's free tier is ~500 requests/month. Each dashboard
  load fetches 4 sports; with the 45s cache, real usage depends on how often the
  page is refreshed/reloaded across all viewers. Watch your usage dashboard and
  upgrade your plan if you outgrow the free tier.
- **This is not financial advice.** EV estimates depend on the consensus of books
  queried; they can be wrong, based on stale lines, or reflect low liquidity.
  Always double check the live price on the actual sportsbook before betting.
- **Arbitrage/+EV betting risk**: sportsbooks actively limit or ban accounts that
  consistently show sharp/arbitrage betting patterns. That's a real business risk
  of the strategy itself, independent of this tool.
- Gambling problem? Call or text 1-800-GAMBLER.
