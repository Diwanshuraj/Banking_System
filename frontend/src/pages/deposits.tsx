import { useMemo, useState } from "react";
import { AlertTriangle, BankNote01, Calendar, Coins01, Lock01, Percent01, Plus, TrendUp01 } from "@untitledui/icons";
import { AppModal, ConfirmModal, PinModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/application/tabs/tabs";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { Select } from "@/components/base/select/select";
import { Toggle } from "@/components/base/toggle/toggle";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { calculateFdMaturity, formatDate, formatINR, maskAccount } from "@/lib/format";
import type { Account, FdRate, FixedDeposit } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

const MIN_AMOUNT = 1000;
const MIN_MONTHS = 1;
const MAX_MONTHS = 120;
const PENALTY = 0.5;

const QUICK_TENURES = [
    { label: "6M", months: 6 },
    { label: "1Y", months: 12 },
    { label: "2Y", months: 24 },
    { label: "3Y", months: 36 },
    { label: "5Y", months: 60 },
];

/** "1 year 6 months" */
const formatTenure = (months: number) => {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts = [];
    if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
    if (rest) parts.push(`${rest} ${rest === 1 ? "month" : "months"}`);
    return parts.join(" ") || "0 months";
};

const addMonths = (date: Date, months: number) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
};

const findSlab = (rates: FdRate[], months: number) =>
    rates.find((slab) => months >= slab.minMonths && months <= slab.maxMonths) ??
    (rates.length && months < Math.min(...rates.map((r) => r.minMonths)) ? [...rates].sort((a, b) => a.minMonths - b.minMonths)[0] : undefined);

const isSeniorCitizen = (dob: string | null | undefined) => {
    if (!dob) return false;
    const birth = new Date(`${dob.slice(0, 10)}T00:00:00`);
    const sixty = new Date(birth);
    sixty.setFullYear(birth.getFullYear() + 60);
    return sixty.getTime() <= Date.now();
};

const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);

/** Share of the tenure already elapsed, 0–100. */
const elapsedPct = (fd: FixedDeposit) => {
    const start = toDate(fd.startDate).getTime();
    const end = toDate(fd.maturityDate).getTime();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
};

/** Indicative premature-closure payout: slab rate for the period held, minus the penalty, quarterly compounding. */
const estimatePrematurePayout = (fd: FixedDeposit, rates: FdRate[]) => {
    const heldDays = Math.max(0, Math.floor((Date.now() - toDate(fd.startDate).getTime()) / 86400000));
    const heldMonths = Math.max(0, Math.floor(heldDays / 30.4));
    const slab = findSlab(rates, Math.max(heldMonths, 1));
    const baseRate = slab?.rate ?? fd.interestRate;
    const effectiveRate = Math.max(0, baseRate - PENALTY);
    if (heldDays < 7) return { heldDays, effectiveRate: 0, payout: fd.principal };
    const payout = fd.principal * Math.pow(1 + effectiveRate / 400, (heldDays / 365) * 4);
    return { heldDays, effectiveRate, payout };
};

export const DepositsPage = () => {
    const { user } = useAuth();
    const toast = useToast();
    const deposits = useApi(() => api.deposits.list(), []);
    const rates = useApi(() => api.deposits.rates(), []);
    const accounts = useApi(() => api.accounts.list(), []);

    const [tab, setTab] = useState<"active" | "closed">("active");
    const [isOpenFormOpen, setIsOpenFormOpen] = useState(false);
    const [closing, setClosing] = useState<{ fd: FixedDeposit; stage: "confirm" | "pin" }>();

    const senior = isSeniorCitizen(user?.dateOfBirth);
    const rateList = useMemo(() => [...(rates.data ?? [])].sort((a, b) => a.minMonths - b.minMonths), [rates.data]);

    const all = deposits.data ?? [];
    const active = all.filter((fd) => fd.status === "ACTIVE");
    const closed = all.filter((fd) => fd.status !== "ACTIVE");
    const visible = tab === "active" ? active : closed;

    const totalInvested = active.reduce((sum, fd) => sum + fd.principal, 0);
    const totalMaturity = active.reduce((sum, fd) => sum + fd.maturityAmount, 0);
    const totalCurrent = active.reduce((sum, fd) => sum + fd.currentValue, 0);

    const closeDeposit = async (pin: string) => {
        if (!closing) return;
        const result = await api.deposits.close(closing.fd.id, pin);
        setClosing(undefined);
        toast.success("Fixed deposit closed", `${formatINR(result.payoutAmount ?? 0)} has been credited to ${maskAccount(result.sourceAccountNumber)}.`);
        deposits.reload();
        accounts.reload();
    };

    const estimate = closing ? estimatePrematurePayout(closing.fd, rateList) : undefined;

    return (
        <>
            <PageHeader
                title="Fixed deposits"
                description="Grow your savings with assured returns. Interest is compounded quarterly."
                actions={
                    <Button iconLeading={Plus} onClick={() => setIsOpenFormOpen(true)}>
                        Open fixed deposit
                    </Button>
                }
            />

            {user && !user.hasTransactionPin && <PinBanner />}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                <StatCard label="Total invested" icon={Coins01} value={formatINR(totalInvested)} footer={`Current value ${formatINR(totalCurrent)}`} />
                <StatCard
                    label="Expected maturity value"
                    icon={TrendUp01}
                    value={formatINR(totalMaturity)}
                    footer={`${formatINR(totalMaturity - totalInvested)} interest on maturity`}
                />
                <StatCard label="Active deposits" icon={BankNote01} value={active.length} footer={`${closed.length} matured or closed`} />
            </div>

            <SectionCard
                title="Your deposits"
                description="Track each deposit's growth and maturity."
                actions={
                    <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key as "active" | "closed")} className="w-auto">
                        <Tabs.List type="button-minimal" size="sm">
                            <Tabs.Item id="active">{`Active (${active.length})`}</Tabs.Item>
                            <Tabs.Item id="closed">{`Matured & closed (${closed.length})`}</Tabs.Item>
                        </Tabs.List>
                    </Tabs>
                }
            >
                {deposits.isLoading && !deposits.data ? (
                    <LoadingState label="Loading deposits…" />
                ) : deposits.error && !deposits.data ? (
                    <ErrorState message={deposits.error.message} onRetry={deposits.reload} />
                ) : visible.length === 0 ? (
                    <EmptyPanel
                        icon={BankNote01}
                        title={tab === "active" ? "No active fixed deposits" : "Nothing here yet"}
                        description={
                            tab === "active"
                                ? "Open a fixed deposit from ₹1,000 for 7 days to 10 years and earn more than a savings account."
                                : "Matured and closed deposits will appear here."
                        }
                        action={
                            tab === "active" && (
                                <Button iconLeading={Plus} onClick={() => setIsOpenFormOpen(true)}>
                                    Open fixed deposit
                                </Button>
                            )
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {visible.map((fd) => (
                            <DepositCard key={fd.id} fd={fd} onClose={() => setClosing({ fd, stage: "confirm" })} />
                        ))}
                    </div>
                )}
            </SectionCard>

            <SectionCard title="Interest rates" description={`Per annum, for deposits below ₹2 crore. Senior citizens (60+) earn the higher rate.`} flush>
                {rates.isLoading && !rates.data ? (
                    <LoadingState label="Loading rates…" />
                ) : rates.error && !rates.data ? (
                    <ErrorState message={rates.error.message} onRetry={rates.reload} />
                ) : rateList.length === 0 ? (
                    <EmptyPanel icon={Percent01} title="Rates unavailable" description="Interest rate slabs have not been published yet." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[480px] text-left text-sm">
                            <thead className="bg-secondary text-xs font-semibold text-tertiary">
                                <tr>
                                    <th className="px-4 py-3 md:px-6">Tenure</th>
                                    <th className="px-4 py-3 md:px-6">Months</th>
                                    <th className="px-4 py-3 text-right md:px-6">General</th>
                                    <th className="px-4 py-3 text-right md:px-6">Senior citizen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary">
                                {rateList.map((slab) => (
                                    <tr key={`${slab.minMonths}-${slab.maxMonths}`}>
                                        <td className="px-4 py-3 font-medium text-primary md:px-6">{slab.label}</td>
                                        <td className="px-4 py-3 text-tertiary tabular-nums md:px-6">
                                            {slab.minMonths}–{slab.maxMonths}
                                        </td>
                                        <td className={cx("px-4 py-3 text-right tabular-nums md:px-6", senior ? "text-tertiary" : "font-semibold text-primary")}>
                                            {slab.rate.toFixed(2)}%
                                        </td>
                                        <td className={cx("px-4 py-3 text-right tabular-nums md:px-6", senior ? "font-semibold text-primary" : "text-tertiary")}>
                                            {slab.seniorRate.toFixed(2)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <OpenDepositModal
                isOpen={isOpenFormOpen}
                onClose={() => setIsOpenFormOpen(false)}
                accounts={accounts.data ?? []}
                accountsLoading={accounts.isLoading && !accounts.data}
                rates={rateList}
                senior={senior}
                hasPin={Boolean(user?.hasTransactionPin)}
                onOpened={() => {
                    deposits.reload();
                    accounts.reload();
                }}
            />

            <ConfirmModal
                isOpen={closing?.stage === "confirm"}
                onClose={() => setClosing(undefined)}
                onConfirm={() => setClosing((current) => (current ? { ...current, stage: "pin" } : current))}
                title="Close this deposit early?"
                destructive
                confirmLabel="Continue to close"
                description={
                    <>
                        Premature closure pays interest at the rate applicable for the period the deposit was actually held, reduced by a{" "}
                        <span className="font-semibold text-secondary">{PENALTY}% penalty</span>. You will earn less than the booked rate.
                    </>
                }
            >
                {closing && estimate && (
                    <dl className="flex flex-col gap-2.5 rounded-lg bg-secondary p-4 text-sm">
                        <Row label="Deposit" value={closing.fd.fdNumber} />
                        <Row label="Principal" value={formatINR(closing.fd.principal)} />
                        <Row label="Booked rate" value={`${closing.fd.interestRate.toFixed(2)}% p.a.`} />
                        <Row label="Held for" value={`${estimate.heldDays} days`} />
                        <Row label="Effective rate (approx.)" value={`${estimate.effectiveRate.toFixed(2)}% p.a.`} />
                        <div className="my-1 border-t border-secondary" />
                        <Row label="Estimated payout" value={formatINR(estimate.payout)} strong />
                        <Row label="Payout on maturity" value={formatINR(closing.fd.maturityAmount)} />
                        <p className="pt-1 text-xs text-tertiary">
                            The estimate is indicative. The bank computes the exact payout, which is credited to {maskAccount(closing.fd.sourceAccountNumber)}.
                        </p>
                    </dl>
                )}
            </ConfirmModal>

            <PinModal
                isOpen={closing?.stage === "pin"}
                onClose={() => setClosing(undefined)}
                onConfirm={closeDeposit}
                title="Authorise premature closure"
                confirmLabel="Close deposit"
                summary={
                    closing && (
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-primary">{closing.fd.fdNumber}</span>
                            <span>
                                Principal {formatINR(closing.fd.principal)} · payout to {maskAccount(closing.fd.sourceAccountNumber)}
                            </span>
                        </div>
                    )
                }
            />
        </>
    );
};

const PinBanner = () => (
    <div className="flex flex-col gap-3 rounded-xl bg-warning-primary p-4 ring-1 ring-secondary sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
            <Lock01 className="mt-0.5 size-5 shrink-0 text-warning-primary" />
            <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-primary">Set your transaction PIN</p>
                <p className="text-sm text-tertiary">You need a 6-digit transaction PIN to open or close fixed deposits.</p>
            </div>
        </div>
        <Button href="/profile" size="sm" color="secondary">
            Set PIN
        </Button>
    </div>
);

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className="flex items-center justify-between gap-4">
        <dt className="text-tertiary">{label}</dt>
        <dd className={cx("text-right tabular-nums", strong ? "font-semibold text-primary" : "font-medium text-secondary")}>{value}</dd>
    </div>
);

const DepositCard = ({ fd, onClose }: { fd: FixedDeposit; onClose: () => void }) => {
    const isActive = fd.status === "ACTIVE";
    const progress = elapsedPct(fd);

    return (
        <article className="flex flex-col gap-5 rounded-xl bg-primary p-4 ring-1 ring-secondary md:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-sm font-semibold text-primary">{fd.fdNumber}</p>
                    <p className="text-xs text-tertiary">
                        {formatTenure(fd.tenureMonths)} · from {maskAccount(fd.sourceAccountNumber)}
                    </p>
                </div>
                <StatusBadge status={fd.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-tertiary">Principal</span>
                    <span className="text-lg font-semibold text-primary tabular-nums">{formatINR(fd.principal)}</span>
                </div>
                <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-xs font-medium text-tertiary">{fd.status === "CLOSED" ? "Paid out" : "Maturity amount"}</span>
                    <span className="text-lg font-semibold text-primary tabular-nums">
                        {formatINR(fd.status === "CLOSED" ? (fd.payoutAmount ?? fd.currentValue) : fd.maturityAmount)}
                    </span>
                </div>
            </div>

            {isActive && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-tertiary">
                        <span>{formatDate(fd.startDate)}</span>
                        <span>{Math.round(progress)}% of tenure</span>
                        <span>{formatDate(fd.maturityDate)}</span>
                    </div>
                    <ProgressBarBase value={progress} />
                </div>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                <Detail label="Interest rate" value={`${fd.interestRate.toFixed(2)}% p.a.`} />
                <Detail label={isActive ? "Current value" : "Maturity value"} value={formatINR(isActive ? fd.currentValue : fd.maturityAmount)} />
                <Detail label="Interest earned" value={formatINR((isActive ? fd.maturityAmount : (fd.payoutAmount ?? fd.maturityAmount)) - fd.principal)} />
                <Detail label="Start date" value={formatDate(fd.startDate)} />
                <Detail label="Maturity date" value={formatDate(fd.maturityDate)} />
                {fd.closedAt ? <Detail label="Closed on" value={formatDate(fd.closedAt)} /> : <Detail label="Auto-renew" value={fd.autoRenew ? "On" : "Off"} />}
            </dl>

            {isActive && (
                <div className="flex flex-col gap-3 border-t border-secondary pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-tertiary">
                        <Calendar className="size-4 text-fg-quaternary" />
                        {fd.autoRenew ? "Renews automatically on maturity" : "Proceeds credited on maturity"}
                    </span>
                    <Button size="sm" color="secondary-destructive" onClick={onClose}>
                        Close early
                    </Button>
                </div>
            )}
        </article>
    );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
    <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-tertiary">{label}</dt>
        <dd className="truncate font-medium text-secondary tabular-nums">{value}</dd>
    </div>
);

interface OpenDepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    accounts: Account[];
    accountsLoading: boolean;
    rates: FdRate[];
    senior: boolean;
    hasPin: boolean;
    onOpened: () => void;
}

type FormErrors = Partial<Record<"sourceAccountId" | "amount" | "tenureMonths", string>>;

const OpenDepositModal = ({ isOpen, onClose, accounts, accountsLoading, rates, senior, hasPin, onOpened }: OpenDepositModalProps) => {
    const toast = useToast();
    const activeAccounts = accounts.filter((account) => account.status === "ACTIVE");

    const [accountId, setAccountId] = useState<number | null>(null);
    const [amount, setAmount] = useState("");
    const [tenure, setTenure] = useState("12");
    const [autoRenew, setAutoRenew] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [stage, setStage] = useState<"form" | "pin">("form");

    const selectedAccountId = accountId ?? activeAccounts[0]?.id ?? null;
    const selectedAccount = activeAccounts.find((account) => account.id === selectedAccountId);
    const amountValue = Number(amount) || 0;
    const tenureValue = Math.floor(Number(tenure) || 0);
    const slab = findSlab(rates, tenureValue);
    const rate = slab ? (senior ? slab.seniorRate : slab.rate) : undefined;
    const maturity = rate !== undefined && amountValue > 0 && tenureValue > 0 ? calculateFdMaturity(amountValue, rate, tenureValue) : 0;
    const maturityDate = tenureValue > 0 ? addMonths(new Date(), tenureValue) : undefined;

    const reset = () => {
        setAccountId(null);
        setAmount("");
        setTenure("12");
        setAutoRenew(false);
        setErrors({});
        setStage("form");
    };

    const close = () => {
        reset();
        onClose();
    };

    const validate = () => {
        const next: FormErrors = {};
        if (!selectedAccount) next.sourceAccountId = "Choose the account to fund this deposit.";
        if (!amount) next.amount = "Enter the deposit amount.";
        else if (!Number.isFinite(amountValue) || amountValue < MIN_AMOUNT) next.amount = `Minimum deposit is ${formatINR(MIN_AMOUNT)}.`;
        else if (selectedAccount && amountValue > selectedAccount.balance) next.amount = `Exceeds available balance of ${formatINR(selectedAccount.balance)}.`;
        if (!tenure || !Number.isInteger(Number(tenure)) || tenureValue < MIN_MONTHS || tenureValue > MAX_MONTHS)
            next.tenureMonths = `Tenure must be between ${MIN_MONTHS} and ${MAX_MONTHS} months.`;
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const proceed = () => {
        if (!hasPin) {
            toast.error("Transaction PIN required", "Set a transaction PIN under Profile & security first.");
            return;
        }
        if (validate()) setStage("pin");
    };

    const submit = async (pin: string) => {
        if (!selectedAccount) return;
        try {
            const fd = await api.deposits.open({ sourceAccountId: selectedAccount.id, amount: amountValue, tenureMonths: tenureValue, autoRenew, pin });
            toast.success("Fixed deposit opened", `${fd.fdNumber} for ${formatINR(fd.principal)} at ${fd.interestRate.toFixed(2)}% matures on ${formatDate(fd.maturityDate)}.`);
            close();
            onOpened();
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors && Object.keys(err.fieldErrors).length) {
                setErrors(err.fieldErrors as FormErrors);
                setStage("form");
                toast.error("Please check the details", err.message);
                return;
            }
            throw err;
        }
    };

    return (
        <>
            <AppModal
                isOpen={isOpen && stage === "form"}
                onClose={close}
                title="Open a fixed deposit"
                description="Funds are debited from the selected account immediately."
                icon={BankNote01}
                widthClassName="sm:max-w-3xl"
                footer={
                    <>
                        <Button color="secondary" size="lg" onClick={close}>
                            Cancel
                        </Button>
                        <Button size="lg" onClick={proceed} isDisabled={accountsLoading}>
                            Continue
                        </Button>
                    </>
                }
            >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                    <form
                        className="flex flex-col gap-5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            proceed();
                        }}
                    >
                        <Select
                            label="Debit from"
                            placeholder={accountsLoading ? "Loading accounts…" : activeAccounts.length ? "Select account" : "No active accounts"}
                            items={activeAccounts.map((account) => ({
                                id: account.id,
                                label: `${account.accountType === "CURRENT" ? "Current" : account.accountType === "SALARY" ? "Salary" : "Savings"} ${maskAccount(account.accountNumber)}`,
                                supportingText: formatINR(account.balance),
                            }))}
                            value={selectedAccountId}
                            onChange={(key) => {
                                setAccountId(key === null ? null : Number(key));
                                setErrors((e) => ({ ...e, sourceAccountId: undefined }));
                            }}
                            isInvalid={Boolean(errors.sourceAccountId)}
                            hint={errors.sourceAccountId}
                            isDisabled={accountsLoading || activeAccounts.length === 0}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                        </Select>

                        <Input
                            label="Deposit amount (₹)"
                            placeholder="Minimum ₹1,000"
                            inputMode="decimal"
                            value={amount}
                            onChange={(value) => {
                                setAmount(value.replace(/[^0-9.]/g, ""));
                                setErrors((e) => ({ ...e, amount: undefined }));
                            }}
                            isInvalid={Boolean(errors.amount)}
                            hint={errors.amount ?? (selectedAccount ? `Available balance ${formatINR(selectedAccount.balance)}` : undefined)}
                        />

                        <div className="flex flex-col gap-3">
                            <Input
                                label="Tenure (months)"
                                placeholder="1 – 120"
                                inputMode="numeric"
                                value={tenure}
                                onChange={(value) => {
                                    setTenure(value.replace(/[^0-9]/g, ""));
                                    setErrors((e) => ({ ...e, tenureMonths: undefined }));
                                }}
                                isInvalid={Boolean(errors.tenureMonths)}
                                hint={errors.tenureMonths ?? (tenureValue > 0 ? formatTenure(tenureValue) : "7 days to 10 years")}
                            />
                            <div className="flex flex-wrap gap-2">
                                {QUICK_TENURES.map((option) => (
                                    <button
                                        key={option.months}
                                        type="button"
                                        onClick={() => {
                                            setTenure(String(option.months));
                                            setErrors((e) => ({ ...e, tenureMonths: undefined }));
                                        }}
                                        className={cx(
                                            "rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition duration-100 ease-linear ring-inset",
                                            tenureValue === option.months
                                                ? "bg-brand-primary text-brand-secondary ring-brand"
                                                : "bg-primary text-secondary ring-primary hover:bg-primary_hover",
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Toggle
                            isSelected={autoRenew}
                            onChange={setAutoRenew}
                            label="Auto-renew on maturity"
                            hint="Principal and interest are reinvested for the same tenure at the prevailing rate."
                        />
                    </form>

                    <aside className="flex flex-col gap-4 rounded-xl bg-secondary p-4 md:p-5">
                        <p className="text-sm font-semibold text-primary">Deposit preview</p>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-tertiary">Maturity amount</span>
                            <span className="text-display-xs font-semibold text-primary tabular-nums">{formatINR(maturity || amountValue)}</span>
                        </div>
                        <dl className="flex flex-col gap-2.5 text-sm">
                            <Row
                                label="Interest rate"
                                value={rate !== undefined ? `${rate.toFixed(2)}% p.a.` : tenureValue > 0 ? "No slab" : "—"}
                                strong
                            />
                            <Row label="Interest earned" value={formatINR(maturity ? maturity - amountValue : 0)} />
                            <Row label="Principal" value={formatINR(amountValue)} />
                            <Row label="Maturity date" value={maturityDate ? formatDate(maturityDate.toISOString()) : "—"} />
                        </dl>
                        {slab && (
                            <p className="text-xs text-tertiary">
                                {slab.label} slab{senior ? " · senior citizen rate applied" : ""}. Compounded quarterly; final rate is confirmed on booking.
                            </p>
                        )}
                        <div className="flex items-start gap-2 border-t border-secondary pt-3 text-xs text-tertiary">
                            <AlertTriangle className="mt-px size-4 shrink-0 text-fg-warning-primary" />
                            <span>Closing before maturity pays {PENALTY}% less than the rate for the period held.</span>
                        </div>
                    </aside>
                </div>
            </AppModal>

            <PinModal
                isOpen={isOpen && stage === "pin"}
                onClose={() => setStage("form")}
                onConfirm={submit}
                title="Authorise fixed deposit"
                confirmLabel="Open deposit"
                summary={
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold text-primary tabular-nums">{formatINR(amountValue)}</span>
                        <span>
                            {formatTenure(tenureValue)} at {rate?.toFixed(2) ?? "—"}% · matures to {formatINR(maturity)}
                        </span>
                        {selectedAccount && <span>Debit from {maskAccount(selectedAccount.accountNumber)}</span>}
                    </div>
                }
            />
        </>
    );
};
