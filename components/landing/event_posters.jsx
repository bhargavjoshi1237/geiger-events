// Coded event-poster art for the landing page's scattered field. Pure gradients
// and type — no image assets, so the field costs nothing to load and stays on
// palette. Each poster fills its square tile; the field owns size and placement.

import { cn } from "@/lib/utils";

// Shared ground: a square with the poster's gradient and centred content.
function Sheet({ className, style, children }) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center overflow-hidden p-[8%] text-center leading-none",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

// A faint dot grid, used by the technical posters to suggest a plotted floor.
function DotGrid({ className }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
        backgroundSize: "10px 10px",
      }}
    />
  );
}

function PokerNight() {
  return (
    <Sheet className="relative bg-[linear-gradient(150deg,#0f3d2e,#07231a_60%,#041610)] text-emerald-50">
      <span className="font-serif text-[16%] italic text-emerald-200/90">Poker</span>
      <span className="mt-[3%] text-[19%] font-black tracking-[0.18em]">NIGHT</span>
      <span className="mt-[8%] text-[13%] tracking-[0.35em] text-emerald-300/70">
        ♠ ♥ ♦ ♣
      </span>
    </Sheet>
  );
}

function DinnerParty() {
  return (
    <Sheet className="bg-[linear-gradient(160deg,#3b2412,#1c1108)] text-amber-100">
      <span className="text-[9%] font-semibold tracking-[0.3em] text-amber-200/70">
        GOOD FRIENDS
      </span>
      <span className="mt-[6%] text-[21%] font-black leading-[0.9] text-amber-300">
        DINNER
        <br />
        PARTY
      </span>
      <span className="mt-[6%] text-[9%] font-semibold tracking-[0.3em] text-amber-200/70">
        GOOD FOOD
      </span>
    </Sheet>
  );
}

function Brunch() {
  return (
    <Sheet className="bg-[linear-gradient(150deg,#f6d7c4,#e8a882)] text-[#7a2e18]">
      <span className="text-[10%] font-medium tracking-[0.2em]">LET&apos;S HAVE A</span>
      <span className="mt-[2%] font-serif text-[26%] italic font-bold">Brunch</span>
      <span className="mt-[6%] text-[9%] font-medium">Good food &amp; friends</span>
    </Sheet>
  );
}

function BeachParty() {
  return (
    <Sheet className="bg-[linear-gradient(#2f7ed8,#7fc4e8_38%,#f2a6b8_68%,#f7cf9a)] justify-between text-white">
      <span className="text-[9%] font-semibold tracking-[0.25em] text-white/80">
        AUGUST 15
      </span>
      <div>
        <span className="block text-[19%] font-black leading-[0.95]">
          BEACH
          <br />
          PARTY
        </span>
        <span className="mt-[4%] block text-[8%] font-medium tracking-[0.2em] text-white/85">
          DJ SET · LIGHT SHOW
        </span>
      </div>
      <span className="text-[15%] font-black tracking-[0.05em] text-[#1d2b3a]">
        SUMMER26
      </span>
    </Sheet>
  );
}

function LetsRun() {
  return (
    <Sheet className="bg-[linear-gradient(200deg,#b6f05a,#6fbf1f_55%,#3d7a10)] text-[#12250a]">
      <span className="text-[24%] font-black italic leading-[0.9]">
        LET&apos;S
        <br />
        RUN
      </span>
      <span className="mt-[7%] text-[8%] font-bold tracking-[0.3em]">
        EVERY SATURDAY · 7AM
      </span>
    </Sheet>
  );
}

function PitchYourIdea() {
  return (
    <Sheet className="bg-[linear-gradient(150deg,#ffe066,#ffb703)] text-[#3d2600]">
      <span className="text-[20%] font-black leading-[0.95]">
        PITCH
        <br />
        YOUR
        <br />
        IDEA
      </span>
      <span className="mt-[6%] text-[8%] font-bold tracking-[0.25em]">
        5 MIN · NO SLIDES
      </span>
    </Sheet>
  );
}

function HackNight() {
  return (
    <Sheet className="relative bg-[linear-gradient(160deg,#101a3a,#060b1c)] text-sky-200">
      <DotGrid className="text-sky-400/25" />
      <span className="relative text-[19%] font-black tracking-[0.1em] text-sky-100">
        HACK
        <br />
        NIGHT
      </span>
      <span className="relative mt-[7%] text-[8%] font-semibold tracking-[0.25em] text-sky-300/80">
        BUILD · SHIP · DEMO
      </span>
    </Sheet>
  );
}

function CocktailHour() {
  return (
    <Sheet className="bg-[linear-gradient(165deg,#1c1710,#0a0806)] text-[#e2c584]">
      <span className="font-serif text-[19%] italic">Cocktail</span>
      <span className="font-serif text-[19%] italic">Hour</span>
      <span className="mt-[9%] text-[8%] font-medium tracking-[0.4em] text-[#e2c584]/60">
        6 — 9 PM
      </span>
    </Sheet>
  );
}

function Birthday() {
  return (
    <Sheet className="bg-[linear-gradient(150deg,#2a2320,#0d0b0a)] text-amber-50">
      <span className="font-serif text-[17%] italic leading-[1.1]">
        it&apos;s my
        <br />
        birthday
      </span>
      <span className="mt-[8%] text-[8%] font-semibold tracking-[0.3em] text-amber-200/70">
        LET&apos;S CELEBRATE
      </span>
    </Sheet>
  );
}

function BBQ() {
  return (
    <Sheet className="bg-[linear-gradient(150deg,#f0e2c8,#dcc59c)] text-[#a52a1e]">
      <span className="text-[9%] font-bold tracking-[0.25em]">IT&apos;S THE</span>
      <span className="mt-[2%] text-[34%] font-black leading-[0.85]">BBQ</span>
      <span className="mt-[3%] text-[9%] font-bold tracking-[0.25em]">
        BACKYARD · 4PM
      </span>
    </Sheet>
  );
}

function Workshop() {
  return (
    <Sheet className="bg-[linear-gradient(160deg,#8b5cf6,#5b21b6_60%,#2e1065)] text-violet-50">
      <span className="text-[8%] font-bold tracking-[0.3em] text-violet-200/80">
        HANDS ON
      </span>
      <span className="mt-[5%] text-[21%] font-black leading-[0.9]">
        WORK
        <br />
        SHOP
      </span>
      <span className="mt-[6%] text-[8%] font-semibold tracking-[0.25em] text-violet-200/80">
        12 SEATS ONLY
      </span>
    </Sheet>
  );
}

function Wedding() {
  return (
    <Sheet className="bg-[linear-gradient(160deg,#fbeaea,#f3d3d3)] text-[#8a4a52]">
      <span className="font-serif text-[15%] italic leading-[1.2]">
        Love
        <br />
        is in the air
      </span>
      <span className="mt-[9%] text-[7%] font-medium tracking-[0.35em]">
        SAVE THE DATE
      </span>
    </Sheet>
  );
}

function DevConf() {
  return (
    <Sheet className="relative bg-[linear-gradient(155deg,#1e1b4b,#0b0a1f)] text-indigo-100">
      <DotGrid className="text-indigo-400/20" />
      <span className="relative text-[22%] font-black tracking-tight">
        DEV
        <br />
        CONF
      </span>
      <span className="relative mt-[6%] text-[11%] font-bold tracking-[0.3em] text-indigo-300">
        2026
      </span>
    </Sheet>
  );
}

function Keynote() {
  return (
    <Sheet className="bg-[linear-gradient(160deg,#ee6b3b,#b83a12_65%,#5c1a05)] text-orange-50">
      <span className="text-[8%] font-bold tracking-[0.35em] text-orange-100/80">
        MAIN STAGE
      </span>
      <span className="mt-[5%] text-[22%] font-black tracking-tight">KEYNOTE</span>
      <span className="mt-[6%] text-[8%] font-semibold tracking-[0.25em] text-orange-100/80">
        DOORS 9:00
      </span>
    </Sheet>
  );
}

function ExpoFloor() {
  return (
    <Sheet className="relative bg-[linear-gradient(160deg,#0f766e,#042f2c)] text-teal-50">
      <DotGrid className="text-teal-300/25" />
      <span className="relative text-[19%] font-black leading-[0.95]">
        EXPO
        <br />
        FLOOR
      </span>
      <span className="relative mt-[7%] text-[8%] font-semibold tracking-[0.3em] text-teal-200/80">
        HALL 2 · 80 BOOTHS
      </span>
    </Sheet>
  );
}

function ProductLaunch() {
  return (
    <Sheet className="relative bg-[radial-gradient(circle_at_50%_115%,#ee6b3b55,transparent_60%),linear-gradient(#141414,#050505)] text-zinc-100">
      <span className="text-[8%] font-bold tracking-[0.35em] text-zinc-400">
        INTRODUCING
      </span>
      <span className="mt-[5%] text-[24%] font-black tracking-tighter">LAUNCH</span>
      <span className="mt-[6%] text-[8%] font-semibold tracking-[0.25em] text-[#ee6b3b]">
        LIVE &amp; IN PERSON
      </span>
    </Sheet>
  );
}

function GameNight() {
  return (
    <Sheet className="bg-[linear-gradient(150deg,#d946ef,#7e22ce_60%,#3b0764)] text-fuchsia-50">
      <span className="text-[21%] font-black leading-[0.9]">
        GAME
        <br />
        NIGHT
      </span>
      <span className="mt-[7%] text-[8%] font-bold tracking-[0.3em] text-fuchsia-200/85">
        BRING YOUR OWN DICE
      </span>
    </Sheet>
  );
}

function BookClub() {
  return (
    <Sheet className="bg-[linear-gradient(160deg,#d7e3cd,#a8bd97)] text-[#2f3d24]">
      <span className="text-[8%] font-bold tracking-[0.3em]">CHAPTER ONE</span>
      <span className="mt-[4%] font-serif text-[19%] italic font-bold leading-[1]">
        Book
        <br />
        Club
      </span>
      <span className="mt-[6%] text-[8%] font-medium tracking-[0.25em]">
        FIRST THURSDAY
      </span>
    </Sheet>
  );
}

// Ordered so neighbours in the scatter rarely share a hue — the field reads as
// variety rather than as a palette swatch.
export const EVENT_POSTERS = [
  { key: "poker", Art: PokerNight },
  { key: "wedding", Art: Wedding },
  { key: "dinner", Art: DinnerParty },
  { key: "hack", Art: HackNight },
  { key: "beach", Art: BeachParty },
  { key: "brunch", Art: Brunch },
  { key: "pitch", Art: PitchYourIdea },
  { key: "run", Art: LetsRun },
  { key: "birthday", Art: Birthday },
  { key: "keynote", Art: Keynote },
  { key: "bbq", Art: BBQ },
  { key: "workshop", Art: Workshop },
  { key: "devconf", Art: DevConf },
  { key: "cocktail", Art: CocktailHour },
  { key: "expo", Art: ExpoFloor },
  { key: "game", Art: GameNight },
  { key: "launch", Art: ProductLaunch },
  { key: "book", Art: BookClub },
];

export default EVENT_POSTERS;
