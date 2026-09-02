"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
  Users,
  UploadCloud,
  Loader2,
  Settings2,
  LayoutGrid,
  Rows3,
  Columns2,
  Columns3,
  Columns4,
  Square,
  RectangleVertical,
  Circle,
  Maximize2,
  Minimize2,
  SquareDashed,
  AlignLeft,
  AlignCenter,
  Eye,
  Text,
} from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Avatar, AvatarFallback } from "@geiger/ui/avatar";
import { Separator } from "@geiger/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  uploadEventImage,
  removeEventImage,
  pathFromPublicUrl,
} from "@/lib/supabase/storage";
import {
  GUEST_LAYOUTS,
  GUEST_COLUMN_OPTIONS,
  GUEST_IMAGE_SHAPES,
  GUEST_IMAGE_FITS,
  GUEST_CARD_STYLES,
  GUEST_ALIGNS,
  GUEST_SHAPE_CLASS,
  GUEST_FIT_CLASS,
  DEFAULT_GUEST_DISPLAY,
  resolveGuestDisplay,
} from "@/lib/events/guests";
import { cn } from "@/lib/utils";
import { Segmented, withIcons } from "./theme_controls";
import { initials } from "./sample_data";

const EMPTY_GUEST = { name: "", role: "", company: "", bio: "", image: "" };

function GuestDialog({ open, onOpenChange, eventId, initial, onSave }) {
  const [draft, setDraft] = useState(EMPTY_GUEST);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial || EMPTY_GUEST);
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setBusy(true);
    const res = await uploadEventImage(eventId, file);
    setBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — only the event's creator can add images.");
      return;
    }
    const old = draft.image;
    set("image")(res.url);
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  const removeImage = () => {
    const path = pathFromPublicUrl(draft.image);
    set("image")("");
    if (path) removeEventImage(path);
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the guest a name first.");
      return;
    }
    onSave({
      name: draft.name.trim(),
      role: draft.role.trim(),
      company: (draft.company || "").trim(),
      bio: draft.bio.trim(),
      image: draft.image || "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit guest" : "Add guest"}</DialogTitle>
          <DialogDescription>
            A featured guest or speaker shown on your public event page.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              {draft.image ? (
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border">
                  <img
                    src={draft.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <Avatar className="h-16 w-16 shrink-0 border border-border">
                  <AvatarFallback className="bg-surface-card text-base text-muted-foreground">
                    {draft.name ? initials(draft.name) : "?"}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    {draft.image ? "Replace" : "Upload"}
                  </Button>
                  {draft.image ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={removeImage}
                      className="border-border bg-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <Field label="Name" htmlFor="guest-name">
            <Input
              id="guest-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Ava Mitchell"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role / title" hint="Optional" htmlFor="guest-role">
              <Input
                id="guest-role"
                value={draft.role}
                onChange={(e) => set("role")(e.target.value)}
                placeholder="VP, AI Software Product Management"
              />
            </Field>
            <Field label="Company" hint="Optional" htmlFor="guest-company">
              <Input
                id="guest-company"
                value={draft.company || ""}
                onChange={(e) => set("company")(e.target.value)}
                placeholder="NVIDIA"
              />
            </Field>
          </div>
          <Field label="Bio" hint="Optional" htmlFor="guest-bio">
            <Textarea
              id="guest-bio"
              rows={3}
              value={draft.bio}
              onChange={(e) => set("bio")(e.target.value)}
              placeholder="A short introduction shown beneath their name."
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            {initial ? "Save guest" : "Add guest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const LAYOUT_OPTIONS = withIcons(GUEST_LAYOUTS, { grid: LayoutGrid, list: Rows3 });
const COLUMN_OPTIONS = withIcons(GUEST_COLUMN_OPTIONS, {
  2: Columns2,
  3: Columns3,
  4: Columns4,
});
const SHAPE_OPTIONS = withIcons(GUEST_IMAGE_SHAPES, {
  square: Square,
  portrait: RectangleVertical,
  circle: Circle,
});
const FIT_OPTIONS = withIcons(GUEST_IMAGE_FITS, {
  cover: Maximize2,
  contain: Minimize2,
});
const CARD_STYLE_OPTIONS = withIcons(GUEST_CARD_STYLES, {
  plain: SquareDashed,
  card: Square,
});
const ALIGN_OPTIONS = withIcons(GUEST_ALIGNS, {
  left: AlignLeft,
  center: AlignCenter,
});

const PREVIEW_GUESTS = [
  { name: "Ava Mitchell", role: "VP, Product", bio: "Leads the platform team building developer tools." },
  { name: "Ravi Patel", role: "Head of Design", bio: "Twelve years shaping interfaces for technical teams." },
  { name: "Mei Tanaka", role: "Founder", bio: "Writes and speaks about audio on the web." },
  { name: "Jonas Weber", role: "Staff Engineer", bio: "Works on edge runtime performance." },
];

const PREVIEW_COLUMNS = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

const GUEST_DISPLAY_KEYS = Object.keys(DEFAULT_GUEST_DISPLAY);

// Miniature of GuestsBlock so settings can be judged without leaving the dialog.
function GuestLayoutPreview({ display, guests }) {
  const isGrid = display.layout === "grid";
  const source = guests?.length ? guests : PREVIEW_GUESTS;
  const items = Array.from(
    { length: isGrid ? display.columns : 2 },
    (_, i) => source[i % source.length],
  );
  const carded = display.cardStyle === "card";
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        <Eye className="h-3.5 w-3.5" /> Preview
      </p>
      <div
        className={
          isGrid
            ? cn("grid gap-x-3 gap-y-4", PREVIEW_COLUMNS[display.columns])
            : "flex flex-col gap-3"
        }
      >
        {items.map((g, i) => (
          <div
            key={i}
            className={cn(
              isGrid ? "min-w-0" : "flex min-w-0 items-start gap-3",
              isGrid && display.align === "center" && "text-center",
              carded && "rounded-lg border border-border bg-surface-card p-2.5",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center overflow-hidden border border-border bg-surface-card",
                GUEST_SHAPE_CLASS[display.imageShape],
                isGrid ? "w-full" : "w-11 shrink-0",
              )}
            >
              {g.image ? (
                <img
                  src={g.image}
                  alt=""
                  className={cn(
                    "h-full w-full",
                    GUEST_FIT_CLASS[display.imageFit],
                    display.imageFit === "contain" && "bg-white p-1",
                  )}
                />
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {initials(g.name || "?")}
                </span>
              )}
            </div>
            <div className={cn("min-w-0", isGrid && "mt-2")}>
              <p className="truncate text-[11px] font-semibold text-foreground">
                {g.name}
              </p>
              {g.role ? (
                <p className="truncate text-[10px] text-text-secondary">{g.role}</p>
              ) : null}
              {display.showBio && g.bio ? (
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                  {g.bio}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuestDisplayDialog({ open, onOpenChange, display, onChange, onReset, guests }) {
  const isGrid = display.layout === "grid";
  const isDefault = GUEST_DISPLAY_KEYS.every(
    (k) => display[k] === DEFAULT_GUEST_DISPLAY[k],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>Guest layout</DialogTitle>
          <DialogDescription>
            How featured guests are arranged on your public event page.
          </DialogDescription>
        </DialogHeader>

        <GuestLayoutPreview display={display} guests={guests} />

        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Layout" hint="Grid shows photo cards; list stacks rows.">
              <Segmented
                value={display.layout}
                onChange={onChange("layout")}
                options={LAYOUT_OPTIONS}
              />
            </Field>
            {isGrid ? (
              <Field label="Columns" hint="At desktop width; narrower screens step down.">
                <Segmented
                  value={display.columns}
                  onChange={onChange("columns")}
                  options={COLUMN_OPTIONS}
                />
              </Field>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Photo shape">
              <Segmented
                value={display.imageShape}
                onChange={onChange("imageShape")}
                options={SHAPE_OPTIONS}
              />
            </Field>
            <Field
              label="Photo framing"
              hint="Fit inside keeps the whole image, with space around it."
            >
              <Segmented
                value={display.imageFit}
                onChange={onChange("imageFit")}
                options={FIT_OPTIONS}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Card style" hint="Plain sits straight on the page.">
              <Segmented
                value={display.cardStyle}
                onChange={onChange("cardStyle")}
                options={CARD_STYLE_OPTIONS}
              />
            </Field>
            {isGrid ? (
              <Field label="Text alignment">
                <Segmented
                  value={display.align}
                  onChange={onChange("align")}
                  options={ALIGN_OPTIONS}
                />
              </Field>
            ) : null}
          </div>

          <Separator />

          <SettingsList>
            <SettingRow
              icon={Text}
              title="Show bios"
              description="The short introduction under each guest's name."
              checked={display.showBio}
              onCheckedChange={onChange("showBio")}
            />
          </SettingsList>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            disabled={isDefault}
            onClick={onReset}
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground disabled:opacity-40"
          >
            Reset to default
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GuestsSection({ event, headerItem }) {
  const [guests, , saveGuests] = useEventConfig(event, "guests", []);
  const [rawDisplay, , saveDisplay] = useEventConfig(
    event,
    "guestsDisplay",
    DEFAULT_GUEST_DISPLAY,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const display = resolveGuestDisplay(rawDisplay);
  const setDisplay = (key) => (value) => saveDisplay({ ...display, [key]: value });

  const addGuest = (guest) =>
    saveGuests([...guests, { ...guest, id: `gst_${Date.now()}` }], {
      successMsg: "Guest added.",
    });

  const updateGuest = (index, guest) =>
    saveGuests(
      guests.map((g, i) => (i === index ? { ...g, ...guest } : g)),
      { successMsg: "Guest updated." },
    );

  const removeGuest = (index) => {
    const target = guests[index];
    saveGuests(guests.filter((_, i) => i !== index));
    const path = pathFromPublicUrl(target?.image);
    if (path) removeEventImage(path);
  };

  const move = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= guests.length) return;
    const copy = [...guests];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    saveGuests(copy);
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Guests"}
        description={
          headerItem?.desc ||
          "Feature speakers and special guests on your public event page."
        }
        action={
          <>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" /> Add guest
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Guest layout settings"
              onClick={() => setSettingsOpen(true)}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {guests.length ? (
        <div className="space-y-2">
          {guests.map((g, i) => (
            <div
              key={g.id || i}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3"
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-text-tertiary" />
              {g.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.image}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
                />
              ) : (
                <Avatar className="h-11 w-11 shrink-0 border border-border">
                  <AvatarFallback className="bg-surface-subtle text-xs text-muted-foreground">
                    {initials(g.name || "?")}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {g.name}
                </p>
                {g.role || g.company ? (
                  <p className="truncate text-xs font-medium text-text-secondary">
                    {[g.role, g.company].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {g.bio ? (
                  <p className="mt-0.5 truncate text-xs text-text-tertiary">
                    {g.bio}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === guests.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditing({ index: i, guest: g })}
                  aria-label="Edit guest"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleteTarget(i)}
                  aria-label="Delete guest"
                  className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
        >
          <Users className="h-6 w-6" />
          <p className="text-sm">Add your first featured guest</p>
        </button>
      )}

      <GuestDisplayDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        display={display}
        onChange={setDisplay}
        onReset={() => saveDisplay(DEFAULT_GUEST_DISPLAY)}
        guests={guests}
      />
      <GuestDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={event.id}
        onSave={addGuest}
      />
      <GuestDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        eventId={event.id}
        initial={editing?.guest}
        onSave={(guest) => {
          updateGuest(editing.index, guest);
          setEditing(null);
        }}
      />

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete guest</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget != null ? guests[deleteTarget]?.name : ""}
              </span>
              ? Their photo is removed too. This action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                removeGuest(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GuestsSection;
