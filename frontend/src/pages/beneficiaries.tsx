import { useMemo, useState } from "react";
import { Building07, Clock, CurrencyRupee, InfoCircle, Plus, SearchLg, Send01, Trash01, UserPlus01, Users01 } from "@untitledui/icons";
import { AppModal, ConfirmModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge, BadgeWithIcon } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { errorMessage, useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatDateTime, formatINR, initials, maskAccount } from "@/lib/format";
import type { Beneficiary } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const OWN_BANK_PREFIX = "BNBI";
const MAX_PAYEE_LIMIT = 1_000_000;
const DEFAULT_NEW_PAYEE_CAP = 25_000;

const isCooling = (payee: Beneficiary) => new Date(payee.coolingPeriodEndsAt).getTime() > Date.now();

export const BeneficiariesPage = () => {
    const toast = useToast();
    const { data, error, isLoading, reload, setData } = useApi(async () => {
        const [payees, limits] = await Promise.all([api.beneficiaries.list(), api.transfers.limits().catch(() => null)]);
        return { payees, newPayeeCap: limits?.newPayeeLimit ?? DEFAULT_NEW_PAYEE_CAP };
    }, []);

    const [query, setQuery] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [toDelete, setToDelete] = useState<Beneficiary | null>(null);

    const cap = data?.newPayeeCap ?? DEFAULT_NEW_PAYEE_CAP;

    const filtered = useMemo(() => {
        const payees = data?.payees ?? [];
        const q = query.trim().toLowerCase();
        if (!q) return payees;
        return payees.filter((payee) =>
            [payee.name, payee.nickname ?? "", payee.bankName, payee.ifscCode, payee.accountNumber].some((field) => field.toLowerCase().includes(q)),
        );
    }, [data, query]);

    const remove = async () => {
        if (!toDelete || !data) return;
        try {
            await api.beneficiaries.remove(toDelete.id);
            setData({ ...data, payees: data.payees.filter((payee) => payee.id !== toDelete.id) });
            toast.success("Payee removed", `${toDelete.name} can no longer receive transfers until added again.`);
            setToDelete(null);
        } catch (err) {
            toast.error("Couldn't remove payee", errorMessage(err));
        }
    };

    return (
        <>
            <PageHeader
                title="Payees"
                description="Manage the people and businesses you send money to."
                actions={
                    <Button iconLeading={Plus} onClick={() => setIsAddOpen(true)}>
                        Add payee
                    </Button>
                }
            />

            <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
                <InfoCircle className="mt-0.5 size-5 shrink-0 text-fg-quaternary" />
                <p className="text-sm text-tertiary">
                    <span className="font-semibold text-secondary">24-hour cooling period: </span>
                    for your safety, a newly added payee can receive at most {formatINR(cap)} per transfer during the first 24 hours. After that, your own
                    per-payee limit applies.
                </p>
            </div>

            {isLoading && !data ? (
                <LoadingState label="Loading payees…" />
            ) : error && !data ? (
                <ErrorState message={error.message} onRetry={reload} />
            ) : data && data.payees.length === 0 ? (
                <SectionCard>
                    <EmptyPanel
                        icon={Users01}
                        title="No payees yet"
                        description="Add a payee with their account number and IFSC to start sending money."
                        action={
                            <Button iconLeading={Plus} onClick={() => setIsAddOpen(true)}>
                                Add payee
                            </Button>
                        }
                    />
                </SectionCard>
            ) : data ? (
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-tertiary">
                            {data.payees.length} saved {data.payees.length === 1 ? "payee" : "payees"}
                        </p>
                        <Input className="sm:max-w-xs" icon={SearchLg} placeholder="Search name, bank or IFSC" value={query} onChange={setQuery} aria-label="Search payees" />
                    </div>

                    {filtered.length === 0 ? (
                        <SectionCard>
                            <EmptyPanel title="No matching payees" description={`Nothing matches “${query}”. Try a different name, bank or IFSC.`} />
                        </SectionCard>
                    ) : (
                        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {filtered.map((payee) => (
                                <PayeeCard key={payee.id} payee={payee} cap={cap} onDelete={() => setToDelete(payee)} />
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}

            <AddPayeeModal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                cap={cap}
                onCreated={(payee) => {
                    if (data) setData({ ...data, payees: [payee, ...data.payees] });
                    else reload();
                    setIsAddOpen(false);
                    toast.success("Payee added", `You can send up to ${formatINR(cap)} per transfer to ${payee.name} for the next 24 hours.`);
                }}
            />

            <ConfirmModal
                isOpen={toDelete !== null}
                onClose={() => setToDelete(null)}
                onConfirm={remove}
                destructive
                title="Remove payee?"
                confirmLabel="Remove payee"
                description={
                    toDelete ? (
                        <>
                            <span className="font-medium text-secondary">{toDelete.name}</span> ({toDelete.bankName}, {maskAccount(toDelete.accountNumber)}) will be
                            removed. If you add them again, the 24-hour cooling period will apply afresh.
                        </>
                    ) : null
                }
            />
        </>
    );
};

const PayeeCard = ({ payee, cap, onDelete }: { payee: Beneficiary; cap: number; onDelete: () => void }) => {
    const cooling = isCooling(payee);
    return (
        <li className="flex flex-col rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
            <div className="flex items-start gap-3 p-4 md:p-5">
                <Avatar size="md" initials={initials(payee.name)} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-md font-semibold text-primary">{payee.name}</span>
                    {payee.nickname && <span className="truncate text-sm text-tertiary">“{payee.nickname}”</span>}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge size="sm" type="pill-color" color={payee.internal ? "brand" : "gray"}>
                            {payee.internal ? "Internal" : "Other bank"}
                        </Badge>
                        {cooling && (
                            <BadgeWithIcon size="sm" type="pill-color" color="warning" iconLeading={Clock}>
                                Cooling until {formatDateTime(payee.coolingPeriodEndsAt)}
                            </BadgeWithIcon>
                        )}
                    </div>
                </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-secondary px-4 py-4 text-sm md:px-5">
                <div className="col-span-2 flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-tertiary">Bank</dt>
                    <dd className="flex items-center gap-1.5 truncate font-medium text-secondary">
                        <Building07 className="size-4 shrink-0 text-fg-quaternary" />
                        <span className="truncate">{payee.bankName}</span>
                    </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-tertiary">Account</dt>
                    <dd className="font-medium text-secondary tabular-nums">{maskAccount(payee.accountNumber)}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-tertiary">IFSC</dt>
                    <dd className="font-medium text-secondary">{payee.ifscCode}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-tertiary">Transfer limit</dt>
                    <dd className="font-medium text-secondary tabular-nums">{formatINR(payee.transferLimit)}</dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-tertiary">{cooling ? "Allowed now" : "Added on"}</dt>
                    <dd className="font-medium text-secondary tabular-nums">{cooling ? formatINR(Math.min(cap, payee.transferLimit)) : formatDate(payee.createdAt)}</dd>
                </div>
            </dl>

            <div className="mt-auto flex items-center justify-between gap-3 border-t border-secondary px-4 py-3 md:px-5">
                <Button color="tertiary-destructive" size="sm" iconLeading={Trash01} onClick={onDelete}>
                    Remove
                </Button>
                <Button size="sm" iconLeading={Send01} href={`/transfer?payee=${payee.id}`}>
                    Pay
                </Button>
            </div>
        </li>
    );
};

interface PayeeForm {
    name: string;
    nickname: string;
    accountNumber: string;
    confirmAccountNumber: string;
    ifscCode: string;
    transferLimit: string;
}

const emptyForm: PayeeForm = { name: "", nickname: "", accountNumber: "", confirmAccountNumber: "", ifscCode: "", transferLimit: "100000" };

const validatePayee = (form: PayeeForm) => {
    const errors: Partial<Record<keyof PayeeForm, string>> = {};
    const name = form.name.trim();
    if (!name) errors.name = "Enter the payee's name as per bank records";
    else if (name.length < 2 || name.length > 100) errors.name = "Name must be 2–100 characters";
    else if (!/^[A-Za-z][A-Za-z .'&-]*$/.test(name)) errors.name = "Use letters, spaces and . ' & - only";

    if (form.nickname.trim().length > 30) errors.nickname = "Keep the nickname under 30 characters";

    if (!form.accountNumber) errors.accountNumber = "Enter the account number";
    else if (!/^\d{9,18}$/.test(form.accountNumber)) errors.accountNumber = "Account numbers are 9–18 digits";

    if (!form.confirmAccountNumber) errors.confirmAccountNumber = "Re-enter the account number";
    else if (form.confirmAccountNumber !== form.accountNumber) errors.confirmAccountNumber = "Account numbers don't match";

    if (!form.ifscCode) errors.ifscCode = "Enter the branch IFSC";
    else if (!IFSC_PATTERN.test(form.ifscCode)) errors.ifscCode = "IFSC is 11 characters: 4 letters, 0, then 6 letters or digits (e.g. HDFC0000128)";

    const limit = Number(form.transferLimit);
    if (!form.transferLimit) errors.transferLimit = "Set a per-transfer limit";
    else if (!/^\d+$/.test(form.transferLimit) || limit < 1) errors.transferLimit = "Enter a whole rupee amount";
    else if (limit > MAX_PAYEE_LIMIT) errors.transferLimit = `The maximum per-payee limit is ${formatINR(MAX_PAYEE_LIMIT)}`;

    return errors;
};

const AddPayeeModal = ({ isOpen, onClose, onCreated, cap }: { isOpen: boolean; onClose: () => void; onCreated: (payee: Beneficiary) => void; cap: number }) => {
    const [form, setForm] = useState<PayeeForm>(emptyForm);
    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string>();
    const [isSaving, setIsSaving] = useState(false);

    const errors = { ...(submitted ? validatePayee(form) : {}), ...serverErrors } as Record<string, string | undefined>;

    const update = (field: keyof PayeeForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setServerErrors((current) => {
            const next = { ...current };
            delete next[field];
            return next;
        });
    };

    const close = () => {
        setForm(emptyForm);
        setSubmitted(false);
        setServerErrors({});
        setFormError(undefined);
        onClose();
    };

    const submit = async () => {
        setSubmitted(true);
        setFormError(undefined);
        if (Object.keys(validatePayee(form)).length > 0) return;
        setIsSaving(true);
        try {
            const payee = await api.beneficiaries.create({
                name: form.name.trim(),
                nickname: form.nickname.trim() || undefined,
                accountNumber: form.accountNumber,
                ifscCode: form.ifscCode,
                transferLimit: Number(form.transferLimit),
            });
            setForm(emptyForm);
            setSubmitted(false);
            onCreated(payee);
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) setServerErrors(err.fieldErrors);
            setFormError(errorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    const ifscValid = IFSC_PATTERN.test(form.ifscCode);
    const ifscHint = ifscValid
        ? form.ifscCode.startsWith(OWN_BANK_PREFIX)
            ? "Bharat National Bank branch — transfers will be internal and instant."
            : "Other bank — you can pay via IMPS, NEFT or RTGS."
        : "4 letters + 0 + 6 characters. Printed on the payee's cheque book or passbook.";

    return (
        <AppModal
            isOpen={isOpen}
            onClose={close}
            title="Add a payee"
            icon={UserPlus01}
            widthClassName="sm:max-w-xl"
            description={`New payees can receive up to ${formatINR(cap)} per transfer for the first 24 hours.`}
            footer={
                <>
                    <Button color="secondary" size="lg" onClick={close} isDisabled={isSaving}>
                        Cancel
                    </Button>
                    <Button size="lg" onClick={submit} isLoading={isSaving} showTextWhileLoading>
                        Add payee
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
                {formError && <div className="rounded-lg bg-error-primary p-3 text-sm text-error-primary">{formError}</div>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="Payee name"
                        isRequired
                        placeholder="As per bank records"
                        value={form.name}
                        onChange={(value) => update("name", value)}
                        isInvalid={Boolean(errors.name)}
                        hint={errors.name}
                    />
                    <Input
                        label="Nickname"
                        placeholder="e.g. Landlord"
                        value={form.nickname}
                        onChange={(value) => update("nickname", value)}
                        isInvalid={Boolean(errors.nickname)}
                        hint={errors.nickname ?? "Optional"}
                    />
                    <Input
                        label="Account number"
                        isRequired
                        inputMode="numeric"
                        type="password"
                        autoComplete="off"
                        placeholder="9–18 digits"
                        value={form.accountNumber}
                        onChange={(value) => update("accountNumber", value.replace(/\D/g, "").slice(0, 18))}
                        isInvalid={Boolean(errors.accountNumber)}
                        hint={errors.accountNumber}
                    />
                    <Input
                        label="Confirm account number"
                        isRequired
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Re-enter account number"
                        value={form.confirmAccountNumber}
                        onChange={(value) => update("confirmAccountNumber", value.replace(/\D/g, "").slice(0, 18))}
                        isInvalid={Boolean(errors.confirmAccountNumber)}
                        hint={
                            errors.confirmAccountNumber ??
                            (form.confirmAccountNumber && form.confirmAccountNumber === form.accountNumber ? "Account numbers match" : undefined)
                        }
                    />
                    <Input
                        label="IFSC"
                        isRequired
                        placeholder="e.g. HDFC0000128"
                        value={form.ifscCode}
                        onChange={(value) => update("ifscCode", value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                        inputClassName="uppercase tracking-wide"
                        isInvalid={Boolean(errors.ifscCode)}
                        hint={errors.ifscCode ?? ifscHint}
                    />
                    <Input
                        label="Per-transfer limit"
                        isRequired
                        icon={CurrencyRupee}
                        inputMode="numeric"
                        value={form.transferLimit}
                        onChange={(value) => update("transferLimit", value.replace(/\D/g, ""))}
                        inputClassName="tabular-nums"
                        isInvalid={Boolean(errors.transferLimit)}
                        hint={errors.transferLimit ?? `Up to ${formatINR(MAX_PAYEE_LIMIT)}`}
                    />
                </div>
                <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
            </form>
        </AppModal>
    );
};
