import type { FC, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Building07,
    CheckCircle,
    CheckVerified01,
    Clock,
    CurrencyRupee,
    InfoCircle,
    Lock01,
    Printer,
    SwitchHorizontal01,
    Users01,
    Wallet02,
    Zap,
} from "@untitledui/icons";
import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";
import { useSearchParams } from "react-router";
import { Tabs } from "@/components/application/tabs/tabs";
import { PinModal } from "@/components/app/app-modal";
import { useNotificationCount } from "@/components/app/app-layout";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge, BadgeWithIcon } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { errorMessage, useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, formatINR, formatINRShort, humanize, maskAccount } from "@/lib/format";
import type { Account, Beneficiary, TransferLimits, TransferMode, TransferReceipt, UpiLookup } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

// ---------------------------------------------------------------------------
// Small building blocks (also used by the bill payments page)
// ---------------------------------------------------------------------------

/** Shown instead of the submit action when the customer has no transaction PIN yet. */
export const PinSetupBanner = ({ action = "transfer money" }: { action?: string }) => (
    <div className="flex flex-col gap-4 rounded-xl bg-warning-primary p-4 ring-1 ring-secondary sm:flex-row sm:items-center">
        <FeaturedIcon icon={Lock01} color="warning" theme="light" size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-semibold text-primary">Set your transaction PIN first</p>
            <p className="text-sm text-tertiary">
                Every payment is authorised with a 6-digit transaction PIN. Set one under Profile & security to {action}.
            </p>
        </div>
        <Button href="/profile" color="secondary" size="md" className="shrink-0">
            Set transaction PIN
        </Button>
    </div>
);

/** Label/value line used in review and receipt summaries. */
export const DetailRow = ({ label, value, emphasis }: { label: string; value: ReactNode; emphasis?: boolean }) => (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <dt className="shrink-0 text-sm text-tertiary">{label}</dt>
        <dd className={cx("min-w-0 text-sm break-words sm:text-right", emphasis ? "font-semibold text-primary" : "font-medium text-secondary")}>{value}</dd>
    </div>
);

const Notice = ({ icon: Icon = InfoCircle, children, tone = "gray" }: { icon?: FC<{ className?: string }>; children: ReactNode; tone?: "gray" | "warning" }) => (
    <div className={cx("flex items-start gap-3 rounded-lg p-3 text-sm", tone === "warning" ? "bg-warning-primary text-warning-primary" : "bg-secondary text-tertiary")}>
        <Icon className={cx("mt-0.5 size-4 shrink-0", tone === "warning" ? "text-fg-warning-primary" : "text-fg-quaternary")} />
        <div className="min-w-0">{children}</div>
    </div>
);

const UsageBar = ({ label, used, limit }: { label: string; used: number; limit: number }) => {
    const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
    const remaining = Math.max(0, limit - used);
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-secondary">{label}</span>
                <span className="text-xs text-tertiary tabular-nums">{Math.round(pct)}% used</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-quaternary" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                <div className={cx("h-full rounded-full", pct >= 90 ? "bg-error-solid" : pct >= 70 ? "bg-warning-solid" : "bg-brand-solid")} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 text-xs text-tertiary tabular-nums">
                <span>
                    Used {formatINR(used)} of {formatINR(limit)}
                </span>
                <span className="font-medium text-secondary">{formatINR(remaining)} left</span>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TabKey = "own" | "payee" | "upi";
type ExternalMode = "IMPS" | "NEFT" | "RTGS";

const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

const accountLabel = (account: Account) => `${humanize(account.accountType)} · ${maskAccount(account.accountNumber)}`;

const isCooling = (payee: Beneficiary) => new Date(payee.coolingPeriodEndsAt).getTime() > Date.now();

const modeName: Record<TransferMode, string> = {
    INTERNAL: "Within bank (internal)",
    IMPS: "IMPS",
    NEFT: "NEFT",
    RTGS: "RTGS",
    UPI: "UPI",
};

const settlementCopy: Record<TransferMode, string> = {
    INTERNAL: "Credited instantly",
    IMPS: "Credited instantly, 24x7",
    NEFT: "Settles in the next half-hourly batch",
    RTGS: "Real-time gross settlement",
    UPI: "Credited instantly, 24x7",
};

interface TransferData {
    accounts: Account[];
    payees: Beneficiary[];
    limits: TransferLimits;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const TransferPage = () => {
    const { user } = useAuth();
    const toast = useToast();
    const { refreshUnread } = useNotificationCount();
    const [searchParams] = useSearchParams();
    const presetPayee = searchParams.get("payee");

    const { data, error, isLoading, reload } = useApi<TransferData>(async () => {
        const [accounts, payees, limits] = await Promise.all([api.accounts.list(), api.beneficiaries.list(), api.transfers.limits()]);
        return { accounts, payees, limits };
    }, []);

    const [tab, setTab] = useState<TabKey>("own");
    const [fromId, setFromId] = useState<string | null>(null);
    const [toId, setToId] = useState<string | null>(null);
    const [payeeId, setPayeeId] = useState<string | null>(null);
    const [externalMode, setExternalMode] = useState<ExternalMode>("IMPS");
    const [upiId, setUpiId] = useState("");
    const [upiResult, setUpiResult] = useState<UpiLookup | null>(null);
    const [upiError, setUpiError] = useState<string>();
    const [isVerifying, setIsVerifying] = useState(false);
    const [amount, setAmount] = useState("");
    const [remarks, setRemarks] = useState("");

    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const [step, setStep] = useState<"form" | "review" | "done">("form");
    const [isPinOpen, setIsPinOpen] = useState(false);
    const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
    const [presetApplied, setPresetApplied] = useState(false);

    const activeAccounts = useMemo(() => data?.accounts.filter((account) => account.status === "ACTIVE") ?? [], [data]);

    // Default the debit account once data arrives.
    useEffect(() => {
        if (!fromId && activeAccounts.length > 0) setFromId(String(activeAccounts[0].id));
    }, [activeAccounts, fromId]);

    // Support /transfer?payee=<id> from the payees page.
    useEffect(() => {
        if (presetApplied || !data) return;
        if (presetPayee && data.payees.some((payee) => String(payee.id) === presetPayee)) {
            setTab("payee");
            setPayeeId(presetPayee);
        }
        setPresetApplied(true);
    }, [data, presetPayee, presetApplied]);

    const from = activeAccounts.find((account) => String(account.id) === fromId);
    const toAccount = activeAccounts.find((account) => String(account.id) === toId);
    const payee = data?.payees.find((item) => String(item.id) === payeeId);
    const limits = data?.limits;

    const mode: TransferMode | null = tab === "own" ? "INTERNAL" : tab === "upi" ? "UPI" : payee ? (payee.internal ? "INTERNAL" : externalMode) : null;

    const clearServer = (field: string) =>
        setServerErrors((current) => {
            if (!(field in current)) return current;
            const next = { ...current };
            delete next[field];
            return next;
        });

    // Maximum amount allowed and the reason for each ceiling, tightest first.
    const caps = useMemo(() => {
        const list: { max: number; reason: string }[] = [];
        if (from) list.push({ max: from.balance, reason: `Insufficient balance. Available: ${formatINR(from.balance)}` });
        if (limits && tab !== "own") {
            const remaining = Math.max(0, limits.dailyLimit - limits.usedToday);
            list.push({ max: remaining, reason: `Exceeds your remaining daily transfer limit of ${formatINR(remaining)}` });
        }
        if (limits && mode === "IMPS") list.push({ max: limits.impsMax, reason: `IMPS allows up to ${formatINR(limits.impsMax)} per transaction. Use NEFT or RTGS for more.` });
        if (limits && mode === "UPI") {
            list.push({ max: limits.upiMax, reason: `UPI allows up to ${formatINR(limits.upiMax)} per transaction` });
            const upiLeft = Math.max(0, limits.upiDailyLimit - limits.upiUsedToday);
            list.push({ max: upiLeft, reason: `Exceeds your remaining UPI limit for today (${formatINR(upiLeft)})` });
        }
        if (tab === "payee" && payee) {
            list.push({ max: payee.transferLimit, reason: `Exceeds the limit of ${formatINR(payee.transferLimit)} you set for this payee` });
            if (isCooling(payee) && limits) {
                list.push({
                    max: limits.newPayeeLimit,
                    reason: `This payee was added recently. Until ${formatDateTime(payee.coolingPeriodEndsAt)} you can send up to ${formatINR(limits.newPayeeLimit)} per transfer.`,
                });
            }
        }
        return list.sort((a, b) => a.max - b.max);
    }, [from, limits, tab, mode, payee]);

    const maxAllowed = caps.length > 0 ? caps[0].max : undefined;

    const errors = useMemo(() => {
        const result: Record<string, string> = {};
        if (!from) result.fromAccountId = "Choose the account to pay from";

        if (tab === "own") {
            if (!toAccount) result.toAccountId = "Choose the account to credit";
            else if (toAccount.id === from?.id) result.toAccountId = "Choose a different account from the one you're paying from";
        } else if (tab === "payee") {
            if (!payee) result.beneficiaryId = "Choose a payee";
        } else {
            if (!upiId.trim()) result.upiId = "Enter the UPI ID you want to pay";
            else if (!UPI_PATTERN.test(upiId.trim())) result.upiId = "Enter a valid UPI ID, like name@bnb";
            else if (!upiResult || upiResult.upiId.toLowerCase() !== upiId.trim().toLowerCase()) result.upiId = "Verify the UPI ID before continuing";
        }

        const value = Number(amount);
        if (!amount.trim()) result.amount = "Enter an amount";
        else if (!AMOUNT_PATTERN.test(amount.trim())) result.amount = "Enter a valid amount with up to 2 decimal places";
        else if (value < 1) result.amount = "The minimum amount is ₹1";
        else if (mode === "RTGS" && limits && value < limits.rtgsMin) result.amount = `RTGS is for ${formatINR(limits.rtgsMin)} and above. Use IMPS or NEFT for smaller amounts.`;
        else {
            const violated = caps.find((cap) => value > cap.max);
            if (violated) result.amount = violated.reason;
        }

        if (remarks.length > 50) result.remarks = "Keep remarks under 50 characters";
        return { ...result, ...serverErrors };
    }, [from, tab, toAccount, payee, upiId, upiResult, amount, mode, limits, caps, remarks, serverErrors]);

    const showError = (field: string) => (submitted || field in serverErrors || (field === "amount" && amount.trim() !== "") ? errors[field] : undefined);

    const verifyUpi = async () => {
        const value = upiId.trim();
        if (!UPI_PATTERN.test(value)) {
            setUpiError("Enter a valid UPI ID, like name@bnb");
            return;
        }
        setIsVerifying(true);
        setUpiError(undefined);
        setUpiResult(null);
        try {
            setUpiResult(await api.transfers.lookupUpi(value));
        } catch (err) {
            setUpiError(err instanceof ApiError && err.status === 404 ? "No account is linked to this UPI ID" : errorMessage(err));
        } finally {
            setIsVerifying(false);
        }
    };

    const goToReview = () => {
        setSubmitted(true);
        if (Object.keys(errors).length > 0) return;
        setStep("review");
    };

    const recipient = () => {
        if (tab === "own" && toAccount) return { name: `${toAccount.holderName} (own account)`, detail: `${accountLabel(toAccount)} · ${toAccount.ifscCode}` };
        if (tab === "payee" && payee) return { name: payee.nickname ? `${payee.name} (${payee.nickname})` : payee.name, detail: `${payee.bankName} · ${maskAccount(payee.accountNumber)} · ${payee.ifscCode}` };
        if (tab === "upi" && upiResult) return { name: upiResult.name, detail: `${upiResult.upiId} · ${upiResult.bankName}` };
        return { name: "—", detail: "" };
    };

    const submitTransfer = async (pin: string) => {
        if (!from || !mode) return;
        try {
            const result = await api.transfers.create({
                fromAccountId: from.id,
                mode,
                toAccountId: tab === "own" ? toAccount?.id : undefined,
                beneficiaryId: tab === "payee" ? payee?.id : undefined,
                upiId: tab === "upi" ? upiId.trim() : undefined,
                amount: Number(amount),
                remarks: remarks.trim() || undefined,
                pin,
            });
            setReceipt(result);
            setIsPinOpen(false);
            setStep("done");
            refreshUnread();
            toast.success(result.status === "PENDING" ? "Transfer initiated" : "Transfer successful", `${formatINR(result.amount)} to ${result.toName}`);
            reload();
        } catch (err) {
            // Validation problems with the form itself go back to the form; PIN errors stay in the modal.
            if (err instanceof ApiError && err.fieldErrors && Object.keys(err.fieldErrors).some((key) => key !== "pin")) {
                setServerErrors(err.fieldErrors);
                setIsPinOpen(false);
                setStep("form");
                toast.error("Transfer not completed", err.message);
                return;
            }
            throw err;
        }
    };

    const startAnother = () => {
        setStep("form");
        setReceipt(null);
        setAmount("");
        setRemarks("");
        setUpiId("");
        setUpiResult(null);
        setSubmitted(false);
        setServerErrors({});
    };

    const header = <PageHeader title="Transfer money" description="Send money to your own accounts, saved payees or any UPI ID." />;

    if (isLoading && !data) {
        return (
            <>
                {header}
                <LoadingState label="Loading your accounts…" />
            </>
        );
    }
    if (error && !data) {
        return (
            <>
                {header}
                <ErrorState message={error.message} onRetry={reload} />
            </>
        );
    }
    if (!data) return null;

    if (activeAccounts.length === 0) {
        return (
            <>
                {header}
                <SectionCard>
                    <EmptyPanel icon={Wallet02} title="No active account to pay from" description="You need an active savings, salary or current account to make transfers." action={<Button href="/accounts">View accounts</Button>} />
                </SectionCard>
            </>
        );
    }

    const hasPin = Boolean(user?.hasTransactionPin);
    const to = recipient();

    return (
        <>
            {header}

            {!hasPin && step !== "done" && <PinSetupBanner />}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    {step === "done" && receipt ? (
                        <ReceiptView receipt={receipt} onNew={startAnother} />
                    ) : step === "review" && from && mode ? (
                        <SectionCard title="Review transfer" description="Check the details carefully. Transfers can't be reversed once processed.">
                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col items-center gap-1 rounded-xl bg-secondary px-4 py-6 text-center">
                                    <span className="text-sm text-tertiary">You're sending</span>
                                    <span className="text-display-sm font-semibold text-primary tabular-nums">{formatINR(Number(amount))}</span>
                                    <span className="text-sm text-tertiary">to {to.name}</span>
                                </div>
                                <dl className="divide-y divide-secondary">
                                    <DetailRow label="From" value={`${accountLabel(from)} · Balance ${formatINR(from.balance)}`} />
                                    <DetailRow
                                        label="To"
                                        value={
                                            <span className="flex flex-col">
                                                <span className="font-semibold text-primary">{to.name}</span>
                                                <span className="text-tertiary">{to.detail}</span>
                                            </span>
                                        }
                                    />
                                    <DetailRow label="Mode" value={`${modeName[mode]} · ${settlementCopy[mode]}`} />
                                    <DetailRow label="Charges" value="Nil" />
                                    {remarks.trim() && <DetailRow label="Remarks" value={remarks.trim()} />}
                                    <DetailRow label="Balance after transfer" value={formatINR(from.balance - Number(amount))} />
                                    <DetailRow label="Total debit" value={formatINR(Number(amount))} emphasis />
                                </dl>
                                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                    <Button color="secondary" size="lg" iconLeading={ArrowLeft} onClick={() => setStep("form")}>
                                        Edit details
                                    </Button>
                                    <Button size="lg" iconLeading={Lock01} onClick={() => setIsPinOpen(true)} isDisabled={!hasPin}>
                                        Confirm & pay
                                    </Button>
                                </div>
                            </div>
                        </SectionCard>
                    ) : (
                        <SectionCard>
                            <div className="flex flex-col gap-6">
                                <Tabs
                                    selectedKey={tab}
                                    onSelectionChange={(key) => {
                                        setTab(key as TabKey);
                                        setSubmitted(false);
                                        setServerErrors({});
                                    }}
                                >
                                    <Tabs.List type="button-border" size="sm" fullWidth aria-label="Transfer type">
                                        <Tabs.Item id="own" icon={SwitchHorizontal01}>
                                            Own account
                                        </Tabs.Item>
                                        <Tabs.Item id="payee" icon={Users01}>
                                            Payee
                                        </Tabs.Item>
                                        <Tabs.Item id="upi" icon={Zap}>
                                            UPI ID
                                        </Tabs.Item>
                                    </Tabs.List>
                                </Tabs>

                                <Select
                                    label="Pay from"
                                    placeholder="Select account"
                                    selectedKey={fromId}
                                    onSelectionChange={(key) => {
                                        setFromId(key == null ? null : String(key));
                                        clearServer("fromAccountId");
                                    }}
                                    items={activeAccounts.map((account) => ({ id: String(account.id), label: accountLabel(account), supportingText: formatINR(account.balance) }))}
                                    isInvalid={Boolean(showError("fromAccountId"))}
                                    hint={showError("fromAccountId") ?? (from ? `Available balance ${formatINR(from.balance)}` : undefined)}
                                >
                                    {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                                </Select>

                                {tab === "own" && (
                                    <OwnAccountPicker
                                        accounts={activeAccounts.filter((account) => String(account.id) !== fromId)}
                                        selectedKey={toId}
                                        onChange={(key) => {
                                            setToId(key);
                                            clearServer("toAccountId");
                                        }}
                                        error={showError("toAccountId")}
                                    />
                                )}

                                {tab === "payee" && (
                                    <PayeePicker
                                        payees={data.payees}
                                        selectedKey={payeeId}
                                        onChange={(key) => {
                                            setPayeeId(key);
                                            clearServer("beneficiaryId");
                                        }}
                                        error={showError("beneficiaryId")}
                                        payee={payee}
                                        limits={data.limits}
                                        externalMode={externalMode}
                                        onModeChange={setExternalMode}
                                    />
                                )}

                                {tab === "upi" && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                            <Input
                                                className="flex-1"
                                                label="UPI ID"
                                                placeholder="name@bnb"
                                                value={upiId}
                                                onChange={(value) => {
                                                    setUpiId(value.trim());
                                                    setUpiResult(null);
                                                    setUpiError(undefined);
                                                    clearServer("upiId");
                                                }}
                                                autoComplete="off"
                                                isInvalid={Boolean(upiError || showError("upiId"))}
                                                hint={upiError ?? showError("upiId") ?? "The registered name is shown after verification."}
                                            />
                                            <Button color="secondary" size="md" className="sm:mt-6.5" iconLeading={CheckVerified01} onClick={verifyUpi} isLoading={isVerifying} showTextWhileLoading isDisabled={!upiId}>
                                                Verify
                                            </Button>
                                        </div>
                                        {upiResult && (
                                            <div className="flex items-center gap-3 rounded-lg bg-success-primary p-3 ring-1 ring-secondary">
                                                <CheckCircle className="size-5 shrink-0 text-fg-success-primary" />
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate text-sm font-semibold text-primary">{upiResult.name}</span>
                                                    <span className="truncate text-xs text-tertiary">
                                                        {upiResult.upiId} · {upiResult.bankName}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <Input
                                    label="Amount"
                                    placeholder="0.00"
                                    icon={CurrencyRupee}
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(value) => {
                                        setAmount(value.replace(/[^\d.]/g, ""));
                                        clearServer("amount");
                                    }}
                                    inputClassName="tabular-nums"
                                    isInvalid={Boolean(showError("amount"))}
                                    hint={
                                        showError("amount") ??
                                        (maxAllowed !== undefined ? `You can send up to ${formatINR(maxAllowed)}${mode === "RTGS" && limits ? ` (minimum ${formatINR(limits.rtgsMin)})` : ""}` : undefined)
                                    }
                                />

                                <Input
                                    label="Remarks (optional)"
                                    placeholder="e.g. Rent for October"
                                    value={remarks}
                                    maxLength={50}
                                    onChange={(value) => {
                                        setRemarks(value);
                                        clearServer("remarks");
                                    }}
                                    isInvalid={Boolean(showError("remarks"))}
                                    hint={showError("remarks") ?? `${remarks.length}/50 characters`}
                                />

                                <div className="flex flex-col gap-3 border-t border-secondary pt-5 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs text-tertiary">You'll review the details and confirm with your transaction PIN.</p>
                                    <Button size="lg" iconTrailing={ArrowRight} onClick={goToReview} isDisabled={!hasPin}>
                                        Review transfer
                                    </Button>
                                </div>
                            </div>
                        </SectionCard>
                    )}
                </div>

                <aside className="flex min-w-0 flex-col gap-6">
                    <SectionCard title="Today's limits" description="Resets at midnight">
                        <div className="flex flex-col gap-5">
                            <UsageBar label="Daily transfer limit" used={data.limits.usedToday} limit={data.limits.dailyLimit} />
                            <UsageBar label="UPI daily limit" used={data.limits.upiUsedToday} limit={data.limits.upiDailyLimit} />
                        </div>
                    </SectionCard>
                    <ModeRules limits={data.limits} />
                </aside>
            </div>

            <PinModal
                isOpen={isPinOpen}
                onClose={() => setIsPinOpen(false)}
                onConfirm={submitTransfer}
                title="Authorise transfer"
                confirmLabel={`Pay ${formatINR(Number(amount) || 0)}`}
                summary={
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold text-primary tabular-nums">{formatINR(Number(amount) || 0)}</span>
                        <span>
                            to {to.name} via {mode ? modeName[mode] : "—"}
                        </span>
                    </div>
                }
            />
        </>
    );
};

// ---------------------------------------------------------------------------
// Destination pickers
// ---------------------------------------------------------------------------

const OwnAccountPicker = ({ accounts, selectedKey, onChange, error }: { accounts: Account[]; selectedKey: string | null; onChange: (key: string | null) => void; error?: string }) => {
    if (accounts.length === 0) {
        return (
            <Notice>
                You have only one active account. Open another account to move money between your own accounts, or pay a saved payee instead.
            </Notice>
        );
    }
    return (
        <Select
            label="Credit to"
            placeholder="Select your account"
            selectedKey={accounts.some((account) => String(account.id) === selectedKey) ? selectedKey : null}
            onSelectionChange={(key) => onChange(key == null ? null : String(key))}
            items={accounts.map((account) => ({ id: String(account.id), label: accountLabel(account), supportingText: formatINR(account.balance) }))}
            isInvalid={Boolean(error)}
            hint={error ?? "Transfers between your own accounts are instant and free."}
        >
            {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
        </Select>
    );
};

interface PayeePickerProps {
    payees: Beneficiary[];
    selectedKey: string | null;
    onChange: (key: string | null) => void;
    error?: string;
    payee?: Beneficiary;
    limits: TransferLimits;
    externalMode: ExternalMode;
    onModeChange: (mode: ExternalMode) => void;
}

const PayeePicker = ({ payees, selectedKey, onChange, error, payee, limits, externalMode, onModeChange }: PayeePickerProps) => {
    if (payees.length === 0) {
        return (
            <div className="rounded-xl ring-1 ring-secondary">
                <EmptyPanel icon={Users01} title="No payees yet" description="Add a payee with their account number and IFSC to send money to them." action={<Button href="/beneficiaries">Add a payee</Button>} />
            </div>
        );
    }

    const modeOptions: { id: ExternalMode; title: string; description: string }[] = [
        { id: "IMPS", title: "IMPS", description: `Instant, 24x7 · up to ${formatINRShort(limits.impsMax)}` },
        { id: "NEFT", title: "NEFT", description: "No minimum · settles in batches" },
        { id: "RTGS", title: "RTGS", description: `High value · min ${formatINRShort(limits.rtgsMin)}` },
    ];

    return (
        <div className="flex flex-col gap-4">
            <Select
                label="Pay to"
                placeholder="Select a payee"
                selectedKey={selectedKey}
                onSelectionChange={(key) => onChange(key == null ? null : String(key))}
                items={payees.map((item) => ({
                    id: String(item.id),
                    label: item.nickname ? `${item.name} (${item.nickname})` : item.name,
                    supportingText: `${item.internal ? "BNB" : item.bankName} · ${maskAccount(item.accountNumber)}`,
                }))}
                isInvalid={Boolean(error)}
                hint={error}
            >
                {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
            </Select>

            {payee && (
                <div className="flex flex-col gap-3 rounded-xl bg-secondary p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Building07 className="size-4 text-fg-quaternary" />
                        <span className="text-sm font-medium text-secondary">{payee.bankName}</span>
                        <Badge size="sm" type="pill-color" color={payee.internal ? "brand" : "gray"}>
                            {payee.internal ? "Bharat National Bank" : "Other bank"}
                        </Badge>
                        {isCooling(payee) && (
                            <BadgeWithIcon size="sm" type="pill-color" color="warning" iconLeading={Clock}>
                                Cooling period
                            </BadgeWithIcon>
                        )}
                    </div>
                    <p className="text-sm text-tertiary">
                        A/c {maskAccount(payee.accountNumber)} · IFSC {payee.ifscCode} · Your limit {formatINR(payee.transferLimit)} per transfer
                    </p>
                    {isCooling(payee) && (
                        <Notice icon={AlertTriangle} tone="warning">
                            Added in the last 24 hours — transfers are capped at {formatINR(limits.newPayeeLimit)} until {formatDateTime(payee.coolingPeriodEndsAt)}.
                        </Notice>
                    )}
                </div>
            )}

            {payee && payee.internal && (
                <Notice icon={Zap}>This payee banks with us, so the money moves instantly as an internal transfer — no IMPS/NEFT needed.</Notice>
            )}

            {payee && !payee.internal && (
                <AriaRadioGroup value={externalMode} onChange={(value) => onModeChange(value as ExternalMode)} className="flex flex-col gap-1.5" aria-label="Transfer mode">
                    <span className="text-sm font-medium text-secondary">Transfer mode</span>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {modeOptions.map((option) => (
                            <AriaRadio
                                key={option.id}
                                value={option.id}
                                className={({ isSelected, isFocusVisible }) =>
                                    cx(
                                        "flex cursor-pointer flex-col gap-0.5 rounded-xl bg-primary p-4 ring-1 ring-secondary transition duration-100 ease-linear ring-inset hover:bg-primary_hover",
                                        isSelected && "bg-brand-primary_alt ring-2 ring-brand hover:bg-brand-primary_alt",
                                        isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                                    )
                                }
                            >
                                {({ isSelected }) => (
                                    <>
                                        <span className="flex items-center justify-between gap-2">
                                            <span className={cx("text-sm font-semibold", isSelected ? "text-brand-secondary" : "text-primary")}>{option.title}</span>
                                            <span className={cx("flex size-4 items-center justify-center rounded-full ring-1 ring-inset", isSelected ? "bg-brand-solid ring-brand-solid" : "ring-primary")}>
                                                {isSelected && <span className="size-1.5 rounded-full bg-fg-white" />}
                                            </span>
                                        </span>
                                        <span className="text-xs text-tertiary">{option.description}</span>
                                    </>
                                )}
                            </AriaRadio>
                        ))}
                    </div>
                </AriaRadioGroup>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Side panel + receipt
// ---------------------------------------------------------------------------

const ModeRules = ({ limits }: { limits: TransferLimits }) => {
    const rules = [
        { title: "Within bank", text: "Own accounts or payees at Bharat National Bank. Instant and free." },
        { title: "IMPS", text: `Instant, 24x7 including holidays. Up to ${formatINR(limits.impsMax)} per transaction.` },
        { title: "NEFT", text: "No minimum amount. Settled in half-hourly batches." },
        { title: "RTGS", text: `For high-value transfers of ${formatINR(limits.rtgsMin)} and above.` },
        { title: "UPI", text: `To any UPI ID. Up to ${formatINR(limits.upiMax)} per transaction and ${formatINR(limits.upiDailyLimit)} per day.` },
        { title: "New payees", text: `Capped at ${formatINR(limits.newPayeeLimit)} per transfer for 24 hours after being added.` },
    ];
    return (
        <SectionCard title="Transfer rules">
            <ul className="flex flex-col gap-4">
                {rules.map((rule) => (
                    <li key={rule.title} className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-primary">{rule.title}</span>
                        <span className="text-sm text-tertiary">{rule.text}</span>
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
};

const ReceiptView = ({ receipt, onNew }: { receipt: TransferReceipt; onNew: () => void }) => {
    const isPending = receipt.status === "PENDING";
    return (
        <SectionCard>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-3 text-center">
                    <FeaturedIcon icon={isPending ? Clock : CheckCircle} color={isPending ? "warning" : "success"} theme="light" size="xl" />
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-semibold text-primary">{isPending ? "Transfer initiated" : "Transfer successful"}</h2>
                        <p className="text-display-sm font-semibold text-primary tabular-nums">{formatINR(receipt.amount)}</p>
                        <p className="text-sm text-tertiary">{receipt.message}</p>
                    </div>
                </div>

                <dl className="divide-y divide-secondary rounded-xl px-4 ring-1 ring-secondary">
                    <DetailRow label="Reference ID" value={<span className="font-mono">{receipt.referenceId}</span>} emphasis />
                    <DetailRow label="Paid to" value={`${receipt.toName} · ${receipt.toAccount}`} />
                    <DetailRow label="From account" value={maskAccount(receipt.fromAccountNumber)} />
                    <DetailRow label="Mode" value={modeName[receipt.mode]} />
                    <DetailRow label="Date & time" value={formatDateTime(receipt.timestamp)} />
                    <DetailRow label="Status" value={<StatusBadge status={receipt.status} />} />
                    <DetailRow label="Available balance" value={formatINR(receipt.balanceAfter)} />
                </dl>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end print:hidden">
                    <Button color="secondary" size="lg" iconLeading={Printer} onClick={() => window.print()}>
                        Download / print receipt
                    </Button>
                    <Button size="lg" iconLeading={SwitchHorizontal01} onClick={onNew}>
                        Make another transfer
                    </Button>
                </div>
            </div>
        </SectionCard>
    );
};
