import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./mobile.css";
import "./public-home.css";
import { ButtonInteractions } from "@/components/button-interactions";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "PanditConnect", template: "%s · PanditConnect" },
  description: "Book a verified nearby Pandit for an urgent home Puja.",
  openGraph: {
    title: "PanditConnect",
    description: "Verified nearby Pandits for urgent Puja",
    type: "website",
    images: [{ url: "/og.png", width: 1776, height: 887, alt: "PanditConnect" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PanditConnect" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={geist.variable}><ButtonInteractions />{children}</body></html>;
}
