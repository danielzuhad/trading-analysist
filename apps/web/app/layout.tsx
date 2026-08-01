import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Geist } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { Toaster } from "@/components/ui/sonner";
import { logoutAction } from "@/lib/auth-actions";
import { getSessionEmail, getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Pythia — Trading Analyst",
  description:
    "Crypto decision-support dashboard: watchlist ranking, AI analysis, and alerts.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionToken = await getSessionToken();
  const sessionEmail = await getSessionEmail();

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
            {sessionToken ? (
              <div className="flex items-center gap-3">
                <SiteNav />
                <div className="flex items-center gap-2 border-l border-border pl-3">
                  {sessionEmail ? (
                    <span className="text-[0.8rem] text-muted-foreground">
                      {sessionEmail}
                    </span>
                  ) : null}
                  <form action={logoutAction}>
                    <button
                      className="cursor-pointer rounded-full border border-border bg-transparent px-3 py-1 text-[0.8rem] text-muted-foreground hover:border-down/40 hover:text-down"
                      type="submit"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
        </header>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
