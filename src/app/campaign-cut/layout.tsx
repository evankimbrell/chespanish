import type { Metadata } from "next";
import { Karla, Young_Serif } from "next/font/google";
import { CampaignCutFooter } from "@/components/campaign-cut/footer";
import { CampaignCutNav } from "@/components/campaign-cut/nav";
import "./campaign-cut.css";

const youngSerif = Young_Serif({
  variable: "--font-young-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Campaign Cut",
    template: "%s · Campaign Cut",
  },
  description:
    "Send us your session audio. We’ll turn it into a real podcast — edited, scored, and archived — for you, your party, and whoever you want to share it with.",
};

export default function CampaignCutLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${youngSerif.variable} ${karla.variable} cc-root`}>
      <CampaignCutNav />
      <main>{children}</main>
      <CampaignCutFooter />
    </div>
  );
}
