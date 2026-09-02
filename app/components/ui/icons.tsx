/**
 * Icon re-exports from lucide-react.
 * All icons default to size=18 to match the app's existing sizing.
 * Pass `size` explicitly to override (e.g. <HomeIcon size={20} />).
 *
 * TrashIcon (with open-lid / shake animation) lives in DelightIcons.tsx.
 */

import {
  Search,
  Calendar,
  Check,
  Plus,
  Home,
  Clock,
  List,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRightLeft,
  Banknote,
  HandCoins,
  RotateCcw,
  Snowflake,
  X,
  Maximize2,
  Minimize2,
  Wrench,
  SlidersHorizontal,
  Scale,
  Shuffle,
  Menu,
  Landmark,
  User,
  UserRound,
  TrendingUp,
  Moon,
  Sun,
  TriangleAlert,
  Flame,
  UsersRound,
  ChartPie,
  type LucideProps,
} from "lucide-react";

export type IconProps = LucideProps;

const S = 18; // default size — matches previous hand-rolled SVG default

export const SearchIcon       = (p: LucideProps) => <Search        size={S} {...p} />;
export const CalendarIcon     = (p: LucideProps) => <Calendar      size={S} {...p} />;
export const CheckIcon        = (p: LucideProps) => <Check         size={S} {...p} />;
export const PlusIcon         = (p: LucideProps) => <Plus          size={S} {...p} />;
export const HomeIcon         = (p: LucideProps) => <Home          size={S} {...p} />;
export const ClockIcon        = (p: LucideProps) => <Clock         size={S} {...p} />;
export const ListIcon         = (p: LucideProps) => <List          size={S} {...p} />;
export const ChevronRightIcon = (p: LucideProps) => <ChevronRight  size={S} {...p} />;
export const ChevronLeftIcon  = (p: LucideProps) => <ChevronLeft   size={S} {...p} />;
export const ChevronDownIcon  = (p: LucideProps) => <ChevronDown   size={S} {...p} />;
export const ArrowDownIcon    = (p: LucideProps) => <ArrowDown      size={S} {...p} />;
export const ArrowUpIcon      = (p: LucideProps) => <ArrowUp        size={S} {...p} />;
export const ArrowLeftIcon    = (p: LucideProps) => <ArrowLeft      size={S} {...p} />;
export const TransferIcon     = (p: LucideProps) => <ArrowRightLeft size={S} {...p} />;
export const BanknoteIcon     = (p: LucideProps) => <Banknote       size={S} {...p} />;
export const FundIcon         = (p: LucideProps) => <HandCoins      size={S} {...p} />;
export const ReviveIcon       = (p: LucideProps) => <RotateCcw      size={S} {...p} />;
export const FreezeIcon       = (p: LucideProps) => <Snowflake      size={S} {...p} />;
export const XIcon            = (p: LucideProps) => <X             size={S} {...p} />;
export const WrenchIcon       = (p: LucideProps) => <Wrench        size={S} {...p} />;
export const SlidersIcon      = (p: LucideProps) => <SlidersHorizontal size={S} {...p} />;
export const ScaleIcon        = (p: LucideProps) => <Scale             size={S} {...p} />;
export const ShuffleIcon      = (p: LucideProps) => <Shuffle           size={S} {...p} />;
export const MenuIcon         = (p: LucideProps) => <Menu          size={S} {...p} />;
export const LandmarkIcon     = (p: LucideProps) => <Landmark      size={S} {...p} />;
export const UserIcon         = (p: LucideProps) => <User          size={S} {...p} />;
export const UserRoundIcon    = (p: LucideProps) => <UserRound     size={S} {...p} />;
export const TrendingUpIcon      = (p: LucideProps) => <TrendingUp    size={S} {...p} />;
export const AlertTriangleIcon   = (p: LucideProps) => <TriangleAlert size={S} {...p} />;
export const MoonIcon            = (p: LucideProps) => <Moon          size={S} {...p} />;
export const SunIcon             = (p: LucideProps) => <Sun           size={S} {...p} />;
export const FlameIcon           = (p: LucideProps) => <Flame         size={S} {...p} />;
export const UsersRoundIcon      = (p: LucideProps) => <UsersRound    size={S} {...p} />;
export const ChartPieIcon        = (p: LucideProps) => <ChartPie      size={S} {...p} />;

/** Compact filled people pictograms for identity controls. */
export function ManIcon({ size = S, ...props }: LucideProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="12" cy="5.5" r="3" />
      <path d="M7.2 10h9.6c1 0 1.8.8 1.8 1.8V17h-2.7v5h-2.6v-5h-2.6v5H8.1v-5H5.4v-5.2c0-1 .8-1.8 1.8-1.8Z" />
    </svg>
  );
}

export function WomanIcon({ size = S, ...props }: LucideProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="12" cy="5.5" r="3" />
      <path d="M9.2 10h5.6c.8 0 1.5.5 1.8 1.2L19 18h-3.2v4h-2.5v-4h-2.6v4H8.2v-4H5l2.4-6.8c.3-.7 1-1.2 1.8-1.2Z" />
    </svg>
  );
}

/** Switches between Maximize2 (enter) and Minimize2 (exit). */
export function FullScreenIcon({
  expanded = false,
  ...props
}: LucideProps & { expanded?: boolean }) {
  return expanded
    ? <Minimize2 size={S} {...props} />
    : <Maximize2 size={S} {...props} />;
}
