export default function Loading() {
  return (
    <div className="app-page">
      <div className="h-16 bg-black/40" />
      <div className="relative h-[70vh] animate-pulse bg-zinc-900">
        <div className="absolute bottom-24 left-4 space-y-3 md:left-12">
          <div className="h-4 w-24 rounded bg-zinc-700" />
          <div className="h-12 w-72 rounded bg-zinc-700 md:w-96" />
          <div className="h-4 w-64 rounded bg-zinc-800" />
          <div className="flex gap-3 pt-2">
            <div className="h-10 w-32 rounded bg-zinc-600" />
            <div className="h-10 w-40 rounded bg-zinc-700" />
          </div>
        </div>
      </div>
      <div className="space-y-8 px-4 py-8 md:px-12">
        {[1, 2, 3].map((row) => (
          <div key={row}>
            <div className="mb-3 h-5 w-48 rounded bg-zinc-800" />
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] w-[110px] shrink-0 rounded bg-zinc-900 md:w-[140px]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
