import type { FC, ReactNode } from "react";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";

interface StatCardProps {
    label: string;
    value: ReactNode;
    icon?: FC<{ className?: string }>;
    /** Small line under the value, e.g. "3 active deposits". */
    footer?: ReactNode;
}

export const StatCard = ({ label, value, icon, footer }: StatCardProps) => (
    <div className="flex flex-col gap-4 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary md:p-6">
        <div className="flex items-center gap-3">
            {icon && <FeaturedIcon icon={icon} color="gray" theme="modern" size="md" />}
            <h3 className="text-sm font-semibold text-tertiary">{label}</h3>
        </div>
        <div className="flex flex-col gap-1">
            <p className="text-display-xs font-semibold text-primary tabular-nums">{value}</p>
            {footer && <div className="text-sm text-tertiary">{footer}</div>}
        </div>
    </div>
);
