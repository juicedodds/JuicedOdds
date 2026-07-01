// Sportsbooks don't publish a bet-slip-prefill API for third parties — that
// kind of deep link (specific selection + stake already in the slip) only
// exists for a handful of official affiliate partners with a direct
// integration agreement, which this project doesn't have. These are each
// book's general sportsbook homepage, so at least the destination is one
// click away — the user still has to search for the game once there.
export const BOOK_URLS: Record<string, string> = {
  draftkings: "https://sportsbook.draftkings.com",
  fanduel: "https://www.fanduel.com/sportsbook",
  betmgm: "https://betmgm.com",
  williamhill_us: "https://www.caesars.com/sportsbook-and-casino",
  betrivers: "https://betrivers.com",
  espnbet: "https://sportsbook.thescore.bet",
  ballybet: "https://www.ballybet.com",
  betparx: "https://www.betparx.com",
  hardrockbet: "https://www.hardrock.bet",
  fanatics: "https://betfanatics.com",
};

export function getBookUrl(bookKey: string): string | undefined {
  return BOOK_URLS[bookKey];
}
