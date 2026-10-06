import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import { BANK_NAME, BANK_NAME_HI, BankMark } from "@/components/app/bank-logo";

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

/** Plain page chrome for public pages other than login: header, content, footer. */
export const AuthShell = ({ children, action }: { children: ReactNode; action?: { prompt: string; label: string; to: string } }) => (
    <div className="flex min-h-dvh flex-col bg-secondary">
        <header className="border-t-4 border-brand-700 border-b border-b-secondary bg-primary">
            <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 md:px-8">
                <RouterLink to="/login" className="rounded-md outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                    <AuthWordmark />
                </RouterLink>
                {action && (
                    <p className="text-sm text-tertiary">
                        <span className="hidden sm:inline">{action.prompt} </span>
                        <RouterLink to={action.to} className="font-semibold text-brand-secondary hover:text-brand-secondary_hover">
                            {action.label}
                        </RouterLink>
                    </p>
                )}
            </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8 md:py-12">{children}</main>

        <AuthFooter className="mx-auto w-full max-w-5xl px-4 pb-8 md:px-8" />
    </div>
);

export const AuthFooter = ({ className }: { className?: string }) => (
    <footer className={className}>
        <p className="text-xs text-quaternary">
            © {new Date().getFullYear()} {BANK_NAME} · Deposits insured up to ₹5,00,000 by DICGC · Report cyber fraud on 1930
        </p>
    </footer>
);
