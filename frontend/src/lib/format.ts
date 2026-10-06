const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹2,48,500.75 */
export const formatINR = (value: number | null | undefined) => inr.format(value ?? 0);

/** ₹2,48,501 */
export const formatINRWhole = (value: number | null | undefined) => inrCompact.format(value ?? 0);

/** ₹2.5L / ₹1.2Cr — for chart axes and dense stats. */
export const formatINRShort = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1e7) return `₹${(value / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
    if (abs >= 1e5) return `₹${(value / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
    if (abs >= 1e3) return `₹${(value / 1e3).toFixed(0)}K`;
    return `₹${value.toFixed(0)}`;
};

const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);

/** 26 Sep 2026 */
export const formatDate = (iso: string | null | undefined) =>
    iso ? toDate(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** 26 Sep 2026, 2:32 pm */
export const formatDateTime = (iso: string | null | undefined) =>
    iso
        ? toDate(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
        : "—";

/** "2 hours ago" style relative time for notifications. */
export const formatRelative = (iso: string) => {
    const diff = (Date.now() - toDate(iso).getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d ago`;
    return formatDate(iso);
};

/** XXXXXXX4881 */
export const maskAccount = (accountNumber: string) => `XXXXXXX${accountNumber.slice(-4)}`;

/** "SAVINGS" -> "Savings", "BILL_PAYMENT" -> "Bill payment" */
export const humanize = (value: string) => {
    const text = value.replace(/_/g, " ").toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
};

export const initials = (name: string) =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join("");

/** yyyy-mm-dd for the local date, for API query params. */
export const toIsoDate = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

/** Standard reducing-balance EMI. */
export const calculateEmi = (principal: number, annualRate: number, months: number) => {
    if (!principal || !months) return 0;
    const r = annualRate / 12 / 100;
    if (r === 0) return principal / months;
    const factor = Math.pow(1 + r, months);
    return (principal * r * factor) / (factor - 1);
};

/** FD maturity with quarterly compounding, the convention Indian banks use. */
export const calculateFdMaturity = (principal: number, annualRate: number, months: number) => {
    if (!principal || !months) return principal || 0;
    return principal * Math.pow(1 + annualRate / 400, (months / 12) * 4);
};
