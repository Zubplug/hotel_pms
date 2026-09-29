import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { PwaRuntime } from "@/lib/pwa/PwaRuntime";
import { PwaInstallPrompt } from "@/lib/pwa/PwaInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LodgeCore PMS",
  description: "Enterprise Property Management System",
  manifest: "/manifest.webmanifest",
  applicationName: "LodgeCore PMS",
  appleWebApp: { capable: true, title: "LodgeCore PMS", statusBarStyle: "black-translucent" },
  icons: { icon: "/favicon.ico", apple: "/lodgecore-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <PwaRuntime />
          <PwaInstallPrompt />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
