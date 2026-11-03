import type { Metadata } from "next";
import "../../admin/admin.css";
import "../../admin/outreach.css";
export const metadata: Metadata = { title: "Workspace | Website Products", description: "Client websites, service payments and business operations.", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
