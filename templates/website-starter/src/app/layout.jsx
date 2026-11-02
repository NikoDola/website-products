import site from "../content/site.json";
import "../styles/globals.css";
export const metadata = { title: site.name, description: site.description };
export default function Layout({children}) { return <html lang="en"><body>{children}</body></html>; }
