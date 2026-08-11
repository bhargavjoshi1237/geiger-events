import Link from "next/link";
import { ArrowRight } from "lucide-react";

// The suite's landing showcase frame, mirroring geiger-dash's
// LandingBoardShowcase / LandingCanvasShowcase: a background-image panel with a
// dark scrim holding a 30% copy column beside a 70% widget in its own inset
// frame. `reverse` swaps the columns, which is how the dash page alternates.
export default function SpotlightShowcase({
  backgroundImage,
  title,
  body,
  ctaHref,
  ctaLabel,
  reverse = false,
  children,
}) {
  const copy = (
    <div className="flex w-full flex-col items-start justify-center space-y-6 lg:w-[30%]">
      <div className="space-y-4">
        <h3 className="text-2xl font-semibold leading-snug text-[#f5f5f5] sm:text-3xl">
          {title}
        </h3>
        <p className="text-base text-[#bcbcbc] sm:text-lg">{body}</p>
      </div>
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-2 font-medium text-[#ee6b3b] transition-colors hover:text-[#ff8052]"
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );

  const widget = (
    <div className="w-full flex-1 lg:w-[70%]">
      <div className="relative overflow-hidden rounded-2xl border border-[#313131] bg-surface-card p-1.5 shadow-2xl">
        <div className="h-[340px] overflow-hidden rounded-xl border border-[#313131] bg-background sm:h-[460px] lg:h-[600px]">
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[#212121] bg-background bg-cover bg-center bg-no-repeat px-4 py-4 sm:px-6 md:p-8 xl:p-10"
      style={
        backgroundImage ? { backgroundImage: `url('${backgroundImage}')` } : undefined
      }
    >
      <div className="absolute inset-0 bg-[#080808]/75" />
      <div className="relative z-10 flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
        {reverse ? (
          <>
            {widget}
            {copy}
          </>
        ) : (
          <>
            {copy}
            {widget}
          </>
        )}
      </div>
    </section>
  );
}
