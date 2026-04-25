import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Analyst",
  description: "Crypto watchlist dashboard with 1H and 4H read views.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
