import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CityBites.AI — Générateur d'itinéraires",
  description: "Compose un mini-guide gourmand à partir des services mocks CityBites.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
