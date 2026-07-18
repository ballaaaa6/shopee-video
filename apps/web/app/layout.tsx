import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PocketDock — Oracle Android Control",
  description: "ควบคุม Android บน Oracle Cloud ผ่านเว็บอย่างปลอดภัย",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
