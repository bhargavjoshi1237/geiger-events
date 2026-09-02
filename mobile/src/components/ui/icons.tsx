import ArrowRight from "lucide-react-native/icons/arrow-right";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import Award from "lucide-react-native/icons/award";
import Bell from "lucide-react-native/icons/bell";
import BellOff from "lucide-react-native/icons/bell-off";
import Briefcase from "lucide-react-native/icons/briefcase";
import Calendar from "lucide-react-native/icons/calendar";
import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CirclePlay from "lucide-react-native/icons/circle-play";
import CircleQuestionMark from "lucide-react-native/icons/circle-question-mark";
import Clock from "lucide-react-native/icons/clock";
import Copy from "lucide-react-native/icons/copy";
import CornerUpLeft from "lucide-react-native/icons/corner-up-left";
import CreditCard from "lucide-react-native/icons/credit-card";
import DollarSign from "lucide-react-native/icons/dollar-sign";
import ExternalLink from "lucide-react-native/icons/external-link";
import FileText from "lucide-react-native/icons/file-text";
import Funnel from "lucide-react-native/icons/funnel";
import House from "lucide-react-native/icons/house";
import Inbox from "lucide-react-native/icons/inbox";
import Info from "lucide-react-native/icons/info";
import LogOut from "lucide-react-native/icons/log-out";
import Mail from "lucide-react-native/icons/mail";
import MapPin from "lucide-react-native/icons/map-pin";
import Maximize from "lucide-react-native/icons/maximize";
import Menu from "lucide-react-native/icons/menu";
import MessageCircle from "lucide-react-native/icons/message-circle";
import MessageSquare from "lucide-react-native/icons/message-square";
import Monitor from "lucide-react-native/icons/monitor";
import Navigation from "lucide-react-native/icons/navigation";
import Package from "lucide-react-native/icons/package";
import Play from "lucide-react-native/icons/play";
import QrCode from "lucide-react-native/icons/qr-code";
import Radio from "lucide-react-native/icons/radio";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import Search from "lucide-react-native/icons/search";
import Send from "lucide-react-native/icons/send";
import Shield from "lucide-react-native/icons/shield";
import ShoppingBag from "lucide-react-native/icons/shopping-bag";
import Smartphone from "lucide-react-native/icons/smartphone";
import SquarePen from "lucide-react-native/icons/square-pen";
import Star from "lucide-react-native/icons/star";
import Sun from "lucide-react-native/icons/sun";
import Tag from "lucide-react-native/icons/tag";
import Users from "lucide-react-native/icons/users";
import VideoOff from "lucide-react-native/icons/video-off";
import Volume2 from "lucide-react-native/icons/volume-2";
import WifiOff from "lucide-react-native/icons/wifi-off";
import X from "lucide-react-native/icons/x";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { colors } from "@/theme/tokens";

// Every icon is deep-imported: Metro does not tree-shake, so the barrel would bundle all ~1800.
export const ICONS = {
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  award: Award,
  bell: Bell,
  "bell-off": BellOff,
  briefcase: Briefcase,
  calendar: Calendar,
  check: Check,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  "circle-play": CirclePlay,
  "circle-question-mark": CircleQuestionMark,
  clock: Clock,
  copy: Copy,
  "corner-up-left": CornerUpLeft,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  "external-link": ExternalLink,
  "file-text": FileText,
  funnel: Funnel,
  house: House,
  inbox: Inbox,
  info: Info,
  "log-out": LogOut,
  mail: Mail,
  "map-pin": MapPin,
  maximize: Maximize,
  menu: Menu,
  "message-circle": MessageCircle,
  "message-square": MessageSquare,
  monitor: Monitor,
  navigation: Navigation,
  package: Package,
  play: Play,
  "qr-code": QrCode,
  radio: Radio,
  "rotate-ccw": RotateCcw,
  search: Search,
  send: Send,
  shield: Shield,
  "shopping-bag": ShoppingBag,
  smartphone: Smartphone,
  "square-pen": SquarePen,
  star: Star,
  sun: Sun,
  tag: Tag,
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
