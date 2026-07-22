import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://peach-patch-studio.amamiya-miu.chatgpt.site"),
  title: "Peach Patch — Rack-compatible modular runtime",
  description: "An independent browser runtime for open-source Rack modules, WebAssembly DSP, patch cables, and .vcv patch files.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title: "Peach Patch", description: "Rack-compatible WebAssembly modular runtime.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
