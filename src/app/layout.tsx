import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/auth/urls";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "ProBee",
    template: "%s | ProBee",
  },
  description: "ProBee — Premium Digital Store",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
