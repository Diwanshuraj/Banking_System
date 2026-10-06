import { useEffect, useState } from "react";
import {
    BarChartSquare02,
    Bell01,
    ClipboardCheck,
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
    X as CloseIcon,
} from "@untitledui/icons";
import { Button as AriaButton, Dialog as AriaDialog, Modal as AriaModal, ModalOverlay as AriaModalOverlay } from "react-aria-components";
import { useLocation } from "react-router";
import { NavList } from "@/components/application/app-navigation/base-components/nav-list";
import type { NavItemType } from "@/components/application/app-navigation/config";
import { BankLogo } from "@/components/app/bank-logo";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { initials } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";

type NavEntry = NavItemType;

const customerNav = (unread: number): NavEntry[] => [
    { label: "Dashboard", href: "/", icon: HomeLine },
    { label: "Accounts", href: "/accounts", icon: Wallet02 },
    { label: "Transfer money", href: "/transfer", icon: SwitchHorizontal01 },
    { label: "Payees", href: "/beneficiaries", icon: Users01 },
    { label: "Transactions", href: "/transactions", icon: Receipt },
    { label: "Bill payments", href: "/bills", icon: ClipboardCheck },
    { label: "Fixed deposits", href: "/deposits", icon: PiggyBank01 },
    { label: "Loans", href: "/loans", icon: CoinsStacked01 },
    { label: "Debit cards", href: "/cards", icon: CreditCard02 },
    { label: "Service requests", href: "/services", icon: MessageChatSquare },
    {
        label: "Notifications",
        href: "/notifications",
        icon: Bell01,
        badge: unread > 0 ? (
            <Badge size="sm" type="pill-color" color="brand">
                {unread > 99 ? "99+" : unread}
            </Badge>
        ) : undefined,
    },
    { label: "Profile & security", href: "/profile", icon: User01 },
];

const adminNav: NavEntry[] = [
    { label: "Overview", href: "/admin", icon: BarChartSquare02 },
    { label: "Customers", href: "/admin/customers", icon: Users01 },
    { label: "Accounts", href: "/admin/accounts", icon: Wallet02 },
    { label: "Transactions", href: "/admin/transactions", icon: Receipt },
    { label: "Loan approvals", href: "/admin/loans", icon: CoinsStacked01 },
    { label: "Service requests", href: "/admin/requests", icon: MessageChatSquare },
    { label: "Bank settings", href: "/admin/settings", icon: Settings01 },
];

/** The nav href that best matches the current path, so /accounts/12 highlights "Accounts". */
const matchActive = (pathname: string, items: NavEntry[]) => {
    const hrefs = items.map((item) => item.href).filter((href): href is string => Boolean(href));
    return hrefs
        .filter((href) => pathname === href || (href !== "/" && href !== "/admin" && pathname.startsWith(href + "/")))
        .sort((a, b) => b.length - a.length)[0];
};

const SidebarContent = ({ variant, unread }: { variant: "customer" | "admin"; unread: number }) => {
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { pathname } = useLocation();

    const items = variant === "admin" ? adminNav : customerNav(unread);
    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        // Sized to fit the viewport without scrolling; on short screens every nav row tightens by the same amount.
        <aside className="flex h-full w-full scrollbar-hide flex-col overflow-y-auto border-secondary bg-primary pt-4 lg:w-70 lg:border-r [@media(max-height:820px)]:[&_li>a]:py-1.5">
            <div className="px-5">
                <BankLogo subtitle={variant === "admin" ? "Branch administration" : "Internet banking"} />
            </div>

            <NavList activeUrl={matchActive(pathname, items)} items={items} className="gap-1 pt-4 [&>li]:py-0" />

            <div className="mt-auto px-4 pt-3 pb-4">
                {user && (
                    <div className="flex items-center gap-3 rounded-xl p-2.5 ring-1 ring-secondary ring-inset">
                        <Avatar size="md" initials={initials(user.fullName)} />
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold text-primary">{user.fullName}</span>
                            <span className="truncate text-xs text-tertiary">
                                {variant === "admin" ? "Administrator" : `CIF ${user.customerId}`}
                            </span>
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
            <header className="sticky top-0 z-40 flex h-16 print:hidden items-center justify-between border-b border-secondary bg-primary px-4 lg:hidden">
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
