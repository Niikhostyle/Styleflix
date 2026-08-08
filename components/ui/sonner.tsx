"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts estilo 21st.dev / Sonner, adaptados a la paleta VeoTV.
 */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-center"
      expand
      richColors
      closeButton
      duration={4200}
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-white/12 bg-[#0c1220]/95 text-white shadow-2xl backdrop-blur-xl",
          title: "font-semibold text-white",
          description: "text-white/55",
          actionButton:
            "bg-[linear-gradient(110deg,var(--tv-from),var(--tv-to))] text-[#07111d] font-bold",
          cancelButton: "bg-white/10 text-white",
          success: "!border-teal-300/30 !bg-[#0c1a18]/95",
          error: "!border-red-400/35 !bg-[#1a0c10]/95",
          info: "!border-violet-300/30 !bg-[#120c1c]/95",
          loading: "!border-white/15",
        },
      }}
      {...props}
    />
  );
}
