import type { ReactNode } from "react";
import { useState } from "react";
import { ArrowRight, Check, Copy01, Plus, Wallet02 } from "@untitledui/icons";
import { AppModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { errorMessage, useApi } from "@/hooks/use-api";
import { useClipboard } from "@/hooks/use-clipboard";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatINR, humanize } from "@/lib/format";
import type { Account, AccountType } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";

const ACCOUNT_TYPE_OPTIONS: { id: AccountType; label: string; supportingText: string }[] = [
    { id: "SAVINGS", label: "Savings", supportingText: "Interest-bearing" },
    { id: "CURRENT", label: "Current", supportingText: "For business" },
    { id: "SALARY", label: "Salary", supportingText: "Zero balance" },
];

/** Copy-to-clipboard icon button with a check mark after copying. */
export const CopyButton = ({ value, label }: { value: string; label: string }) => {
    const { copied, copy } = useClipboard();
    return (
        <ButtonUtility
            size="xs"
            color="tertiary"
            tooltip={copied ? "Copied" : `Copy ${label}`}
            icon={copied ? Check : Copy01}
            onClick={() => copy(value)}
        />
    );
};

export const DetailItem = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs font-medium text-tertiary">{label}</dt>
        <dd className="flex min-w-0 items-center gap-1 text-sm font-medium text-primary">{children}</dd>
    </div>
);

const AccountCard = ({ account }: { account: Account }) => (
    <article className="flex flex-col overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
        <div className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-secondary text-fg-brand-primary">
                        <Wallet02 className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                        <h2 className="truncate text-md font-semibold text-primary">{humanize(account.accountType)} account</h2>
                        <span className="truncate text-sm text-tertiary">{account.holderName}</span>
                    </div>
                </div>
                <StatusBadge status={account.status} />
            </div>

            <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-tertiary">Available balance</span>
                <span className="text-display-xs font-semibold text-primary tabular-nums">{formatINR(account.balance)}</span>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-secondary pt-4 sm:grid-cols-2">
                <DetailItem label="Account number">
                    <span className="truncate tabular-nums">{account.accountNumber}</span>
                    <CopyButton value={account.accountNumber} label="account number" />
                </DetailItem>
                <DetailItem label="IFSC">
                    <span className="truncate">{account.ifscCode}</span>
                    <CopyButton value={account.ifscCode} label="IFSC" />
                </DetailItem>
                <DetailItem label="Branch">
                    <span className="truncate">{account.branchName}</span>
                </DetailItem>
                <DetailItem label="UPI ID">
                    {account.upiId ? (
                        <>
                            <span className="truncate">{account.upiId}</span>
                            <CopyButton value={account.upiId} label="UPI ID" />
                        </>
                    ) : (
                        <span className="text-tertiary">Not linked</span>
                    )}
                </DetailItem>
                <DetailItem label="Interest rate">
                    <span className="tabular-nums">{account.interestRate.toFixed(2)}% p.a.</span>
                </DetailItem>
                <DetailItem label="Nominee">
                    <span className={account.nomineeName ? "truncate" : "text-tertiary"}>{account.nomineeName ?? "Not registered"}</span>
                </DetailItem>
            </dl>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-secondary bg-secondary_alt px-5 py-3 md:px-6">
            <span className="text-xs text-tertiary">Opened {formatDate(account.openedAt)}</span>
            <Button href={`/accounts/${account.id}`} color="link-color" size="sm" iconTrailing={ArrowRight}>
                View statement
            </Button>
        </div>
    </article>
);

interface OpenAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpened: (account: Account) => void;
}

const OpenAccountModal = ({ isOpen, onClose, onOpened }: OpenAccountModalProps) => {
    const toast = useToast();
    const [accountType, setAccountType] = useState<AccountType>("SAVINGS");
    const [nomineeName, setNomineeName] = useState("");
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});
    const [formError, setFormError] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const close = () => {
        setAccountType("SAVINGS");
        setNomineeName("");
        setErrors({});
        setFormError(undefined);
        onClose();
    };

    const submit = async () => {
        const nominee = nomineeName.trim();
        if (nominee && !/^[A-Za-z .'-]{3,}$/.test(nominee)) {
            setErrors({ nomineeName: "Enter the nominee's full name (letters only)." });
            return;
        }
        setIsSubmitting(true);
        setFormError(undefined);
        try {
            const account = await api.accounts.open({ accountType, nomineeName: nominee || undefined });
            toast.success("Account opened", `Your ${humanize(account.accountType).toLowerCase()} account ${account.accountNumber} is ready to use.`);
            onOpened(account);
            close();
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
            setFormError(errorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppModal
            isOpen={isOpen}
            onClose={close}
            title="Open a new account"
            description="Your new account is opened instantly using your existing KYC. No paperwork needed."
            icon={Plus}
            footer={
                <>
                    <Button color="secondary" size="lg" onClick={close} isDisabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button size="lg" onClick={submit} isLoading={isSubmitting} showTextWhileLoading>
                        Open account
                    </Button>
                </>
            }
        >
            <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                {formError && <p className="rounded-lg bg-error-primary p-3 text-sm text-error-primary">{formError}</p>}
                <Select
                    label="Account type"
                    items={ACCOUNT_TYPE_OPTIONS}
                    selectedKey={accountType}
                    onSelectionChange={(key) => key && setAccountType(key as AccountType)}
                    hint={errors.accountType}
                    isInvalid={Boolean(errors.accountType)}
                >
                    {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                </Select>
                <Input
                    label="Nominee name"
                    placeholder="Optional"
                    value={nomineeName}
                    onChange={(value) => {
                        setNomineeName(value);
                        setErrors({});
                    }}
                    isInvalid={Boolean(errors.nomineeName)}
                    hint={errors.nomineeName ?? "Registering a nominee makes claim settlement simpler for your family."}
                />
            </form>
        </AppModal>
    );
};

export const AccountsPage = () => {
    const { data, error, isLoading, reload, setData } = useApi(() => api.accounts.list(), []);
    const [isOpenModal, setIsOpenModal] = useState(false);

    const total = data?.reduce((sum, account) => sum + account.balance, 0) ?? 0;

    return (
        <>
            <PageHeader
                title="Accounts"
                description={data && data.length > 0 ? `Total balance ${formatINR(total)} across ${data.length} ${data.length === 1 ? "account" : "accounts"}.` : "Your savings, current and salary accounts."}
                actions={
                    <Button size="md" iconLeading={Plus} onClick={() => setIsOpenModal(true)}>
                        Open new account
                    </Button>
                }
            />

            {!data ? (
                error ? (
                    <ErrorState message={error.message} onRetry={reload} />
                ) : isLoading ? (
                    <LoadingState label="Loading accounts…" />
                ) : null
            ) : data.length === 0 ? (
                <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                    <EmptyPanel
                        icon={Wallet02}
                        title="No accounts yet"
                        description="Open your first account in seconds using your existing KYC."
                        action={
                            <Button size="md" iconLeading={Plus} onClick={() => setIsOpenModal(true)}>
                                Open new account
                            </Button>
                        }
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {data.map((account) => (
                        <AccountCard key={account.id} account={account} />
                    ))}
                </div>
            )}

            <OpenAccountModal isOpen={isOpenModal} onClose={() => setIsOpenModal(false)} onOpened={(account) => setData([...(data ?? []), account])} />
        </>
    );
};
