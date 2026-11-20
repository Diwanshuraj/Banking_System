import type { ReactNode } from "react";
import { Clock, Lock01, ShieldTick } from "@untitledui/icons";
import { Link as RouterLink } from "react-router";
import { BANK_NAME, BANK_NAME_HI, BankMark } from "@/components/app/bank-logo";
import { cx } from "@/utils/cx";

/** Bilingual wordmark used on the public pages. */
export const AuthWordmark = ({ tone = "brand" }: { tone?: "brand" | "light" }) => (
    <span className="flex items-center gap-3">
        <BankMark tone={tone} className="size-9" />
        <span className="flex flex-col leading-tight">
            <span className={tone === "light" ? "text-md font-semibold text-white" : "text-md font-semibold text-primary"}>{BANK_NAME}</span>
            <span className={tone === "light" ? "text-xs text-white/60" : "text-xs text-tertiary"} lang="hi">
                {BANK_NAME_HI}
            </span>
        </span>
    </span>
);

export const AuthFooter = ({ className }: { className?: string }) => (
    <footer className={className}>
        <p className="text-xs text-quaternary">
            © {new Date().getFullYear()} {BANK_NAME} · Never share your password, OTP or PIN · Report cyber fraud on 1930
        </p>
    </footer>
);

/** Small "secure connection" pill shown above auth forms. */
export const SecureBadge = ({ children = "256-bit secure connection" }: { children?: ReactNode }) => (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success-primary px-2.5 py-1 text-xs font-medium text-success-primary">
        <Lock01 className="size-3.5" aria-hidden="true" />
        {children}
    </span>
);

/** Heading block used at the top of each brand panel. */
export const PanelHeading = ({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) => (
    <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wider text-brand-300 uppercase">{eyebrow}</p>
        <h2 className="text-display-sm font-semibold tracking-tight text-balance text-white">{title}</h2>
        <p className="text-md text-pretty text-white/65">{description}</p>
    </div>
);

/** Frosted card that sits on the dark brand panel. */
export const GlassCard = ({ className, children }: { className?: string; children: ReactNode }) => (
    <div className={cx("rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur-sm ring-inset", className)}>{children}</div>
);

const TRUST = [
    { icon: ShieldTick, label: "DICGC insured" },
    { icon: Lock01, label: "256-bit encryption" },
    { icon: Clock, label: "24×7 banking" },
];

interface AuthLayoutProps {
    /** Content of the dark brand panel (desktop only). */
    panel: ReactNode;
    /** Link shown at the top right, e.g. "New customer? Open an account". */
    action?: { prompt: string; label: string; to: string };
    /** Max width of the form column. */
    width?: "sm" | "lg";
    children: ReactNode;
}

/** Split-screen chrome shared by login and registration. On desktop it fills exactly one screen. */
export const AuthLayout = ({ panel, action, width = "sm", children }: AuthLayoutProps) => (
    <div className="flex min-h-dvh bg-primary lg:h-dvh lg:overflow-hidden">
        <aside className="relative hidden w-[46%] max-w-170 shrink-0 flex-col overflow-hidden bg-brand-950 lg:flex">
            <div aria-hidden="true" className="absolute -top-48 -right-24 size-120 rounded-full bg-brand-600/30 blur-[120px]" />
            <div aria-hidden="true" className="absolute -bottom-48 -left-24 size-120 rounded-full bg-brand-500/20 blur-[120px]" />

            <div className="relative flex h-full flex-col px-10 py-8 xl:px-16">
                <RouterLink to="/login" className="w-fit rounded-md outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                    <AuthWordmark tone="light" />
                </RouterLink>

                <div className="flex min-h-0 flex-1 items-center py-8">
                    <div className="w-full max-w-md">{panel}</div>
                </div>

                <ul className="flex flex-wrap gap-x-5 gap-y-2">
                    {TRUST.map(({ icon: Icon, label }) => (
                        <li key={label} className="flex items-center gap-2 text-sm text-white/60">
                            <Icon className="size-4 text-brand-300" aria-hidden="true" />
                            {label}
                        </li>
                    ))}
                </ul>
            </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center justify-between gap-4 px-5 pt-5 md:px-10 md:pt-6">
                <RouterLink to="/login" className="rounded-md outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden">
                    <AuthWordmark />
                </RouterLink>
                {action && (
                    <p className="ml-auto text-sm text-tertiary">
                        <span className="hidden sm:inline">{action.prompt} </span>
                        <RouterLink
                            to={action.to}
                            className="rounded-md px-1 font-semibold text-brand-secondary outline-focus-ring hover:text-brand-secondary_hover focus-visible:outline-2"
                        >
                            {action.label}
                        </RouterLink>
                    </p>
                )}
            </header>

            <main className="scrollbar-hide flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 py-6 md:px-10">
                <div className={cx("my-auto flex w-full flex-col", width === "sm" ? "max-w-100" : "max-w-xl")}>{children}</div>
            </main>

            <AuthFooter className="shrink-0 px-5 pb-5 md:px-10" />
        </div>
    </div>
);
