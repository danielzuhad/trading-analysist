import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pythia — Trading Analyst",
  description:
    "Crypto decision-support dashboard: watchlist ranking, AI analysis, and alerts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <header className="topbar">
          <div className="topbar__inner">
            <Link className="topbar__brand" href="/">
              Pythia <span>Trading Analyst</span>
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
