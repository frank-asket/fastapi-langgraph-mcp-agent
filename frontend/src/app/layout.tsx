import type { Metadata } from "next";
import { Syne, Figtree } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Study Coach — AI tutoring for African education",
  description:
    "Vertical AI platform for African education — personalized tutoring, document intelligence, and study coaching.",
  icons: {
    icon: "/images/landing/kifinal.png",
    apple: "/images/landing/kifinal.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const tree = (
    <html lang="en">
      <body className={`${syne.variable} ${figtree.variable} antialiased`}>{children}</body>
    </html>
  );

  if (clerkPk) {
    return <ClerkProvider>{tree}</ClerkProvider>;
  }
  return tree;
}
