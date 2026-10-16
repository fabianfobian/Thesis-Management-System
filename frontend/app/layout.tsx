import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "PAC University — Thesis Tracking System",
  description:
    "Official thesis and dissertation progress tracker for Pan Africa Christian University.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen flex flex-col bg-pac-cream text-pac-navy font-sans">
        <header className="bg-pac-navy text-white shadow-md">
          <div className="mx-auto max-w-5xl px-6 py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-pac-gold text-pac-navy grid place-items-center font-bold text-lg">
              PAC
            </div>
            <div className="leading-tight">
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
                Pan Africa Christian University
              </p>
              <p className="text-xs text-pac-goldLight tracking-widest uppercase">
                Thesis Tracking System
              </p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-pac-gold via-pac-goldLight to-pac-gold" />
        </header>

        <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10">
          {children}
        </main>

        <footer className="bg-pac-navy text-pac-cream/80 text-sm">
          <div className="mx-auto max-w-5xl px-6 py-6 flex flex-col sm:flex-row justify-between gap-2">
            <p>
              © {new Date().getFullYear()} Pan Africa Christian University. All
              rights reserved.
            </p>
            <p className="text-pac-goldLight">
              Office of Graduate Studies &amp; Research
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}