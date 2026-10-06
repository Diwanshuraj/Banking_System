import { BadgeWithDot } from "@/components/base/badges/badges";
import { humanize } from "@/lib/format";

type BadgeColor = "success" | "warning" | "error" | "gray" | "brand" | "blue";

const statusColors: Record<string, BadgeColor> = {
    ACTIVE: "success",
    SUCCESS: "success",
    COMPLETED: "success",
    MATURED: "brand",
    APPROVED: "success",
    PENDING: "warning",
    OPEN: "warning",
    IN_PROGRESS: "blue",
    FROZEN: "error",
    BLOCKED: "error",
    HOTLISTED: "error",
    SUSPENDED: "error",
    LOCKED: "error",
    FAILED: "error",
    REJECTED: "error",
    CLOSED: "gray",
};

/** Status pill used for every entity status (accounts, loans, requests, cards…). */
export const StatusBadge = ({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) => (
    <BadgeWithDot type="pill-color" size={size} color={statusColors[status] ?? "gray"}>
        {humanize(status)}
    </BadgeWithDot>
);
