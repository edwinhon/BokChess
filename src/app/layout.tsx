import type { Metadata } from "next";
import "./globals.css";
import PlayerProvider from "@/components/PlayerProvider";

export const metadata: Metadata = {
  title: "BokChess — Chinese Chess (象棋)",
  description: "Play Chinese Chess online with AI or multiplayer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PlayerProvider>{children}</PlayerProvider>
      </body>
    </html>
  );
}
