import type { Metadata } from "next";
import { pocMode } from "@/lib/auth-mode";
import { PocBanner } from "@/components/poc-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "D2OS Care Tracker",
    template: "%s · D2OS Care Tracker",
  },
  description:
    "WWT Day 2 Operations customer escalation tracking — 3-Tier Care Model",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* Bottom padding keeps the fixed POC banner from covering content. */}
      <body className={pocMode() ? "min-h-full pb-9" : "min-h-full"}>
        {children}
        <PocBanner />
      </body>
    </html>
  );
}
