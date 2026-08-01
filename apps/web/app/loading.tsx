const SKELETON_CARD_KEYS = [
  "card-1",
  "card-2",
  "card-3",
  "card-4",
  "card-5",
  "card-6",
];

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-sm bg-secondary ${className}`} />
  );
}

export default function HomeLoading() {
  return (
    <main className="mx-auto grid w-[min(1600px,calc(100vw-32px))] gap-6 py-6 pb-18 sm:w-[min(100vw-20px,1600px)] sm:py-4 sm:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <SkeletonBlock className="h-7 w-32" />
        <SkeletonBlock className="h-8 w-48" />
      </div>

      <SkeletonBlock className="h-10 w-full" />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
          {SKELETON_CARD_KEYS.map((cardKey) => (
            <div
              key={cardKey}
              className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5"
            >
              <div className="flex items-center gap-2.5">
                <SkeletonBlock className="h-8.5 w-8.5 rounded-full" />
                <SkeletonBlock className="h-5 w-16" />
              </div>
              <SkeletonBlock className="h-8 w-28" />
              <SkeletonBlock className="h-1.5 w-full rounded-full" />
              <SkeletonBlock className="h-1.5 w-full rounded-full" />
              <SkeletonBlock className="h-12 w-full" />
            </div>
          ))}
        </div>

        <div className="grid gap-3.5">
          <SkeletonBlock className="h-40 w-full" />
          <SkeletonBlock className="h-56 w-full" />
        </div>
      </div>
    </main>
  );
}
