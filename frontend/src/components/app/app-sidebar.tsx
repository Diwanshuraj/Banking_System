import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
    BarChartSquare02,
    Bell01,
    ClipboardCheck,
    X as CloseIcon,
    CoinsStacked01,
    CreditCard02,
    HomeLine,
    LogOut01,
    Menu02,
    MessageChatSquare,
    Moon01,
    PiggyBank01,
    Receipt,
    Settings01,
    Sun,
    SwitchHorizontal01,
    User01,
    Users01,
    Wallet02,
} from "@untitledui/icons";
import { Button as AriaButton, Dialog as AriaDialog, Link as AriaLink, Modal as AriaModal, ModalOverlay as AriaModalOverlay } from "react-aria-components";
import { useLocation } from "react-router";
import { BankLogo } from "@/components/app/bank-logo";
import { Avatar } from "@/components/base/avatar/avatar";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { initials } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";

type NavLink = { label: string; href: string; icon: FC<{ className?: string }>; count?: number };
type NavSection = { title: string; items: NavLink[] };

const customerNav = (unread: number): NavSection[] => [
    {
        title: "Overview",
        items: [
            { label: "Dashboard", href: "/", icon: HomeLine },
            { label: "Accounts", href: "/accounts", icon: Wallet02 },
            { label: "Transactions", href: "/transactions", icon: Receipt },
        ],
    },
    {
        title: "Payments",
        items: [
            { label: "Transfer money", href: "/transfer", icon: SwitchHorizontal01 },
            { label: "Payees", href: "/beneficiaries", icon: Users01 },
            { label: "Bill payments", href: "/bills", icon: ClipboardCheck },
        ],
    },
    {
        title: "Savings & credit",
        items: [
            { label: "Fixed deposits", href: "/deposits", icon: PiggyBank01 },
            { label: "Loans", href: "/loans", icon: CoinsStacked01 },
            { label: "Debit cards", href: "/cards", icon: CreditCard02 },
        ],
    },
    {
        title: "Support & settings",
        items: [
            { label: "Notifications", href: "/notifications", icon: Bell01, count: unread },
            { label: "Service requests", href: "/services", icon: MessageChatSquare },
            { label: "Profile & security", href: "/profile", icon: User01 },
        ],
    },
];

const adminNav: NavSection[] = [
    {
        title: "Overview",
        items: [{ label: "Dashboard", href: "/admin", icon: BarChartSquare02 }],
    },
    {
        title: "Customers & ledger",
        items: [
            { label: "Customers", href: "/admin/customers", icon: Users01 },
            { label: "Accounts", href: "/admin/accounts", icon: Wallet02 },
            { label: "Transactions", href: "/admin/transactions", icon: Receipt },
        ],
    },
    {
        title: "Operations",
        items: [
            { label: "Loan approvals", href: "/admin/loans", icon: CoinsStacked01 },
            { label: "Service requests", href: "/admin/requests", icon: MessageChatSquare },
        ],
    },
    {
        title: "Settings",
        items: [{ label: "Bank settings", href: "/admin/settings", icon: Settings01 }],
    },
];

/** The nav href that best matches the current path, so /accounts/12 highlights "Accounts". */
const matchActive = (pathname: string, sections: NavSection[]) =>
    sections
        .flatMap((section) => section.items.map((item) => item.href))
        .filter((href) => pathname === href || (href !== "/" && href !== "/admin" && pathname.startsWith(href + "/")))
        .sort((a, b) => b.length - a.length)[0];

const SidebarLink = ({ item, isCurrent }: { item: NavLink; isCurrent: boolean }) => {
    const Icon = item.icon;
    return (
        <AriaLink
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={cx(
                "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2",
                isCurrent ? "bg-brand-primary_alt text-brand-secondary" : "text-secondary hover:bg-primary_hover hover:text-secondary_hover",
            )}
        >
            {isCurrent && <span aria-hidden="true" className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-brand-solid" />}
            <Icon
                aria-hidden="true"
                className={cx("size-5 shrink-0", isCurrent ? "text-fg-brand-primary" : "text-fg-quaternary group-hover:text-fg-quaternary_hover")}
            />
            <span className="flex-1 truncate">{item.label}</span>
            {item.count ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-solid px-1.5 text-xs font-semibold text-white">
                    {item.count > 99 ? "99+" : item.count}
                </span>
            ) : null}
        </AriaLink>
    );
};

const SidebarSection = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="flex flex-col gap-0.5">
        <p className="px-2.5 pb-1 text-xs font-semibold tracking-wider text-quaternary uppercase">{title}</p>
        {children}
    </div>
);

const SidebarContent = ({ variant, unread }: { variant: "customer" | "admin"; unread: number }) => {
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { pathname } = useLocation();

    const sections = variant === "admin" ? adminNav : customerNav(unread);
    const activeHref = matchActive(pathname, sections);
    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        <aside className="flex h-full w-full flex-col border-secondary bg-primary lg:w-70 lg:border-r">
            <div className="border-b border-secondary px-5 py-4">
                <BankLogo subtitle={variant === "admin" ? "Branch administration" : "Internet banking"} />
            </div>

            <nav aria-label="Main" className="scrollbar-hide flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
                {sections.map((section) => (
                    <SidebarSection key={section.title} title={section.title}>
                        {section.items.map((item) => (
                            <SidebarLink key={item.href} item={item} isCurrent={item.href === activeHref} />
                        ))}
                    </SidebarSection>
                ))}
            </nav>

            <div className="border-t border-secondary p-3">
                {user && (
                    <div className="flex items-center gap-3 rounded-xl bg-secondary p-2.5">
                        <Avatar size="md" initials={initials(user.fullName)} />
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold text-primary">{user.fullName}</span>
                            <span className="truncate text-xs text-tertiary">{variant === "admin" ? "Administrator" : `CIF ${user.customerId}`}</span>
                        </div>
                        <div className="flex gap-0.5">
                            <ButtonUtility
                                size="xs"
                                color="tertiary"
                                tooltip={isDark ? "Light mode" : "Dark mode"}
                                icon={isDark ? Sun : Moon01}
                                onClick={() => setTheme(isDark ? "light" : "dark")}
                            />
                            <ButtonUtility size="xs" color="tertiary" tooltip="Sign out" icon={LogOut01} onClick={logout} />
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};

export const AppSidebar = ({ variant, unread = 0 }: { variant: "customer" | "admin"; unread?: number }) => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const { pathname } = useLocation();

    // Close the mobile drawer after navigating.
    useEffect(() => setIsMobileOpen(false), [pathname]);

    return (
        <>
            <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-secondary bg-primary px-4 lg:hidden print:hidden">
                <BankLogo />
                <AriaButton
                    aria-label="Open navigation menu"
                    onPress={() => setIsMobileOpen(true)}
                    className="flex items-center justify-center rounded-lg p-2 text-fg-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <Menu02 className="size-6" />
                </AriaButton>
            </header>

            <AriaModalOverlay
                isOpen={isMobileOpen}
                onOpenChange={setIsMobileOpen}
                isDismissable
                className={({ isEntering, isExiting }) =>
                    cx(
                        "fixed inset-0 z-50 bg-overlay/70 pr-16 backdrop-blur-md lg:hidden",
                        isEntering && "duration-300 ease-in-out animate-in fade-in",
                        isExiting && "duration-200 ease-in-out animate-out fade-out",
                    )
                }
            >
                <AriaButton
                    aria-label="Close navigation menu"
                    onPress={() => setIsMobileOpen(false)}
                    className="fixed top-3 right-3 flex items-center justify-center rounded-lg p-2 text-fg-white/70 outline-focus-ring hover:bg-white/10 hover:text-fg-white"
                >
                    <CloseIcon className="size-6" />
                </AriaButton>
                <AriaModal className="h-dvh w-full max-w-80">
                    <AriaDialog aria-label="Navigation" className="h-full outline-hidden">
                        <SidebarContent variant={variant} unread={unread} />
                    </AriaDialog>
                </AriaModal>
            </AriaModalOverlay>

            <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex print:hidden">
                <SidebarContent variant={variant} unread={unread} />
            </div>
        </>
    );
};
