"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid w-[min(640px,calc(100vw-32px))] gap-4 py-16 text-center">
      <h1 className="m-0 text-xl">Something went wrong</h1>
      <p className="m-0 text-muted-foreground">
        The dashboard hit an unexpected error while loading this page.
      </p>
      <Button className="mx-auto" onClick={() => reset()} type="button">
        Try again
      </Button>
    </main>
  );
}
