import type { Metadata } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://getlodgecore.vercel.app"),
  title: { default: "LodgeCore | The operating system for modern hotels", template: "%s | LodgeCore" },
  description: "A connected hotel platform for property management, POS, booking, finance, operations and hardware.",
  openGraph: { type: "website", siteName: "LodgeCore", title: "The operating system for modern hotels", description: "Run every part of your hotel from one connected platform." },
  robots: { index: true, follow: true },
};

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
