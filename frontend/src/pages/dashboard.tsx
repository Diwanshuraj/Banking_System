import type { FC } from "react";
import { ArrowRight, ClipboardCheck, CoinsStacked01, CreditCard02, Lock01, PiggyBank01, Receipt, SwitchHorizontal01, Wallet02 } from "@untitledui/icons";
import { Link as RouterLink } from "react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState, EmptyPanel, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { TransactionList } from "@/components/app/transaction-list";
import { ChartLegendContent, ChartTooltipContent } from "@/components/application/charts/charts-base";
import { Button } from "@/components/base/buttons/button";
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDateTime, formatINR, formatINRShort, humanize, maskAccount } from "@/lib/format";
import type { Account, MonthlyFlow } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { cx } from "@/utils/cx";

const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
};

const QUICK_ACTIONS: { label: string; href: string; icon: FC<{ className?: string }> }[] = [
    { label: "Transfer", href: "/transfer", icon: SwitchHorizontal01 },
    { label: "Pay bills", href: "/bills", icon: ClipboardCheck },
    { label: "Open FD", href: "/deposits", icon: PiggyBank01 },
    { label: "Apply for loan", href: "/loans", icon: CoinsStacked01 },
    { label: "Cards", href: "/cards", icon: CreditCard02 },
];

export const SetPinBanner = () => (
    <div className="flex flex-col gap-4 rounded-xl bg-warning-primary p-4 ring-1 ring-utility-yellow-200 ring-inset sm:flex-row sm:items-center md:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-secondary text-fg-warning-primary">
            <Lock01 className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-semibold text-primary">Set your transaction PIN</p>
            <p className="text-sm text-tertiary">A 6-digit PIN is required to authorise transfers, bill payments, deposits and loan repayments.</p>
        </div>
        <Button href="/profile" size="md" color="secondary" iconTrailing={ArrowRight} className="shrink-0">
            Set PIN now
        </Button>
    </div>
);

const AccountCard = ({ account }: { account: Account }) => (
    <RouterLink
        to={`/accounts/${account.id}`}
        className="group flex flex-col gap-5 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary transition duration-100 ease-linear outline-focus-ring hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2"
    >
        <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-secondary text-fg-brand-primary">
                    <Wallet02 className="size-5" />
                </span>
                <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-primary">{humanize(account.accountType)} account</span>
                    <span className="text-sm text-tertiary tabular-nums">{maskAccount(account.accountNumber)}</span>
                </div>
            </div>
            <StatusBadge status={account.status} />
        </div>
        <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-medium text-tertiary">Available balance</span>
                <span className="truncate text-xl font-semibold text-primary tabular-nums">{formatINR(account.balance)}</span>
            </div>
            <ArrowRight className="size-5 shrink-0 text-fg-quaternary transition duration-100 ease-linear group-hover:translate-x-0.5 group-hover:text-fg-quaternary_hover" />
        </div>
    </RouterLink>
);

const MoneyFlowChart = ({ data }: { data: MonthlyFlow[] }) => (
    <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={4} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
                <Legend
                    verticalAlign="top"
                    align="right"
                    height={36}
                    content={(props) => <ChartLegendContent {...props} />}
                />
                <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(value: number) => formatINRShort(value)}
                    tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }}
                />
                <Tooltip
                    cursor={{ fill: "var(--color-bg-secondary)" }}
                    content={<ChartTooltipContent />}
                    formatter={(value) => formatINR(Number(value))}
                />
                <Bar dataKey="credit" name="Money in" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={28} className="text-utility-brand-600" isAnimationActive={false} />
                <Bar dataKey="debit" name="Money out" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={28} className="text-utility-neutral-300" isAnimationActive={false} />
            </BarChart>
        </ResponsiveContainer>
    </div>
);

export const DashboardPage = () => {
    const { user } = useAuth();
    const { data, error, isLoading, reload } = useApi(() => api.dashboard(), []);

    const firstName = user?.fullName.split(" ")[0] ?? "";

    const header = (
        <PageHeader
            title={`${greeting()}, ${firstName}`}
            description={user?.lastLoginAt ? `Last login ${formatDateTime(user.lastLoginAt)}` : "Here's an overview of your accounts."}
            actions={
                <>
                    <Button href="/transactions" color="secondary" size="md" iconLeading={Receipt}>
                        Statements
                    </Button>
                    <Button href="/transfer" size="md" iconLeading={SwitchHorizontal01}>
                        Transfer money
                    </Button>
                </>
            }
        />
    );

    if (!data) {
        return (
            <>
                {header}
                {error ? <ErrorState message={error.message} onRetry={reload} /> : isLoading ? <LoadingState label="Loading your accounts…" /> : null}
            </>
        );
    }

    const { limits } = data;
    const limitUsedPct = limits.dailyLimit > 0 ? Math.min(100, (limits.usedToday / limits.dailyLimit) * 100) : 0;
    const hasFlow = data.monthly.some((month) => month.credit > 0 || month.debit > 0);

    return (
        <>
            {header}

            {user && !user.hasTransactionPin && <SetPinBanner />}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="relative flex flex-col justify-between gap-8 overflow-hidden rounded-xl bg-brand-section p-6 shadow-xs lg:col-span-2">
                    <div aria-hidden="true" className="absolute -top-16 -right-16 size-48 rounded-full bg-white/5" />
                    <div aria-hidden="true" className="absolute -right-4 -bottom-20 size-40 rounded-full bg-white/5" />
                    <div className="relative flex flex-col gap-1">
                        <span className="text-sm font-medium text-tertiary_on-brand">Total balance</span>
                        <span className="text-display-sm font-semibold break-all text-primary_on-brand tabular-nums md:text-display-md">
                            {formatINR(data.totalBalance)}
                        </span>
                    </div>
                    <div className="relative flex flex-wrap items-center justify-between gap-2 text-sm text-tertiary_on-brand">
                        <span>
                            Across {data.accounts.length} {data.accounts.length === 1 ? "account" : "accounts"}
                        </span>
                        {user && <span className="tabular-nums">CIF {user.customerId}</span>}
                    </div>
                </div>

                <SectionCard title="Quick actions" className="lg:col-span-3">
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                        {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
                            <RouterLink
                                key={href}
                                to={href}
                                className="group flex flex-col items-center gap-2 rounded-lg p-2 text-center outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                                <span className="flex size-12 items-center justify-center rounded-xl bg-brand-secondary text-fg-brand-primary transition duration-100 ease-linear group-hover:bg-brand-solid group-hover:text-white">
                                    <Icon className="size-6" />
                                </span>
                                <span className="text-xs font-semibold text-secondary sm:text-sm">{label}</span>
                            </RouterLink>
                        ))}
                    </div>
                </SectionCard>
            </div>

            <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-primary">Your accounts</h2>
                    <Button href="/accounts" color="link-color" size="sm" iconTrailing={ArrowRight}>
                        Manage
                    </Button>
                </div>
                {data.accounts.length === 0 ? (
                    <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                        <EmptyPanel
                            icon={Wallet02}
                            title="No accounts yet"
                            description="Open a savings, current or salary account to get started."
                            action={
                                <Button href="/accounts" size="md">
                                    Open an account
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {data.accounts.map((account) => (
                            <AccountCard key={account.id} account={account} />
                        ))}
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                    label="Fixed deposits"
                    icon={PiggyBank01}
                    value={formatINR(data.fdTotal)}
                    footer={
                        <RouterLink to="/deposits" className="hover:text-tertiary_hover">
                            {data.fdCount} active {data.fdCount === 1 ? "deposit" : "deposits"}
                        </RouterLink>
                    }
                />
                <StatCard
                    label="Loan outstanding"
                    icon={CoinsStacked01}
                    value={formatINR(data.loanOutstanding)}
                    footer={
                        <RouterLink to="/loans" className="hover:text-tertiary_hover">
                            {data.loanCount === 0 ? "No active loans" : `${data.loanCount} active ${data.loanCount === 1 ? "loan" : "loans"}`}
                        </RouterLink>
                    }
                />
                <StatCard
                    label="Today's transfer limit used"
                    icon={SwitchHorizontal01}
                    value={formatINR(limits.usedToday)}
                    footer={
                        <div className="flex flex-col gap-2 pt-1">
                            <ProgressBarBase
                                value={limitUsedPct}
                                progressClassName={cx(limitUsedPct >= 90 ? "bg-fg-error-primary" : limitUsedPct >= 70 ? "bg-fg-warning-primary" : undefined)}
                            />
                            <span className="tabular-nums">
                                {formatINR(Math.max(0, limits.dailyLimit - limits.usedToday))} left of {formatINR(limits.dailyLimit)}
                            </span>
                        </div>
                    }
                />
            </div>

            <SectionCard title="Money in vs money out" description="Credits and debits across all your accounts, last 6 months.">
                {hasFlow ? (
                    <MoneyFlowChart data={data.monthly} />
                ) : (
                    <EmptyPanel title="No activity yet" description="Your monthly money flow will appear here once you start transacting." />
                )}
            </SectionCard>

            <SectionCard
                title="Recent transactions"
                flush
                actions={
                    <Button href="/transactions" color="secondary" size="sm" iconTrailing={ArrowRight}>
                        View all
                    </Button>
                }
            >
                {data.recentTransactions.length === 0 ? (
                    <EmptyPanel icon={Receipt} title="No transactions yet" description="Transfers, bill payments and deposits will show up here." />
                ) : (
                    <TransactionList transactions={data.recentTransactions} ariaLabel="Recent transactions" />
                )}
            </SectionCard>
        </>
    );
};
