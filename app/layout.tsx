import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./public-home.css";
import "./pujaone-v2.css";
import "./pujaone-signature.css";
// Keep the responsive layer last so desktop theme rules can never override
// phone layouts on customer, Pandit, admin, auth or settings screens.
import "./mobile.css";
import { ButtonInteractions } from "@/components/button-interactions";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "PujaOne", template: "%s · PujaOne" },
  description: "Book a verified nearby Pandit for an urgent home Puja.",
  openGraph: {
    title: "PujaOne",
    description: "Verified nearby Pandits for urgent Puja",
    type: "website",
    images: [{ url: "/og.png", width: 1776, height: 887, alt: "PujaOne" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PujaOne" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={geist.variable}><ButtonInteractions />{children}</body></html>;
}
