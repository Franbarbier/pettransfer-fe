import type { Metadata } from "next";
import {
  Onest,
  Orbitron,
  Sora,
  Space_Grotesk,
} from "next/font/google";
import "@/styles/globals.css";

const fontOnest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

const fontOrbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const fontSora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const fontSpaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pettransfer",
  description: "Frontend (Next.js)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fontOnest.variable} ${fontOrbitron.variable} ${fontSora.variable} ${fontSpaceGrotesk.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
