import type { FormEvent } from "react";
import { useState } from "react";
import { AlertCircle, ArrowLeft, Briefcase01, Check, CheckCircle, Wallet02, Coins01 } from "@untitledui/icons";
import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";
import { Link as RouterLink, Navigate, useNavigate } from "react-router";
import { AuthShell } from "@/components/app/auth-shell";
import { BANK_NAME } from "@/components/app/bank-logo";
import { LoadingState } from "@/components/app/data-states";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { errorMessage } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import type { AccountType, RegisterRequest } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

type FormState = Omit<RegisterRequest, "accountType"> & { accountType: AccountType; confirmPassword: string };
type Errors = Partial<Record<keyof FormState | "terms", string>>;

const STEPS = [
    { title: "Personal details", description: "Name and contact" },
    { title: "KYC details", description: "PAN, Aadhaar and address" },
    { title: "Account & password", description: "Choose account and secure it" },
];

const STEP_FIELDS: (keyof FormState)[][] = [
    ["fullName", "email", "phone"],
    ["panNumber", "aadhaarNumber", "dateOfBirth", "address"],
    ["accountType", "password", "confirmPassword"],
];

const ACCOUNT_TYPES: { value: AccountType; title: string; description: string; icon: typeof Wallet02 }[] = [
    { value: "SAVINGS", title: "Savings account", description: "Earn interest on your balance. Ideal for individuals.", icon: Wallet02 },
    { value: "SALARY", title: "Salary account", description: "Zero-balance account for salaried employees.", icon: Coins01 },
    { value: "CURRENT", title: "Current account", description: "For businesses and frequent high-value transactions.", icon: Briefcase01 },
];

const PASSWORD_RULES = [
    { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
    { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
    { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
    { label: "One number", test: (value: string) => /\d/.test(value) },
    { label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

const ageOn = (dob: string) => {
    const birth = new Date(`${dob}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return -1;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
    if (beforeBirthday) age -= 1;
    return age;
};

const validateField = (field: keyof FormState, form: FormState): string | undefined => {
    const value = String(form[field] ?? "").trim();
    switch (field) {
        case "fullName":
            if (value.length < 3) return "Enter your full name as per PAN.";
            if (!/^[A-Za-z .'-]+$/.test(value)) return "Name can only contain letters, spaces and . ' -";
            return;
        case "email":
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : "Enter a valid email address.";
        case "phone":
            return /^[6-9]\d{9}$/.test(value) ? undefined : "Enter a 10-digit Indian mobile number.";
        case "panNumber":
            return /^[A-Z]{5}\d{4}[A-Z]$/.test(value) ? undefined : "PAN must look like ABCDE1234F.";
        case "aadhaarNumber":
            return /^\d{12}$/.test(value.replace(/\s/g, "")) ? undefined : "Aadhaar must be 12 digits.";
        case "dateOfBirth": {
            if (!value) return "Enter your date of birth.";
            const age = ageOn(value);
            if (age < 0 || age > 120) return "Enter a valid date of birth.";
            if (age < 18) return "You must be at least 18 years old to open an account online.";
            return;
        }
        case "address":
            return value.length >= 10 ? undefined : "Enter your full residential address with PIN code.";
        case "accountType":
            return value ? undefined : "Choose an account type.";
        case "password":
            return PASSWORD_RULES.every((rule) => rule.test(form.password)) ? undefined : "Password doesn't meet all the rules below.";
        case "confirmPassword":
            if (!form.confirmPassword) return "Re-enter your password.";
            return form.confirmPassword === form.password ? undefined : "Passwords don't match.";
    }
};

const initialForm: FormState = {
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    panNumber: "",
    aadhaarNumber: "",
    dateOfBirth: "",
    address: "",
    accountType: "SAVINGS",
};

const Stepper = ({ step }: { step: number }) => (
    <ol className="flex items-start gap-2">
        {STEPS.map((item, index) => {
            const isDone = index < step;
            const isCurrent = index === step;
            return (
                <li key={item.title} className="flex flex-1 flex-col gap-2">
                    <div className={cx("h-1 rounded-full", isDone || isCurrent ? "bg-brand-solid" : "bg-quaternary")} />
                    <div className="flex items-start gap-2">
                        <span
                            className={cx(
                                "mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                                isDone && "bg-brand-solid text-white",
                                isCurrent && "bg-brand-secondary text-brand-secondary ring-1 ring-brand ring-inset",
                                !isDone && !isCurrent && "bg-secondary text-quaternary",
                            )}
                        >
                            {isDone ? <Check className="size-3" /> : index + 1}
                        </span>
                        <div className="flex min-w-0 flex-col">
                            <span className={cx("text-sm font-semibold", isCurrent ? "text-brand-secondary" : "text-secondary")}>{item.title}</span>
                            <span className="hidden text-xs text-tertiary sm:block">{item.description}</span>
                        </div>
                    </div>
                </li>
            );
        })}
    </ol>
);

export const RegisterPage = () => {
    const { user, isRestoring, register } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const [step, setStep] = useState(0);
    const [form, setForm] = useState<FormState>(initialForm);
    const [errors, setErrors] = useState<Errors>({});
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [formError, setFormError] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (isRestoring) return <LoadingState label="Restoring your session…" className="min-h-dvh" />;
    if (user && !isSubmitting) return <Navigate to={user.role === "ROLE_ADMIN" ? "/admin" : "/"} replace />;

    const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: undefined }));
    };

    const validateStep = (index: number) => {
        const stepErrors: Errors = {};
        STEP_FIELDS[index].forEach((field) => {
            const message = validateField(field, form);
            if (message) stepErrors[field] = message;
        });
        if (index === 2 && !acceptedTerms) stepErrors.terms = "Please accept the terms to continue.";
        setErrors((current) => ({ ...current, ...stepErrors }));
        return Object.keys(stepErrors).length === 0;
    };

    const next = (event: FormEvent) => {
        event.preventDefault();
        setFormError(undefined);
        if (!validateStep(step)) return;
        if (step < STEPS.length - 1) {
            setStep(step + 1);
            return;
        }
        submit();
    };

    const submit = async () => {
        setIsSubmitting(true);
        try {
            const created = await register({
                fullName: form.fullName.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone.trim(),
                password: form.password,
                panNumber: form.panNumber.trim().toUpperCase(),
                aadhaarNumber: form.aadhaarNumber.replace(/\s/g, ""),
                dateOfBirth: form.dateOfBirth,
                address: form.address.trim(),
                accountType: form.accountType,
            });
            toast.success(`Welcome to ${BANK_NAME}, ${created.fullName.split(" ")[0]}!`, `Your Customer ID is ${created.customerId}. Set a transaction PIN under Profile & security before making payments.`);
            navigate("/", { replace: true });
        } catch (err) {
            setIsSubmitting(false);
            if (err instanceof ApiError && err.fieldErrors) {
                const apiErrors = err.fieldErrors as Errors;
                setErrors(apiErrors);
                const firstStep = STEP_FIELDS.findIndex((fields) => fields.some((field) => apiErrors[field]));
                if (firstStep >= 0) setStep(firstStep);
            }
            setFormError(errorMessage(err));
        }
    };

    const field = (name: keyof FormState) => ({
        value: String(form[name]),
        isInvalid: Boolean(errors[name]),
        onBlur: () => {
            if (form[name]) setErrors((current) => ({ ...current, [name]: validateField(name, form) }));
        },
    });

    return (
        <AuthShell action={{ prompt: "Already bank with us?", label: "Log in", to: "/login" }}>
            <div className="mx-auto flex max-w-3xl flex-col gap-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-display-xs font-semibold text-primary">Open a savings account online</h1>
                    <p className="text-md text-tertiary">Paperless account opening in 3 steps. Keep your PAN and Aadhaar handy.</p>
                </div>

                <Stepper step={step} />

                <form onSubmit={next} noValidate className="flex flex-col rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                    <div className="flex flex-col gap-1 border-b border-secondary px-4 py-5 md:px-6">
                        <h2 className="text-lg font-semibold text-primary">{STEPS[step].title}</h2>
                        <p className="text-sm text-tertiary">
                            Step {step + 1} of {STEPS.length} · {STEPS[step].description}
                        </p>
                    </div>

                    <div className="flex flex-col gap-5 px-4 py-6 md:px-6">
                        {formError && (
                            <div role="alert" className="flex gap-3 rounded-lg bg-error-primary p-3 text-sm text-error-primary ring-1 ring-error_subtle ring-inset">
                                <AlertCircle className="size-5 shrink-0" />
                                <span>{formError}</span>
                            </div>
                        )}

                        {step === 0 && (
                            <>
                                <Input
                                    label="Full name (as per PAN)"
                                    placeholder="Priya Verma"
                                    autoComplete="name"
                                    isRequired
                                    autoFocus
                                    {...field("fullName")}
                                    onChange={(value) => update("fullName", value)}
                                    hint={errors.fullName}
                                />
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <Input
                                        label="Email address"
                                        type="email"
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        isRequired
                                        {...field("email")}
                                        onChange={(value) => update("email", value)}
                                        hint={errors.email ?? "You can log in with this email."}
                                    />
                                    <Input
                                        label="Mobile number"
                                        type="tel"
                                        inputMode="numeric"
                                        placeholder="98765 43210"
                                        autoComplete="tel-national"
                                        isRequired
                                        maxLength={10}
                                        {...field("phone")}
                                        onChange={(value) => update("phone", value.replace(/\D/g, "").slice(0, 10))}
                                        hint={errors.phone ?? "Linked to your Aadhaar, for SMS alerts."}
                                    />
                                </div>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <Input
                                        label="PAN"
                                        placeholder="ABCDE1234F"
                                        isRequired
                                        autoFocus
                                        maxLength={10}
                                        inputClassName="uppercase tracking-wider"
                                        {...field("panNumber")}
                                        onChange={(value) => update("panNumber", value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                                        hint={errors.panNumber ?? "10-character Permanent Account Number."}
                                    />
                                    <Input
                                        label="Aadhaar number"
                                        inputMode="numeric"
                                        placeholder="1234 5678 9012"
                                        isRequired
                                        maxLength={14}
                                        inputClassName="tabular-nums tracking-wider"
                                        {...field("aadhaarNumber")}
                                        value={form.aadhaarNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}
                                        onChange={(value) => update("aadhaarNumber", value.replace(/\D/g, "").slice(0, 12))}
                                        hint={errors.aadhaarNumber ?? "Stored masked — only the last 4 digits are shown."}
                                    />
                                </div>
                                <Input
                                    label="Date of birth"
                                    type="date"
                                    isRequired
                                    className="md:max-w-xs"
                                    {...field("dateOfBirth")}
                                    onChange={(value) => update("dateOfBirth", value)}
                                    hint={errors.dateOfBirth ?? "You must be 18 or older."}
                                />
                                <TextArea
                                    label="Residential address"
                                    placeholder="Flat / house no., street, city, state, PIN code"
                                    isRequired
                                    rows={3}
                                    value={form.address}
                                    isInvalid={Boolean(errors.address)}
                                    onChange={(value) => update("address", value)}
                                    hint={errors.address ?? "As per your Aadhaar."}
                                />
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <AriaRadioGroup
                                    aria-label="Account type"
                                    value={form.accountType}
                                    onChange={(value) => update("accountType", value as AccountType)}
                                    className="flex flex-col gap-3"
                                >
                                    <span className="text-sm font-medium text-secondary">Account type</span>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        {ACCOUNT_TYPES.map(({ value, title, description, icon: Icon }) => (
                                            <AriaRadio
                                                key={value}
                                                value={value}
                                                className={({ isSelected, isFocusVisible }) =>
                                                    cx(
                                                        "relative flex cursor-pointer flex-col gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary transition duration-100 ease-linear ring-inset",
                                                        isSelected && "bg-brand-primary_alt ring-2 ring-brand",
                                                        isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                                                    )
                                                }
                                            >
                                                {({ isSelected }) => (
                                                    <>
                                                        <div className="flex items-center justify-between">
                                                            <span className="flex size-9 items-center justify-center rounded-lg bg-secondary ring-1 ring-secondary ring-inset">
                                                                <Icon className="size-5 text-fg-secondary" />
                                                            </span>
                                                            {isSelected && <CheckCircle className="size-5 text-fg-brand-primary" />}
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-sm font-semibold text-primary">{title}</span>
                                                            <span className="text-sm text-tertiary">{description}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </AriaRadio>
                                        ))}
                                    </div>
                                </AriaRadioGroup>

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <Input
                                        label="Create login password"
                                        type="password"
                                        autoComplete="new-password"
                                        isRequired
                                        {...field("password")}
                                        onChange={(value) => update("password", value)}
                                        hint={errors.password}
                                    />
                                    <Input
                                        label="Confirm password"
                                        type="password"
                                        autoComplete="new-password"
                                        isRequired
                                        {...field("confirmPassword")}
                                        onChange={(value) => update("confirmPassword", value)}
                                        hint={errors.confirmPassword}
                                    />
                                </div>

                                <ul className="grid grid-cols-1 gap-2 rounded-lg bg-secondary p-4 sm:grid-cols-2">
                                    {PASSWORD_RULES.map((rule) => {
                                        const passed = rule.test(form.password);
                                        return (
                                            <li key={rule.label} className={cx("flex items-center gap-2 text-sm", passed ? "text-success-primary" : "text-tertiary")}>
                                                <span
                                                    className={cx(
                                                        "flex size-4 shrink-0 items-center justify-center rounded-full",
                                                        passed ? "bg-success-solid text-white" : "bg-quaternary text-quaternary",
                                                    )}
                                                >
                                                    <Check className="size-3" />
                                                </span>
                                                {rule.label}
                                            </li>
                                        );
                                    })}
                                </ul>

                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        isSelected={acceptedTerms}
                                        onChange={(value) => {
                                            setAcceptedTerms(value);
                                            setErrors((current) => ({ ...current, terms: undefined }));
                                        }}
                                        label="I confirm the details above are correct"
                                        hint="I agree to the account terms, and consent to Aadhaar-based e-KYC verification."
                                    />
                                    {errors.terms && <p className="text-sm text-error-primary">{errors.terms}</p>}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-secondary px-4 py-4 sm:flex-row sm:justify-between md:px-6">
                        {step > 0 ? (
                            <Button color="secondary" size="lg" iconLeading={ArrowLeft} onClick={() => setStep(step - 1)} isDisabled={isSubmitting}>
                                Back
                            </Button>
                        ) : (
                            <span />
                        )}
                        <Button type="submit" size="lg" isLoading={isSubmitting} showTextWhileLoading>
                            {step < STEPS.length - 1 ? "Continue" : "Open my account"}
                        </Button>
                    </div>
                </form>

                <p className="text-center text-sm text-tertiary">
                    Already bank with us?{" "}
                    <RouterLink to="/login" className="font-semibold text-brand-secondary hover:text-brand-secondary_hover">
                        Log in to internet banking
                    </RouterLink>
                </p>
            </div>
        </AuthShell>
    );
};
