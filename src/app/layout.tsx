import type { Metadata } from "next";
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
