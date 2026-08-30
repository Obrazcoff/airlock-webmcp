import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Airlock — analysis without disclosure",
  description:
    "An analytics workspace where an AI agent does the whole analysis without ever seeing your data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
