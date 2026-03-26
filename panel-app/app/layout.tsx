import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visli Panel",
  description: "SaaS Admin Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-[#f8f9fc]">{children}</body>
    </html>
  );
}
