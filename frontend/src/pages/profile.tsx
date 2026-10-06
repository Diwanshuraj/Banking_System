import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Check, Key01, Lock01, Monitor01, Moon01, Settings01, Shield01, Sun, User01, XClose } from "@untitledui/icons";
import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";
import { Tabs } from "@/components/application/tabs/tabs";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Avatar } from "@/components/base/avatar/avatar";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { errorMessage } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import type { User } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

type TabKey = "personal" | "security" | "preferences";

const FormAlert = ({ message }: { message?: string }) => (message ? <div className="rounded-lg bg-error-primary p-3 text-sm text-error-primary">{message}</div> : null);

const ReadOnlyField = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex min-w-0 flex-col gap-1">
        <dt className="text-sm text-tertiary">{label}</dt>
        <dd className="truncate text-md font-medium text-primary">{value || "—"}</dd>
    </div>
);

export const ProfilePage = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState<TabKey>("personal");

    if (!user) return null;

    return (
        <>
            <PageHeader title="Profile & security" description="Manage your contact details, password, transaction PIN and preferences." />

            <div className="flex flex-col gap-4 rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary sm:flex-row sm:items-center md:p-6">
                <Avatar size="xl" initials={initials(user.fullName)} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold text-primary">{user.fullName}</h2>
                        <StatusBadge status={user.status} />
                    </div>
                    <p className="truncate text-sm text-tertiary">
                        CIF {user.customerId} · {user.email}
                    </p>
                </div>
                <div className="flex flex-col text-sm sm:items-end">
                    <span className="text-tertiary">Last login</span>
                    <span className="font-medium text-secondary">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "First session"}</span>
                </div>
            </div>

            <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key as TabKey)}>
                <Tabs.List type="underline" size="sm" aria-label="Profile sections" className="overflow-x-auto">
                    <Tabs.Item id="personal" icon={User01}>
                        Personal details
                    </Tabs.Item>
                    <Tabs.Item id="security" icon={Shield01}>
                        Security
                    </Tabs.Item>
                    <Tabs.Item id="preferences" icon={Settings01}>
                        Preferences
                    </Tabs.Item>
                </Tabs.List>
                <Tabs.Panel id="personal" className="pt-6">
                    <PersonalTab user={user} />
                </Tabs.Panel>
                <Tabs.Panel id="security" className="pt-6">
                    <SecurityTab user={user} />
                </Tabs.Panel>
                <Tabs.Panel id="preferences" className="pt-6">
                    <PreferencesTab />
                </Tabs.Panel>
            </Tabs>
        </>
    );
};

// ---------------------------------------------------------------------------
// Personal details
// ---------------------------------------------------------------------------

const PersonalTab = ({ user }: { user: User }) => {
    const { setUser } = useAuth();
    const toast = useToast();
    const [phone, setPhone] = useState(user.phone ?? "");
    const [address, setAddress] = useState(user.address ?? "");
    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string>();
    const [isSaving, setIsSaving] = useState(false);

    const validate = () => {
        const errors: Record<string, string> = {};
        if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = "Enter a valid 10-digit Indian mobile number";
        if (address.trim().length < 15) errors.address = "Enter your complete address including city and PIN code";
        else if (address.trim().length > 250) errors.address = "Keep the address under 250 characters";
        return errors;
    };
    const errors: Record<string, string | undefined> = { ...(submitted ? validate() : {}), ...serverErrors };
    const isDirty = phone !== (user.phone ?? "") || address !== (user.address ?? "");

    const save = async () => {
        setSubmitted(true);
        setFormError(undefined);
        if (Object.keys(validate()).length > 0) return;
        setIsSaving(true);
        try {
            const updated = await api.profile.update({ phone, address: address.trim() });
            setUser(updated);
            setSubmitted(false);
            toast.success("Profile updated", "Your contact details have been saved.");
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) setServerErrors(err.fieldErrors);
            setFormError(errorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <SectionCard title="Customer information" description="These details are verified through KYC. Visit your branch or raise a KYC update request to change them.">
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <ReadOnlyField label="Full name" value={user.fullName} />
                    <ReadOnlyField label="Customer ID (CIF)" value={<span className="tabular-nums">{user.customerId}</span>} />
                    <ReadOnlyField label="Email" value={user.email} />
                    <ReadOnlyField label="Date of birth" value={user.dateOfBirth ? formatDate(user.dateOfBirth) : null} />
                    <ReadOnlyField label="PAN" value={user.panNumber} />
                    <ReadOnlyField label="Aadhaar" value={user.aadhaarMasked} />
                    <ReadOnlyField label="Customer since" value={formatDate(user.createdAt)} />
                </dl>
            </SectionCard>

            <SectionCard title="Contact details" description="We'll send OTPs and alerts to this mobile number.">
                <form
                    className="flex flex-col gap-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        save();
                    }}
                >
                    <FormAlert message={formError} />
                    <Input
                        label="Mobile number"
                        isRequired
                        inputMode="tel"
                        placeholder="10-digit mobile number"
                        value={phone}
                        onChange={(value) => {
                            setPhone(value.replace(/\D/g, "").slice(0, 10));
                            setServerErrors(({ phone: _omit, ...rest }) => rest);
                        }}
                        isInvalid={Boolean(errors.phone)}
                        hint={errors.phone}
                    />
                    <TextArea
                        label="Communication address"
                        isRequired
                        rows={4}
                        value={address}
                        onChange={(value) => {
                            setAddress(value);
                            setServerErrors(({ address: _omit, ...rest }) => rest);
                        }}
                        isInvalid={Boolean(errors.address)}
                        hint={errors.address ?? "House no., street, city, state and PIN code"}
                    />
                    <div className="flex flex-col-reverse gap-3 border-t border-secondary pt-5 sm:flex-row sm:justify-end">
                        <Button
                            color="secondary"
                            isDisabled={!isDirty || isSaving}
                            onClick={() => {
                                setPhone(user.phone ?? "");
                                setAddress(user.address ?? "");
                                setSubmitted(false);
                                setServerErrors({});
                                setFormError(undefined);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isDisabled={!isDirty} isLoading={isSaving} showTextWhileLoading>
                            Save changes
                        </Button>
                    </div>
                </form>
            </SectionCard>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
    { label: "At least 8 characters", test: (value) => value.length >= 8 },
    { label: "An uppercase letter", test: (value) => /[A-Z]/.test(value) },
    { label: "A lowercase letter", test: (value) => /[a-z]/.test(value) },
    { label: "A number", test: (value) => /\d/.test(value) },
    { label: "A special character", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

const strengthLabel = ["Too weak", "Too weak", "Weak", "Fair", "Good", "Strong"];

const PasswordStrength = ({ value }: { value: string }) => {
    const passed = PASSWORD_RULES.filter((rule) => rule.test(value)).length;
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <div className="grid flex-1 grid-cols-5 gap-1.5">
                    {PASSWORD_RULES.map((rule, index) => (
                        <span
                            key={rule.label}
                            className={cx("h-1.5 rounded-full", index < passed ? (passed <= 2 ? "bg-error-solid" : passed <= 4 ? "bg-warning-solid" : "bg-success-solid") : "bg-quaternary")}
                        />
                    ))}
                </div>
                <span className="w-16 text-right text-xs font-medium text-tertiary">{value ? strengthLabel[passed] : ""}</span>
            </div>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(value);
                    return (
                        <li key={rule.label} className={cx("flex items-center gap-2 text-sm", ok ? "text-success-primary" : "text-tertiary")}>
                            {ok ? <Check className="size-4 shrink-0 text-fg-success-primary" /> : <XClose className="size-4 shrink-0 text-fg-quaternary" />}
                            {rule.label}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

const ChangePasswordCard = () => {
    const toast = useToast();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string>();
    const [isSaving, setIsSaving] = useState(false);

    const validate = () => {
        const errors: Record<string, string> = {};
        if (!current) errors.currentPassword = "Enter your current password";
        if (!PASSWORD_RULES.every((rule) => rule.test(next))) errors.newPassword = "Your new password doesn't meet all the rules below";
        else if (next === current) errors.newPassword = "Choose a password different from your current one";
        if (!confirm) errors.confirm = "Re-enter the new password";
        else if (confirm !== next) errors.confirm = "Passwords don't match";
        return errors;
    };
    const errors: Record<string, string | undefined> = { ...(submitted ? validate() : {}), ...serverErrors };

    const save = async () => {
        setSubmitted(true);
        setFormError(undefined);
        if (Object.keys(validate()).length > 0) return;
        setIsSaving(true);
        try {
            await api.profile.changePassword({ currentPassword: current, newPassword: next });
            setCurrent("");
            setNext("");
            setConfirm("");
            setSubmitted(false);
            toast.success("Password changed", "Use your new password the next time you sign in.");
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) setServerErrors(err.fieldErrors);
            setFormError(errorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SectionCard title="Login password" description="Used to sign in to internet banking.">
            <form
                className="flex flex-col gap-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
            >
                <FormAlert message={formError} />
                <Input
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    isRequired
                    value={current}
                    onChange={(value) => {
                        setCurrent(value);
                        setServerErrors(({ currentPassword: _omit, ...rest }) => rest);
                    }}
                    isInvalid={Boolean(errors.currentPassword)}
                    hint={errors.currentPassword}
                />
                <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    isRequired
                    value={next}
                    onChange={(value) => {
                        setNext(value);
                        setServerErrors(({ newPassword: _omit, ...rest }) => rest);
                    }}
                    isInvalid={Boolean(errors.newPassword)}
                    hint={errors.newPassword}
                />
                <PasswordStrength value={next} />
                <Input
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    isRequired
                    value={confirm}
                    onChange={setConfirm}
                    isInvalid={Boolean(errors.confirm)}
                    hint={errors.confirm}
                />
                <div className="flex justify-end border-t border-secondary pt-5">
                    <Button type="submit" iconLeading={Key01} isLoading={isSaving} showTextWhileLoading>
                        Update password
                    </Button>
                </div>
            </form>
        </SectionCard>
    );
};

const isWeakPin = (pin: string) => /^(\d)\1{5}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin);

const TransactionPinCard = ({ user }: { user: User }) => {
    const { refreshUser } = useAuth();
    const toast = useToast();
    const [pin, setPin] = useState("");
    const [confirm, setConfirm] = useState("");
    const [password, setPassword] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string>();
    const [isSaving, setIsSaving] = useState(false);

    const validate = () => {
        const errors: Record<string, string> = {};
        if (!/^\d{6}$/.test(pin)) errors.pin = "The PIN must be exactly 6 digits";
        else if (isWeakPin(pin)) errors.pin = "Avoid repeated or sequential digits like 111111 or 123456";
        if (!confirm) errors.confirm = "Re-enter the PIN";
        else if (confirm !== pin) errors.confirm = "PINs don't match";
        if (!password) errors.password = "Enter your login password to authorise this change";
        return errors;
    };
    const errors: Record<string, string | undefined> = { ...(submitted ? validate() : {}), ...serverErrors };

    const save = async () => {
        setSubmitted(true);
        setFormError(undefined);
        if (Object.keys(validate()).length > 0) return;
        setIsSaving(true);
        try {
            await api.profile.setPin({ pin, password });
            await refreshUser().catch(() => {});
            setPin("");
            setConfirm("");
            setPassword("");
            setSubmitted(false);
            toast.success(user.hasTransactionPin ? "Transaction PIN changed" : "Transaction PIN set", "Use it to authorise transfers, bill payments and deposits.");
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) setServerErrors(err.fieldErrors);
            setFormError(errorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    const digits = (value: string) => value.replace(/\D/g, "").slice(0, 6);

    return (
        <SectionCard
            title="Transaction PIN"
            description="A 6-digit PIN that authorises every payment. Never share it — bank staff will never ask for it."
            actions={
                user.hasTransactionPin ? (
                    <BadgeWithDot type="pill-color" size="sm" color="success">
                        PIN set
                    </BadgeWithDot>
                ) : (
                    <BadgeWithDot type="pill-color" size="sm" color="warning">
                        Not set
                    </BadgeWithDot>
                )
            }
        >
            <form
                className="flex flex-col gap-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
            >
                {!user.hasTransactionPin && (
                    <div className="flex items-start gap-3 rounded-lg bg-warning-primary p-3 text-sm text-warning-primary">
                        <Lock01 className="mt-0.5 size-4 shrink-0 text-fg-warning-primary" />
                        You need a transaction PIN before you can transfer money, pay bills or open deposits.
                    </div>
                )}
                <FormAlert message={formError} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label={user.hasTransactionPin ? "New PIN" : "PIN"}
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        isRequired
                        placeholder="••••••"
                        maxLength={6}
                        value={pin}
                        inputClassName="tracking-[0.3em] tabular-nums"
                        onChange={(value) => {
                            setPin(digits(value));
                            setServerErrors(({ pin: _omit, ...rest }) => rest);
                        }}
                        isInvalid={Boolean(errors.pin)}
                        hint={errors.pin}
                    />
                    <Input
                        label="Confirm PIN"
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        isRequired
                        placeholder="••••••"
                        maxLength={6}
                        value={confirm}
                        inputClassName="tracking-[0.3em] tabular-nums"
                        onChange={(value) => setConfirm(digits(value))}
                        isInvalid={Boolean(errors.confirm)}
                        hint={errors.confirm}
                    />
                </div>
                <Input
                    label="Login password"
                    type="password"
                    autoComplete="current-password"
                    isRequired
                    value={password}
                    onChange={(value) => {
                        setPassword(value);
                        setServerErrors(({ password: _omit, ...rest }) => rest);
                    }}
                    isInvalid={Boolean(errors.password)}
                    hint={errors.password ?? "Confirms it's really you making this change."}
                />
                <div className="flex justify-end border-t border-secondary pt-5">
                    <Button type="submit" iconLeading={Lock01} isLoading={isSaving} showTextWhileLoading>
                        {user.hasTransactionPin ? "Change PIN" : "Set PIN"}
                    </Button>
                </div>
            </form>
        </SectionCard>
    );
};

const SecurityTab = ({ user }: { user: User }) => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <ChangePasswordCard />
        <div className="flex min-w-0 flex-col gap-6">
            <TransactionPinCard user={user} />
            <SectionCard title="Session activity">
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <ReadOnlyField label="Last login" value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "This is your first session"} />
                    <ReadOnlyField label="Account status" value={<StatusBadge status={user.status} />} />
                </dl>
                <p className="mt-5 text-sm text-tertiary">Don't recognise this activity? Change your password immediately and contact customer care.</p>
            </SectionCard>
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

const THEMES: { id: "light" | "dark" | "system"; label: string; description: string; icon: FC<{ className?: string }> }[] = [
    { id: "light", label: "Light", description: "Bright background, best in daylight", icon: Sun },
    { id: "dark", label: "Dark", description: "Easier on the eyes at night", icon: Moon01 },
    { id: "system", label: "System", description: "Follows your device setting", icon: Monitor01 },
];

const PreferencesTab = () => {
    const { theme, setTheme } = useTheme();
    return (
        <SectionCard title="Appearance" description="Choose how internet banking looks on this device.">
            <AriaRadioGroup value={theme} onChange={(value) => setTheme(value as typeof theme)} aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {THEMES.map(({ id, label, description, icon: Icon }) => (
                    <AriaRadio
                        key={id}
                        value={id}
                        className={({ isSelected, isFocusVisible }) =>
                            cx(
                                "flex cursor-pointer items-start gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary transition duration-100 ease-linear ring-inset hover:bg-primary_hover",
                                isSelected && "bg-brand-primary_alt ring-2 ring-brand hover:bg-brand-primary_alt",
                                isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                            )
                        }
                    >
                        {({ isSelected }) => (
                            <>
                                <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", isSelected ? "bg-brand-solid text-white" : "bg-secondary text-fg-secondary")}>
                                    <Icon className="size-5" />
                                </span>
                                <span className="flex min-w-0 flex-col">
                                    <span className={cx("text-sm font-semibold", isSelected ? "text-brand-secondary" : "text-primary")}>{label}</span>
                                    <span className="text-sm text-tertiary">{description}</span>
                                </span>
                            </>
                        )}
                    </AriaRadio>
                ))}
            </AriaRadioGroup>
        </SectionCard>
    );
};
