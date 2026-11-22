import * as Clipboard from "expo-clipboard";
import React from "react";

import { ListGroup } from "@/components/ui/ListGroup";
import { successFeedback } from "@/lib/haptics";

// Kept for older call sites; it is ListGroup without a title.
export function Group({ children }: { children: React.ReactNode }) {
  return <ListGroup>{children}</ListGroup>;
}

export async function copyToClipboard(text: string, onCopied: (message: string) => void, message = "Copied.") {
  await Clipboard.setStringAsync(text);
  successFeedback();
  onCopied(message);
}
