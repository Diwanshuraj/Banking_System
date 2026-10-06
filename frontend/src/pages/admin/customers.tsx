import { useEffect, useMemo, useState } from "react";
import { Eye, SearchLg, UserPlus01, Users01 } from "@untitledui/icons";
import { useNavigate } from "react-router";
import { AppModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import { errorMessage, useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatDateTime, formatINR, initials } from "@/lib/format";
import type { AccountType, AdminCreateCustomerRequest, User } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";

const useDebounced = <T,>(value: T, delay = 300) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
};

const accountTypes: { id: AccountType; label: string; supportingText: string }[] = [
    { id: "SAVINGS", label: "Savings", supportingText: "Interest-bearing" },
    { id: "CURRENT", label: "Current", supportingText: "For businesses" },
    { id: "SALARY", label: "Salary", supportingText: "Zero balance" },
];

type FormState = Omit<AdminCreateCustomerRequest, "openingDeposit" | "accountType"> & { accountType: AccountType; openingDeposit: string };

const emptyForm: FormState = {
    fullName: "",
    email: "",
    phone: "",
    password: "",
    panNumber: "",
    aadhaarNumber: "",
    dateOfBirth: "",
    address: "",
    accountType: "SAVINGS",
    openingDeposit: "0",
};

const ageOn = (dob: string) => {
    const birth = new Date(`${dob}T00:00:00`);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
};

const validate = (form: FormState) => {
    const errors: Record<string, string> = {};
    if (form.fullName.trim().length < 3) errors.fullName = "Enter the customer's full name as per PAN.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) errors.phone = "Enter a 10-digit Indian mobile number.";
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(form.panNumber)) errors.panNumber = "PAN must look like ABCDE1234F.";
    if (!/^\d{12}$/.test(form.aadhaarNumber)) errors.aadhaarNumber = "Aadhaar must be 12 digits.";
    if (!form.dateOfBirth) errors.dateOfBirth = "Enter the date of birth.";
    else if (Number.isNaN(new Date(form.dateOfBirth).getTime())) errors.dateOfBirth = "Enter a valid date.";
    else if (ageOn(form.dateOfBirth) < 18) errors.dateOfBirth = "Customer must be at least 18 years old.";
    if (form.address.trim().length < 10) errors.address = "Enter the full residential address.";
    const deposit = Number(form.openingDeposit);
    if (form.openingDeposit.trim() === "" || !Number.isFinite(deposit) || deposit < 0) errors.openingDeposit = "Opening deposit must be ₹0 or more.";
    if (form.password.length < 8) errors.password = "Use at least 8 characters.";
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errors.password = "Include both letters and numbers.";
    return errors;
};

const AddCustomerModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const toast = useToast();
    const navigate = useNavigate();
    const [form, setForm] = useState<FormState>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setForm(emptyForm);
            setErrors({});
            setFormError(undefined);
        }
    }, [isOpen]);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
        if (errors[key]) setErrors(({ [key]: _removed, ...rest }) => rest);
    };

    const submit = async () => {
        const next = validate(form);
        setErrors(next);
        setFormError(undefined);
        if (Object.keys(next).length) return;

        setIsSubmitting(true);
        try {
            const created = await api.admin.createCustomer({
                ...form,
                fullName: form.fullName.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                address: form.address.trim(),
                openingDeposit: Number(form.openingDeposit),
            });
            toast.success("Customer created", `${created.fullName} · CIF ${created.customerId}. Share the initial password securely.`);
            onClose();
            navigate(`/admin/customers/${created.id}`);
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
            setFormError(errorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const field = (key: keyof FormState) => ({ isInvalid: Boolean(errors[key]), hint: errors[key] });

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title="Add customer"
            icon={UserPlus01}
            description="Completes KYC and opens the first account. The customer signs in with their email or CIF and the initial password."
            widthClassName="sm:max-w-2xl"
            footer={
                <>
                    <Button color="secondary" size="lg" onClick={onClose} isDisabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button size="lg" onClick={submit} isLoading={isSubmitting} showTextWhileLoading>
                        Create customer
                    </Button>
                </>
            }
        >
            <form
                noValidate
                className="flex flex-col gap-6"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <fieldset className="flex flex-col gap-4">
                    <legend className="mb-3 text-sm font-semibold text-secondary">Personal details</legend>
                    <Input label="Full name" isRequired placeholder="As per PAN card" value={form.fullName} onChange={(v) => set("fullName", v)} {...field("fullName")} />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Email" isRequired type="email" placeholder="name@example.com" value={form.email} onChange={(v) => set("email", v)} {...field("email")} />
                        <Input
                            label="Mobile number"
                            isRequired
                            inputMode="numeric"
                            placeholder="98XXXXXXXX"
                            maxLength={10}
                            value={form.phone}
                            onChange={(v) => set("phone", v.replace(/\D/g, ""))}
                            {...field("phone")}
                        />
                        <Input
                            label="PAN"
                            isRequired
                            placeholder="ABCDE1234F"
                            maxLength={10}
                            inputClassName="uppercase"
                            value={form.panNumber}
                            onChange={(v) => set("panNumber", v.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                            {...field("panNumber")}
                        />
                        <Input
                            label="Aadhaar number"
                            isRequired
                            inputMode="numeric"
                            placeholder="12-digit number"
                            maxLength={12}
                            value={form.aadhaarNumber}
                            onChange={(v) => set("aadhaarNumber", v.replace(/\D/g, ""))}
                            {...field("aadhaarNumber")}
                        />
                        <Input label="Date of birth" isRequired type="date" value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} {...field("dateOfBirth")} />
                    </div>
                    <TextArea label="Address" isRequired rows={2} placeholder="House, street, city, state, PIN" value={form.address} onChange={(v) => set("address", v)} {...field("address")} />
                </fieldset>

                <fieldset className="flex flex-col gap-4 border-t border-secondary pt-5">
                    <legend className="sr-only">Account and access</legend>
                    <p className="text-sm font-semibold text-secondary">First account & access</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="Account type"
                            isRequired
                            items={accountTypes}
                            selectedKey={form.accountType}
                            onSelectionChange={(key) => key && set("accountType", key as AccountType)}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                        </Select>
                        <Input
                            label="Opening deposit (₹)"
                            isRequired
                            inputMode="decimal"
                            placeholder="0"
                            value={form.openingDeposit}
                            onChange={(v) => set("openingDeposit", v.replace(/[^\d.]/g, ""))}
                            isInvalid={Boolean(errors.openingDeposit)}
                            hint={errors.openingDeposit ?? (Number(form.openingDeposit) > 0 ? `Credits ${formatINR(Number(form.openingDeposit))} as cash` : "Cash received at the counter")}
                        />
                        <Input
                            label="Initial password"
                            isRequired
                            type="password"
                            placeholder="At least 8 characters"
                            className="sm:col-span-2"
                            value={form.password}
                            onChange={(v) => set("password", v)}
                            isInvalid={Boolean(errors.password)}
                            hint={errors.password ?? "Share it with the customer in person; they should change it after first sign-in."}
                        />
                    </div>
                </fieldset>

                {formError && <p className="text-sm text-error-primary">{formError}</p>}
                <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
            </form>
        </AppModal>
    );
};

export const AdminCustomersPage = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [includeAdmins, setIncludeAdmins] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const q = useDebounced(query.trim());

    const { data, error, isLoading, reload } = useApi(() => api.admin.users(q || undefined), [q]);

    const users = useMemo(() => (data ?? []).filter((user) => includeAdmins || user.role === "ROLE_CUSTOMER"), [data, includeAdmins]);

    const open = (user: User) => navigate(`/admin/customers/${user.id}`);

    return (
        <>
            <PageHeader
                title="Customers"
                description="Search KYC records, review access and open new relationships."
                actions={
                    <Button size="md" iconLeading={UserPlus01} onClick={() => setIsAdding(true)}>
                        Add customer
                    </Button>
                }
            />

            <TableCard.Root>
                <TableCard.Header
                    title="All customers"
                    badge={data ? `${users.length}` : undefined}
                    description="Click a row to view the full profile and accounts."
                    contentTrailing={
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
                            <Toggle size="sm" label="Include staff" isSelected={includeAdmins} onChange={setIncludeAdmins} />
                            <Input
                                aria-label="Search customers"
                                icon={SearchLg}
                                placeholder="Name, email, phone or CIF"
                                value={query}
                                onChange={setQuery}
                                className="w-full sm:w-72"
                            />
                        </div>
                    }
                />

                {isLoading && !data ? (
                    <LoadingState label="Loading customers…" />
                ) : error ? (
                    <ErrorState message={errorMessage(error)} onRetry={reload} />
                ) : !users.length ? (
                    <EmptyPanel
                        icon={q ? SearchLg : Users01}
                        title={q ? "No customers match" : "No customers yet"}
                        description={q ? `Nothing found for “${q}”. Try a name, email, phone or 11-digit CIF.` : "Add the first customer to open an account."}
                        action={
                            q ? (
                                <Button color="secondary" onClick={() => setQuery("")}>
                                    Clear search
                                </Button>
                            ) : (
                                <Button iconLeading={UserPlus01} onClick={() => setIsAdding(true)}>
                                    Add customer
                                </Button>
                            )
                        }
                    />
                ) : (
                    <Table aria-label="Customers" onRowAction={(key) => navigate(`/admin/customers/${key}`)}>
                        <Table.Header>
                            <Table.Head id="customer" label="Customer" isRowHeader className="w-full min-w-64" />
                            <Table.Head id="cif" label="CIF" />
                            <Table.Head id="phone" label="Phone" />
                            <Table.Head id="pan" label="PAN" />
                            <Table.Head id="joined" label="Joined" />
                            <Table.Head id="login" label="Last login" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="actions" />
                        </Table.Header>
                        <Table.Body items={users}>
                            {(user) => (
                                <Table.Row id={user.id} className="cursor-pointer">
                                    <Table.Cell>
                                        <div className="flex items-center gap-3">
                                            <Avatar size="md" initials={initials(user.fullName)} alt={user.fullName} />
                                            <div className="flex min-w-0 flex-col">
                                                <span className="flex items-center gap-2 truncate font-medium text-primary">
                                                    {user.fullName}
                                                    {user.role === "ROLE_ADMIN" && (
                                                        <Badge color="brand" size="sm" type="pill-color">
                                                            Staff
                                                        </Badge>
                                                    )}
                                                </span>
                                                <span className="truncate text-tertiary">{user.email}</span>
                                            </div>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap tabular-nums">{user.customerId}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap tabular-nums">{user.phone}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{user.panNumber ?? "—"}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{formatDate(user.createdAt)}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}</Table.Cell>
                                    <Table.Cell>
                                        <StatusBadge status={user.status} />
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Button color="link-gray" size="sm" iconLeading={Eye} onClick={() => open(user)}>
                                            View
                                        </Button>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <AddCustomerModal isOpen={isAdding} onClose={() => setIsAdding(false)} />
        </>
    );
};
