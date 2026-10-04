import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
import BackLink from "./back-link";
import { StoreProvider } from "@/lib/store";

// Inter for UI and body; Newsreader is an open serif standing in for the licensed serif used on thedatecrew.com.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Preference check · The Date Crew prototype",
  description: "Prototype: check profiles against client preferences before sending, and learn from every rejection. Synthetic data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="brand">
              <span className="name">The Date Crew</span>
              <span className="sub">Preference check</span>
            </Link>
            <BackLink />
          </div>
        </header>
        <div className="banner">Prototype · synthetic data · no messages are sent</div>
        <StoreProvider>
          <main className="wrap">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
