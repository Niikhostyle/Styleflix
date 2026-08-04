import { Suspense } from "react";
import { notFound } from "next/navigation";
import DetailClient from "@/components/DetailClient";
import {
  getDisplayTitle,
  getMediaDetails,
  getSimilarMedia,
  type MediaType,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

function isMediaType(value: string): value is MediaType {
  return value === "movie" || value === "tv";
}

export async function generateMetadata({ params }: PageProps) {
  const { type, id } = await params;
  if (!isMediaType(type)) return { title: "Naseros" };

  try {
    const details = await getMediaDetails(type, Number(id));
    return {
      title: `${getDisplayTitle(details)} | Naseros`,
      description: details.overview?.slice(0, 160) || "Ver en Naseros",
    };
  } catch {
    return { title: "Naseros" };
  }
}

export default async function TituloPage({ params }: PageProps) {
  const { type, id } = await params;

  if (!isMediaType(type) || Number.isNaN(Number(id))) {
    notFound();
  }

  let details;
  let similar;

  try {
    [details, similar] = await Promise.all([
      getMediaDetails(type, Number(id)),
      getSimilarMedia(type, Number(id)),
    ]);
  } catch {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#141414] text-white">
          Cargando...
        </div>
      }
    >
      <DetailClient details={details} similar={similar} mediaType={type} />
    </Suspense>
  );
}
