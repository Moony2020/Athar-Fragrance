import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, Cinzel_Decorative } from "next/font/google";
import "@/styles/globals.css";

const displayFont = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["300","400","500","600","700"], display: "swap" });
const uiFont = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const logoFont = Cinzel_Decorative({ variable: "--font-logo", subsets: ["latin"], weight: ["400","700","900"], display: "swap" });

export const metadata: Metadata = {
  title: "ATHAR — Haute Parfumerie",
  description: "A premium fragrance experience.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${uiFont.variable} ${logoFont.variable}`} data-scroll-behavior="smooth">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
