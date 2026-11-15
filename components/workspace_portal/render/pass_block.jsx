"use client";

import { useMemo } from "react";
import { QrCode } from "lucide-react";
import QRCode from "qrcode";
import { BlockError, BlockFrame, BlockLoading, BlockMessage } from "./block_frame";
import { useBlockData } from "./use_block_data";

// A QR code drawn as SVG squares, with a quiet zone so phone cameras pick it up.
export function QrSvg({ value, size = 220, label }) {
  const qr = useMemo(() => QRCode.create(value, { errorCorrectionLevel: "M" }), [value]);
  const count = qr.modules.size;
  const cells = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) if (qr.modules.get(row, col)) cells.push(`M${col + 4} ${row + 4}h1v1h-1z`);
  }
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${count + 8} ${count + 8}`} shapeRendering="crispEdges" className="rounded-lg bg-white">
      <path d={cells.join("")} fill="#000" />
    </svg>
  );
}

// The signed-in person's own pass: a signed QR code that scanners on this event accept.
export function PassBlock({ block, fill }) {
  const config = block.config;
  const { data, error, loading, reload } = useBlockData(block, {});
  let body;
  if (loading) body = <BlockLoading label="Loading your pass" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (!data?.code) {
    body = data?.mode === "portal"
      ? <BlockMessage icon={QrCode} title="No pass yet" text="Sign in with the email the organisers have for you to see your pass." />
      : <BlockMessage icon={QrCode} title="Each person sees their own pass here" text="On the portal, a signed-in person gets a QR code that scanners on this event accept." />;
  } else {
    body = (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <QrSvg value={data.code} label={`Pass for ${data.name}`} />
        <div className="space-y-0.5">
          <p className="text-base font-semibold text-foreground">{data.name}</p>
          {config.text ? <p className="text-sm text-text-secondary">{config.text}</p> : null}
        </div>
      </div>
    );
  }
  return <BlockFrame title={config.title} fill={fill}>{body}</BlockFrame>;
}
