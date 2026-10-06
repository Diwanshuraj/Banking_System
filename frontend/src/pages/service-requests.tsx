import type { FC } from "react";
import { useState } from "react";
import { AlertTriangle, BookOpen01, ChevronRight, CreditCardRefresh, FileCheck02, MarkerPin01, MessageChatSquare, SlashCircle01, UserPlus01, XCircle } from "@untitledui/icons";
import { Table } from "@/components/application/table/table";
import { AppModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { errorMessage, useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatDateTime, formatINR, humanize, maskAccount } from "@/lib/format";
import type { Account, ServiceRequest, ServiceRequestType } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

interface RequestTypeInfo {
    type: ServiceRequestType;
    title: string;
    description: string;
    icon: FC<{ className?: string }>;
    needsAccount: boolean;
    turnaround: string;
}

const REQUEST_TYPES: RequestTypeInfo[] = [
    { type: "CHEQUE_BOOK", title: "Cheque book", description: "Order a new 25 or 50 leaf cheque book to your registered address.", icon: BookOpen01, needsAccount: true, turnaround: "Delivered in 5–7 working days" },
    { type: "STOP_CHEQUE", title: "Stop cheque payment", description: "Stop payment on one or a range of issued cheques.", icon: SlashCircle01, needsAccount: true, turnaround: "Effective within 1 working hour" },
    { type: "DEBIT_CARD_REISSUE", title: "Debit card reissue", description: "Replace a damaged, lost or expiring debit card.", icon: CreditCardRefresh, needsAccount: true, turnaround: "Delivered in 7–10 working days" },
    { type: "ADDRESS_CHANGE", title: "Change address", description: "Update your communication address on bank records.", icon: MarkerPin01, needsAccount: false, turnaround: "Updated in 2 working days" },
    { type: "NOMINEE_UPDATE", title: "Nominee update", description: "Add or change the nominee on an account.", icon: UserPlus01, needsAccount: true, turnaround: "Updated in 2 working days" },
    { type: "KYC_UPDATE", title: "KYC update", description: "Re-submit or update your KYC documents.", icon: FileCheck02, needsAccount: false, turnaround: "Verified in 3 working days" },
    { type: "ACCOUNT_CLOSURE", title: "Close an account", description: "Request closure and transfer of the remaining balance.", icon: XCircle, needsAccount: true, turnaround: "Processed in 5 working days" },
];

const typeInfo = (type: ServiceRequestType) => REQUEST_TYPES.find((item) => item.type === type)!;

const accountLabel = (account: Account) => `${humanize(account.accountType)} · ${maskAccount(account.accountNumber)}`;

type FormState = Record<string, string>;

export const ServiceRequestsPage = () => {
    const toast = useToast();
    const { data, error, isLoading, reload, setData } = useApi(async () => {
        const [requests, accounts] = await Promise.all([api.serviceRequests.list(), api.accounts.list()]);
        return { requests, accounts };
    }, []);
    const [active, setActive] = useState<RequestTypeInfo | null>(null);

    return (
        <>
            <PageHeader title="Service requests" description="Raise requests for cheque books, card reissue, KYC and more — no branch visit needed." />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {REQUEST_TYPES.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.type}
                            type="button"
                            onClick={() => setActive(item)}
                            disabled={!data}
                            className={cx(
                                "group flex items-start gap-4 rounded-xl bg-primary p-4 text-left shadow-xs ring-1 ring-secondary transition duration-100 ease-linear ring-inset outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:p-5",
                            )}
                        >
                            <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", item.type === "ACCOUNT_CLOSURE" ? "bg-error-primary text-fg-error-primary" : "bg-brand-primary text-fg-brand-primary")}>
                                <Icon className="size-5" />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-primary">
                                    {item.title}
                                    <ChevronRight className="size-4 shrink-0 text-fg-quaternary transition group-hover:translate-x-0.5" />
                                </span>
                                <span className="text-sm text-tertiary">{item.description}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            <SectionCard title="My requests" description="Track the status of requests you've raised" flush>
                {isLoading && !data ? (
                    <LoadingState label="Loading requests…" />
                ) : error && !data ? (
                    <ErrorState message={error.message} onRetry={reload} />
                ) : !data || data.requests.length === 0 ? (
                    <EmptyPanel icon={MessageChatSquare} title="No requests yet" description="Choose a service above to raise your first request." />
                ) : (
                    <RequestList requests={data.requests} />
                )}
            </SectionCard>

            {active && data && (
                <RequestModal
                    key={active.type}
                    info={active}
                    accounts={data.accounts.filter((account) => account.status === "ACTIVE")}
                    onClose={() => setActive(null)}
                    onCreated={(request) => {
                        setData({ ...data, requests: [request, ...data.requests] });
                        setActive(null);
                        toast.success("Request raised", `Ticket ${request.ticketNumber} · ${active.turnaround}.`);
                    }}
                />
            )}
        </>
    );
};

const RequestList = ({ requests }: { requests: ServiceRequest[] }) => (
    <>
        <ul className="divide-y divide-secondary md:hidden">
            {requests.map((request) => (
                <li key={request.id} className="flex flex-col gap-2 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold text-primary">{typeInfo(request.type)?.title ?? humanize(request.type)}</span>
                            <span className="truncate font-mono text-xs text-tertiary">{request.ticketNumber}</span>
                        </div>
                        <StatusBadge status={request.status} />
                    </div>
                    <p className="text-xs text-tertiary">
                        {request.accountNumber ? `${maskAccount(request.accountNumber)} · ` : ""}Raised {formatDate(request.createdAt)} · Updated {formatDate(request.updatedAt)}
                    </p>
                    {request.remarks && <p className="rounded-lg bg-secondary p-2.5 text-xs text-secondary">Bank remarks: {request.remarks}</p>}
                </li>
            ))}
        </ul>
        <div className="max-md:hidden">
            <Table aria-label="My service requests" size="sm">
                <Table.Header>
                    <Table.Head id="ticket" label="Request" isRowHeader />
                    <Table.Head id="account" label="Account" />
                    <Table.Head id="details" label="Details" className="w-full" />
                    <Table.Head id="status" label="Status" />
                    <Table.Head id="raised" label="Raised" />
                    <Table.Head id="updated" label="Last update" />
                </Table.Header>
                <Table.Body items={requests}>
                    {(request) => (
                        <Table.Row id={request.id}>
                            <Table.Cell>
                                <div className="flex flex-col">
                                    <span className="font-medium whitespace-nowrap text-primary">{typeInfo(request.type)?.title ?? humanize(request.type)}</span>
                                    <span className="font-mono text-xs text-tertiary">{request.ticketNumber}</span>
                                </div>
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap">{request.accountNumber ? maskAccount(request.accountNumber) : "—"}</Table.Cell>
                            <Table.Cell>
                                <div className="flex max-w-md flex-col gap-1">
                                    <span className="line-clamp-2 text-secondary">{request.details}</span>
                                    {request.remarks && <span className="text-xs text-tertiary">Bank remarks: {request.remarks}</span>}
                                </div>
                            </Table.Cell>
                            <Table.Cell>
                                <StatusBadge status={request.status} />
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap">{formatDate(request.createdAt)}</Table.Cell>
                            <Table.Cell className="whitespace-nowrap">{formatDateTime(request.updatedAt)}</Table.Cell>
                        </Table.Row>
                    )}
                </Table.Body>
            </Table>
        </div>
    </>
);

// ---------------------------------------------------------------------------
// Request form
// ---------------------------------------------------------------------------

const CARD_REASONS = ["Damaged card", "Lost or stolen", "Card expiring soon", "Name change"];
const STOP_REASONS = ["Cheque lost", "Cheque stolen", "Payment dispute", "Issued in error"];
const RELATIONSHIPS = ["Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Other"];
const KYC_DOCS = ["Aadhaar card", "PAN card", "Passport", "Voter ID", "Driving licence"];
const CLOSURE_REASONS = ["Moving to another bank", "Relocating", "Too many accounts", "Unhappy with service", "Other"];

const options = (values: string[]) => values.map((value) => ({ id: value, label: value }));

const validate = (type: ServiceRequestType, form: FormState, needsAccount: boolean) => {
    const errors: Record<string, string> = {};
    const required = (field: string, message: string) => {
        if (!form[field]?.trim()) errors[field] = message;
    };
    if (needsAccount) required("accountId", "Choose an account");
    switch (type) {
        case "CHEQUE_BOOK":
            required("leaves", "Choose the number of leaves");
            break;
        case "STOP_CHEQUE":
            if (!/^\d{6}$/.test(form.fromCheque ?? "")) errors.fromCheque = "Cheque numbers are 6 digits";
            if (form.toCheque && !/^\d{6}$/.test(form.toCheque)) errors.toCheque = "Cheque numbers are 6 digits";
            else if (form.toCheque && Number(form.toCheque) < Number(form.fromCheque)) errors.toCheque = "Must be the same as or after the first cheque";
            else if (form.toCheque && Number(form.toCheque) - Number(form.fromCheque) >= 50) errors.toCheque = "You can stop up to 50 cheques in one request";
            required("reason", "Choose a reason");
            break;
        case "DEBIT_CARD_REISSUE":
            required("reason", "Choose a reason");
            break;
        case "ADDRESS_CHANGE":
            if ((form.address ?? "").trim().length < 15) errors.address = "Enter your complete address with PIN code";
            else if (!/\b\d{6}\b/.test(form.address ?? "")) errors.address = "Include the 6-digit PIN code";
            break;
        case "NOMINEE_UPDATE":
            if (!/^[A-Za-z][A-Za-z .']{1,59}$/.test((form.nominee ?? "").trim())) errors.nominee = "Enter the nominee's full name";
            required("relationship", "Choose the relationship");
            break;
        case "KYC_UPDATE":
            required("document", "Choose the document you're submitting");
            if (!(form.documentNumber ?? "").trim()) errors.documentNumber = "Enter the document number";
            break;
        case "ACCOUNT_CLOSURE":
            required("reason", "Choose a reason");
            if (form.confirm !== "CLOSE") errors.confirm = "Type CLOSE to confirm";
            break;
    }
    if ((form.notes ?? "").length > 300) errors.notes = "Keep notes under 300 characters";
    return errors;
};

const buildDetails = (type: ServiceRequestType, form: FormState, accounts: Account[]) => {
    const parts: string[] = [];
    switch (type) {
        case "CHEQUE_BOOK":
            parts.push(`Leaves: ${form.leaves}`, "Deliver to registered address");
            break;
        case "STOP_CHEQUE":
            parts.push(form.toCheque && form.toCheque !== form.fromCheque ? `Cheque numbers: ${form.fromCheque} to ${form.toCheque}` : `Cheque number: ${form.fromCheque}`, `Reason: ${form.reason}`);
            break;
        case "DEBIT_CARD_REISSUE":
            parts.push(`Reason: ${form.reason}`);
            break;
        case "ADDRESS_CHANGE":
            parts.push(`New address: ${form.address.trim()}`);
            break;
        case "NOMINEE_UPDATE":
            parts.push(`Nominee: ${form.nominee.trim()}`, `Relationship: ${form.relationship}`);
            break;
        case "KYC_UPDATE":
            parts.push(`Document: ${form.document}`, `Document number: ${form.documentNumber.trim()}`);
            break;
        case "ACCOUNT_CLOSURE": {
            const target = accounts.find((account) => String(account.id) === form.transferTo);
            parts.push(`Reason: ${form.reason}`, target ? `Transfer balance to ${target.accountNumber}` : "Pay balance by demand draft");
            break;
        }
    }
    if (form.notes?.trim()) parts.push(`Notes: ${form.notes.trim()}`);
    return parts.join("; ");
};

const RequestModal = ({ info, accounts, onClose, onCreated }: { info: RequestTypeInfo; accounts: Account[]; onClose: () => void; onCreated: (request: ServiceRequest) => void }) => {
    const { user } = useAuth();
    const [form, setForm] = useState<FormState>(() => ({
        accountId: accounts[0] ? String(accounts[0].id) : "",
        leaves: "25",
        ...(info.type === "ADDRESS_CHANGE" ? { address: "" } : {}),
    }));
    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string>();
    const [isSaving, setIsSaving] = useState(false);

    const errors: Record<string, string | undefined> = { ...(submitted ? validate(info.type, form, info.needsAccount) : {}), ...serverErrors };
    const set = (field: string, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setServerErrors((current) => {
            const next = { ...current };
            delete next[field];
            return next;
        });
    };

    const account = accounts.find((item) => String(item.id) === form.accountId);
    const noAccounts = info.needsAccount && accounts.length === 0;

    const submit = async () => {
        setSubmitted(true);
        setFormError(undefined);
        if (Object.keys(validate(info.type, form, info.needsAccount)).length > 0) return;
        setIsSaving(true);
        try {
            const request = await api.serviceRequests.create({
                type: info.type,
                accountId: info.needsAccount ? Number(form.accountId) : undefined,
                details: buildDetails(info.type, form, accounts),
            });
            onCreated(request);
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) setServerErrors(err.fieldErrors);
            setFormError(errorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    const selectField = (field: string, label: string, values: string[], placeholder = "Select") => (
        <Select
            label={label}
            placeholder={placeholder}
            selectedKey={form[field] || null}
            onSelectionChange={(key) => set(field, key == null ? "" : String(key))}
            items={options(values)}
            isInvalid={Boolean(errors[field])}
            hint={errors[field]}
        >
            {(item) => <Select.Item id={item.id} label={item.label} />}
        </Select>
    );

    const isClosure = info.type === "ACCOUNT_CLOSURE";

    return (
        <AppModal
            isOpen
            onClose={onClose}
            title={info.title}
            description={`${info.description} ${info.turnaround}.`}
            icon={info.icon}
            iconColor={isClosure ? "error" : "brand"}
            widthClassName="sm:max-w-lg"
            footer={
                <>
                    <Button color="secondary" size="lg" onClick={onClose} isDisabled={isSaving}>
                        Cancel
                    </Button>
                    <Button color={isClosure ? "primary-destructive" : "primary"} size="lg" onClick={submit} isLoading={isSaving} showTextWhileLoading isDisabled={noAccounts}>
                        {isClosure ? "Request closure" : "Submit request"}
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

                {noAccounts && <div className="rounded-lg bg-secondary p-3 text-sm text-tertiary">You don't have an active account for this request.</div>}

                {info.needsAccount && accounts.length > 0 && (
                    <Select
                        label="Account"
                        placeholder="Select account"
                        selectedKey={form.accountId || null}
                        onSelectionChange={(key) => set("accountId", key == null ? "" : String(key))}
                        items={accounts.map((item) => ({ id: String(item.id), label: accountLabel(item), supportingText: formatINR(item.balance) }))}
                        isInvalid={Boolean(errors.accountId)}
                        hint={errors.accountId}
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                    </Select>
                )}

                {info.type === "CHEQUE_BOOK" && (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-secondary">Number of leaves</span>
                        <div role="radiogroup" aria-label="Number of leaves" className="grid grid-cols-2 gap-3">
                            {["25", "50"].map((leaves) => (
                                <button
                                    key={leaves}
                                    type="button"
                                    role="radio"
                                    aria-checked={form.leaves === leaves}
                                    onClick={() => set("leaves", leaves)}
                                    className={cx(
                                        "flex flex-col items-start rounded-xl p-3 text-left ring-1 ring-secondary ring-inset outline-focus-ring focus-visible:outline-2",
                                        form.leaves === leaves ? "bg-brand-primary_alt ring-2 ring-brand" : "bg-primary hover:bg-primary_hover",
                                    )}
                                >
                                    <span className="text-sm font-semibold text-primary">{leaves} leaves</span>
                                    <span className="text-xs text-tertiary">{leaves === "25" ? "Free" : "For frequent cheque users"}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-sm text-tertiary">Delivered to your registered address{user?.address ? `: ${user.address}` : "."}</p>
                    </div>
                )}

                {info.type === "STOP_CHEQUE" && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Cheque number"
                                isRequired
                                inputMode="numeric"
                                placeholder="000123"
                                value={form.fromCheque ?? ""}
                                onChange={(value) => set("fromCheque", value.replace(/\D/g, "").slice(0, 6))}
                                isInvalid={Boolean(errors.fromCheque)}
                                hint={errors.fromCheque}
                            />
                            <Input
                                label="To cheque number"
                                inputMode="numeric"
                                placeholder="Optional, for a range"
                                value={form.toCheque ?? ""}
                                onChange={(value) => set("toCheque", value.replace(/\D/g, "").slice(0, 6))}
                                isInvalid={Boolean(errors.toCheque)}
                                hint={errors.toCheque}
                            />
                        </div>
                        {selectField("reason", "Reason", STOP_REASONS)}
                    </>
                )}

                {info.type === "DEBIT_CARD_REISSUE" && selectField("reason", "Reason for reissue", CARD_REASONS)}

                {info.type === "ADDRESS_CHANGE" && (
                    <>
                        {user?.address && (
                            <div className="rounded-lg bg-secondary p-3 text-sm text-tertiary">
                                <span className="font-medium text-secondary">Current address: </span>
                                {user.address}
                            </div>
                        )}
                        <TextArea
                            label="New address"
                            isRequired
                            rows={3}
                            placeholder="House no., street, city, state and PIN code"
                            value={form.address ?? ""}
                            onChange={(value) => set("address", value)}
                            isInvalid={Boolean(errors.address)}
                            hint={errors.address ?? "You'll need to show proof of the new address if asked by the branch."}
                        />
                    </>
                )}

                {info.type === "NOMINEE_UPDATE" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nominee's full name" isRequired value={form.nominee ?? ""} onChange={(value) => set("nominee", value)} isInvalid={Boolean(errors.nominee)} hint={errors.nominee} />
                        {selectField("relationship", "Relationship", RELATIONSHIPS)}
                        {account?.nomineeName && <p className="text-sm text-tertiary sm:col-span-2">Current nominee on this account: {account.nomineeName}</p>}
                    </div>
                )}

                {info.type === "KYC_UPDATE" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {selectField("document", "Document", KYC_DOCS)}
                        <Input
                            label="Document number"
                            isRequired
                            value={form.documentNumber ?? ""}
                            onChange={(value) => set("documentNumber", value.toUpperCase())}
                            isInvalid={Boolean(errors.documentNumber)}
                            hint={errors.documentNumber}
                        />
                    </div>
                )}

                {isClosure && (
                    <>
                        <div className="flex items-start gap-3 rounded-lg bg-error-primary p-3 text-sm text-error-primary">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            <span>Closing an account is permanent. Linked debit cards, standing instructions and cheque books will stop working. Clear any pending dues first.</span>
                        </div>
                        {selectField("reason", "Reason for closure", CLOSURE_REASONS)}
                        <Select
                            label="Remaining balance"
                            placeholder="Choose how to receive it"
                            selectedKey={form.transferTo || "DD"}
                            onSelectionChange={(key) => set("transferTo", key == null || key === "DD" ? "" : String(key))}
                            items={[
                                { id: "DD", label: "Demand draft to registered address" },
                                ...accounts.filter((item) => String(item.id) !== form.accountId).map((item) => ({ id: String(item.id), label: `Transfer to ${accountLabel(item)}` })),
                            ]}
                            hint={account ? `Current balance ${formatINR(account.balance)}` : undefined}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Input
                            label="Type CLOSE to confirm"
                            isRequired
                            value={form.confirm ?? ""}
                            onChange={(value) => set("confirm", value.toUpperCase())}
                            isInvalid={Boolean(errors.confirm)}
                            hint={errors.confirm}
                        />
                    </>
                )}

                <TextArea
                    label="Additional notes"
                    rows={2}
                    placeholder="Optional"
                    value={form.notes ?? ""}
                    onChange={(value) => set("notes", value)}
                    isInvalid={Boolean(errors.notes)}
                    hint={errors.notes}
                />
            </form>
        </AppModal>
    );
};
