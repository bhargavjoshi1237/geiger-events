import ClientEventsPlayground from "@/components/ClientEventsPlayground";

// The landing-page playground on its own route, so the showcase embeds it in an iframe and the workspace's portalled
// dialogs, sheets, menus and toasts stay inside the card instead of covering the landing page.
export const metadata = {
  title: "Events Playground - Geiger Studio",
  robots: { index: false, follow: false },
};

export default function EventsPlaygroundPage() {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background">
      <ClientEventsPlayground />
    </div>
  );
}
