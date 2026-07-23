import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NetraID — AI Biometric Attendance Platform",
  description: "Enterprise-grade AI face recognition attendance system. 100% open source & self-hosted.",
  authors: [{ name: "NetraID" }],
  keywords: ["face recognition", "attendance", "biometric", "AI", "open source"],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body
        className="antialiased min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
