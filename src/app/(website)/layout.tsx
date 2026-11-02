import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "@/website/website.css";

const bodyFont = DM_Sans({ subsets: ["latin"], display: "optional", preload: true, variable: "--font-dm-sans" });
const headingFont = Manrope({ subsets: ["latin", "cyrillic"], display: "optional", preload: true, variable: "--font-manrope" });
// Separate root layouts keep workspace styles and errors out of the public site.
// HomeShell sets the selected document language after hydration, as before.
export const metadata: Metadata = { robots: { index: true, follow: true } };
export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${bodyFont.variable} ${headingFont.variable}`}><body>{children}</body></html>;
}
