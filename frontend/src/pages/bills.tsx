import type { FC } from "react";
import { useEffect, useState } from "react";
import {
    Car01,
    CheckCircle,
    CreditCard01,
    CurrencyRupee,
    Droplets01,
    Lightning01,
    Phone01,
    Printer,
    Receipt,
    ShieldPlus,
    ThermometerWarm,
    Tv03,
    Wifi,
} from "@untitledui/icons";
import { Table } from "@/components/application/table/table";
import { PinModal } from "@/components/app/app-modal";
import { useNotificationCount } from "@/components/app/app-layout";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, formatINR, humanize, maskAccount } from "@/lib/format";
import type { Account, BillCategory, BillPayment, BillerCategory } from "@/lib/types";
import { DetailRow, PinSetupBanner } from "@/pages/transfer";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

const categoryIcons: Record<BillCategory, FC<{ className?: string }>> = {
    ELECTRICITY: Lightning01,
    MOBILE: Phone01,
    DTH: Tv03,
    WATER: Droplets01,
    GAS: ThermometerWarm,
    BROADBAND: Wifi,
    FASTAG: Car01,
    INSURANCE: ShieldPlus,
    CREDIT_CARD: CreditCard01,
};

const RECHARGE_PLANS = [199, 299, 479, 719];
const MAX_BILL_AMOUNT = 200_000;

/** Category-specific format checks for the consumer / account identifier. */
const validateConsumer = (category: BillCategory, value: string, label: string) => {
    const v = value.trim();
    if (!v) return `Enter your ${label.toLowerCase()}`;
    if (category === "MOBILE" && !/^[6-9]\d{9}$/.test(v)) return "Enter a valid 10-digit mobile number";
    if (category === "FASTAG" && !/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(v)) return "Enter the vehicle number, e.g. MH12AB1234";
    if (category === "CREDIT_CARD" && !/^\d{16}$/.test(v)) return "Enter the 16-digit card number";
    if (!/^[A-Za-z0-9-/]{4,30}$/.test(v)) return `${label} should be 4–30 letters or digits`;
    return undefined;
};

const accountLabel = (account: Account) => `${humanize(account.accountType)} · ${maskAccount(account.accountNumber)}`;

export const BillsPage = () => {
    const { user } = useAuth();
    const toast = useToast();
    const { refreshUnread } = useNotificationCount();

    const setup = useApi(async () => {
        const [categories, accounts] = await Promise.all([api.bills.billers(), api.accounts.list()]);
        return { categories, accounts: accounts.filter((account) => account.status === "ACTIVE") };
    }, []);
    const history = useApi(() => api.bills.history(), []);

    const [category, setCategory] = useState<BillCategory | null>(null);
    const [biller, setBiller] = useState<string | null>(null);
    const [consumer, setConsumer] = useState("");
    const [amount, setAmount] = useState("");
    const [accountId, setAccountId] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const [isPinOpen, setIsPinOpen] = useState(false);
    const [receipt, setReceipt] = useState<BillPayment | null>(null);

    const categories = setup.data?.categories ?? [];
    const accounts = setup.data?.accounts ?? [];

    useEffect(() => {
        if (!category && categories.length > 0) setCategory(categories[0].category);
    }, [categories, category]);
    useEffect(() => {
        if (!accountId && accounts.length > 0) setAccountId(String(accounts[0].id));
    }, [accounts, accountId]);

    const current: BillerCategory | undefined = categories.find((item) => item.category === category);
    const account = accounts.find((item) => String(item.id) === accountId);

    const errors: Record<string, string | undefined> = { ...serverErrors };
    if (submitted && current) {
        if (!biller) errors.billerName = errors.billerName ?? "Choose your biller";
        errors.consumerNumber = errors.consumerNumber ?? validateConsumer(current.category, consumer, current.consumerLabel);
        const value = Number(amount);
        if (!amount) errors.amount = errors.amount ?? "Enter the amount to pay";
        else if (!/^\d+(\.\d{1,2})?$/.test(amount) || value < 1) errors.amount = errors.amount ?? "Enter a valid amount of at least ₹1";
        else if (value > MAX_BILL_AMOUNT) errors.amount = errors.amount ?? `Bill payments are limited to ${formatINR(MAX_BILL_AMOUNT)} per transaction`;
        else if (account && value > account.balance) errors.amount = errors.amount ?? `Insufficient balance. Available: ${formatINR(account.balance)}`;
        if (!account) errors.accountId = errors.accountId ?? "Choose the account to pay from";
    }
    const hasErrors = Object.values(errors).some(Boolean);

    const clearServer = (field: string) =>
        setServerErrors((currentErrors) => {
            const next = { ...currentErrors };
            delete next[field];
            return next;
        });

    const selectCategory = (next: BillCategory) => {
        setCategory(next);
        setBiller(null);
        setConsumer("");
        setAmount("");
        setSubmitted(false);
        setServerErrors({});
        setReceipt(null);
    };

    const proceed = () => {
        setSubmitted(true);
        // Validation runs on this render; recompute synchronously to decide.
        if (!current || !biller || !account) return;
        if (validateConsumer(current.category, consumer, current.consumerLabel)) return;
        const value = Number(amount);
        if (!/^\d+(\.\d{1,2})?$/.test(amount) || value < 1 || value > MAX_BILL_AMOUNT || value > account.balance) return;
        if (Object.values(serverErrors).some(Boolean)) return;
        setIsPinOpen(true);
    };

    const pay = async (pin: string) => {
        if (!current || !biller || !account) return;
        try {
            const payment = await api.bills.pay({
                accountId: account.id,
                category: current.category,
                billerName: biller,
                consumerNumber: consumer.trim(),
                amount: Number(amount),
                pin,
            });
            setIsPinOpen(false);
            setReceipt(payment);
            toast.success(current.category === "MOBILE" ? "Recharge successful" : "Bill paid", `${formatINR(payment.amount)} to ${payment.billerName}`);
            refreshUnread();
            history.reload();
            setup.reload();
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors && Object.keys(err.fieldErrors).some((key) => key !== "pin")) {
                setServerErrors(err.fieldErrors);
                setIsPinOpen(false);
                toast.error("Payment not completed", err.message);
                return;
            }
            throw err;
        }
    };

    const resetForm = () => {
        setReceipt(null);
        setConsumer("");
        setAmount("");
        setBiller(null);
        setSubmitted(false);
    };

    const hasPin = Boolean(user?.hasTransactionPin);

    return (
        <>
            <PageHeader title="Bill payments & recharges" description="Pay utility bills, recharge mobile and DTH, top up FASTag and more — powered by Bharat BillPay." />

            {!hasPin && <PinSetupBanner action="pay bills" />}

            {setup.isLoading && !setup.data ? (
                <LoadingState label="Loading billers…" />
            ) : setup.error && !setup.data ? (
                <ErrorState message={setup.error.message} onRetry={setup.reload} />
            ) : categories.length === 0 ? (
                <SectionCard>
                    <EmptyPanel icon={Receipt} title="No billers available" description="Bill payments are temporarily unavailable. Please try again later." />
                </SectionCard>
            ) : (
                <>
                    <div role="radiogroup" aria-label="Bill category" className="grid grid-cols-3 gap-3 sm:grid-cols-5 xl:grid-cols-9">
                        {categories.map((item) => {
                            const Icon = categoryIcons[item.category] ?? Receipt;
                            const selected = item.category === category;
                            return (
                                <button
                                    key={item.category}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => selectCategory(item.category)}
                                    className={cx(
                                        "flex min-w-0 flex-col items-center gap-2 rounded-xl bg-primary px-2 py-4 text-center shadow-xs ring-1 ring-secondary transition duration-100 ease-linear ring-inset outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2",
                                        selected && "bg-brand-primary_alt ring-2 ring-brand hover:bg-brand-primary_alt",
                                    )}
                                >
                                    <span className={cx("flex size-10 items-center justify-center rounded-lg", selected ? "bg-brand-solid text-white" : "bg-secondary text-fg-secondary")}>
                                        <Icon className="size-5" />
                                    </span>
                                    <span className={cx("line-clamp-2 text-xs font-semibold", selected ? "text-brand-secondary" : "text-secondary")}>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {current && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
                            <div className="min-w-0 lg:col-span-3">
                                {receipt ? (
                                    <SectionCard>
                                        <div className="flex flex-col gap-6">
                                            <div className="flex flex-col items-center gap-3 text-center">
                                                <FeaturedIcon icon={CheckCircle} color="success" theme="light" size="xl" />
                                                <h2 className="text-lg font-semibold text-primary">{receipt.category === "MOBILE" ? "Recharge successful" : "Payment successful"}</h2>
                                                <p className="text-display-sm font-semibold text-primary tabular-nums">{formatINR(receipt.amount)}</p>
                                            </div>
                                            <dl className="divide-y divide-secondary rounded-xl px-4 ring-1 ring-secondary">
                                                <DetailRow label="Reference ID" value={<span className="font-mono">{receipt.referenceId}</span>} emphasis />
                                                <DetailRow label="Biller" value={receipt.billerName} />
                                                <DetailRow label={current.consumerLabel} value={receipt.consumerNumber} />
                                                <DetailRow label="Paid from" value={maskAccount(receipt.accountNumber)} />
                                                <DetailRow label="Date & time" value={formatDateTime(receipt.createdAt)} />
                                                <DetailRow label="Status" value={<StatusBadge status={receipt.status} />} />
                                            </dl>
                                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end print:hidden">
                                                <Button color="secondary" size="lg" iconLeading={Printer} onClick={() => window.print()}>
                                                    Print receipt
                                                </Button>
                                                <Button size="lg" onClick={resetForm}>
                                                    Pay another bill
                                                </Button>
                                            </div>
                                        </div>
                                    </SectionCard>
                                ) : (
                                    <SectionCard title={current.category === "MOBILE" ? "Mobile recharge" : `Pay ${current.label.toLowerCase()} bill`} description="Payments are confirmed with your transaction PIN.">
                                        <form
                                            className="flex flex-col gap-5"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                proceed();
                                            }}
                                        >
                                            <Select
                                                label={current.category === "MOBILE" ? "Operator" : "Biller"}
                                                placeholder={current.category === "MOBILE" ? "Select operator" : "Select biller"}
                                                selectedKey={biller}
                                                onSelectionChange={(key) => {
                                                    setBiller(key == null ? null : String(key));
                                                    clearServer("billerName");
                                                }}
                                                items={current.billers.map((name) => ({ id: name, label: name }))}
                                                isInvalid={Boolean(errors.billerName)}
                                                hint={errors.billerName}
                                            >
                                                {(item) => <Select.Item id={item.id} label={item.label} />}
                                            </Select>

                                            <Input
                                                label={current.consumerLabel}
                                                placeholder={current.category === "MOBILE" ? "10-digit mobile number" : current.category === "FASTAG" ? "e.g. MH12AB1234" : `Enter ${current.consumerLabel.toLowerCase()}`}
                                                inputMode={current.category === "MOBILE" || current.category === "CREDIT_CARD" ? "numeric" : "text"}
                                                value={consumer}
                                                onChange={(value) => {
                                                    setConsumer(current.category === "FASTAG" ? value.toUpperCase().replace(/\s/g, "") : value.replace(/\s/g, ""));
                                                    clearServer("consumerNumber");
                                                }}
                                                isInvalid={Boolean(errors.consumerNumber)}
                                                hint={errors.consumerNumber ?? "As printed on your bill or registered with the biller."}
                                            />

                                            <div className="flex flex-col gap-2">
                                                <Input
                                                    label="Amount"
                                                    placeholder="0.00"
                                                    icon={CurrencyRupee}
                                                    inputMode="decimal"
                                                    value={amount}
                                                    inputClassName="tabular-nums"
                                                    onChange={(value) => {
                                                        setAmount(value.replace(/[^\d.]/g, ""));
                                                        clearServer("amount");
                                                    }}
                                                    isInvalid={Boolean(errors.amount)}
                                                    hint={errors.amount}
                                                />
                                                {current.category === "MOBILE" && (
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="text-xs text-tertiary">Popular plans:</span>
                                                        {RECHARGE_PLANS.map((plan) => (
                                                            <button
                                                                key={plan}
                                                                type="button"
                                                                onClick={() => setAmount(String(plan))}
                                                                className={cx(
                                                                    "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-secondary ring-inset outline-focus-ring focus-visible:outline-2",
                                                                    amount === String(plan) ? "bg-brand-primary_alt text-brand-secondary ring-brand" : "bg-primary text-secondary hover:bg-primary_hover",
                                                                )}
                                                            >
                                                                ₹{plan}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <Select
                                                label="Pay from"
                                                placeholder="Select account"
                                                selectedKey={accountId}
                                                onSelectionChange={(key) => {
                                                    setAccountId(key == null ? null : String(key));
                                                    clearServer("accountId");
                                                }}
                                                items={accounts.map((item) => ({ id: String(item.id), label: accountLabel(item), supportingText: formatINR(item.balance) }))}
                                                isInvalid={Boolean(errors.accountId)}
                                                hint={errors.accountId ?? (account ? `Available balance ${formatINR(account.balance)}` : "You need an active account to pay bills")}
                                            >
                                                {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                                            </Select>

                                            <div className="flex justify-end border-t border-secondary pt-5">
                                                <Button type="submit" size="lg" isDisabled={!hasPin || accounts.length === 0 || (submitted && hasErrors)}>
                                                    {current.category === "MOBILE" ? "Recharge now" : "Pay bill"}
                                                </Button>
                                            </div>
                                        </form>
                                    </SectionCard>
                                )}
                            </div>

                            <aside className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                                <SectionCard title="Good to know">
                                    <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-tertiary">
                                        <li>Payments are usually reflected with the biller instantly; some billers take up to 2 working days.</li>
                                        <li>Keep the reference ID for any complaint raised with the biller or through Bharat BillPay.</li>
                                        <li>No convenience fee is charged on bill payments from your savings or current account.</li>
                                    </ul>
                                </SectionCard>
                            </aside>
                        </div>
                    )}
                </>
            )}

            <SectionCard title="Payment history" description="Your recent bill payments and recharges" flush>
                {history.isLoading && !history.data ? (
                    <LoadingState label="Loading payments…" />
                ) : history.error && !history.data ? (
                    <ErrorState message={history.error.message} onRetry={history.reload} />
                ) : !history.data || history.data.length === 0 ? (
                    <EmptyPanel icon={Receipt} title="No bill payments yet" description="Payments you make will show up here." />
                ) : (
                    <BillHistory payments={history.data} labels={Object.fromEntries(categories.map((item) => [item.category, item.label]))} />
                )}
            </SectionCard>

            <PinModal
                isOpen={isPinOpen}
                onClose={() => setIsPinOpen(false)}
                onConfirm={pay}
                title="Authorise payment"
                confirmLabel={`Pay ${formatINR(Number(amount) || 0)}`}
                summary={
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold text-primary tabular-nums">{formatINR(Number(amount) || 0)}</span>
                        <span>
                            {biller} · {current?.consumerLabel} {consumer}
                        </span>
                        {account && <span>From {accountLabel(account)}</span>}
                    </div>
                }
            />
        </>
    );
};

const BillHistory = ({ payments, labels }: { payments: BillPayment[]; labels: Record<string, string> }) => (
    <>
        <ul className="divide-y divide-secondary md:hidden">
            {payments.map((payment) => {
                const Icon = categoryIcons[payment.category] ?? Receipt;
                return (
                    <li key={payment.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-quaternary">
                            <Icon className="size-5" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium text-primary">{payment.billerName}</span>
                            <span className="truncate text-xs text-tertiary">
                                {payment.consumerNumber} · {formatDateTime(payment.createdAt)}
                            </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-semibold text-primary tabular-nums">{formatINR(payment.amount)}</span>
                            <StatusBadge status={payment.status} />
                        </div>
                    </li>
                );
            })}
        </ul>
        <div className="max-md:hidden">
            <Table aria-label="Bill payment history" size="sm">
                <Table.Header>
                    <Table.Head id="biller" label="Biller" isRowHeader className="w-full" />
                    <Table.Head id="consumer" label="Consumer no." />
                    <Table.Head id="account" label="Paid from" />
                    <Table.Head id="date" label="Date" />
                    <Table.Head id="status" label="Status" />
                    <Table.Head id="amount" label="Amount" className="text-right [&>div]:justify-end" />
                </Table.Header>
                <Table.Body items={payments}>
                    {(payment) => {
                        const Icon = categoryIcons[payment.category] ?? Receipt;
                        return (
                            <Table.Row id={payment.id}>
                                <Table.Cell>
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-quaternary">
                                            <Icon className="size-5" />
                                        </span>
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium text-primary">{payment.billerName}</span>
                                            <span className="truncate text-xs text-tertiary">
                                                {labels[payment.category] ?? humanize(payment.category)} · {payment.referenceId}
                                            </span>
                                        </div>
                                    </div>
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap">{payment.consumerNumber}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap">{maskAccount(payment.accountNumber)}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap">{formatDateTime(payment.createdAt)}</Table.Cell>
                                <Table.Cell>
                                    <StatusBadge status={payment.status} />
                                </Table.Cell>
                                <Table.Cell className="text-right font-semibold whitespace-nowrap text-primary tabular-nums">{formatINR(payment.amount)}</Table.Cell>
                            </Table.Row>
                        );
                    }}
                </Table.Body>
            </Table>
        </div>
    </>
);
