import { getPopularCatalogPosters } from "@/lib/catalog";
import PosterCollageBackground from "@/components/PosterCollageBackground";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const posterUrls = await getPopularCatalogPosters(28).catch(
    () => [] as string[]
  );

  return (
    <div className="relative min-h-screen bg-black text-white">
      <PosterCollageBackground images={posterUrls} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
