import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import GoogleAdSense from "@/components/GoogleAdSense";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "StyleFlix",
    template: "%s | StyleFlix",
  },
  description:
    "StyleFlix — películas, series y animes. Tu plataforma de streaming.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#141414] text-white antialiased">
        <GoogleAdSense />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
