import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: { default: `Careers | ${siteConfig.companyName}`, template: `%s | ${siteConfig.companyName} Careers` },
  description: `Open positions at ${siteConfig.companyName}, a residential real estate developer in Bengaluru.`,
};

export const viewport: Viewport = { themeColor: "#22504a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
