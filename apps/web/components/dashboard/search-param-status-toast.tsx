"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

type SearchParamStatusToastProps = {
  message: string | undefined;
  paramName: string;
  tone: "success" | "error" | "muted";
};

/**
 * Server actions that redirect back to the current page with a one-time
 * status query param (see buildPositionRedirectPath and
 * removeFromWatchlistAndRedirectAction) render that result as a toast here,
 * then strip the param from the URL so it doesn't replay on refresh or
 * back-navigation.
 */
export function SearchParamStatusToast({
  message,
  paramName,
  tone,
}: SearchParamStatusToastProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Intentionally runs once per mount, for the status carried in the
  // initial URL — depending on searchParams/paramName/router/pathname would
  // re-fire this after the replace() below changes the URL.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per mount, see comment above
  useEffect(() => {
    if (!message) {
      return;
    }

    if (tone === "error") {
      toast.error(message);
    } else {
      toast.success(message);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(paramName);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, []);

  return null;
}
