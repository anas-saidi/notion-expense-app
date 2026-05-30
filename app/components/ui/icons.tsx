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
  ChevronDown,
  ArrowDown,
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
export const ChevronDownIcon  = (p: LucideProps) => <ChevronDown   size={S} {...p} />;
export const ArrowDownIcon    = (p: LucideProps) => <ArrowDown      size={S} {...p} />;
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
export const TrendingUpIcon   = (p: LucideProps) => <TrendingUp    size={S} {...p} />;

/** Switches between Maximize2 (enter) and Minimize2 (exit). */
export function FullScreenIcon({
  expanded = false,
  ...props
}: LucideProps & { expanded?: boolean }) {
  return expanded
    ? <Minimize2 size={S} {...props} />
    : <Maximize2 size={S} {...props} />;
}
