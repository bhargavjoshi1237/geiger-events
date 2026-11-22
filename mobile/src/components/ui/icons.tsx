import ArrowRight from "lucide-react-native/icons/arrow-right";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import Award from "lucide-react-native/icons/award";
import Briefcase from "lucide-react-native/icons/briefcase";
import Calendar from "lucide-react-native/icons/calendar";
import CalendarCheck from "lucide-react-native/icons/calendar-check";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import CalendarSync from "lucide-react-native/icons/calendar-sync";
import CalendarX from "lucide-react-native/icons/calendar-x";
import ChartColumn from "lucide-react-native/icons/chart-column";
import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CirclePlay from "lucide-react-native/icons/circle-play";
import CircleQuestionMark from "lucide-react-native/icons/circle-question-mark";
import ClipboardCheck from "lucide-react-native/icons/clipboard-check";
import Clock from "lucide-react-native/icons/clock";
import Copy from "lucide-react-native/icons/copy";
import CornerUpLeft from "lucide-react-native/icons/corner-up-left";
import CreditCard from "lucide-react-native/icons/credit-card";
import DollarSign from "lucide-react-native/icons/dollar-sign";
import ExternalLink from "lucide-react-native/icons/external-link";
import FileText from "lucide-react-native/icons/file-text";
import Funnel from "lucide-react-native/icons/funnel";
import Gift from "lucide-react-native/icons/gift";
import House from "lucide-react-native/icons/house";
import IdCard from "lucide-react-native/icons/id-card";
import Inbox from "lucide-react-native/icons/inbox";
import Info from "lucide-react-native/icons/info";
import Link from "lucide-react-native/icons/link";
import LogOut from "lucide-react-native/icons/log-out";
import Mail from "lucide-react-native/icons/mail";
import MapPin from "lucide-react-native/icons/map-pin";
import Maximize from "lucide-react-native/icons/maximize";
import Megaphone from "lucide-react-native/icons/megaphone";
import Menu from "lucide-react-native/icons/menu";
import MessageCircle from "lucide-react-native/icons/message-circle";
import MessageCircleQuestionMark from "lucide-react-native/icons/message-circle-question-mark";
import MessageSquare from "lucide-react-native/icons/message-square";
import MessagesSquare from "lucide-react-native/icons/messages-square";
import Monitor from "lucide-react-native/icons/monitor";
import Navigation from "lucide-react-native/icons/navigation";
import Package from "lucide-react-native/icons/package";
import Play from "lucide-react-native/icons/play";
import QrCode from "lucide-react-native/icons/qr-code";
import Radio from "lucide-react-native/icons/radio";
import Receipt from "lucide-react-native/icons/receipt";
import Reply from "lucide-react-native/icons/reply";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import ScanLine from "lucide-react-native/icons/scan-line";
import Search from "lucide-react-native/icons/search";
import Send from "lucide-react-native/icons/send";
import Settings from "lucide-react-native/icons/settings";
import Share from "lucide-react-native/icons/share";
import Shield from "lucide-react-native/icons/shield";
import ShoppingBag from "lucide-react-native/icons/shopping-bag";
import Smartphone from "lucide-react-native/icons/smartphone";
import SquarePen from "lucide-react-native/icons/square-pen";
import Star from "lucide-react-native/icons/star";
import Sun from "lucide-react-native/icons/sun";
import Tag from "lucide-react-native/icons/tag";
import Ticket from "lucide-react-native/icons/ticket";
import TicketX from "lucide-react-native/icons/ticket-x";
import Users from "lucide-react-native/icons/users";
import VideoOff from "lucide-react-native/icons/video-off";
import Volume2 from "lucide-react-native/icons/volume-2";
import WifiOff from "lucide-react-native/icons/wifi-off";
import X from "lucide-react-native/icons/x";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { BRAND_BARS, BRAND_VIEW_BOX } from "@/components/BrandMark";
import { colors } from "@/theme/tokens";

// Lucide's props, taken off a deep-imported icon so the barrel stays out of the bundle.
type GlyphProps = React.ComponentProps<typeof Calendar>;

// The Geiger mark with lucide's props so it slots into ICONS; filled, so strokeWidth is ignored. Centred in a square box.
function GeigerMark({ size = 24, color = colors.foreground, style }: GlyphProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={BRAND_VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
      style={style}
    >
      {BRAND_BARS.map((d) => (
        <Path key={d} d={d} fill={color} />
      ))}
    </Svg>
  );
}

// Every icon is deep-imported: Metro does not tree-shake, so the barrel would bundle all ~1800.
export const ICONS = {
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  award: Award,
  briefcase: Briefcase,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  "calendar-clock": CalendarClock,
  "calendar-sync": CalendarSync,
  "calendar-x": CalendarX,
  "chart-column": ChartColumn,
  check: Check,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  "circle-play": CirclePlay,
  "circle-question-mark": CircleQuestionMark,
  "clipboard-check": ClipboardCheck,
  clock: Clock,
  copy: Copy,
  "corner-up-left": CornerUpLeft,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  "external-link": ExternalLink,
  "file-text": FileText,
  funnel: Funnel,
  geiger: GeigerMark,
  gift: Gift,
  house: House,
  "id-card": IdCard,
  inbox: Inbox,
  info: Info,
  link: Link,
  "log-out": LogOut,
  mail: Mail,
  "map-pin": MapPin,
  maximize: Maximize,
  megaphone: Megaphone,
  menu: Menu,
  "message-circle": MessageCircle,
  "message-circle-question-mark": MessageCircleQuestionMark,
  "message-square": MessageSquare,
  "messages-square": MessagesSquare,
  monitor: Monitor,
  navigation: Navigation,
  package: Package,
  play: Play,
  "qr-code": QrCode,
  radio: Radio,
  receipt: Receipt,
  reply: Reply,
  "rotate-ccw": RotateCcw,
  "scan-line": ScanLine,
  search: Search,
  send: Send,
  settings: Settings,
  share: Share,
  shield: Shield,
  "shopping-bag": ShoppingBag,
  smartphone: Smartphone,
  "square-pen": SquarePen,
  star: Star,
  sun: Sun,
  tag: Tag,
  ticket: Ticket,
  "ticket-x": TicketX,
  users: Users,
  "video-off": VideoOff,
  "volume-2": Volume2,
  "wifi-off": WifiOff,
  x: X,
} as const;

export type IconName = keyof typeof ICONS;

export function getIcon(name: IconName) {
  return ICONS[name];
}

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function Icon({
  name,
  size = 20,
  color = colors.foreground,
  strokeWidth = 2,
  style,
}: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}
