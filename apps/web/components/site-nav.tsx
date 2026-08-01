"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Watchlist" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/track-record", label: "Track Record" },
] as const;

const adminNavItems = [
  { href: "/admin/decisions", label: "Decision History" },
] as const;

export function SiteNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <nav className="flex items-center gap-1" aria-label="Main navigation">
      {items.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-muted-foreground transition-colors hover:text-foreground",
              isActive && "bg-secondary text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
