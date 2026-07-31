import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

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
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
    >
      <body suppressHydrationWarning>
        <header className="sticky top-0 z-20 border-b border-border bg-background/86 backdrop-blur-[10px]">
          <div className="mx-auto flex min-h-14 w-[min(1600px,calc(100vw-32px))] items-center justify-between gap-4 sm:w-[min(1600px,calc(100vw-20px))]">
            <Link
              className="flex items-baseline gap-2.5 font-bold tracking-[0.01em] [&_span]:text-muted-foreground"
              href="/"
            >
              Pythia <span>Trading Analyst</span>
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
