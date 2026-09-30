/**
 * Icon re-exports from lucide-react.
 * All icons default to size=18 to match the app's existing sizing.
 * Pass `size` explicitly to override (e.g. <HomeIcon size={20} />).
 *
 * TrashIcon (with open-lid / shake animation) lives in DelightIcons.tsx.
 */

import {
  Pencil,
  Search,
  Calendar,
  CalendarRange,
  Check,
  Plus,
  Home,
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
  Repeat2,
  Snowflake,
  X,
  SlidersHorizontal,
  Scale,
  Shuffle,
  TrendingUp,
  TriangleAlert,
  Flame,
  ChartPie,
  Settings,
  Delete,
  MoreHorizontal,
  ReceiptText,
  WalletCards,
  type LucideProps,
} from "lucide-react";

export type IconProps = LucideProps;

const S = 18; // default size — matches previous hand-rolled SVG default

export const SearchIcon       = (p: LucideProps) => <Search        size={S} {...p} />;
export const CalendarIcon     = (p: LucideProps) => <Calendar      size={S} {...p} />;
export const CalendarRangeIcon = (p: LucideProps) => <CalendarRange size={S} {...p} />;
export const CheckIcon        = (p: LucideProps) => <Check         size={S} {...p} />;
export const PlusIcon         = (p: LucideProps) => <Plus          size={S} {...p} />;
export const HomeIcon         = (p: LucideProps) => <Home          size={S} {...p} />;
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
export const RepeatIcon       = (p: LucideProps) => <Repeat2        size={S} {...p} />;
export const FreezeIcon       = (p: LucideProps) => <Snowflake      size={S} {...p} />;
export const XIcon            = (p: LucideProps) => <X             size={S} {...p} />;
export const SlidersIcon      = (p: LucideProps) => <SlidersHorizontal size={S} {...p} />;
export const ScaleIcon        = (p: LucideProps) => <Scale             size={S} {...p} />;
export const EditIcon         = (p: LucideProps) => <Pencil            size={S} {...p} />;
export const ShuffleIcon      = (p: LucideProps) => <Shuffle           size={S} {...p} />;
export const DeleteIcon       = (p: LucideProps) => <Delete        size={S} {...p} />;
/**
 * Type it: write transactions in plain words. A filled four-point star rather
 * than Lucide's outline sparkles; it takes the text colour like the other icons.
 */
export const SparklesIcon = ({ size = S, color = "currentColor", strokeWidth: _strokeWidth, absoluteStrokeWidth: _absolute, ...rest }: LucideProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} {...rest}>
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
  </svg>
);
export const MoreIcon         = (p: LucideProps) => <MoreHorizontal size={S} {...p} />;
export const ReceiptIcon      = (p: LucideProps) => <ReceiptText    size={S} {...p} />;
export const WalletIcon       = (p: LucideProps) => <WalletCards    size={S} {...p} />;
export const TrendingUpIcon      = (p: LucideProps) => <TrendingUp    size={S} {...p} />;
export const AlertTriangleIcon   = (p: LucideProps) => <TriangleAlert size={S} {...p} />;
export const FlameIcon           = (p: LucideProps) => <Flame         size={S} {...p} />;
export const ChartPieIcon        = (p: LucideProps) => <ChartPie      size={S} {...p} />;
export const SettingsIcon        = (p: LucideProps) => <Settings      size={S} {...p} />;

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
