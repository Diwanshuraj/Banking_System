import { ArrowDownLeft, ArrowUpRight } from "@untitledui/icons";
import { Table } from "@/components/application/table/table";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDateTime, formatINR, humanize, maskAccount } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { cx } from "@/utils/cx";

export const AmountText = ({ amount, direction, className }: { amount: number; direction: Transaction["direction"]; className?: string }) => (
    <span className={cx("font-semibold whitespace-nowrap tabular-nums", direction === "CREDIT" ? "text-success-primary" : "text-primary", className)}>
        {direction === "CREDIT" ? "+" : "−"}
        {formatINR(amount)}
    </span>
);

const DirectionIcon = ({ direction }: { direction: Transaction["direction"] }) => (
    <span
        className={cx(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            direction === "CREDIT" ? "bg-success-secondary text-fg-success-primary" : "bg-secondary text-fg-quaternary",
        )}
    >
        {direction === "CREDIT" ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
    </span>
);

const title = (txn: Transaction) => txn.counterpartyName || txn.description;

interface TransactionListProps {
    transactions: Transaction[];
    /** Show the running balance column (statements). */
    showBalance?: boolean;
    /** Show which account the entry belongs to (multi-account views, admin). */
    showAccount?: boolean;
    ariaLabel?: string;
}

/** Transaction table on desktop, stacked list on mobile. */
export const TransactionList = ({ transactions, showBalance, showAccount, ariaLabel = "Transactions" }: TransactionListProps) => (
    <>
        <ul className="divide-y divide-secondary md:hidden">
            {transactions.map((txn) => (
                <li key={txn.id} className="flex items-center gap-3 px-4 py-3">
                    <DirectionIcon direction={txn.direction} />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-primary">{title(txn)}</span>
                        <span className="truncate text-xs text-tertiary">
                            {humanize(txn.channel)} · {formatDateTime(txn.createdAt)}
                        </span>
                    </div>
                    <AmountText amount={txn.amount} direction={txn.direction} className="text-sm" />
                </li>
            ))}
        </ul>

        <div className="max-md:hidden">
            <Table aria-label={ariaLabel} size="sm">
                <Table.Header>
                    <Table.Head id="details" label="Details" isRowHeader className="w-full" />
                    {showAccount && <Table.Head id="account" label="Account" />}
                    <Table.Head id="channel" label="Mode" />
                    <Table.Head id="date" label="Date" />
                    <Table.Head id="status" label="Status" />
                    <Table.Head id="amount" label="Amount" className="text-right [&>div]:justify-end" />
                    {showBalance && <Table.Head id="balance" label="Balance" className="text-right [&>div]:justify-end" />}
                </Table.Header>
                <Table.Body items={transactions}>
                    {(txn) => (
                        <Table.Row id={txn.id}>
                            <Table.Cell>
                                <div className="flex items-center gap-3">
                                    <DirectionIcon direction={txn.direction} />
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate font-medium text-primary">{title(txn)}</span>
                                        <span className="truncate text-xs text-tertiary">{txn.referenceId}</span>
                                    </div>
                                </div>
                            </Table.Cell>
                            {showAccount && <Table.Cell className="whitespace-nowrap">{maskAccount(txn.accountNumber)}</Table.Cell>}
                            <Table.Cell className="whitespace-nowrap">{humanize(txn.channel)}</Table.Cell>
                            <Table.Cell className="whitespace-nowrap">{formatDateTime(txn.createdAt)}</Table.Cell>
                            <Table.Cell>
                                <StatusBadge status={txn.status} />
                            </Table.Cell>
                            <Table.Cell className="text-right">
                                <AmountText amount={txn.amount} direction={txn.direction} />
                            </Table.Cell>
                            {showBalance && <Table.Cell className="text-right whitespace-nowrap tabular-nums">{formatINR(txn.balanceAfter)}</Table.Cell>}
                        </Table.Row>
                    )}
                </Table.Body>
            </Table>
        </div>
    </>
);
