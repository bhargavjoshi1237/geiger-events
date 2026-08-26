"use client";

import { AgendaLayout } from "./agenda";
import { AnchoredLayout } from "./anchored";
import { AppShellLayout } from "./appshell";
import { BentoLayout } from "./bento";
import { BoxOfficeLayout } from "./boxoffice";
import { CheckoutLayout } from "./checkout";
import { ClassicLayout } from "./classic";
import { GalleryLayout } from "./gallery";
import { GlassLayout } from "./glass";
import { LandingLayout } from "./landing";
import { MagazineLayout } from "./magazine";
import { MarqueeLayout } from "./marquee";
import { PosterLayout } from "./poster";
import { ShowcaseLayout } from "./showcase";
import { SpotlightLayout } from "./spotlight";
import { SplitLayout } from "./split";
import { StackLayout } from "./stack";
import { ZigzagLayout } from "./zigzag";

const LAYOUTS = {
  classic: ClassicLayout,
  anchored: AnchoredLayout,
  agenda: AgendaLayout,
  appshell: AppShellLayout,
  spotlight: SpotlightLayout,
  split: SplitLayout,
  glass: GlassLayout,
  gallery: GalleryLayout,
  marquee: MarqueeLayout,
  magazine: MagazineLayout,
  poster: PosterLayout,
  showcase: ShowcaseLayout,
  landing: LandingLayout,
  zigzag: ZigzagLayout,
  bento: BentoLayout,
  checkout: CheckoutLayout,
  boxoffice: BoxOfficeLayout,
  stack: StackLayout,
};

export function PageLayout({ layout, ctx }) {
  const Layout = LAYOUTS[layout] || ClassicLayout;
  return <Layout ctx={ctx} />;
}
