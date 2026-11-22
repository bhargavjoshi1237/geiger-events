import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ItemForm } from "@/components/control/inventory/ItemForm";
import { qtyText, STOCK_META } from "@/components/control/inventory/meta";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { InventoryItemGroup } from "@/types/control_inventory";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "Low stock", label: "Low stock" },
  { value: "Out of stock", label: "Out of stock" },
];

export default function InventoryItemsScreen() {
  const router = useRouter();
  const { project } = useControl();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const list = useControlQuery<{ items: InventoryItemGroup[] }>(project ? `/api/control/inventory/${project.id}/items` : null);
  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!q) return true;
      return [item.name, item.sku, item.category, ...item.variants.map((v) => `${v.variantLabel} ${v.sku}`)].join(" ").toLowerCase().includes(q);
    });
  }, [items, query, filter]);

  const needsAttention = items.filter((i) => i.status !== "In stock").length;

  let body: React.ReactNode;
  if (!project) {
    body = <EmptyState icon="briefcase" title="No project" message="Pick a project in Control first." />;
  } else if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load inventory" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!items.length) {
    body = <EmptyState icon="boxes" title="No items yet" message="Merch, swag and supplies you track appear here." actionLabel="Add an item" onAction={() => setCreating(true)} />;
  } else if (!shown.length) {
    body = (
      <EmptyState
        icon="search"
        title="Nothing matches"
        message="Try another name, SKU or stock level."
        actionLabel="Clear filters"
        onAction={() => {
          setQuery("");
          setFilter("all");
        }}
      />
    );
  } else {
    body = (
      <View style={styles.group}>
        {shown.map((item, i) => {
          const meta = STOCK_META[item.status];
          const detail = item.variants.length ? `${item.variants.length} variants · ${item.category}` : [item.sku, item.category].filter(Boolean).join(" · ");
          return (
            <ListRow
              key={item.id}
              leading={<IconTile icon="box" size={34} tone={item.status === "Out of stock" ? "danger" : "neutral"} />}
              title={item.name}
              subtitle={`${qtyText(item.onHand)} on hand · ${detail}`}
              trailing={<Pill label={meta.label} tone={meta.tone} variant="outline" />}
              onPress={() => router.push({ pathname: "/control/inventory/item/[id]", params: { id: item.id } })}
              divider={i < shown.length - 1}
            />
          );
        })}
      </View>
    );
  }

  return (
    <Screen
      scroll
      header={
        <ScreenHeader
          title="Inventory"
          subtitle={list.data ? `${items.length} items${needsAttention ? ` · ${needsAttention} need attention` : ""}` : undefined}
          right={project ? <IconButton icon="plus" label="Add an item" variant="solid" onPress={() => setCreating(true)} /> : undefined}
        />
      }
    >
      {list.data && items.length ? (
        <View style={styles.controls}>
          <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search items, SKUs…" autoCapitalize="none" />
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        </View>
      ) : null}
      {body}
      <Text style={styles.footnote}>Photos and allocation rules are set on the dashboard.</Text>
      {project ? (
        <Sheet visible={creating} onClose={() => setCreating(false)} title="New inventory item">
          <ItemForm
            projectId={project.id}
            onClose={() => setCreating(false)}
            onCreated={(item) => {
              setCreating(false);
              void list.reload();
              router.push({ pathname: "/control/inventory/item/[id]", params: { id: item.id } });
            }}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  footnote: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.lg,
  },
});
