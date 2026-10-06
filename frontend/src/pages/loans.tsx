import type { FC } from "react";
import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, Car01, CheckCircle, Coins01, CreditCard02, File06, GraduationHat01, Home02, Lock01, User01 } from "@untitledui/icons";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { AppModal, PinModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/application/tabs/tabs";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { Select } from "@/components/base/select/select";
import { Slider } from "@/components/base/slider/slider";
import { TextArea } from "@/components/base/textarea/textarea";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { calculateEmi, formatDate, formatINR, formatINRShort, humanize, maskAccount } from "@/lib/format";
import type { Account, Loan, LoanProduct, LoanType } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

type TabKey = "loans" | "apply" | "calculator";

const loanIcons: Record<LoanType, FC<{ className?: string }>> = {
    HOME: Home02,
    PERSONAL: User01,
    CAR: Car01,
    EDUCATION: GraduationHat01,
    GOLD: Coins01,
};

const loanName = (type: LoanType) => `${humanize(type)} loan`;

const formatTenure = (months: number) => {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts = [];
    if (years) parts.push(`${years} yr`);
    if (rest) parts.push(`${rest} mo`);
    return parts.join(" ") || "0 mo";
};

const accountLabel = (account: Account) => `${humanize(account.accountType)} ${maskAccount(account.accountNumber)}`;

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className="flex items-center justify-between gap-4">
        <dt className="text-tertiary">{label}</dt>
        <dd className={cx("text-right tabular-nums", strong ? "font-semibold text-primary" : "font-medium text-secondary")}>{value}</dd>
    </div>
);

const Detail = ({ label, value }: { label: string; value: string }) => (
    <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-tertiary">{label}</dt>
        <dd className="truncate text-sm font-medium text-secondary tabular-nums">{value}</dd>
    </div>
);

export const LoansPage = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState<TabKey>("loans");
    const loans = useApi(() => api.loans.list(), []);
    const accounts = useApi(() => api.accounts.list(), []);
    const activeAccounts = (accounts.data ?? []).filter((account) => account.status === "ACTIVE");

    return (
        <>
            <PageHeader title="Loans" description="Manage your loans, apply for a new one or plan your EMIs." />

            {user && !user.hasTransactionPin && (
                <div className="flex flex-col gap-3 rounded-xl bg-warning-primary p-4 ring-1 ring-secondary sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <Lock01 className="mt-0.5 size-5 shrink-0 text-warning-primary" />
                        <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-semibold text-primary">Set your transaction PIN</p>
                            <p className="text-sm text-tertiary">You need a 6-digit transaction PIN to pay EMIs or prepay a loan.</p>
                        </div>
                    </div>
                    <Button href="/profile" size="sm" color="secondary">
                        Set PIN
                    </Button>
                </div>
            )}

            <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key as TabKey)} className="gap-6">
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <Tabs.List type="underline" size="sm">
                        <Tabs.Item id="loans">My loans</Tabs.Item>
                        <Tabs.Item id="apply">Apply for a loan</Tabs.Item>
                        <Tabs.Item id="calculator">EMI calculator</Tabs.Item>
                    </Tabs.List>
                </div>

                <Tabs.Panel id="loans" className="flex flex-col gap-6">
                    <MyLoans
                        loans={loans.data}
                        isLoading={loans.isLoading && !loans.data}
                        error={loans.error && !loans.data ? loans.error.message : undefined}
                        reload={loans.reload}
                        accounts={activeAccounts}
                        hasPin={Boolean(user?.hasTransactionPin)}
                        onRepaid={() => {
                            loans.reload();
                            accounts.reload();
                        }}
                        onApply={() => setTab("apply")}
                    />
                </Tabs.Panel>

                <Tabs.Panel id="apply">
                    <ApplyLoan
                        accounts={activeAccounts}
                        accountsLoading={accounts.isLoading && !accounts.data}
                        onApplied={() => {
                            loans.reload();
                            setTab("loans");
                        }}
                    />
                </Tabs.Panel>

                <Tabs.Panel id="calculator">
                    <EmiCalculator />
                </Tabs.Panel>
            </Tabs>
        </>
    );
};

// ---------------------------------------------------------------- My loans

interface MyLoansProps {
    loans: Loan[] | undefined;
    isLoading: boolean;
    error: string | undefined;
    reload: () => void;
    accounts: Account[];
    hasPin: boolean;
    onRepaid: () => void;
    onApply: () => void;
}

const MyLoans = ({ loans, isLoading, error, reload, accounts, hasPin, onRepaid, onApply }: MyLoansProps) => {
    const [repaying, setRepaying] = useState<Loan>();

    if (isLoading) return <LoadingState label="Loading your loans…" />;
    if (error)
        return (
            <SectionCard>
                <ErrorState message={error} onRetry={reload} />
            </SectionCard>
        );

    const list = [...(loans ?? [])].sort((a, b) => {
        const order = { ACTIVE: 0, PENDING: 1, REJECTED: 2, CLOSED: 3 };
        return order[a.status] - order[b.status] || b.appliedAt.localeCompare(a.appliedAt);
    });

    if (list.length === 0)
        return (
            <SectionCard>
                <EmptyPanel
                    icon={File06}
                    title="You don't have any loans"
                    description="Home, car, education, personal and gold loans at competitive rates with instant EMI estimates."
                    action={<Button onClick={onApply}>Apply for a loan</Button>}
                />
            </SectionCard>
        );

    const active = list.filter((loan) => loan.status === "ACTIVE");
    const outstanding = active.reduce((sum, loan) => sum + loan.outstanding, 0);
    const monthlyEmi = active.reduce((sum, loan) => sum + loan.emi, 0);
    const nextDue = active
        .map((loan) => loan.nextDueDate)
        .filter((date): date is string => Boolean(date))
        .sort()[0];

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                <StatCard label="Total outstanding" icon={CreditCard02} value={formatINR(outstanding)} footer={`${active.length} active ${active.length === 1 ? "loan" : "loans"}`} />
                <StatCard label="Monthly EMI" icon={Calculator} value={formatINR(monthlyEmi)} footer="Across all active loans" />
                <StatCard label="Next EMI due" icon={CheckCircle} value={nextDue ? formatDate(nextDue) : "—"} footer={nextDue ? "Keep your account funded" : "No dues right now"} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                {list.map((loan) => (
                    <LoanCard key={loan.id} loan={loan} onRepay={() => setRepaying(loan)} />
                ))}
            </div>

            <RepayModal loan={repaying} onClose={() => setRepaying(undefined)} accounts={accounts} hasPin={hasPin} onRepaid={onRepaid} />
        </>
    );
};

const LoanCard = ({ loan, onRepay }: { loan: Loan; onRepay: () => void }) => {
    const Icon = loanIcons[loan.type] ?? File06;
    const progress = loan.tenureMonths ? Math.min(100, (loan.emisPaid / loan.tenureMonths) * 100) : 0;
    const repaid = Math.max(0, loan.principal - loan.outstanding);

    return (
        <article className="flex flex-col gap-5 rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary md:p-6">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <FeaturedIcon icon={Icon} color="brand" theme="light" size="md" />
                    <div className="flex min-w-0 flex-col">
                        <p className="truncate text-md font-semibold text-primary">{loanName(loan.type)}</p>
                        <p className="truncate text-sm text-tertiary">{loan.loanNumber}</p>
                    </div>
                </div>
                <StatusBadge status={loan.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-tertiary">{loan.status === "ACTIVE" ? "Outstanding" : "Loan amount"}</span>
                    <span className="text-xl font-semibold text-primary tabular-nums">{formatINR(loan.status === "ACTIVE" ? loan.outstanding : loan.principal)}</span>
                </div>
                <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-xs font-medium text-tertiary">Monthly EMI</span>
                    <span className="text-xl font-semibold text-primary tabular-nums">{formatINR(loan.emi)}</span>
                </div>
            </div>

            {(loan.status === "ACTIVE" || loan.status === "CLOSED") && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-tertiary">
                        <span className="tabular-nums">
                            {loan.emisPaid} of {loan.tenureMonths} EMIs paid
                        </span>
                        <span className="tabular-nums">{formatINR(repaid)} repaid</span>
                    </div>
                    <ProgressBarBase value={loan.status === "CLOSED" ? 100 : progress} />
                </div>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Detail label="Principal" value={formatINR(loan.principal)} />
                <Detail label="Interest rate" value={`${loan.interestRate.toFixed(2)}% p.a.`} />
                <Detail label="Tenure" value={formatTenure(loan.tenureMonths)} />
                <Detail label="Applied on" value={formatDate(loan.appliedAt)} />
                <Detail label={loan.status === "ACTIVE" ? "Next due" : "Decided on"} value={formatDate(loan.status === "ACTIVE" ? loan.nextDueDate : loan.decidedAt)} />
                <Detail label="Account" value={maskAccount(loan.disbursementAccountNumber)} />
            </dl>

            {loan.status === "PENDING" && (
                <p className="rounded-lg bg-secondary p-3 text-sm text-tertiary">
                    Your application is under review. Once approved, {formatINR(loan.principal)} will be credited to {maskAccount(loan.disbursementAccountNumber)}.
                    {loan.remarks && <span className="mt-1 block text-secondary">Remarks: {loan.remarks}</span>}
                </p>
            )}
            {loan.status === "REJECTED" && (
                <p className="rounded-lg bg-error-primary p-3 text-sm text-error-primary">
                    <span className="font-semibold">Application declined.</span> {loan.remarks || "No reason was provided."}
                </p>
            )}
            {loan.status === "CLOSED" && <p className="rounded-lg bg-success-primary p-3 text-sm text-success-primary">Fully repaid. This loan is closed.</p>}

            {loan.status === "ACTIVE" && (
                <div className="flex flex-col gap-3 border-t border-secondary pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-tertiary">Purpose: {loan.purpose}</span>
                    <Button size="sm" onClick={onRepay}>
                        Pay EMI / prepay
                    </Button>
                </div>
            )}
        </article>
    );
};

interface RepayModalProps {
    loan: Loan | undefined;
    onClose: () => void;
    accounts: Account[];
    hasPin: boolean;
    onRepaid: () => void;
}

const RepayModal = ({ loan, onClose, accounts, hasPin, onRepaid }: RepayModalProps) => {
    const toast = useToast();
    const [mode, setMode] = useState<"emi" | "prepay">("emi");
    const [accountId, setAccountId] = useState<number | null>(null);
    const [amount, setAmount] = useState("");
    const [errors, setErrors] = useState<Partial<Record<"accountId" | "amount", string>>>({});
    const [stage, setStage] = useState<"form" | "pin">("form");

    const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
    const account = accounts.find((a) => a.id === selectedAccountId);
    const emiAmount = loan ? Math.min(loan.emi, loan.outstanding) : 0;
    const amountValue = mode === "emi" ? emiAmount : Number(amount) || 0;

    const close = () => {
        setMode("emi");
        setAccountId(null);
        setAmount("");
        setErrors({});
        setStage("form");
        onClose();
    };

    const proceed = () => {
        if (!loan) return;
        if (!hasPin) {
            toast.error("Transaction PIN required", "Set a transaction PIN under Profile & security first.");
            return;
        }
        const next: typeof errors = {};
        if (!account) next.accountId = "Choose the account to pay from.";
        if (mode === "prepay") {
            if (!amount || amountValue <= 0) next.amount = "Enter the amount to prepay.";
            else if (amountValue > loan.outstanding) next.amount = `Cannot exceed the outstanding ${formatINR(loan.outstanding)}.`;
        }
        if (!next.amount && account && amountValue > account.balance) next.amount = `Insufficient balance (${formatINR(account.balance)} available).`;
        setErrors(next);
        if (Object.keys(next).length === 0) setStage("pin");
    };

    const submit = async (pin: string) => {
        if (!loan || !account) return;
        try {
            const updated = await api.loans.repay(loan.id, { accountId: account.id, amount: Math.round(amountValue * 100) / 100, pin });
            toast.success(
                updated.status === "CLOSED" ? "Loan fully repaid" : "Payment successful",
                updated.status === "CLOSED"
                    ? `${loan.loanNumber} is now closed.`
                    : `${formatINR(amountValue)} paid. Outstanding is now ${formatINR(updated.outstanding)}.`,
            );
            close();
            onRepaid();
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors && Object.keys(err.fieldErrors).length) {
                setErrors(err.fieldErrors);
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
                isOpen={Boolean(loan) && stage === "form"}
                onClose={close}
                title="Pay EMI or prepay"
                description={loan && `${loanName(loan.type)} · ${loan.loanNumber}`}
                icon={CreditCard02}
                widthClassName="sm:max-w-lg"
                footer={
                    <>
                        <Button color="secondary" size="lg" onClick={close}>
                            Cancel
                        </Button>
                        <Button size="lg" onClick={proceed}>
                            Continue
                        </Button>
                    </>
                }
            >
                {loan && (
                    <form
                        className="flex flex-col gap-5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            proceed();
                        }}
                    >
                        <dl className="flex flex-col gap-2 rounded-lg bg-secondary p-4 text-sm">
                            <Row label="Outstanding" value={formatINR(loan.outstanding)} strong />
                            <Row label="Monthly EMI" value={formatINR(loan.emi)} />
                            <Row label="Next due" value={formatDate(loan.nextDueDate)} />
                        </dl>

                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary_alt p-1 ring-1 ring-secondary ring-inset">
                            {(["emi", "prepay"] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => {
                                        setMode(option);
                                        setErrors({});
                                    }}
                                    className={cx(
                                        "rounded-md px-3 py-2 text-sm font-semibold transition duration-100 ease-linear",
                                        mode === option ? "bg-primary text-secondary shadow-xs ring-1 ring-primary ring-inset" : "text-quaternary hover:text-secondary",
                                    )}
                                >
                                    {option === "emi" ? "Pay EMI" : "Part-prepayment"}
                                </button>
                            ))}
                        </div>

                        <Select
                            label="Pay from"
                            placeholder={accounts.length ? "Select account" : "No active accounts"}
                            items={accounts.map((a) => ({ id: a.id, label: accountLabel(a), supportingText: formatINR(a.balance) }))}
                            value={selectedAccountId}
                            onChange={(key) => {
                                setAccountId(key === null ? null : Number(key));
                                setErrors((e) => ({ ...e, accountId: undefined }));
                            }}
                            isInvalid={Boolean(errors.accountId)}
                            hint={errors.accountId}
                            isDisabled={accounts.length === 0}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                        </Select>

                        {mode === "emi" ? (
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-secondary">Amount</span>
                                <span className="text-display-xs font-semibold text-primary tabular-nums">{formatINR(emiAmount)}</span>
                                {errors.amount && <span className="text-sm text-error-primary">{errors.amount}</span>}
                            </div>
                        ) : (
                            <Input
                                label="Prepayment amount (₹)"
                                inputMode="decimal"
                                placeholder={`Up to ${formatINR(loan.outstanding)}`}
                                value={amount}
                                onChange={(value) => {
                                    setAmount(value.replace(/[^0-9.]/g, ""));
                                    setErrors((e) => ({ ...e, amount: undefined }));
                                }}
                                isInvalid={Boolean(errors.amount)}
                                hint={errors.amount ?? "Part-prepayment reduces your outstanding principal. Paying the full outstanding closes the loan."}
                            />
                        )}
                    </form>
                )}
            </AppModal>

            <PinModal
                isOpen={Boolean(loan) && stage === "pin"}
                onClose={() => setStage("form")}
                onConfirm={submit}
                title={mode === "emi" ? "Authorise EMI payment" : "Authorise prepayment"}
                confirmLabel={`Pay ${formatINR(amountValue)}`}
                summary={
                    loan && (
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-primary tabular-nums">{formatINR(amountValue)}</span>
                            <span>
                                {loan.loanNumber}
                                {account && ` · from ${maskAccount(account.accountNumber)}`}
                            </span>
                        </div>
                    )
                }
            />
        </>
    );
};

// ---------------------------------------------------------------- Apply

type ApplyErrors = Partial<Record<"amount" | "tenureMonths" | "purpose" | "monthlyIncome" | "disbursementAccountId", string>>;

const ApplyLoan = ({ accounts, accountsLoading, onApplied }: { accounts: Account[]; accountsLoading: boolean; onApplied: () => void }) => {
    const toast = useToast();
    const products = useApi(() => api.loans.products(), []);
    const [selectedType, setSelectedType] = useState<LoanType>();
    const [amount, setAmount] = useState("");
    const [tenure, setTenure] = useState("");
    const [purpose, setPurpose] = useState("");
    const [income, setIncome] = useState("");
    const [accountId, setAccountId] = useState<number | null>(null);
    const [errors, setErrors] = useState<ApplyErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const product = products.data?.find((p) => p.type === selectedType);
    const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
    const amountValue = Number(amount) || 0;
    const tenureValue = Math.floor(Number(tenure) || 0);
    const incomeValue = Number(income) || 0;
    const emi = product ? calculateEmi(amountValue, product.rate, tenureValue) : 0;
    const totalPayable = emi * tenureValue;
    const totalInterest = Math.max(0, totalPayable - amountValue);
    const fee = product ? (amountValue * product.processingFeePct) / 100 : 0;
    const ratio = incomeValue > 0 && emi > 0 ? (emi / incomeValue) * 100 : undefined;

    const choose = (p: LoanProduct) => {
        setSelectedType(p.type);
        setErrors({});
        setTenure((current) => (current && Number(current) <= p.maxTenureMonths ? current : String(Math.min(p.maxTenureMonths, 60))));
    };

    const clear = (key: keyof ApplyErrors) => setErrors((e) => ({ ...e, [key]: undefined }));

    const submit = async () => {
        if (!product) return;
        const next: ApplyErrors = {};
        if (!amount || amountValue <= 0) next.amount = "Enter the loan amount.";
        else if (amountValue > product.maxAmount) next.amount = `Maximum for this loan is ${formatINR(product.maxAmount)}.`;
        if (!tenure || tenureValue < 1) next.tenureMonths = "Enter the tenure in months.";
        else if (tenureValue > product.maxTenureMonths) next.tenureMonths = `Maximum tenure is ${product.maxTenureMonths} months.`;
        if (purpose.trim().length < 5) next.purpose = "Describe the purpose in a few words.";
        if (!income || incomeValue <= 0) next.monthlyIncome = "Enter your net monthly income.";
        if (!selectedAccountId) next.disbursementAccountId = "Choose the account to receive the funds.";
        setErrors(next);
        if (Object.keys(next).length) return;

        setIsSubmitting(true);
        try {
            const loan = await api.loans.apply({
                type: product.type,
                amount: amountValue,
                tenureMonths: tenureValue,
                purpose: purpose.trim(),
                monthlyIncome: incomeValue,
                disbursementAccountId: selectedAccountId!,
            });
            toast.success("Application submitted", `${loan.loanNumber} is under review. We'll notify you once it's decided.`);
            setSelectedType(undefined);
            setAmount("");
            setTenure("");
            setPurpose("");
            setIncome("");
            setAccountId(null);
            onApplied();
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors as ApplyErrors);
            toast.error("Couldn't submit application", err instanceof Error ? err.message : undefined);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (products.isLoading && !products.data) return <LoadingState label="Loading loan products…" />;
    if (products.error && !products.data)
        return (
            <SectionCard>
                <ErrorState message={products.error.message} onRetry={products.reload} />
            </SectionCard>
        );
    if (!products.data?.length)
        return (
            <SectionCard>
                <EmptyPanel icon={File06} title="No loan products available" description="Please check back later." />
            </SectionCard>
        );

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {products.data.map((p) => {
                    const Icon = loanIcons[p.type] ?? File06;
                    const selected = p.type === selectedType;
                    return (
                        <button
                            key={p.type}
                            type="button"
                            onClick={() => choose(p)}
                            aria-pressed={selected}
                            className={cx(
                                "flex flex-col gap-4 rounded-xl bg-primary p-5 text-left shadow-xs ring-1 transition duration-100 ease-linear outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                                selected ? "ring-2 ring-brand" : "ring-secondary hover:ring-primary",
                            )}
                        >
                            <FeaturedIcon icon={Icon} color={selected ? "brand" : "gray"} theme="modern" size="md" />
                            <div className="flex flex-col gap-1">
                                <p className="text-md font-semibold text-primary">{p.name}</p>
                                <p className="line-clamp-2 text-sm text-tertiary">{p.description}</p>
                            </div>
                            <dl className="mt-auto flex flex-col gap-1.5 text-sm">
                                <Row label="Rate" value={`${p.rate.toFixed(2)}% p.a.`} strong />
                                <Row label="Up to" value={formatINRShort(p.maxAmount)} />
                                <Row label="Tenure" value={formatTenure(p.maxTenureMonths)} />
                                <Row label="Processing fee" value={`${p.processingFeePct}%`} />
                            </dl>
                        </button>
                    );
                })}
            </div>

            {product ? (
                <SectionCard title={`Apply for a ${product.name.toLowerCase().includes("loan") ? product.name : `${product.name} loan`}`} description={`${product.rate.toFixed(2)}% p.a. · up to ${formatINR(product.maxAmount)} for ${product.maxTenureMonths} months`}>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-8">
                        <form
                            className="flex flex-col gap-5"
                            onSubmit={(event) => {
                                event.preventDefault();
                                submit();
                            }}
                        >
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <Input
                                    label="Loan amount (₹)"
                                    inputMode="decimal"
                                    placeholder={`Up to ${formatINRShort(product.maxAmount)}`}
                                    value={amount}
                                    onChange={(value) => {
                                        setAmount(value.replace(/[^0-9.]/g, ""));
                                        clear("amount");
                                    }}
                                    isInvalid={Boolean(errors.amount)}
                                    hint={errors.amount ?? `Maximum ${formatINR(product.maxAmount)}`}
                                />
                                <Input
                                    label="Tenure (months)"
                                    inputMode="numeric"
                                    placeholder={`1 – ${product.maxTenureMonths}`}
                                    value={tenure}
                                    onChange={(value) => {
                                        setTenure(value.replace(/[^0-9]/g, ""));
                                        clear("tenureMonths");
                                    }}
                                    isInvalid={Boolean(errors.tenureMonths)}
                                    hint={errors.tenureMonths ?? (tenureValue ? formatTenure(tenureValue) : `Up to ${product.maxTenureMonths} months`)}
                                />
                                <Input
                                    label="Net monthly income (₹)"
                                    inputMode="decimal"
                                    placeholder="e.g. 85000"
                                    value={income}
                                    onChange={(value) => {
                                        setIncome(value.replace(/[^0-9.]/g, ""));
                                        clear("monthlyIncome");
                                    }}
                                    isInvalid={Boolean(errors.monthlyIncome)}
                                    hint={errors.monthlyIncome}
                                />
                                <Select
                                    label="Disbursement account"
                                    placeholder={accountsLoading ? "Loading accounts…" : accounts.length ? "Select account" : "No active accounts"}
                                    items={accounts.map((a) => ({ id: a.id, label: accountLabel(a), supportingText: a.ifscCode }))}
                                    value={selectedAccountId}
                                    onChange={(key) => {
                                        setAccountId(key === null ? null : Number(key));
                                        clear("disbursementAccountId");
                                    }}
                                    isInvalid={Boolean(errors.disbursementAccountId)}
                                    hint={errors.disbursementAccountId}
                                    isDisabled={accountsLoading || accounts.length === 0}
                                >
                                    {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                                </Select>
                            </div>
                            <TextArea
                                label="Purpose"
                                placeholder="e.g. Purchase of a 2BHK flat in Pune"
                                rows={3}
                                value={purpose}
                                onChange={(value) => {
                                    setPurpose(value);
                                    clear("purpose");
                                }}
                                isInvalid={Boolean(errors.purpose)}
                                hint={errors.purpose}
                            />
                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <Button color="secondary" onClick={() => setSelectedType(undefined)} isDisabled={isSubmitting}>
                                    Cancel
                                </Button>
                                <Button type="submit" isLoading={isSubmitting} showTextWhileLoading>
                                    Submit application
                                </Button>
                            </div>
                        </form>

                        <aside className="flex flex-col gap-4 self-start rounded-xl bg-secondary p-5">
                            <p className="text-sm font-semibold text-primary">Repayment estimate</p>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-tertiary">Monthly EMI</span>
                                <span className="text-display-xs font-semibold text-primary tabular-nums">{formatINR(emi)}</span>
                            </div>
                            <dl className="flex flex-col gap-2.5 text-sm">
                                <Row label="Principal" value={formatINR(amountValue)} />
                                <Row label="Total interest" value={formatINR(totalInterest)} />
                                <Row label="Total payable" value={formatINR(totalPayable)} strong />
                                <Row label={`Processing fee (${product.processingFeePct}%)`} value={formatINR(fee)} />
                            </dl>
                            {ratio !== undefined && (
                                <div
                                    className={cx(
                                        "flex items-start gap-2 rounded-lg p-3 text-sm",
                                        ratio > 50 ? "bg-warning-primary text-warning-primary" : "bg-success-primary text-success-primary",
                                    )}
                                >
                                    {ratio > 50 ? <AlertTriangle className="mt-px size-4 shrink-0" /> : <CheckCircle className="mt-px size-4 shrink-0" />}
                                    <span>
                                        EMI is {ratio.toFixed(0)}% of your monthly income.{" "}
                                        {ratio > 50 ? "Applications above 50% are less likely to be approved — consider a longer tenure or lower amount." : "This looks comfortably within the 50% guideline."}
                                    </span>
                                </div>
                            )}
                            <p className="text-xs text-tertiary">Indicative figures at {product.rate.toFixed(2)}% p.a. Final terms are confirmed on approval.</p>
                        </aside>
                    </div>
                </SectionCard>
            ) : (
                <p className="text-center text-sm text-tertiary">Select a loan product above to start your application.</p>
            )}
        </div>
    );
};

// ---------------------------------------------------------------- EMI calculator

const EmiCalculator = () => {
    const [principal, setPrincipal] = useState(2500000);
    const [rate, setRate] = useState(8.5);
    const [months, setMonths] = useState(240);

    const emi = calculateEmi(principal, rate, months);
    const total = emi * months;
    const interest = Math.max(0, total - principal);
    const chartData = useMemo(
        () => [
            { name: "Principal", value: principal, className: "fill-utility-brand-600 text-utility-brand-600" },
            { name: "Interest", value: interest, className: "fill-utility-brand-200 text-utility-brand-200" },
        ],
        [principal, interest],
    );

    const sliders = [
        {
            label: "Loan amount",
            display: formatINR(principal),
            value: principal,
            min: 50000,
            max: 20000000,
            step: 50000,
            onChange: setPrincipal,
            range: ["₹50K", "₹2Cr"],
        },
        { label: "Interest rate", display: `${rate.toFixed(2)}% p.a.`, value: rate, min: 5, max: 20, step: 0.05, onChange: setRate, range: ["5%", "20%"] },
        { label: "Tenure", display: `${months} months (${formatTenure(months)})`, value: months, min: 6, max: 360, step: 6, onChange: setMonths, range: ["6 mo", "30 yr"] },
    ];

    return (
        <SectionCard title="EMI calculator" description="Plan your borrowing. Uses the standard reducing-balance method.">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                <div className="flex flex-col gap-8">
                    {sliders.map((slider) => (
                        <div key={slider.label} className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-sm font-medium text-secondary">{slider.label}</span>
                                <span className="text-md font-semibold text-primary tabular-nums">{slider.display}</span>
                            </div>
                            <Slider
                                aria-label={slider.label}
                                minValue={slider.min}
                                maxValue={slider.max}
                                step={slider.step}
                                value={slider.value}
                                onChange={(value) => slider.onChange(Array.isArray(value) ? value[0] : value)}
                                formatOptions={{ maximumFractionDigits: 2 }}
                            />
                            <div className="flex justify-between text-xs text-quaternary">
                                <span>{slider.range[0]}</span>
                                <span>{slider.range[1]}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-5 rounded-xl bg-secondary p-5">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-tertiary">Monthly EMI</span>
                        <span className="text-display-sm font-semibold text-primary tabular-nums">{formatINR(emi)}</span>
                    </div>
                    <div className="relative h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                                    {chartData.map((entry) => (
                                        <Cell key={entry.name} className={entry.className} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xs text-tertiary">Total payable</span>
                            <span className="text-md font-semibold text-primary tabular-nums">{formatINRShort(total)}</span>
                        </div>
                    </div>
                    <dl className="flex flex-col gap-2.5 text-sm">
                        {chartData.map((entry) => (
                            <div key={entry.name} className="flex items-center justify-between gap-4">
                                <dt className="flex items-center gap-2 text-tertiary">
                                    <span className={cx("size-2.5 rounded-full bg-current", entry.className)} />
                                    {entry.name}
                                    <span className="text-quaternary tabular-nums">({total ? Math.round((entry.value / total) * 100) : 0}%)</span>
                                </dt>
                                <dd className="font-medium text-secondary tabular-nums">{formatINR(entry.value)}</dd>
                            </div>
                        ))}
                        <div className="my-1 border-t border-secondary" />
                        <Row label="Total payable" value={formatINR(total)} strong />
                    </dl>
                </div>
            </div>
        </SectionCard>
    );
};
