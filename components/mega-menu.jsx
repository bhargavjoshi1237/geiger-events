"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Zap, Layers, Cpu, ContainerIcon, CalendarDays, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MegaMenu({ dashboardHref = "/home" }) {
  const products = [
    {
      icon: ContainerIcon,
      label: "Flow",
      description: "Plan and track work.",
      href: "/flow",
    },
    {
      icon: Zap,
      label: "Notes",
      description: "Write and collaborate.",
      href: "/notes",
    },
    {
      icon: CalendarDays,
      label: "Events",
      description: "Plan and run events.",
      href: dashboardHref,
      current: true,
    },
    {
      icon: Layers,
      label: "DAM",
      description: "Manage your media.",
      href: "#",
    },
    {
      icon: Cpu,
      label: "Grey",
      description: "AI workspace tools.",
      href: "#",
    },
  ];

  const resources = [
    { label: "Documentation", href: "/docs" },
    { label: "Changelog", href: "/changelog" },
    { label: "Blog", href: "/blog" },
    { label: "GitHub Repository", href: "#" },
    { label: "Self Host Geiger", href: "#" },
  ];

  return (
    <>
      <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8 text-sm font-medium text-zinc-400">
        <div className="group">
          <button className="flex items-center gap-1 py-6 transition-colors hover:text-zinc-100">
            Features
          </button>

          <div className="invisible absolute left-1/2 top-[100%] w-[640px] -translate-x-1/2 translate-y-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
            <div className="rounded-xl border border-zinc-800 bg-[#1a1a1a] p-4 shadow-xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Products</p>
                  <div className="space-y-1">
                    {products.map((item) => {
                      const Icon = item.icon;
                      return (
                        <a
                          href={item.href}
                          key={item.label}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-zinc-800"
                        >
                          <Icon className="h-4 w-4 text-zinc-400" />
                          <div>
                            <p className="text-sm text-zinc-100">
                              {item.label}
                              {item.current ? (
                                <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                                  Current
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-zinc-500">{item.description}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Resources</p>
                  <div className="space-y-1">
                    {resources.map((item) => (
                      <a
                        href={item.href}
                        key={item.label}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        {item.label}
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <a href="/pricing" className="py-6 transition-colors hover:text-zinc-100">
          Pricing
        </a>
      </nav>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="top" className="max-h-[85dvh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100">
            <SheetHeader className="border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo1.svg`} alt="Geiger logo" width={18} height={18} />
                <SheetTitle className="mt-0.5">Geiger Studio</SheetTitle>
              </div>
              <SheetDescription className="text-zinc-500">
                Browse products, resources, and pricing.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Products</p>
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                  {products.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SheetClose asChild key={item.label}>
                        <a
                          href={item.href}
                          className="flex min-w-[86px] flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-3 text-center text-xs text-zinc-200"
                        >
                          <Icon className="h-4 w-4 text-zinc-400" />
                          <p className="leading-tight">{item.label}</p>
                        </a>
                      </SheetClose>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Resources</p>
                {resources.map((item) => (
                  <SheetClose asChild key={item.label}>
                    <a
                      href={item.href}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-200"
                    >
                      {item.label}
                      <ArrowRight className="h-4 w-4 text-zinc-500" />
                    </a>
                  </SheetClose>
                ))}
              </div>

              <div className="space-y-2">
                <SheetClose asChild>
                  <a
                    href="/pricing"
                    className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
                  >
                    View Pricing
                  </a>
                </SheetClose>

                <SheetClose asChild>
                  <Link
                    href={dashboardHref}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-700 bg-transparent px-4 py-2 text-sm font-medium text-zinc-100"
                  >
                    Open Dashboard
                  </Link>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
