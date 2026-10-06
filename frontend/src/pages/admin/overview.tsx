import { ArrowRight, BankNote01, Building07, ClipboardCheck, Coins01, MessageChatSquare, Snowflake01, SwitchHorizontal01, Users01 } from "@untitledui/icons";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { StatCard } from "@/components/app/stat-card";
import { TransactionList } from "@/components/app/transaction-list";
import { ChartTooltipContent } from "@/components/application/charts/charts-base";
import { Button } from "@/components/base/buttons/button";
import { errorMessage, useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDate, formatINR, formatINRShort, humanize } from "@/lib/format";
import type { AdminMetrics } from "@/lib/types";

const shortDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const CardLink = ({ href, children }: { href: string; children: string }) => (
    <Button href={href} color="link-color" size="sm" iconTrailing={ArrowRight}>
        {children}
    </Button>
);

const VolumeChart = ({ data }: { data: AdminMetrics["dailyVolume"] }) => {
    if (!data.length) return <EmptyPanel title="No activity yet" description="Daily volume appears here once transactions post." />;

    const total = data.reduce((sum, day) => sum + day.amount, 0);
    const count = data.reduce((sum, day) => sum + day.count, 0);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
                <div className="flex flex-col">
                    <span className="text-sm text-tertiary">14-day volume</span>
                    <span className="text-lg font-semibold text-primary tabular-nums">{formatINR(total)}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm text-tertiary">Transactions</span>
                    <span className="text-lg font-semibold text-primary tabular-nums">{count.toLocaleString("en-IN")}</span>
                </div>
            </div>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
                        <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={shortDay}
                            axisLine={false}
                            tickLine={false}
                            tickMargin={10}
                            interval="preserveStartEnd"
                            minTickGap={16}
                            className="text-xs text-tertiary"
                            tick={{ fill: "currentColor", fontSize: 12 }}
                        />
                        <YAxis
                            tickFormatter={(value: number) => formatINRShort(value)}
                            axisLine={false}
                            tickLine={false}
                            width={56}
                            className="text-xs text-tertiary"
                            tick={{ fill: "currentColor", fontSize: 12 }}
                        />
                        <Tooltip
                            cursor={{ className: "fill-utility-neutral-100/60" }}
                            content={<ChartTooltipContent />}
                            formatter={(value) => formatINR(Number(value))}
                            labelFormatter={(label, payload) => {
                                const row = payload?.[0]?.payload as AdminMetrics["dailyVolume"][number] | undefined;
                                return row ? `${formatDate(row.date)} · ${row.count} txns` : String(label);
                            }}
                        />
                        <Bar
                            dataKey="amount"
                            name="Volume"
                            fill="currentColor"
                            className="text-utility-brand-600"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                            isAnimationActive={false}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const ChannelBreakdown = ({ data }: { data: AdminMetrics["channelBreakdown"] }) => {
    const rows = [...data].sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    if (!rows.length || total === 0) return <EmptyPanel title="No channel data" description="Payment mode split appears once transactions post." />;
    const max = rows[0]!.amount || 1;

    return (
        <ul className="flex flex-col gap-4">
            {rows.map((row) => {
                const share = (row.amount / total) * 100;
                return (
                    <li key={row.channel} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-medium text-primary">{["UPI", "IMPS", "NEFT", "RTGS"].includes(row.channel) ? row.channel : humanize(row.channel)}</span>
                            <span className="text-right text-tertiary tabular-nums">
                                <span className="font-medium text-secondary">{formatINRShort(row.amount)}</span> · {row.count.toLocaleString("en-IN")} ·{" "}
                                {share.toFixed(share < 10 ? 1 : 0)}%
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-quaternary" title={`${formatINR(row.amount)} across ${row.count} transactions`}>
                            <div className="h-full rounded-full bg-brand-solid" style={{ width: `${Math.max(2, (row.amount / max) * 100)}%` }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

const LatestTransactions = () => {
    const { data, error, isLoading, reload } = useApi(() => api.admin.transactions({ size: 8 }), []);

    return (
        <SectionCard title="Latest transactions" description="Most recent postings across the bank" actions={<CardLink href="/admin/transactions">View ledger</CardLink>} flush>
            {isLoading && !data ? (
                <LoadingState />
            ) : error ? (
                <ErrorState message={errorMessage(error)} onRetry={reload} />
            ) : !data?.content.length ? (
                <EmptyPanel title="No transactions yet" description="Transactions will appear here as customers bank with you." />
            ) : (
                <TransactionList transactions={data.content} showAccount ariaLabel="Latest transactions" />
            )}
        </SectionCard>
    );
};

export const AdminOverviewPage = () => {
    const { data: metrics, error, isLoading, reload } = useApi(() => api.admin.metrics(), []);

    return (
        <>
            <PageHeader
                title="Branch overview"
                description={`Bank-wide position as of ${formatDate(new Date().toISOString())}`}
                actions={
                    <Button color="secondary" size="md" iconLeading={Users01} href="/admin/customers">
                        Customers
                    </Button>
                }
            />

            {isLoading && !metrics ? (
                <LoadingState label="Loading metrics…" />
            ) : error || !metrics ? (
                <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                    <ErrorState message={errorMessage(error)} onRetry={reload} />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard label="Customers" icon={Users01} value={metrics.totalCustomers.toLocaleString("en-IN")} footer={<CardLink href="/admin/customers">Manage customers</CardLink>} />
                        <StatCard
                            label="Active accounts"
                            icon={Building07}
                            value={metrics.activeAccounts.toLocaleString("en-IN")}
                            footer={<CardLink href="/admin/accounts">View accounts</CardLink>}
                        />
                        <StatCard label="Total deposits" icon={Coins01} value={formatINRShort(metrics.totalDeposits)} footer={formatINR(metrics.totalDeposits)} />
                        <StatCard
                            label="Today's volume"
                            icon={SwitchHorizontal01}
                            value={formatINRShort(metrics.todayVolume)}
                            footer={`${metrics.todayTransactions.toLocaleString("en-IN")} transaction${metrics.todayTransactions === 1 ? "" : "s"} today`}
                        />
                        <StatCard
                            label="Pending loans"
                            icon={ClipboardCheck}
                            value={metrics.pendingLoans.toLocaleString("en-IN")}
                            footer={<CardLink href="/admin/loans">Review applications</CardLink>}
                        />
                        <StatCard
                            label="Open service requests"
                            icon={MessageChatSquare}
                            value={metrics.openRequests.toLocaleString("en-IN")}
                            footer={<CardLink href="/admin/requests">Open queue</CardLink>}
                        />
                        <StatCard
                            label="Frozen accounts"
                            icon={Snowflake01}
                            value={metrics.frozenAccounts.toLocaleString("en-IN")}
                            footer={metrics.frozenAccounts ? "Blocked from sending money" : "No accounts frozen"}
                        />
                        <StatCard label="Loan book" icon={BankNote01} value={formatINRShort(metrics.loanBook)} footer={`${formatINR(metrics.loanBook)} outstanding`} />
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <SectionCard title="Transaction volume" description="Daily value of successful transactions, last 14 days" className="lg:col-span-2">
                            <VolumeChart data={metrics.dailyVolume} />
                        </SectionCard>
                        <SectionCard title="Channel breakdown" description="Share of value by payment mode">
                            <ChannelBreakdown data={metrics.channelBreakdown} />
                        </SectionCard>
                    </div>
                </>
            )}

            <LatestTransactions />
        </>
    );
};
