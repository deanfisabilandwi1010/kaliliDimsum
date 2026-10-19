import { BlackSeriesFeature } from "@/components/BlackSeriesFeature";
import { DimsumAnatomy } from "@/components/DimsumAnatomy";
import { EntryGate } from "@/components/EntryGate";
import { Experience } from "@/components/Experience";
import { HeroStage } from "@/components/HeroStage";
import { KaliliMoments } from "@/components/KaliliMoments";
import { MenuSection } from "@/components/MenuSection";
import { OrderSection } from "@/components/OrderSection";
import { SelectionDrawer } from "@/components/SelectionDrawer";
import { Marquee, SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SteamStory } from "@/components/SteamStory";

export default function Page() {
  return (
    <Experience>
      <a className="skip-link" href="#menu">Langsung ke menu</a>
      <EntryGate />
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <HeroStage />
        <Marquee />
        <DimsumAnatomy />
        <SteamStory />
        <MenuSection />
        <BlackSeriesFeature />
        <KaliliMoments />
        <OrderSection />
      </main>
      <SiteFooter />
      <SelectionDrawer />
    </Experience>
  );
}
