import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Positive Bets — +EV & Arbitrage Dashboard",
  description: "Live +EV and arbitrage opportunities across major sportsbooks.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
