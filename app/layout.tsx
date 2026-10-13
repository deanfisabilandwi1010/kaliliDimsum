import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { gateBootScript, liteBootScript } from "@/lib/motion/quality-mode";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dimsum by Kalili — Kalili Steam Club",
  description: "Kecil bentuknya. Besar godaannya. Buka kukusannya, jelajahi menu Dimsum by Kalili, dan simpan pilihan yang ingin kamu tanyakan.",
};

export const viewport: Viewport = {
  themeColor: "#891F1F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: liteBootScript + ";" + gateBootScript }} />
        {/* Tanpa JavaScript: gerbang disembunyikan dan halaman tetap bisa digulir. */}
        <noscript>
          <style>{`.gate{display:none!important}html,body{overflow:auto!important}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
