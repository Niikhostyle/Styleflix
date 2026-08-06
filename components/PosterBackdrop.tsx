const POSTER_SEEDS = [
  "/t/p/w342/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
  "/t/p/w342/qNBAXBIQlnOThrvrvHzXXrh2tQsY.jpg",
  "/t/p/w342/d5NXSklXo0qyIYkgV94aAgLgVYN.jpg",
  "/t/p/w342/62HCnUTziyWcpDaBO2i1DX17ljH.jpg",
  "/t/p/w342/1E5baAaEse26fej7uHcjOgEE2t2.jpg",
  "/t/p/w342/rktDFPBFUhFhEb5AEHKk6m8ZYnS.jpg",
  "/t/p/w342/7WsyChQLEftFiDOVTGkv3hFvsB8.jpg",
  "/t/p/w342/9Gtg2DzBhmYcPBp1aS8usIw9fXJ.jpg",
  "/t/p/w342/5YZbUmjbMa3CltaOm1LFUW5Zzpk.jpg",
  "/t/p/w342/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg",
  "/t/p/w342/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
  "/t/p/w342/qhb1HQCBp7uBes6yeYvU1G6lZWn.jpg",
];

function resolvePaths(posterPaths: string[]) {
  if (posterPaths.length >= 8) return posterPaths.slice(0, 18);
  return POSTER_SEEDS.map((p) => `https://image.tmdb.org${p}`);
}

/** Muro de posters populares + overlay oscuro (landing / login). */
export default function PosterBackdrop({
  posterPaths = [],
}: {
  posterPaths?: string[];
}) {
  const paths = resolvePaths(posterPaths);

  return (
    <>
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-1 opacity-40 sm:grid-cols-4 md:grid-cols-6">
        {paths.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="aspect-[2/3] overflow-hidden"
            style={{
              animation: `posterWallFade 12s ease-in-out ${i * 0.15}s infinite alternate`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                src.startsWith("http")
                  ? src
                  : `https://image.tmdb.org/t/p/w342${src}`
              }
              alt=""
              className="h-full w-full object-cover"
              loading={i < 6 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/80 to-[#050508]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,8,0.55)_70%)]" />
      <style jsx>{`
        @keyframes posterWallFade {
          from {
            transform: scale(1);
            filter: brightness(0.75);
          }
          to {
            transform: scale(1.04);
            filter: brightness(0.95);
          }
        }
      `}</style>
    </>
  );
}
