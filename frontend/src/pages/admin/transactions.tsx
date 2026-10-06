import { useEffect, useState } from "react";
import { FilterLines, SearchLg, SwitchHorizontal01, XClose } from "@untitledui/icons";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader } from "@/components/app/page-header";
import { TransactionList } from "@/components/app/transaction-list";
import { PaginationCardDefault } from "@/components/application/pagination/pagination";
import { TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { errorMessage, useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { humanize } from "@/lib/format";
import type { Channel, Direction } from "@/lib/types";

const PAGE_SIZE = 25;

const channels: Channel[] = ["UPI", "IMPS", "NEFT", "RTGS", "INTERNAL", "BILL_PAYMENT", "FIXED_DEPOSIT", "LOAN", "INTEREST", "CASH"];
const channelItems = [{ id: "ALL", label: "All modes" }, ...channels.map((c) => ({ id: c, label: ["UPI", "IMPS", "NEFT", "RTGS"].includes(c) ? c : humanize(c) }))];
const directionItems = [
    { id: "ALL", label: "Credits & debits" },
    { id: "CREDIT", label: "Credits only" },
    { id: "DEBIT", label: "Debits only" },
];

export const AdminTransactionsPage = () => {
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [channel, setChannel] = useState<Channel | "ALL">("ALL");
    const [direction, setDirection] = useState<Direction | "ALL">("ALL");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [page, setPage] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setQ(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Any filter change starts again from the first page.
    useEffect(() => setPage(0), [q, channel, direction, from, to]);

    const rangeError = from && to && from > to ? "“From” must be on or before “To”." : undefined;

    const { data, error, isLoading, reload } = useApi(
        () =>
            rangeError
                ? Promise.resolve(undefined)
                : api.admin.transactions({
                      q: q || undefined,
                      channel: channel === "ALL" ? undefined : channel,
                      direction: direction === "ALL" ? undefined : direction,
                      from: from || undefined,
                      to: to || undefined,
                      page,
                      size: PAGE_SIZE,
                  }),
        [q, channel, direction, from, to, page, rangeError],
    );

    const hasFilters = Boolean(q || channel !== "ALL" || direction !== "ALL" || from || to);
    const clear = () => {
        setSearch("");
        setQ("");
        setChannel("ALL");
        setDirection("ALL");
        setFrom("");
        setTo("");
    };

    const summary = data
        ? data.totalElements
            ? `Showing ${(data.page * data.size + 1).toLocaleString("en-IN")}–${Math.min((data.page + 1) * data.size, data.totalElements).toLocaleString("en-IN")} of ${data.totalElements.toLocaleString("en-IN")}`
            : "No matching entries"
        : "Every posting across all customer accounts";

    return (
        <>
            <PageHeader title="Transactions" description="Bank-wide ledger of every posting, newest first." />

            <div className="grid grid-cols-1 gap-4 rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary sm:grid-cols-2 md:p-5 lg:grid-cols-12">
                <Input
                    label="Search"
                    icon={SearchLg}
                    placeholder="Reference, name or account"
                    value={search}
                    onChange={setSearch}
                    className="sm:col-span-2 lg:col-span-4"
                />
                <Select
                    label="Mode"
                    items={channelItems}
                    selectedKey={channel}
                    onSelectionChange={(key) => key && setChannel(key as Channel | "ALL")}
                    className="lg:col-span-2"
                >
                    {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
                <Select
                    label="Direction"
                    items={directionItems}
                    selectedKey={direction}
                    onSelectionChange={(key) => key && setDirection(key as Direction | "ALL")}
                    className="lg:col-span-2"
                >
                    {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
                <Input label="From" type="date" value={from} onChange={setFrom} isInvalid={Boolean(rangeError)} className="lg:col-span-2" />
                <Input label="To" type="date" value={to} onChange={setTo} isInvalid={Boolean(rangeError)} hint={rangeError} className="lg:col-span-2" />
            </div>

            <TableCard.Root size="sm">
                <TableCard.Header
                    title="Ledger"
                    badge={data ? data.totalElements.toLocaleString("en-IN") : undefined}
                    description={summary}
                    contentTrailing={
                        hasFilters ? (
                            <Button color="secondary" size="sm" iconLeading={XClose} onClick={clear}>
                                Clear filters
                            </Button>
                        ) : undefined
                    }
                />

                {rangeError ? (
                    <EmptyPanel icon={FilterLines} title="Check the date range" description={rangeError} />
                ) : isLoading && !data ? (
                    <LoadingState label="Loading ledger…" />
                ) : error ? (
                    <ErrorState message={errorMessage(error)} onRetry={reload} />
                ) : !data?.content.length ? (
                    <EmptyPanel
                        icon={hasFilters ? FilterLines : SwitchHorizontal01}
                        title={hasFilters ? "No transactions match" : "No transactions yet"}
                        description={hasFilters ? "Try widening the date range or removing a filter." : "Postings will appear here as customers transact."}
                        action={
                            hasFilters ? (
                                <Button color="secondary" onClick={clear}>
                                    Clear filters
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <div className={isLoading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={isLoading}>
                        <TransactionList transactions={data.content} showAccount showBalance ariaLabel="Bank ledger" />
                        {data.totalPages > 1 && <PaginationCardDefault page={data.page + 1} total={data.totalPages} onPageChange={(p) => setPage(p - 1)} />}
                    </div>
                )}
            </TableCard.Root>
        </>
    );
};
