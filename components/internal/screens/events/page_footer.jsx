"use client";

import {
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Github,
  Globe,
  Mail,
  Plus,
  Trash2,
} from "lucide-react";

import {
  Field,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Shared footer for the public event page and the Event Wall. Config is a small
// bag stored alongside the theme (pageDesign.footer / metadata.footer):
//   { showBranding, text, links: [{label,url}], socials: [{platform,url}] }
// PageFooter renders it; FooterEditor edits it. Both editors reuse this so the
// two surfaces stay identical.

export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "facebook", label: "Facebook", icon: Facebook },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "youtube", label: "YouTube", icon: Youtube },
  { key: "github", label: "GitHub", icon: Github },
  { key: "website", label: "Website", icon: Globe },
  { key: "email", label: "Email", icon: Mail },
];

export const DEFAULT_FOOTER = {
  showBranding: true,
  text: "",
  links: [],
  socials: [],
};

function socialIcon(platform) {
  return (SOCIAL_PLATFORMS.find((p) => p.key === platform) || SOCIAL_PLATFORMS[0])
    .icon;
}

// Normalize a possibly-partial saved footer to the full shape.
export function resolveFooter(footer) {
  const f = footer && typeof footer === "object" ? footer : {};
  return {
    showBranding: f.showBranding !== false,
    text: f.text || "",
    links: Array.isArray(f.links) ? f.links : [],
    socials: Array.isArray(f.socials) ? f.socials : [],
  };
}

// ---------------------------------------------------------------------------
// Public renderer
// ---------------------------------------------------------------------------

export function PageFooter({ footer, accent }) {
  const f = resolveFooter(footer);
  const links = f.links.filter((l) => l && l.label);
  const socials = f.socials.filter((s) => s && s.url);
  const hasCustom = links.length || socials.length || f.text;

  if (!hasCustom && !f.showBranding) return null;

  return (
    <footer className="mt-14 flex flex-col items-center gap-4 border-t border-border pt-8 text-center">
      {socials.length ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {socials.map((s, i) => {
            const Icon = socialIcon(s.platform);
            const href =
              s.platform === "email" && !/^mailto:/.test(s.url)
                ? `mailto:${s.url}`
                : s.url;
            return (
              <a
                key={`${s.platform}-${i}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.platform}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-card text-text-secondary transition-colors hover:text-foreground"
                style={accent ? { borderColor: `${accent.color}33` } : undefined}
              >
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
        </div>
      ) : null}

      {links.length ? (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {links.map((l, i) => (
            <a
              key={`${l.label}-${i}`}
              href={l.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-secondary transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>
      ) : null}

      {f.text ? (
        <p className="max-w-xl text-xs text-text-tertiary">{f.text}</p>
      ) : null}

      {f.showBranding ? (
        <p className="text-xs text-text-tertiary">Powered by Geiger Events</p>
      ) : null}
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Editor block (body of a SectionCard in each design editor)
// ---------------------------------------------------------------------------

function RowActions({ onRemove }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onRemove}
      aria-label="Remove"
      className="shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function FooterEditor({ value, onChange }) {
  const f = resolveFooter(value);
  const patch = (next) => onChange({ ...f, ...next });

  const setLink = (i, key, v) =>
    patch({ links: f.links.map((l, j) => (j === i ? { ...l, [key]: v } : l)) });
  const addLink = () => patch({ links: [...f.links, { label: "", url: "" }] });
  const removeLink = (i) => patch({ links: f.links.filter((_, j) => j !== i) });

  const setSocial = (i, key, v) =>
    patch({
      socials: f.socials.map((s, j) => (j === i ? { ...s, [key]: v } : s)),
    });
  const addSocial = () =>
    patch({ socials: [...f.socials, { platform: "instagram", url: "" }] });
  const removeSocial = (i) =>
    patch({ socials: f.socials.filter((_, j) => j !== i) });

  return (
    <div className="space-y-5">
      <SettingsList>
        <SettingRow
          title="Show Geiger branding"
          description='Keep the "Powered by Geiger Events" line in the footer.'
          checked={f.showBranding}
          onCheckedChange={(v) => patch({ showBranding: v })}
        />
      </SettingsList>

      <Field label="Footer text" hint="A copyright line, address, or short note.">
        <Input
          value={f.text}
          onChange={(e) => patch({ text: e.target.value })}
          placeholder="© 2026 Your Brand. All rights reserved."
        />
      </Field>

      <Field label="Social links">
        <div className="space-y-2">
          {f.socials.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={s.platform || "instagram"}
                onValueChange={(v) => setSocial(i, "platform", v)}
              >
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={s.url || ""}
                onChange={(e) => setSocial(i, "url", e.target.value)}
                placeholder="https://…"
                className="flex-1"
              />
              <RowActions onRemove={() => removeSocial(i)} />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addSocial}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Add social link
          </Button>
        </div>
      </Field>

      <Field label="Footer links">
        <div className="space-y-2">
          {f.links.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={l.label || ""}
                onChange={(e) => setLink(i, "label", e.target.value)}
                placeholder="Label"
                className="w-36 shrink-0"
              />
              <Input
                value={l.url || ""}
                onChange={(e) => setLink(i, "url", e.target.value)}
                placeholder="https://…"
                className="flex-1"
              />
              <RowActions onRemove={() => removeLink(i)} />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addLink}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Add link
          </Button>
        </div>
      </Field>
    </div>
  );
}

export default PageFooter;
