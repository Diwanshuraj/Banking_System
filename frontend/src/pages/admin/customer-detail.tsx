import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Bank, Building07, LockUnlocked01, SwitchHorizontal01, UserCheck01, UserX01 } from "@untitledui/icons";
import { useParams } from "react-router";
import { ConfirmModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TransactionList } from "@/components/app/transaction-list";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { errorMessage, useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatINR, humanize, initials } from "@/lib/format";
import type { Account, AdminUserDetail, UserStatus } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";
import { CashModal, FreezeModal, freezeIcon } from "./cash-modal";

const statusAction: Record<UserStatus, { to: UserStatus; label: string; icon: typeof UserX01; destructive: boolean; title: string; body: string } | null> = {
    ACTIVE: {
        to: "SUSPENDED",
        label: "Suspend",
        icon: UserX01,
        destructive: true,
        title: "Suspend this customer?",
        body: "They will be signed out and blocked from internet banking until reactivated. Their accounts and balances are not affected.",
    },
    SUSPENDED: {
        to: "ACTIVE",
        label: "Reactivate",
        icon: UserCheck01,
        destructive: false,
        title: "Reactivate this customer?",
        body: "They will be able to sign in to internet banking again.",
    },
    LOCKED: {
        to: "ACTIVE",
        label: "Unlock",
        icon: LockUnlocked01,
        destructive: false,
        title: "Unlock this customer?",
        body: "The account was locked after repeated failed sign-in attempts. Confirm the customer's identity before unlocking.",
    },
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-1">
        <dt className="text-sm text-tertiary">{label}</dt>
        <dd className="text-sm font-medium break-words text-primary">{children || "—"}</dd>
    </div>
);

const ProfileCard = ({ user, onStatus }: { user: AdminUserDetail; onStatus: () => void }) => {
    const action = statusAction[user.status];
    const secondary = user.status === "LOCKED" ? statusAction.ACTIVE : null;

    return (
        <SectionCard>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                        <Avatar size="xl" initials={initials(user.fullName)} alt={user.fullName} />
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="truncate text-lg font-semibold text-primary">{user.fullName}</h2>
                                <StatusBadge status={user.status} />
                                {user.role === "ROLE_ADMIN" && (
                                    <Badge color="brand" size="sm" type="pill-color">
                                        Staff
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-tertiary">
                                CIF <span className="tabular-nums">{user.customerId}</span> · {user.email}
                            </p>
                        </div>
                    </div>
                    {action && (
                        <div className="flex shrink-0 flex-wrap gap-3">
                            {secondary && <SuspendFromLocked user={user} onDone={onStatus} />}
                            <StatusActionButton user={user} onDone={onStatus} />
                        </div>
                    )}
                </div>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-secondary pt-5 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Mobile">{user.phone}</Field>
                    <Field label="Email">{user.email}</Field>
                    <Field label="PAN">{user.panNumber}</Field>
                    <Field label="Aadhaar">{user.aadhaarMasked}</Field>
                    <Field label="Date of birth">{user.dateOfBirth ? formatDate(user.dateOfBirth) : null}</Field>
                    <Field label="Transaction PIN">{user.hasTransactionPin ? "Set" : "Not set"}</Field>
                    <Field label="Last login">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}</Field>
                    <Field label="Customer since">{formatDate(user.createdAt)}</Field>
                    <div className="sm:col-span-2 lg:col-span-4">
                        <Field label="Address">{user.address}</Field>
                    </div>
                </dl>
            </div>
        </SectionCard>
    );
};

/** Main status transition for the user's current status. */
const StatusActionButton = ({ user, onDone }: { user: AdminUserDetail; onDone: () => void }) => {
    const action = statusAction[user.status]!;
    return <StatusChange user={user} to={action.to} config={action} primary onDone={onDone} />;
};

/** A locked user can also be suspended outright. */
const SuspendFromLocked = ({ user, onDone }: { user: AdminUserDetail; onDone: () => void }) => (
    <StatusChange user={user} to="SUSPENDED" config={statusAction.ACTIVE!} onDone={onDone} />
);

const StatusChange = ({
    user,
    to,
    config,
    primary,
    onDone,
}: {
    user: AdminUserDetail;
    to: UserStatus;
    config: NonNullable<(typeof statusAction)[UserStatus]>;
    primary?: boolean;
    onDone: () => void;
}) => {
    const toast = useToast();
    const [isOpen, setIsOpen] = useState(false);

    const confirm = async () => {
        try {
            await api.admin.setUserStatus(user.id, to);
            toast.success(`${config.label === "Suspend" ? "Customer suspended" : config.label === "Unlock" ? "Customer unlocked" : "Customer reactivated"}`, `${user.fullName} is now ${humanize(to).toLowerCase()}.`);
            setIsOpen(false);
            onDone();
        } catch (err) {
            toast.error(`Couldn't ${config.label.toLowerCase()} customer`, errorMessage(err));
        }
    };

    return (
        <>
            <Button
                size="md"
                color={config.destructive ? (primary ? "primary-destructive" : "secondary-destructive") : primary ? "primary" : "secondary"}
                iconLeading={config.icon}
                onClick={() => setIsOpen(true)}
            >
                {config.label}
            </Button>
            <ConfirmModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onConfirm={confirm}
                title={config.title}
                description={config.body}
                confirmLabel={config.label}
                destructive={config.destructive}
            />
        </>
    );
};

const AccountsCard = ({ accounts, onCash, onFreeze }: { accounts: Account[]; onCash: (a: Account) => void; onFreeze: (a: Account) => void }) => (
    <SectionCard title="Accounts" description={`${accounts.length} account${accounts.length === 1 ? "" : "s"} held`} flush>
        {!accounts.length ? (
            <EmptyPanel icon={Building07} title="No accounts" description="This customer doesn't hold any accounts yet." />
        ) : (
            <ul className="divide-y divide-secondary">
                {accounts.map((account) => {
                    const FreezeIcon = freezeIcon(account);
                    const closed = account.status === "CLOSED";
                    return (
                        <li key={account.id} className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:px-6">
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-primary tabular-nums">{account.accountNumber}</span>
                                    <Badge color="gray" size="sm" type="modern">
                                        {humanize(account.accountType)}
                                    </Badge>
                                    <StatusBadge status={account.status} />
                                </div>
                                <span className="text-sm text-tertiary">
                                    {account.ifscCode} · {account.branchName} · Opened {formatDate(account.openedAt)}
                                </span>
                            </div>
                            <div className="flex flex-col md:items-end">
                                <span className="text-xs text-tertiary">Balance</span>
                                <span className="text-lg font-semibold text-primary tabular-nums">{formatINR(account.balance)}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 md:ml-4">
                                <Button size="sm" color="secondary" iconLeading={Bank} onClick={() => onCash(account)} isDisabled={closed}>
                                    Cash
                                </Button>
                                <Button
                                    size="sm"
                                    color={account.status === "FROZEN" ? "secondary" : "secondary-destructive"}
                                    iconLeading={FreezeIcon}
                                    onClick={() => onFreeze(account)}
                                    isDisabled={closed}
                                >
                                    {account.status === "FROZEN" ? "Unfreeze" : "Freeze"}
                                </Button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        )}
    </SectionCard>
);

const RecentTransactions = ({ accounts, refreshKey }: { accounts: Account[]; refreshKey: number }) => {
    const [accountId, setAccountId] = useState<number | undefined>(accounts[0]?.id);

    useEffect(() => {
        if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts[0]?.id);
    }, [accounts, accountId]);

    const { data, error, isLoading, reload } = useApi(
        () => (accountId ? api.admin.transactions({ accountId, size: 10 }) : Promise.resolve(undefined)),
        [accountId, refreshKey],
    );

    return (
        <SectionCard
            title="Recent transactions"
            description="Last 10 postings on the selected account"
            flush
            actions={
                accounts.length > 1 ? (
                    <Select
                        aria-label="Account"
                        size="sm"
                        className="w-full sm:w-64"
                        items={accounts.map((a) => ({ id: a.id, label: a.accountNumber, supportingText: humanize(a.accountType) }))}
                        selectedKey={accountId ?? null}
                        onSelectionChange={(key) => key !== null && setAccountId(Number(key))}
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                    </Select>
                ) : undefined
            }
        >
            {!accounts.length ? (
                <EmptyPanel icon={SwitchHorizontal01} title="No transactions" description="Open an account to start transacting." />
            ) : isLoading && !data ? (
                <LoadingState />
            ) : error ? (
                <ErrorState message={errorMessage(error)} onRetry={reload} />
            ) : !data?.content.length ? (
                <EmptyPanel icon={SwitchHorizontal01} title="No transactions yet" description="Nothing has posted to this account." />
            ) : (
                <TransactionList transactions={data.content} showBalance ariaLabel="Customer transactions" />
            )}
        </SectionCard>
    );
};

export const AdminCustomerDetailPage = () => {
    const { id } = useParams();
    const userId = Number(id);
    const { data: user, error, isLoading, reload, setData } = useApi(() => api.admin.user(userId), [userId]);
    const [cashAccount, setCashAccount] = useState<Account | null>(null);
    const [freezeAccount, setFreezeAccount] = useState<Account | null>(null);
    const [txnRefresh, setTxnRefresh] = useState(0);

    const back = (
        <Button color="link-gray" size="md" iconLeading={ArrowLeft} href="/admin/customers">
            Back to customers
        </Button>
    );

    if (!Number.isFinite(userId)) {
        return (
            <>
                <PageHeader title="Customer" actions={back} />
                <EmptyPanel title="Customer not found" description="The link looks incorrect." />
            </>
        );
    }

    return (
        <>
            <PageHeader
                title={user?.fullName ?? "Customer"}
                description={user ? `CIF ${user.customerId} · ${user.accounts.length} account${user.accounts.length === 1 ? "" : "s"}` : "Customer profile"}
                actions={back}
            />

            {isLoading && !user ? (
                <LoadingState label="Loading customer…" />
            ) : error || !user ? (
                <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                    <ErrorState message={error?.status === 404 ? "This customer doesn't exist." : errorMessage(error)} onRetry={reload} />
                </div>
            ) : (
                <>
                    <ProfileCard user={user} onStatus={reload} />
                    <AccountsCard accounts={user.accounts} onCash={setCashAccount} onFreeze={setFreezeAccount} />
                    <RecentTransactions accounts={user.accounts} refreshKey={txnRefresh} />

                    <CashModal
                        account={cashAccount}
                        onClose={() => setCashAccount(null)}
                        onDone={() => {
                            reload();
                            setTxnRefresh((n) => n + 1);
                        }}
                    />
                    <FreezeModal
                        account={freezeAccount}
                        onClose={() => setFreezeAccount(null)}
                        onDone={(updated) => setData({ ...user, accounts: user.accounts.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)) })}
                    />
                </>
            )}
        </>
    );
};
