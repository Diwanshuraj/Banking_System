import { useState } from "react";
import { ArrowLeft, Download01, Receipt, SwitchHorizontal01, Wallet02 } from "@untitledui/icons";
import { useParams } from "react-router";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TransactionList } from "@/components/app/transaction-list";
import { PaginationCardDefault } from "@/components/application/pagination/pagination";
import { Button } from "@/components/base/buttons/button";
import { errorMessage, useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDate, formatINR, humanize, maskAccount } from "@/lib/format";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";
import { CopyButton, DetailItem } from "@/pages/accounts";
import { DateRangeFilter, daysAgo } from "@/pages/transactions";

const PAGE_SIZE = 20;

export const AccountDetailPage = () => {
    const { id } = useParams();
    const accountId = Number(id);
    const isValidId = Number.isInteger(accountId) && accountId > 0;
    const toast = useToast();

    const account = useApi(() => (isValidId ? api.accounts.get(accountId) : Promise.reject(new Error("Invalid account"))), [accountId]);

    const [from, setFrom] = useState(() => daysAgo(90));
    const [to, setTo] = useState(() => daysAgo(0));
    const [page, setPage] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    const passbook = useApi(
        () => (isValidId ? api.transactions.list({ accountId, from, to, page, size: PAGE_SIZE }) : Promise.reject(new Error("Invalid account"))),
        [accountId, from, to, page],
    );

    const back = (
        <Button href="/accounts" color="link-gray" size="sm" iconLeading={ArrowLeft} className="w-max">
            All accounts
        </Button>
    );

    if (!isValidId || account.error?.status === 404) {
        return (
            <>
                {back}
                <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                    <EmptyPanel
                        icon={Wallet02}
                        title="Account not found"
                        description="This account doesn't exist or isn't linked to your Customer ID."
                        action={
                            <Button href="/accounts" size="md">
                                View my accounts
                            </Button>
                        }
                    />
                </div>
            </>
        );
    }

    if (!account.data) {
        return (
            <>
                {back}
                {account.error ? <ErrorState message={account.error.message} onRetry={account.reload} /> : <LoadingState label="Loading account…" />}
            </>
        );
    }

    const acc = account.data;

    const download = async () => {
        setIsDownloading(true);
        try {
            await api.accounts.downloadStatement(acc.id, from, to);
            toast.success("Statement downloaded", `${formatDate(from)} to ${formatDate(to)}`);
        } catch (err) {
            toast.error("Couldn't download statement", errorMessage(err));
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-4">
                {back}
                <PageHeader
                    title={`${humanize(acc.accountType)} account`}
                    description={
                        <span className="flex flex-wrap items-center gap-2">
                            <span className="tabular-nums">{maskAccount(acc.accountNumber)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{acc.holderName}</span>
                            <StatusBadge status={acc.status} />
                        </span>
                    }
                    actions={
                        <Button href="/transfer" size="md" iconLeading={SwitchHorizontal01} isDisabled={acc.status !== "ACTIVE"}>
                            Transfer money
                        </Button>
                    }
                />
            </div>

            {acc.status === "FROZEN" && (
                <div className="rounded-xl bg-error-primary p-4 text-sm text-error-primary ring-1 ring-error_subtle ring-inset">
                    This account is frozen. Debits are blocked until the branch lifts the freeze — raise a service request or visit your home branch.
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-xl bg-brand-section p-6 shadow-xs">
                    <div aria-hidden="true" className="absolute -top-16 -right-16 size-48 rounded-full bg-white/5" />
                    <div className="relative flex flex-col gap-1">
                        <span className="text-sm font-medium text-tertiary_on-brand">Available balance</span>
                        <span className="text-display-sm font-semibold break-all text-primary_on-brand tabular-nums">{formatINR(acc.balance)}</span>
                    </div>
                    <div className="relative flex flex-col gap-1 text-sm text-tertiary_on-brand">
                        <span>Interest {acc.interestRate.toFixed(2)}% p.a.</span>
                        <span>Currency {acc.currency}</span>
                    </div>
                </div>

                <section className="rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary md:p-6 lg:col-span-2">
                    <h2 className="mb-4 text-md font-semibold text-primary">Account details</h2>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                        <DetailItem label="Account number">
                            <span className="truncate tabular-nums">{acc.accountNumber}</span>
                            <CopyButton value={acc.accountNumber} label="account number" />
                        </DetailItem>
                        <DetailItem label="IFSC">
                            <span className="truncate">{acc.ifscCode}</span>
                            <CopyButton value={acc.ifscCode} label="IFSC" />
                        </DetailItem>
                        <DetailItem label="Branch">
                            <span className="truncate">{acc.branchName}</span>
                        </DetailItem>
                        <DetailItem label="UPI ID">
                            {acc.upiId ? (
                                <>
                                    <span className="truncate">{acc.upiId}</span>
                                    <CopyButton value={acc.upiId} label="UPI ID" />
                                </>
                            ) : (
                                <span className="text-tertiary">Not linked</span>
                            )}
                        </DetailItem>
                        <DetailItem label="Account holder">
                            <span className="truncate">{acc.holderName}</span>
                        </DetailItem>
                        <DetailItem label="Opened on">{formatDate(acc.openedAt)}</DetailItem>
                        <DetailItem label="Nominee">
                            <span className={acc.nomineeName ? "truncate" : "text-tertiary"}>{acc.nomineeName ?? "Not registered"}</span>
                        </DetailItem>
                        <DetailItem label="Account type">{humanize(acc.accountType)}</DetailItem>
                    </dl>
                </section>
            </div>

            <section className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                <div className="flex flex-col gap-3 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <div className="flex flex-col gap-0.5">
                        <h2 className="text-md font-semibold text-primary">Passbook</h2>
                        <p className="text-sm text-tertiary">
                            {formatDate(from)} – {formatDate(to)}
                            {passbook.data ? ` · ${passbook.data.totalElements.toLocaleString("en-IN")} entries` : ""}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <DateRangeFilter
                            from={from}
                            to={to}
                            onChange={(nextFrom, nextTo) => {
                                setFrom(nextFrom);
                                setTo(nextTo);
                                setPage(0);
                            }}
                        />
                        <Button color="secondary" size="md" iconLeading={Download01} onClick={download} isLoading={isDownloading} showTextWhileLoading>
                            Download CSV
                        </Button>
                    </div>
                </div>

                {!passbook.data ? (
                    passbook.error ? (
                        <ErrorState message={passbook.error.message} onRetry={passbook.reload} />
                    ) : (
                        <LoadingState label="Loading passbook…" />
                    )
                ) : passbook.error ? (
                    <ErrorState message={passbook.error.message} onRetry={passbook.reload} />
                ) : passbook.data.content.length === 0 ? (
                    <EmptyPanel icon={Receipt} title="No transactions in this period" description="Choose a wider date range to see older entries." />
                ) : (
                    <>
                        <div className={cx("transition-opacity duration-100", passbook.isLoading && "pointer-events-none opacity-60")}>
                            <TransactionList transactions={passbook.data.content} showBalance ariaLabel="Passbook" />
                        </div>
                        {passbook.data.totalPages > 1 && (
                            <PaginationCardDefault page={passbook.data.page + 1} total={passbook.data.totalPages} onPageChange={(next) => setPage(next - 1)} />
                        )}
                    </>
                )}
            </section>
        </>
    );
};
