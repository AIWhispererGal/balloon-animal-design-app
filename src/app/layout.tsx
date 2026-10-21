import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwistCraft Studio - AI Balloon Twister CAD & Synthesizer",
  description:
    "Convert any item or image into 3 adjustable balloon twister versions (Beginner, Intermediate, Advanced) using standard 160, 260, and 360 balloons with realistic 3D latex rendering, tail physics, and step instructions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
