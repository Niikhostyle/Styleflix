import { MessageSquareHeart } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FeedbackClient from "@/components/FeedbackClient";

export const metadata = {
  title: "Feedback | VeoTV",
  description: "Envía dudas, quejas o sugerencias a VeoTV",
};

export default function FeedbackPage() {
  return (
    <div className="app-page">
      <Navbar />
      <main className="relative mx-auto max-w-3xl px-4 pb-20 pt-32 md:px-8 md:pt-36">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 h-64 w-[min(100%,36rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.18),transparent_70%)] blur-2xl"
        />

        <p className="eyebrow mb-2">Comunidad</p>
        <h1 className="flex items-center gap-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
          <MessageSquareHeart className="h-8 w-8 text-teal-300" aria-hidden />
          Feedback
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400 md:text-base">
          Cuéntanos dudas, quejas o sugerencias. Leemos cada mensaje para
          mejorar VeoTV.
        </p>

        <FeedbackClient />
      </main>
      <Footer />
    </div>
  );
}
