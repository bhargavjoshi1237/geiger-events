import { Handshake } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { EmptyState } from "@/components/internal/shared/screen_kit";

export function SponsorshipLoadError({ onRetry }) {
  return (
    <EmptyState
      icon={Handshake}
      title="Couldn't load sponsorship"
      description="Your deals couldn't be retrieved. Retry before editing them."
      action={<Button variant="outline" onClick={onRetry}>Retry</Button>}
    />
  );
}
