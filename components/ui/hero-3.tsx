"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import PosterCollageBackground from "@/components/PosterCollageBackground";

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

  return (
    <section
      className={cn(
        "relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-black px-4 text-center",
        header
          ? "justify-start pt-24 pb-8 sm:pt-28 md:justify-center md:pt-0 md:pb-0"
          : "justify-center",
        className
      )}
    >
      <PosterCollageBackground images={images} />

      {header && (
        <div className="absolute left-0 right-0 top-0 z-30 bg-gradient-to-b from-black/90 via-black/50 to-transparent px-4 pb-8 pt-4 sm:px-5 sm:pt-5 md:px-10">
          {header}
        </div>
      )}

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center pb-[22vh] md:pb-[34vh]">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fade}
          className="mb-3 inline-block max-w-[min(100%,18rem)] truncate rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm sm:mb-4 sm:max-w-none sm:px-4 sm:py-1.5 sm:text-sm"
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
          className="font-[family-name:var(--font-display)] text-[2.15rem] font-bold leading-[1.1] tracking-tighter text-white sm:text-5xl md:text-7xl"
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
          className="mt-4 max-w-xl px-1 text-base leading-snug text-white/60 sm:mt-6 sm:text-lg"
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
            <div className="mt-5 text-left sm:mt-6">{children}</div>
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
