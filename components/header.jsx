import Image from "next/image";
import { MegaMenu } from "@/components/mega-menu";

export function Header({ dashboardHref = "/home" }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-zinc-950 md:border-zinc-800/50 md:bg-zinc-950/85 md:backdrop-blur-md">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between px-4 sm:px-6 relative">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo1.svg`} alt="Logo" width={20} height={20} />
          </div>
          <span className="truncate font-bold text-sm tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 sm:text-md">Geiger Studios</span>
        </div>
        <MegaMenu dashboardHref={dashboardHref} />
        <div className="hidden items-center gap-4 md:flex">
          <a
            href={dashboardHref}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Open Dashboard
          </a>
        </div>
      </div>
    </header>
  );
}
