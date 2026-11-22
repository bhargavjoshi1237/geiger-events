import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ItemForm } from "@/components/control/inventory/ItemForm";
import { ITEM_CATEGORIES, qtyText } from "@/components/control/inventory/meta";
import { StockRow } from "@/components/control/inventory/StockRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { InventoryItemGroup } from "@/types/control_inventory";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "Low stock", label: "Low stock" },
  { value: "Out of stock", label: "Out of stock" },
];

const stagger = (i: number) => Math.min(i, 8) * 50;

// Shelves follow the dashboard's category order; anything unknown goes last under its own name.
function shelvesOf(items: InventoryItemGroup[]): { category: string; items: InventoryItemGroup[] }[] {
  const byCategory = new Map<string, InventoryItemGroup[]>();
  for (const item of items) {
    const key = item.category || "Other";
    byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
  }
  const rank = (c: string) => {
    const i = ITEM_CATEGORIES.indexOf(c);
    return i === -1 ? ITEM_CATEGORIES.length : i;
  };
  return [...byCategory.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)).map(([category, rows]) => ({ category, items: rows }));
}

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
  const low = items.filter((i) => i.status === "Low stock").length;
  const out = items.filter((i) => i.status === "Out of stock").length;
  const units = items.reduce((sum, i) => sum + i.onHand, 0);
  const open = (id: string) => router.push({ pathname: "/control/inventory/item/[id]", params: { id } });

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
      <View style={styles.shelves}>
        {shelvesOf(shown).map((shelf, s) => (
          <Animated.View key={shelf.category} entering={FadeInDown.delay(stagger(s + 1)).springify()}>
            <ListGroup title={shelf.category} action={<CountBadge value={shelf.items.length} />}>
              {shelf.items.map((item, i) => (
                <StockRow
                  key={item.id}
                  title={item.name}
                  subtitle={item.variants.length ? `${item.variants.length} variants${item.sku ? ` · ${item.sku}` : ""}` : item.sku || undefined}
                  imageUrl={item.imageUrl || undefined}
                  onHand={item.onHand}
                  status={item.status}
                  onPress={() => open(item.id)}
                  divider={i < shelf.items.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
        ))}
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
          <Animated.View entering={FadeInDown.springify()}>
            <Readout
              lead={{ label: "Units on hand", value: qtyText(units), hint: `across ${items.length} ${items.length === 1 ? "item" : "items"}` }}
              items={[
                { label: "In stock", value: String(items.length - needsAttention) },
                { label: "Low", value: String(low), tone: low ? "warning" : "neutral" },
                { label: "Out", value: String(out), tone: out ? "danger" : "neutral" },
              ]}
            >
              <TickMeter value={items.length - needsAttention} max={items.length} ticks={44} height={16} label={`${items.length - needsAttention} of ${items.length} items in stock`} />
            </Readout>
          </Animated.View>
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
              open(item.id);
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
    marginBottom: spacing.xl,
  },
  shelves: {
    gap: spacing.xl,
  },
  footnote: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.lg,
  },
});
