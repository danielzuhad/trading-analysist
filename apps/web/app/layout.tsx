import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Analyst",
  description: "Sprint 1 foundation for the trading analyst platform.",
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
