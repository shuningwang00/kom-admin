import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import SWRProvider from "@/components/swr-provider";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KOM Billing",
  description: "Knockout Math admin — students, classes, billing",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-zinc-100 font-sans text-zinc-900 antialiased">
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}
