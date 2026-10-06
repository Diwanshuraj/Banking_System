import { cx } from "@/utils/cx";

export const BANK_NAME = "Bharat National Bank";
export const BANK_NAME_HI = "भारत राष्ट्रीय बैंक";

/** Pillar mark on a brand tile — reads as "bank" at 24px. `light` is for dark backgrounds. */
export const BankMark = ({ className, tone = "brand" }: { className?: string; tone?: "brand" | "light" }) => (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cx("size-8 shrink-0", className)}>
        <rect width="32" height="32" rx="8" className={tone === "light" ? "fill-white" : "fill-bg-brand-solid"} />
        <g className={tone === "light" ? "fill-brand-900" : "fill-white"}>
            <path d="M16 6.5 7 11v2h18v-2l-9-4.5Z" />
            <path d="M9 14.5h2.5v7H9zM14.75 14.5h2.5v7h-2.5zM20.5 14.5H23v7h-2.5z" fillOpacity=".9" />
            <path d="M7.5 23h17v2.5h-17z" />
        </g>
    </svg>
);

export const BankLogo = ({ className, subtitle }: { className?: string; subtitle?: string }) => (
    <div className={cx("flex items-center gap-2.5", className)}>
        <BankMark />
        <div className="flex flex-col leading-tight">
            <span className="text-md font-semibold text-primary">{BANK_NAME}</span>
            {subtitle && <span className="text-xs font-medium text-tertiary">{subtitle}</span>}
        </div>
    </div>
);
