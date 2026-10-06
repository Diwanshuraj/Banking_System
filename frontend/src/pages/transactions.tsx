import { useEffect, useState } from "react";
import { parseDate } from "@internationalized/date";
import { FilterLines, Receipt, SearchLg, XClose } from "@untitledui/icons";
import type { DateValue } from "react-aria-components";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader } from "@/components/app/page-header";
import { TransactionList } from "@/components/app/transaction-list";
import { DateRangePicker } from "@/components/application/date-picker/date-range-picker";
import { PaginationCardDefault } from "@/components/application/pagination/pagination";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { maskAccount, humanize, toIsoDate } from "@/lib/format";
import type { Channel, Direction } from "@/lib/types";
import { cx } from "@/utils/cx";

type Range = { start: DateValue; end: DateValue };

/** yyyy-mm-dd for `days` ago (0 = today). */
export const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return toIsoDate(date);
};

const toRange = (from: string, to: string): Range | null => {
    try {
        return { start: parseDate(from), end: parseDate(to) };
    } catch {
        return null;
    }
};

/** Date range button that only commits the range when "Apply" is pressed. */
export const DateRangeFilter = ({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) => {
    const [draft, setDraft] = useState<Range | null>(() => toRange(from, to));

    useEffect(() => setDraft(toRange(from, to)), [from, to]);

    return (
        <DateRangePicker
            aria-label="Date range"
            size="md"
            value={draft}
            onChange={(value) => setDraft(value ? { start: value.start, end: value.end } : null)}
            onApply={() => {
                if (draft) onChange(draft.start.toString(), draft.end.toString());
            }}
            onCancel={() => setDraft(toRange(from, to))}
        />
    );
};

const DIRECTION_OPTIONS = [
    { id: "ALL", label: "All" },
    { id: "CREDIT", label: "Credits" },
    { id: "DEBIT", label: "Debits" },
];

const CHANNELS: Channel[] = ["UPI", "IMPS", "NEFT", "RTGS", "INTERNAL", "BILL_PAYMENT", "FIXED_DEPOSIT", "LOAN", "INTEREST", "CASH"];
const CHANNEL_OPTIONS = [{ id: "ALL", label: "All modes" }, ...CHANNELS.map((channel) => ({ id: channel, label: channel.length <= 4 ? channel : humanize(channel) }))];

const PAGE_SIZE = 20;

export const TransactionsPage = () => {
    const accounts = useApi(() => api.accounts.list(), []);

    const [accountId, setAccountId] = useState<string>("ALL");
    const [direction, setDirection] = useState<string>("ALL");
    const [channel, setChannel] = useState<string>("ALL");
    const [from, setFrom] = useState(() => daysAgo(30));
    const [to, setTo] = useState(() => daysAgo(0));
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(0);

    // Debounce the search box so we don't hit the API on every keystroke.
    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery(search.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const { data, error, isLoading, reload } = useApi(
        () =>
            api.transactions.list({
                accountId: accountId === "ALL" ? undefined : Number(accountId),
                direction: direction === "ALL" ? undefined : (direction as Direction),
                channel: channel === "ALL" ? undefined : (channel as Channel),
                from,
                to,
                q: query || undefined,
                page,
                size: PAGE_SIZE,
            }),
        [accountId, direction, channel, from, to, query, page],
    );

    const accountOptions = [
        { id: "ALL", label: "All accounts" },
        ...(accounts.data ?? []).map((account) => ({ id: String(account.id), label: maskAccount(account.accountNumber), supportingText: humanize(account.accountType) })),
    ];

    const isFiltered = accountId !== "ALL" || direction !== "ALL" || channel !== "ALL" || query !== "" || from !== daysAgo(30) || to !== daysAgo(0);

    const resetFilters = () => {
        setAccountId("ALL");
        setDirection("ALL");
        setChannel("ALL");
        setFrom(daysAgo(30));
        setTo(daysAgo(0));
        setSearch("");
        setQuery("");
        setPage(0);
    };

    const withReset =
        <T,>(setter: (value: T) => void) =>
        (value: T) => {
            setter(value);
            setPage(0);
        };

    return (
        <>
            <PageHeader title="Transactions" description="Search and filter every credit and debit across your accounts." />

            <section className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                <div className="flex flex-col gap-4 border-b border-secondary px-4 py-4 md:px-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-md font-semibold text-primary">History</h2>
                            {data && (
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary tabular-nums ring-1 ring-secondary ring-inset">
                                    {data.totalElements.toLocaleString("en-IN")} {data.totalElements === 1 ? "entry" : "entries"}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {isFiltered && (
                                <Button color="link-gray" size="sm" iconLeading={XClose} onClick={resetFilters}>
                                    Clear filters
                                </Button>
                            )}
                            <DateRangeFilter
                                from={from}
                                to={to}
                                onChange={(nextFrom, nextTo) => {
                                    setFrom(nextFrom);
                                    setTo(nextTo);
                                    setPage(0);
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Input
                            aria-label="Search transactions"
                            placeholder="Search name, reference, remarks"
                            icon={SearchLg}
                            size="sm"
                            value={search}
                            onChange={setSearch}
                        />
                        <Select
                            aria-label="Account"
                            size="sm"
                            items={accountOptions}
                            selectedKey={accountId}
                            onSelectionChange={(key) => key !== null && withReset(setAccountId)(String(key))}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                        </Select>
                        <Select
                            aria-label="Credit or debit"
                            size="sm"
                            icon={FilterLines}
                            items={DIRECTION_OPTIONS}
                            selectedKey={direction}
                            onSelectionChange={(key) => key !== null && withReset(setDirection)(String(key))}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            aria-label="Payment mode"
                            size="sm"
                            items={CHANNEL_OPTIONS}
                            selectedKey={channel}
                            onSelectionChange={(key) => key !== null && withReset(setChannel)(String(key))}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    </div>
                </div>

                {!data ? (
                    error ? (
                        <ErrorState message={error.message} onRetry={reload} />
                    ) : (
                        <LoadingState label="Loading transactions…" />
                    )
                ) : error ? (
                    <ErrorState message={error.message} onRetry={reload} />
                ) : data.content.length === 0 ? (
                    <EmptyPanel
                        icon={isFiltered ? SearchLg : Receipt}
                        title="No transactions found"
                        description={isFiltered ? "Try a wider date range or clear some filters." : "Your transactions will appear here."}
                        action={
                            isFiltered ? (
                                <Button color="secondary" size="md" onClick={resetFilters}>
                                    Clear filters
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <>
                        <div className={cx("transition-opacity duration-100", isLoading && "pointer-events-none opacity-60")}>
                            <TransactionList transactions={data.content} showAccount />
                        </div>
                        {data.totalPages > 1 && (
                            <PaginationCardDefault page={data.page + 1} total={data.totalPages} onPageChange={(next) => setPage(next - 1)} />
                        )}
                    </>
                )}
            </section>
        </>
    );
};
