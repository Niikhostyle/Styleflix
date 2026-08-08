"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Collage de posters (estilo landing) para fondos full-bleed.
 */
export default function PosterCollageBackground({
  images,
  className,
  animate = true,
}: {
  images: string[];
  className?: string;
  animate?: boolean;
}) {
  if (!images.length) return null;

  const collagePool = Array.from(
    { length: 36 },
    (_, i) => images[i % images.length]!
  );
  const collageRows = [0, 1, 2, 3].map((row) =>
    collagePool.slice(row * 9, row * 9 + 9)
  );

  const rows = collageRows.map((row, rowIndex) => (
    <div
      key={rowIndex}
      className="flex justify-center gap-2 md:gap-3"
      style={{
        transform: `translateX(${rowIndex % 2 === 0 ? "-3%" : "4%"}) rotate(${rowIndex % 2 === 0 ? -1.5 : 1.5}deg)`,
      }}
    >
      {row.map((src, i) => (
        <div
          key={`${rowIndex}-${i}-${src}`}
          className="relative aspect-[2/3] w-[18vw] min-w-[5.5rem] max-w-[9.5rem] flex-shrink-0 overflow-hidden rounded-md md:w-[12vw] md:max-w-[11rem]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover opacity-70"
            loading={rowIndex === 0 && i < 6 ? "eager" : "lazy"}
          />
        </div>
      ))}
    </div>
  ));

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden",
        className
      )}
    >
      {animate ? (
        <motion.div
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1.12 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-[-8%] flex flex-col justify-center gap-2 md:gap-3"
        >
          {rows}
        </motion.div>
      ) : (
        <div className="absolute inset-[-8%] flex scale-[1.12] flex-col justify-center gap-2 md:gap-3">
          {rows}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.92)_100%)]" />
    </div>
  );
}
