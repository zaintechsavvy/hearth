import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Hearth", template: "%s · Hearth" },
  description: "A calm dashboard for your home: climate, cameras, lights, and Matter devices.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1b1b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" data-accent="orange" className={`${geist.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
