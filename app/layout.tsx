import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://peach-patch-studio.amamiya-miu.chatgpt.site"),
  title: "Web Rack — Browser Modular Synthesizer",
  description: "A tactile browser-based virtual Eurorack with free module placement, patch cables, Web Audio, and patch files.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Web Rack — Browser Modular Synthesizer",
    description: "Patch modules freely in your browser.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Web Rack modular synthesizer" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
