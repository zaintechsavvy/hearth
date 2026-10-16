import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import Script from "next/script";
import { ServiceWorker } from "@/components/shell/service-worker";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const SITE = process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
const DESCRIPTION = "A calm dashboard for your home: lights, locks, climate, and cameras from Home Assistant and Matter, on any screen.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Hearth", template: "%s · Hearth" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "Hearth", title: "Hearth", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "Hearth", description: DESCRIPTION },
  icons: { icon: "/icon.svg", apple: "/icons/icon-180.png" },
  appleWebApp: { capable: true, title: "Hearth", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1b1b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" data-accent="neutral" data-wallpaper="studio" className={`${geist.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">{THEME_BOOTSTRAP}</Script>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
