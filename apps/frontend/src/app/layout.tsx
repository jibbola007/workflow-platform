import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simply Workflow",
  description: "Simple Agile workflow management for teams"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
