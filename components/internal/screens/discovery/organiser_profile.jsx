"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Compass,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from "@/context/project-context";
import { getWall } from "@/lib/supabase/event_wall";
import {
  getProfile,
  listFollowers,
  removeFollower,
  updateProfile,
} from "@/lib/supabase/discovery";
import { formatDate } from "@/components/internal/screens/events/sample_data";

// Fields that count toward the profile "completeness" stat.
const COMPLETENESS_FIELDS = [
  "displayName",
  "tagline",
  "bio",
  "avatarUrl",
  "website",
  "location",
  "contactEmail",
];

const EMPTY_FORM = {
  displayName: "",
  tagline: "",
  bio: "",
  avatarUrl: "",
  bannerUrl: "",
  website: "",
  location: "",
  contactEmail: "",
  links: [],
};

function toForm(profile) {
  if (!profile) return { ...EMPTY_FORM };
  return {
    displayName: profile.displayName || "",
    tagline: profile.tagline || "",
    bio: profile.bio || "",
    avatarUrl: profile.avatarUrl || "",
    bannerUrl: profile.bannerUrl || "",
    website: profile.website || "",
    location: profile.location || "",
    contactEmail: profile.contactEmail || "",
    links: Array.isArray(profile.links) ? profile.links : [],
  };
}

// The single "Discovery" destination — the project's public organiser profile
// (rendered on the /w/<slug> wall) and the audience following it. Project-scoped
// and self-contained like EventWallScreen: reached straight from the sidebar.
export function OrganiserProfileScreen() {
  const { projectId } = useProject();
  const [form, setForm] = useState(EMPTY_FORM);
  const [followers, setFollowers] = useState([]);
  const [slug, setSlug] = useState("events");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  // Captured at load time (impure Date.now can't run during render) to gauge
  // recent-follower growth in the stats bar.
  const [loadedMs, setLoadedMs] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getProfile(projectId),
      listFollowers(projectId),
      getWall(projectId),
    ]).then(([profileRow, followerRows, wallRow]) => {
      if (!alive) return;
      setForm(toForm(profileRow));
      setFollowers(followerRows ?? []);
      if (wallRow?.slug) setSlug(wallRow.slug);
      setLoadedMs(Date.now());
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const setLink = (i, key) => (value) =>
    setForm((f) => ({
      ...f,
      links: f.links.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)),
    }));
  const addLink = () =>
    setForm((f) => ({ ...f, links: [...f.links, { label: "", url: "" }] }));
  const removeLink = (i) =>
    setForm((f) => ({ ...f, links: f.links.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true);
    // Drop blank link rows before persisting.
    const links = form.links.filter((l) => (l.url || "").trim());
    const saved = await updateProfile(projectId, { ...form, links });
    setSaving(false);
    if (saved) {
      setForm(toForm(saved));
      toast.success("Profile saved.");
    } else {
      toast.error("Couldn't save the profile.");
    }
  };

  const handleRemoveFollower = async (follower) => {
    const prev = followers;
    setFollowers((list) => list.filter((f) => f.id !== follower.id));
    const ok = await removeFollower(follower.id);
    if (!ok) {
      setFollowers(prev);
      toast.error("Couldn't remove that follower.");
    } else {
      toast.success("Follower removed.");
    }
  };

  const exportCsv = () => {
    if (typeof window === "undefined" || !followers.length) return;
    const rows = [
      ["Email", "Name", "Followed"],
      ...followers.map((f) => [f.email, f.name, f.createdAt]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "followers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const wallPath = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/w/${slug}`;
  const wallUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${wallPath}`
      : wallPath;

  const copyLink = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(wallUrl).then(
      () => toast.success("Public link copied."),
      () => toast.error("Couldn't copy the link."),
    );
  };
  const viewLive = () => {
    if (typeof window !== "undefined") {
      window.open(wallPath, "_blank", "noopener,noreferrer");
    }
  };

  const stats = useMemo(() => {
    const total = followers.length;
    const weekAgo = loadedMs
      ? new Date(loadedMs - 7 * 864e5).toISOString()
      : null;
    const recent = weekAgo
      ? followers.filter((f) => f.createdAt && f.createdAt >= weekAgo).length
      : 0;
    const filled = COMPLETENESS_FIELDS.filter((k) => (form[k] || "").trim())
      .length;
    const completeness = Math.round(
      (filled / COMPLETENESS_FIELDS.length) * 100,
    );
    return [
      { label: "Followers", value: String(total) },
      {
        label: "New this week",
        value: String(recent),
        delta: recent ? `+${recent}` : undefined,
        trend: recent ? "up" : undefined,
      },
      { label: "Profile complete", value: `${completeness}%` },
    ];
  }, [followers, form, loadedMs]);

  const filteredFollowers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return followers;
    return followers.filter(
      (f) =>
        f.email.toLowerCase().includes(q) ||
        (f.name || "").toLowerCase().includes(q),
    );
  }, [followers, search]);

  const columns = [
    {
      key: "email",
      header: "Email",
      render: (f) => (
        <span className="font-medium text-foreground">{f.email}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (f) => (
        <span className="text-text-secondary">{f.name || "—"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Followed",
      render: (f) => (
        <span className="text-text-secondary">
          {f.createdAt ? formatDate(f.createdAt.slice(0, 10)) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (f) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove follower"
          className="h-8 w-8 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
          onClick={() => handleRemoveFollower(f)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <MainScreenWrapper>
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </MainScreenWrapper>
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Discovery"
        description="Your public organiser profile — the identity buyers follow to hear about new events."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={copyLink}
            >
              <Copy className="h-4 w-4" /> Copy link
            </Button>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={viewLive}
            >
              <ExternalLink className="h-4 w-4" /> View live
            </Button>
          </div>
        }
      />

      <StatsBar stats={stats} columns={3} className="mt-6" />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Organiser profile"
          description="Shown on your public events page. Save to publish changes."
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={save}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          }
        >
          <div className="grid gap-4">
            <Field label="Display name">
              <Input
                value={form.displayName}
                onChange={(e) => set("displayName")(e.target.value)}
                placeholder="e.g. Geiger Studios"
              />
            </Field>
            <Field label="Tagline" hint="A short one-liner.">
              <Input
                value={form.tagline}
                onChange={(e) => set("tagline")(e.target.value)}
                placeholder="Unforgettable events, all year round"
              />
            </Field>
            <Field label="Bio">
              <Textarea
                value={form.bio}
                onChange={(e) => set("bio")(e.target.value)}
                rows={4}
                placeholder="Tell followers who you are and what you host."
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Avatar URL">
                <Input
                  value={form.avatarUrl}
                  onChange={(e) => set("avatarUrl")(e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Banner URL">
                <Input
                  value={form.bannerUrl}
                  onChange={(e) => set("bannerUrl")(e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Website">
                <Input
                  value={form.website}
                  onChange={(e) => set("website")(e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => set("location")(e.target.value)}
                  placeholder="London, UK"
                />
              </Field>
            </div>
            <Field label="Public contact email">
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail")(e.target.value)}
                placeholder="hello@example.com"
              />
            </Field>

            <Field label="Social links">
              <div className="grid gap-2">
                {form.links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={link.label}
                      onChange={(e) => setLink(i, "label")(e.target.value)}
                      placeholder="Instagram"
                      className="w-32 shrink-0"
                    />
                    <Input
                      value={link.url}
                      onChange={(e) => setLink(i, "url")(e.target.value)}
                      placeholder="https://…"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove link"
                      className="h-9 w-9 shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => removeLink(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-fit border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={addLink}
                >
                  <Plus className="h-4 w-4" /> Add link
                </Button>
              </div>
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Followers"
          description="People who follow you for new-event updates."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={exportCsv}
              disabled={!followers.length}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          }
        >
          <Toolbar className="mb-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search followers…"
              className="w-full sm:max-w-xs"
            />
          </Toolbar>

          <DataTable
            columns={columns}
            data={filteredFollowers}
            getRowKey={(f) => f.id}
            empty={
              <EmptyState
                icon={Compass}
                title={search ? "No matching followers" : "No followers yet"}
                description={
                  search
                    ? "Try a different search."
                    : "Share your public events page and add a Follow button so buyers can subscribe for updates."
                }
              />
            }
          />
        </SectionCard>
      </div>
    </MainScreenWrapper>
  );
}

export default OrganiserProfileScreen;
