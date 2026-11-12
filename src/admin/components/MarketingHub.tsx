"use client";
import Marketing from "./Marketing";
import NewClients from "./NewClients";
import ReferralProgram from "./ReferralProgram";

export default function MarketingHub({ today, section, navigate }: { today: string; section: string; navigate: (section: "current" | "new" | "referrals") => void }) {
  return <div><nav className="marketing-section-tabs" aria-label="Marketing sections">
    <button className={section === "current" ? "primary" : "secondary"} aria-current={section === "current" ? "page" : undefined} onClick={() => navigate("current")}>Current Clients</button>
    <button className={section === "new" ? "primary" : "secondary"} aria-current={section === "new" ? "page" : undefined} onClick={() => navigate("new")}>New Clients</button>
    <button className={section === "referrals" ? "primary" : "secondary"} aria-current={section === "referrals" ? "page" : undefined} onClick={() => navigate("referrals")}>Referral Program</button>
  </nav>{section === "current" ? <><p className="marketing-section-note">Your historical Marketing directory. These contacts remain separate from the Clients database.</p><Marketing today={today} /></> : section === "new" ? <NewClients /> : <ReferralProgram />}</div>;
}
