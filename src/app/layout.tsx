import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";

const primarySans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const codeFont = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NRI Law Buddy | Concierge legal stack for NRIs",
  description:
    "Modern control room for NRI legal matters spanning property, family law, escrow, and document intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${primarySans.variable} ${codeFont.variable} min-h-screen bg-[#f8fafc] text-slate-900 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
