import { checkinServiceWorkerSource } from "@/lib/checkin/offline/sw_source";

// The staff-route service worker. Served under /checkin/ (public in the suite gate); Service-Worker-Allowed lets it
// also register for /door/ and /kiosk/.
export function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return new Response(checkinServiceWorkerSource(base), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": `${base}/`,
    },
  });
}
