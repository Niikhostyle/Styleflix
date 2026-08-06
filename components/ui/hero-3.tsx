"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AnimatedMarqueeHeroProps {
  tagline: string;
  title: React.ReactNode;
  description: string;
  /** Texto del CTA si no pasas `children`. */
  ctaText?: string;
  onCtaClick?: () => void;
  images: string[];
  className?: string;
  /** Sustituye el botón CTA (p. ej. formulario de login). */
  children?: React.ReactNode;
  /** Brand / logo arriba a la izquierda. */
  header?: React.ReactNode;
}

const ActionButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    className="mt-8 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-8 py-3 font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60"
  >
    {children}
  </motion.button>
);

export function AnimatedMarqueeHero({
  tagline,
  title,
  description,
  ctaText,
  onCtaClick,
  images,
  className,
  children,
  header,
}: AnimatedMarqueeHeroProps) {
  const FADE_IN_ANIMATION_VARIANTS = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 20 },
    },
  };

  const duplicatedImages =
    images.length > 0 ? [...images, ...images, ...images] : [];

  return (
    <section
      className={cn(
        "relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#050508] px-4 text-center",
        className
      )}
    >
      {header && (
        <div className="absolute left-0 right-0 top-0 z-20 px-5 py-5 md:px-10">
          {header}
        </div>
      )}

      <div className="z-10 flex max-w-3xl flex-col items-center pb-[28vh] md:pb-[32vh]">
        <motion.div
          initial="hidden"
          animate="show"
          variants={FADE_IN_ANIMATION_VARIANTS}
          className="mb-4 inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 backdrop-blur-sm"
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
          className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          {typeof title === "string" ? (
            title.split(" ").map((word, i) => (
              <motion.span
                key={i}
                variants={FADE_IN_ANIMATION_VARIANTS}
                className="inline-block"
              >
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
          variants={FADE_IN_ANIMATION_VARIANTS}
          transition={{ delay: 0.5 }}
          className="mt-5 max-w-xl text-base text-white/60 md:text-lg"
        >
          {description}
        </motion.p>

        <motion.div
          initial="hidden"
          animate="show"
          variants={FADE_IN_ANIMATION_VARIANTS}
          transition={{ delay: 0.6 }}
          className="w-full max-w-md"
        >
          {children ? (
            <div className="mt-8 text-left">{children}</div>
          ) : ctaText ? (
            <ActionButton onClick={onCtaClick}>{ctaText}</ActionButton>
          ) : null}
        </motion.div>
      </div>

      {duplicatedImages.length > 0 && (
        <div className="pointer-events-none absolute bottom-0 left-0 z-[1] h-[32%] w-full [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)] md:h-[38%]">
          <motion.div
            className="flex gap-4"
            animate={{ x: ["0%", "-33.333%"] }}
            transition={{
              ease: "linear",
              duration: 45,
              repeat: Infinity,
            }}
          >
            {duplicatedImages.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="relative aspect-[3/4] h-44 flex-shrink-0 md:h-60"
                style={{
                  rotate: `${index % 2 === 0 ? -2 : 5}deg`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full rounded-2xl object-cover shadow-lg shadow-black/50 ring-1 ring-white/10"
                  loading={index < 8 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </motion.div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/55 via-transparent to-black/75" />
    </section>
  );
}
