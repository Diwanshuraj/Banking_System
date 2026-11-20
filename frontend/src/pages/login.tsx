import type { FormEvent } from "react";
import { useState } from "react";
import { AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle, Lightning01, Lock01, User01 } from "@untitledui/icons";
import { Navigate, useLocation, useNavigate } from "react-router";
import { AuthLayout, GlassCard, PanelHeading, SecureBadge } from "@/components/app/auth-shell";
import { LoadingState } from "@/components/app/data-states";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { errorMessage } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

const homeFor = (user: User, from?: string) => (user.role === "ROLE_ADMIN" ? "/admin" : from && from !== "/login" ? from : "/");

const PREVIEW_ACTIVITY = [
    { icon: ArrowDownLeft, label: "Salary credited", meta: "Today, 9:12 am", amount: "+ ₹85,000", credit: true },
    { icon: Lightning01, label: "Electricity bill", meta: "Yesterday", amount: "− ₹2,340", credit: false },
    { icon: ArrowUpRight, label: "Sent to Amit Patel", meta: "18 Nov", amount: "− ₹5,000", credit: false },
];

/** Bar heights for the decorative balance trend. */
const TREND = [38, 52, 44, 60, 56, 72, 64, 80, 74, 92];

/** Decorative preview of the dashboard: balance, trend and recent activity. */
const AccountPreview = () => (
    <div aria-hidden="true" className="relative">
        <GlassCard className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-white/55">Savings account ·· 2527</span>
                    <span className="text-display-xs font-semibold tracking-tight text-white">₹4,82,150.75</span>
                </div>
                <div className="flex h-10 items-end gap-1">
                    {TREND.map((height, index) => (
                        <span
                            key={index}
                            style={{ height: `${height}%` }}
                            className={cx("w-1.5 rounded-full", index === TREND.length - 1 ? "bg-brand-300" : "bg-white/20")}
                        />
                    ))}
                </div>
            </div>

            <ul className="flex flex-col divide-y divide-white/10 border-t border-white/10">
                {PREVIEW_ACTIVITY.map(({ icon: Icon, label, meta, amount, credit }) => (
                    <li key={label} className="flex items-center gap-3 py-3 last:pb-0">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                            <Icon className={cx("size-4", credit ? "text-green-400" : "text-white/70")} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium text-white">{label}</span>
                            <span className="text-xs text-white/50">{meta}</span>
                        </span>
                        <span className={cx("text-sm font-semibold tabular-nums", credit ? "text-green-400" : "text-white/80")}>{amount}</span>
                    </li>
                ))}
            </ul>
        </GlassCard>

        <div className="absolute -top-4 -right-4 flex items-center gap-2 rounded-full bg-white py-1.5 pr-3.5 pl-2 shadow-lg">
            <CheckCircle className="size-5 text-green-600" />
            <span className="text-xs font-semibold text-gray-900">Transfer successful</span>
        </div>
    </div>
);

const LoginPanel = () => (
    <div className="flex flex-col gap-10">
        <PanelHeading
            eyebrow="Personal NetBanking"
            title="Your bank, open whenever you need it."
            description="Transfer funds, pay bills, open deposits and manage your cards from one secure place."
        />
        <AccountPreview />
    </div>
);

export const LoginPage = () => {
    const { user, isRestoring, login } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const from = (location.state as { from?: string } | null)?.from;

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
    const [formError, setFormError] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (isRestoring) return <LoadingState label="Restoring your session…" className="min-h-dvh" />;
    if (user && !isSubmitting) return <Navigate to={homeFor(user, from)} replace />;

    const validate = () => {
        const errors: typeof fieldErrors = {};
        const value = username.trim();
        if (!value) errors.username = "Enter your email address or Customer ID.";
        else if (!value.includes("@") && !/^\d{11}$/.test(value)) errors.username = "Customer ID is the 11-digit CIF number on your passbook.";
        if (!password) errors.password = "Enter your password.";
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setFormError(undefined);
        if (!validate()) return;
        setIsSubmitting(true);
        try {
            const signedIn = await login({ username: username.trim(), password });
            toast.success(`Welcome back, ${signedIn.fullName.split(" ")[0]}`);
            navigate(homeFor(signedIn, from), { replace: true });
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors({ username: err.fieldErrors.username, password: err.fieldErrors.password });
            }
            setFormError(errorMessage(err));
            setIsSubmitting(false);
        }
    };

    return (
        <AuthLayout panel={<LoginPanel />} action={{ prompt: "New customer?", label: "Open an account", to: "/register" }}>
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                    <SecureBadge />
                    <h1 className="text-display-xs font-semibold tracking-tight text-primary">Welcome back</h1>
                    <p className="text-md text-tertiary">Log in with your registered email address or 11-digit Customer ID.</p>
                </div>

                <form onSubmit={submit} noValidate className="flex flex-col gap-5">
                    {formError && (
                        <div role="alert" className="flex gap-3 rounded-lg bg-error-primary p-3 text-sm text-error-primary ring-1 ring-error_subtle ring-inset">
                            <AlertCircle className="size-5 shrink-0" />
                            <span>{formError}</span>
                        </div>
                    )}

                    <Input
                        size="lg"
                        label="Email or Customer ID"
                        placeholder="you@example.com"
                        icon={User01}
                        autoComplete="username"
                        value={username}
                        onChange={(value) => {
                            setUsername(value);
                            setFieldErrors((current) => ({ ...current, username: undefined }));
                        }}
                        isInvalid={Boolean(fieldErrors.username)}
                        hint={fieldErrors.username}
                        isRequired
                        hideRequiredIndicator
                        autoFocus
                    />
                    <Input
                        size="lg"
                        label="Password"
                        type="password"
                        placeholder="Enter your password"
                        icon={Lock01}
                        autoComplete="current-password"
                        value={password}
                        onChange={(value) => {
                            setPassword(value);
                            setFieldErrors((current) => ({ ...current, password: undefined }));
                        }}
                        isInvalid={Boolean(fieldErrors.password)}
                        hint={fieldErrors.password}
                        isRequired
                        hideRequiredIndicator
                    />

                    <Button type="submit" size="xl" className="mt-2" iconTrailing={ArrowRight} isLoading={isSubmitting} showTextWhileLoading>
                        Log in securely
                    </Button>
                </form>
            </div>
        </AuthLayout>
    );
};
