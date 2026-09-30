import type { Metadata } from "next";
import { Inter, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://getlodgecore.vercel.app"),
  title: { default: "LodgeCore | The operating system for modern hotels", template: "%s | LodgeCore" },
  description: "A connected hotel platform for property management, POS, booking, finance, operations and hardware.",
  openGraph: { type: "website", siteName: "LodgeCore", title: "The operating system for modern hotels", description: "Run every part of your hotel from one connected platform." },
  robots: { index: true, follow: true },
};

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
