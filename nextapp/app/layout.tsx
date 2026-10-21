import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import CookieConsentBanner from "./CookieConsentBanner";
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
  title: "N4JT — Stream and Community",
  description: "Watch N4JT streams, explore point leaderboards, and visit the community shop.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
