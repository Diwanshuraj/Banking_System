import { useEffect, useState } from "react";
import { Bank, Building07, SearchLg } from "@untitledui/icons";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { errorMessage, useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDate, formatINR, humanize } from "@/lib/format";
import type { Account } from "@/lib/types";
import { CashModal, FreezeModal, freezeIcon } from "./cash-modal";

export const AdminAccountsPage = () => {
    const [query, setQuery] = useState("");
    const [q, setQ] = useState("");
    const [cashAccount, setCashAccount] = useState<Account | null>(null);
    const [freezeAccount, setFreezeAccount] = useState<Account | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setQ(query.trim()), 300);
        return () => clearTimeout(timer);
    }, [query]);

    const { data, error, isLoading, reload, setData } = useApi(() => api.admin.accounts(q || undefined), [q]);
    const accounts = data ?? [];
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    return (
        <>
            <PageHeader title="Accounts" description="Every deposit account at the bank — freeze suspicious accounts and post counter cash." />

            <TableCard.Root>
                <TableCard.Header
                    title="All accounts"
                    badge={data ? `${accounts.length}` : undefined}
                    description={data && accounts.length ? `Combined balance ${formatINR(totalBalance)}` : "Search by account number or holder name."}
                    contentTrailing={
                        <Input
                            aria-label="Search accounts"
                            icon={SearchLg}
                            placeholder="Account number or holder"
                            value={query}
                            onChange={setQuery}
                            className="w-full md:w-80"
                        />
                    }
                />

                {isLoading && !data ? (
                    <LoadingState label="Loading accounts…" />
                ) : error ? (
                    <ErrorState message={errorMessage(error)} onRetry={reload} />
                ) : !accounts.length ? (
                    <EmptyPanel
                        icon={q ? SearchLg : Building07}
                        title={q ? "No accounts match" : "No accounts yet"}
                        description={q ? `Nothing found for “${q}”.` : "Accounts appear here once customers are onboarded."}
                        action={
                            q ? (
                                <Button color="secondary" onClick={() => setQuery("")}>
                                    Clear search
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <Table aria-label="Accounts">
                        <Table.Header>
                            <Table.Head id="number" label="Account number" isRowHeader />
                            <Table.Head id="holder" label="Holder" className="w-full min-w-48" />
                            <Table.Head id="type" label="Type" />
                            <Table.Head id="branch" label="IFSC / Branch" />
                            <Table.Head id="balance" label="Balance" className="text-right [&>div]:justify-end" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="opened" label="Opened" />
                            <Table.Head id="actions" />
                        </Table.Header>
                        <Table.Body items={accounts}>
                            {(account) => {
                                const FreezeIcon = freezeIcon(account);
                                const closed = account.status === "CLOSED";
                                return (
                                    <Table.Row id={account.id}>
                                        <Table.Cell className="font-medium whitespace-nowrap text-primary tabular-nums">{account.accountNumber}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap text-primary">{account.holderName}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{humanize(account.accountType)}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-secondary">{account.ifscCode}</span>
                                                <span className="text-xs">{account.branchName}</span>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell className="text-right font-semibold whitespace-nowrap text-primary tabular-nums">{formatINR(account.balance)}</Table.Cell>
                                        <Table.Cell>
                                            <StatusBadge status={account.status} />
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{formatDate(account.openedAt)}</Table.Cell>
                                        <Table.Cell>
                                            <div className="flex items-center justify-end gap-1">
                                                <Button size="sm" color="tertiary" iconLeading={Bank} onClick={() => setCashAccount(account)} isDisabled={closed}>
                                                    Cash
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    color={account.status === "FROZEN" ? "tertiary" : "tertiary-destructive"}
                                                    iconLeading={FreezeIcon}
                                                    onClick={() => setFreezeAccount(account)}
                                                    isDisabled={closed}
                                                >
                                                    {account.status === "FROZEN" ? "Unfreeze" : "Freeze"}
                                                </Button>
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <CashModal account={cashAccount} onClose={() => setCashAccount(null)} onDone={reload} />
            <FreezeModal
                account={freezeAccount}
                onClose={() => setFreezeAccount(null)}
                onDone={(updated) => setData(accounts.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)))}
            />
        </>
    );
};
