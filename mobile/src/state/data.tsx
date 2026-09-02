import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import type {
  Channel,
  LiveRoom,
  NotificationItem,
  Plan,
  PortalData,
  Thread,
  WatchItem,
} from "@/types/portal";

type PlansState = { plans: Plan[]; paymentsEnabled: boolean };
type NotificationFeed = { items: NotificationItem[]; unread: number };

type LoadFlags = {
  data: boolean;
  plans: boolean;
  watch: boolean;
  threads: boolean;
  notifications: boolean;
  live: boolean;
  channels: boolean;
};

export type Counts = {
  tickets: number | null;
  orders: number | null;
  memberships: number | null;
  watch: number | null;
  messages: number | null;
  notifications: number | null;
  chats: number | null;
  inbox: number | null;
  liveNow: number | null;
};

type PortalDataState = {
  data: PortalData | null;
  plans: PlansState;
  watch: WatchItem[] | null;
  threads: Thread[] | null;
  notifications: NotificationFeed;
  live: LiveRoom[] | null;
  channels: Channel[] | null;
  qaChannels: Channel[] | null;
  refreshing: boolean;
  loading: LoadFlags;
  counts: Counts;
  refreshAll: () => Promise<void>;
  refreshLive: () => Promise<void>;
  refreshChannels: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
};

const EMPTY_PLANS: PlansState = { plans: [], paymentsEnabled: false };
const EMPTY_NOTIFICATIONS: NotificationFeed = { items: [], unread: 0 };

const PortalDataContext = createContext<PortalDataState | null>(null);

export function PortalDataProvider({ children }: { children: React.ReactNode }) {
  const { status, token, member } = useSession();
  const [data, setData] = useState<PortalData | null>(null);
  const [plans, setPlans] = useState<PlansState>(EMPTY_PLANS);
  const [watch, setWatch] = useState<WatchItem[] | null>(null);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [notifications, setNotifications] =
    useState<NotificationFeed>(EMPTY_NOTIFICATIONS);
  const [live, setLive] = useState<LiveRoom[] | null>(null);
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [qaChannels, setQaChannels] = useState<Channel[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState<LoadFlags>({
    data: false,
    plans: false,
    watch: false,
    threads: false,
    notifications: false,
    live: false,
    channels: false,
  });

  const memberId = member?.id;
  const memberIdRef = useRef(memberId);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading((l) => ({ ...l, data: true }));
    const res = await api<PortalData>("/api/portal/data", { token });
    if (res.ok) setData(res.data);
    else setData({ orders: [], memberships: [], entitlements: {}, tickets: [] });
    setLoading((l) => ({ ...l, data: false }));
  }, [token]);

  const loadPlans = useCallback(async () => {
    if (!token) return;
    setLoading((l) => ({ ...l, plans: true }));
    const res = await api<PlansState>("/api/portal/membership/plans", { token });
    if (res.ok) setPlans({ plans: res.data.plans || [], paymentsEnabled: !!res.data.paymentsEnabled });
    setLoading((l) => ({ ...l, plans: false }));
  }, [token]);

  const loadWatch = useCallback(async () => {
    if (!token) return;
    setLoading((l) => ({ ...l, watch: true }));
    const res = await api<{ items: WatchItem[] }>("/api/portal/watch", { token });
    setWatch(res.ok ? res.data.items : []);
    setLoading((l) => ({ ...l, watch: false }));
  }, [token]);

  const loadThreads = useCallback(async () => {
    if (!token) return;
    setLoading((l) => ({ ...l, threads: true }));
    const res = await api<{ threads: Thread[] }>("/api/portal/threads", { token });
    setThreads(res.ok ? res.data.threads : []);
    setLoading((l) => ({ ...l, threads: false }));
  }, [token]);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    setLoading((l) => ({ ...l, notifications: true }));
    const res = await api<NotificationFeed>("/api/portal/notifications", { token });
    if (res.ok)
      setNotifications({ items: res.data.items || [], unread: res.data.unread || 0 });
    setLoading((l) => ({ ...l, notifications: false }));
  }, [token]);

  // Live drives the tab dot and Home's live strip, so it is shared rather than screen-local.
  const refreshLive = useCallback(async () => {
    if (!token) return;
    setLoading((l) => ({ ...l, live: true }));
    const res = await api<{ rooms: LiveRoom[] }>("/api/portal/live", { token });
    setLive(res.ok ? res.data.rooms : []);
    setLoading((l) => ({ ...l, live: false }));
  }, [token]);

  const refreshChannels = useCallback(async () => {
    if (!token) return;
    setLoading((l) => ({ ...l, channels: true }));
    const [event, qa] = await Promise.all([
      api<{ channels: Channel[] }>("/api/portal/chat/channels?kind=event", { token }),
      api<{ channels: Channel[] }>("/api/portal/chat/channels?kind=qa", { token }),
    ]);
    setChannels(event.ok ? event.data.channels : []);
    setQaChannels(qa.ok ? qa.data.channels : []);
    setLoading((l) => ({ ...l, channels: false }));
  }, [token]);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    await Promise.all([
      loadData(),
      loadPlans(),
      loadWatch(),
      loadThreads(),
      loadNotifications(),
      refreshLive(),
      refreshChannels(),
    ]);
    setRefreshing(false);
  }, [
    token,
    loadData,
    loadPlans,
    loadWatch,
    loadThreads,
    loadNotifications,
    refreshLive,
    refreshChannels,
  ]);

  useEffect(() => {
    if (status !== "authed" || !token) return;
    if (memberIdRef.current === memberId && memberIdRef.current !== undefined) return;
    memberIdRef.current = memberId;
    void refreshAll();
  }, [status, token, memberId, refreshAll]);

  /* eslint-disable react-hooks/set-state-in-effect -- resetting on auth change */
  useEffect(() => {
    if (status !== "guest") return;
    setData(null);
    setPlans(EMPTY_PLANS);
    setWatch(null);
    setThreads(null);
    setNotifications(EMPTY_NOTIFICATIONS);
    setLive(null);
    setChannels(null);
    setQaChannels(null);
  }, [status]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const markNotificationsRead = useCallback(async () => {
    if (!token) return;
    void api("/api/portal/notifications", { method: "POST", token });
    setNotifications((n) => ({
      unread: 0,
      items: n.items.map((i) => ({ ...i, unread: false })),
    }));
  }, [token]);

  const counts = useMemo<Counts>(() => {
    const unreadThreads = (threads || []).filter((t) => t.unread).length;
    const unreadChats = [...(channels || []), ...(qaChannels || [])].reduce(
      (sum, c) => sum + (c.unread || 0),
      0,
    );
    return {
      tickets: data?.tickets?.length || null,
      orders: data?.orders?.length || null,
      memberships: data?.memberships?.length || null,
      watch: watch?.length || null,
      messages: unreadThreads || null,
      notifications: notifications.unread || null,
      chats: unreadChats || null,
      inbox: unreadThreads + notifications.unread + unreadChats || null,
      liveNow: (live || []).filter((r) => r.openNow).length || null,
    };
  }, [data, watch, threads, notifications, live, channels, qaChannels]);

  const value = useMemo(
    () => ({
      data,
      plans,
      watch,
      threads,
      notifications,
      live,
      channels,
      qaChannels,
      refreshing,
      loading,
      counts,
      refreshAll,
      refreshLive,
      refreshChannels,
      markNotificationsRead,
    }),
    [
      data,
      plans,
      watch,
      threads,
      notifications,
      live,
      channels,
      qaChannels,
      refreshing,
      loading,
      counts,
      refreshAll,
      refreshLive,
      refreshChannels,
      markNotificationsRead,
    ],
  );

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
}

export function usePortalData(): PortalDataState {
  const ctx = useContext(PortalDataContext);
  if (!ctx) throw new Error("usePortalData must be used within a PortalDataProvider");
  return ctx;
}
