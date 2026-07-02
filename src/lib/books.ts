// Single source of truth for the regulated US sportsbooks this app pulls
// odds from. Shared between the server (oddsApi.ts, to build the Odds API
// `bookmakers` param) and the client (book filter checkboxes, "Bet" links).
export interface Book {
  key: string;
  title: string;
  // Sportsbooks don't publish a bet-slip-prefill API for third parties —
  // that kind of deep link (specific selection + stake already in the slip)
  // only exists for official affiliate partners with a direct integration
  // agreement, which this project doesn't have. These are each book's
  // general sportsbook homepage, so at least the destination is one click
  // away — the user still has to search for the game once there.
  url: string;
}

export const BOOKS: Book[] = [
  { key: "draftkings", title: "DraftKings", url: "https://sportsbook.draftkings.com" },
  { key: "fanduel", title: "FanDuel", url: "https://www.fanduel.com/sportsbook" },
  { key: "betmgm", title: "BetMGM", url: "https://betmgm.com" },
  { key: "williamhill_us", title: "Caesars", url: "https://www.caesars.com/sportsbook-and-casino" },
  { key: "betrivers", title: "BetRivers", url: "https://betrivers.com" },
  { key: "espnbet", title: "theScore Bet", url: "https://sportsbook.thescore.bet" },
  { key: "ballybet", title: "Bally Bet", url: "https://www.ballybet.com" },
  { key: "betparx", title: "betPARX", url: "https://www.betparx.com" },
  { key: "hardrockbet", title: "Hard Rock Bet", url: "https://www.hardrock.bet" },
  { key: "fanatics", title: "Fanatics", url: "https://betfanatics.com" },
];

export function getBookUrl(bookKey: string): string | undefined {
  return BOOKS.find((b) => b.key === bookKey)?.url;
}
