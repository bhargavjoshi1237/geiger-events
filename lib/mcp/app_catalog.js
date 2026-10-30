// How each AI app connects to the MCP server: an install link, a page to open, or a command to copy. Pure.

export const MCP_SERVER_NAME = "geiger-events";

function cursorInstallLink(url) {
  const config = btoa(JSON.stringify({ url }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_SERVER_NAME}&config=${encodeURIComponent(config)}`;
}

function vscodeInstallLink(url) {
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: MCP_SERVER_NAME, type: "http", url }))}`;
}

// kind "open" copies the address and opens a page, "install" hands off to the app, "command" copies a terminal command.
export function buildAppCatalog(url) {
  return [
    {
      id: "claude",
      name: "Claude",
      description: "Desktop and web. Choose Add custom connector, then paste the address.",
      kind: "open",
      href: "https://claude.ai/settings/connectors",
      actionLabel: "Open Claude",
      toast: "Address copied. Choose Add custom connector and paste it.",
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      description: "Needs developer mode. Create a connector, then paste the address.",
      kind: "open",
      href: "https://chatgpt.com/#settings/Connectors",
      actionLabel: "Open ChatGPT",
      toast: "Address copied. Create a connector and paste it.",
    },
    {
      id: "cursor",
      name: "Cursor",
      description: "Adds the server to Cursor, which then asks you to sign in.",
      kind: "install",
      href: cursorInstallLink(url),
      actionLabel: "Add to Cursor",
    },
    {
      id: "vscode",
      name: "VS Code",
      description: "Adds the server to Copilot agent mode, which then asks you to sign in.",
      kind: "install",
      href: vscodeInstallLink(url),
      actionLabel: "Add to VS Code",
    },
    {
      id: "claude-code",
      name: "Claude Code",
      description: "Run this in your terminal, then use /mcp to sign in.",
      kind: "command",
      command: `claude mcp add --transport http ${MCP_SERVER_NAME} ${url}`,
      actionLabel: "Copy command",
      toast: "Command copied. Run it, then use /mcp to sign in.",
    },
    {
      id: "codex",
      name: "Codex",
      description: "Run these two commands in your terminal. The second one signs you in.",
      kind: "command",
      command: `codex mcp add ${MCP_SERVER_NAME} --url ${url}\ncodex mcp login ${MCP_SERVER_NAME}`,
      actionLabel: "Copy commands",
      toast: "Commands copied. Run them in your terminal.",
    },
  ];
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// A custom callback must be https, or http only on this computer, with nothing that could hide where it really goes.
export function validateCallbackUrl(value) {
  const text = String(value || "").trim();
  if (!text) return { ok: true, value: null };
  let url;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "Enter a full URL, starting with https://." };
  }
  const isLoopback = url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !isLoopback) {
    return { ok: false, error: "The callback URL must start with https://." };
  }
  if (url.username || url.password || url.hash) {
    return { ok: false, error: "Remove any login details or # section from the URL." };
  }
  if (text.length > 500) return { ok: false, error: "That URL is too long." };
  return { ok: true, value: text };
}
