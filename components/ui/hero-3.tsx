"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AnimatedMarqueeHeroProps {
  tagline: string;
  title: React.ReactNode;
  description: string;
  ctaText?: string;
  /** Si hay CTA de botón: href o onClick. */
  ctaHref?: string;
  onCtaClick?: () => void;
  images: string[];
  className?: string;
  /** Sustituye el botón CTA (p. ej. formulario de login). */
  children?: React.ReactNode;
  header?: React.ReactNode;
}

function ActionButton({
  children,
  onClick,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "brand-button mt-8 inline-flex items-center justify-center rounded-full px-8 py-3 font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-300/50";

  if (href) {
    return (
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Link href={href} className={className}>
          {children}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

export function AnimatedMarqueeHero({
  tagline,
  title,
  description,
  ctaText,
  ctaHref,
  onCtaClick,
  images,
  className,
  children,
  header,
}: AnimatedMarqueeHeroProps) {
  const fade = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 20 },
    },
  };

  const duplicatedImages =
    images.length > 0 ? [...images, ...images, ...images] : [];

  // Rellenar collage de fondo (estilo Netflix) reutilizando posters del catálogo
  const collagePool =
    images.length > 0
      ? Array.from({ length: 36 }, (_, i) => images[i % images.length]!)
      : [];
  const collageRows = [0, 1, 2, 3].map((row) =>
    collagePool.slice(row * 9, row * 9 + 9)
  );

  return (
    <section
      className={cn(
        "relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-black px-4 text-center",
        className
      )}
    >
      {collagePool.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          <motion.div
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1.12 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-[-8%] flex flex-col justify-center gap-2 md:gap-3"
          >
            {collageRows.map((row, rowIndex) => (
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
            ))}
          </motion.div>
          {/* Vignette para legibilidad del texto */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/90" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.92)_100%)]" />
        </div>
      )}

      {header && (
        <div className="absolute left-0 right-0 top-0 z-20 px-5 py-5 md:px-10">
          {header}
        </div>
      )}

      <div className="relative z-10 flex max-w-3xl flex-col items-center pb-[30vh] md:pb-[34vh]">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fade}
          className="mb-4 inline-block rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 backdrop-blur-sm"
        >
          {tagline}
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.1 } },
          }}
          className="font-[family-name:var(--font-display)] text-5xl font-bold tracking-tighter text-white md:text-7xl"
        >
          {typeof title === "string" ? (
            title.split(" ").map((word, i) => (
              <motion.span key={i} variants={fade} className="inline-block">
                {word}&nbsp;
              </motion.span>
            ))
          ) : (
            title
          )}
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="show"
          variants={fade}
          transition={{ delay: 0.5 }}
          className="mt-6 max-w-xl text-lg text-white/60"
        >
          {description}
        </motion.p>

        <motion.div
          initial="hidden"
          animate="show"
          variants={fade}
          transition={{ delay: 0.6 }}
          className={children ? "mt-2 w-full max-w-md" : undefined}
        >
          {children ? (
            <div className="mt-6 text-left">{children}</div>
          ) : ctaText ? (
            <ActionButton href={ctaHref} onClick={onCtaClick}>
              {ctaText}
            </ActionButton>
          ) : null}
        </motion.div>
      </div>

      {duplicatedImages.length > 0 && (
        <div className="pointer-events-none absolute bottom-0 left-0 z-[1] h-1/3 w-full [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)] md:h-2/5">
          <motion.div
            className="flex gap-4"
            animate={{ x: ["0%", "-33.333%"] }}
            transition={{
              ease: "linear",
              duration: 40,
              repeat: Infinity,
            }}
          >
            {duplicatedImages.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="relative aspect-[3/4] h-48 flex-shrink-0 md:h-64"
                style={{
                  rotate: `${index % 2 === 0 ? -2 : 5}deg`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full rounded-2xl object-cover shadow-md"
                  loading={index < 8 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </motion.div>
        </div>
      )}
    </section>
  );
}
