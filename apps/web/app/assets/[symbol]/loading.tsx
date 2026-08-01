function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-sm bg-secondary ${className}`} />
  );
}

export default function AssetDetailLoading() {
  return (
    <main className="mx-auto grid w-[min(1600px,calc(100vw-32px))] gap-6 py-6 pb-18 sm:w-[min(100vw-20px,1600px)] sm:py-4 sm:pb-12">
      <div className="grid gap-3.5">
        <SkeletonBlock className="h-4 w-24" />
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-10 w-10 rounded-full" />
          <SkeletonBlock className="h-7 w-20" />
          <SkeletonBlock className="h-5 w-32" />
        </div>
        <SkeletonBlock className="h-9 w-40" />
      </div>

      <SkeletonBlock className="h-64 w-full rounded-(--radius)" />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-1">
        <SkeletonBlock className="h-48 w-full rounded-(--radius)" />
        <SkeletonBlock className="h-48 w-full rounded-(--radius)" />
        <SkeletonBlock className="h-48 w-full rounded-(--radius)" />
        <SkeletonBlock className="h-48 w-full rounded-(--radius)" />
      </div>
    </main>
  );
}
