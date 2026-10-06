import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProBee",
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
