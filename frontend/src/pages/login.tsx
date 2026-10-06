import type { FormEvent } from "react";
import { useState } from "react";
import { AlertCircle, Lock01, ShieldTick, User01 } from "@untitledui/icons";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router";
import { AuthFooter, AuthWordmark } from "@/components/app/auth-shell";
import { LoadingState } from "@/components/app/data-states";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { errorMessage } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

const DEMO_LOGINS = [
    { label: "Customer", username: "priya.v@example.com", password: "Customer@123", note: "PIN 123456" },
    { label: "Administrator", username: "admin@bank.com", password: "Admin@123", note: "Branch console" },
];

const HIGHLIGHTS = [
    { value: "24×7", label: "Access to your accounts" },
    { value: "₹5 lakh", label: "DICGC deposit insurance" },
    { value: "6-digit", label: "PIN on every payment" },
];

const homeFor = (user: User, from?: string) => (user.role === "ROLE_ADMIN" ? "/admin" : from && from !== "/login" ? from : "/");

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

    const fillDemo = (demo: (typeof DEMO_LOGINS)[number]) => {
        setUsername(demo.username);
        setPassword(demo.password);
        setFieldErrors({});
        setFormError(undefined);
    };

    return (
        <div className="flex min-h-dvh bg-primary">
            <aside className="relative hidden w-[52%] flex-col overflow-hidden bg-brand-950 lg:flex">
                <svg aria-hidden="true" className="absolute inset-0 size-full opacity-[0.07]">
                    <defs>
                        <pattern id="login-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                            <path d="M48 0H0v48" fill="none" stroke="white" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#login-grid)" />
                </svg>
                <div aria-hidden="true" className="absolute -right-32 -bottom-32 size-130 rounded-full bg-brand-600/25 blur-3xl" />

                <div className="relative flex flex-1 flex-col justify-between px-12 py-10 xl:px-16">
                    <AuthWordmark tone="light" />

                    <div className="flex max-w-lg flex-col gap-10">
                        <div className="flex flex-col gap-4">
                            <p className="text-sm font-semibold tracking-wider text-brand-300 uppercase">Personal NetBanking</p>
                            <h2 className="text-display-md font-semibold tracking-tight text-white">Your bank, open whenever you need it.</h2>
                            <p className="text-lg text-white/70">Transfer funds, pay bills, open deposits and manage your cards from one secure place.</p>
                        </div>

                        <dl className="grid grid-cols-3 divide-x divide-white/15 border-y border-white/15 py-5">
                            {HIGHLIGHTS.map((item) => (
                                <div key={item.label} className="flex flex-col gap-1 px-5 first:pl-0">
                                    <dt className="order-2 text-sm text-white/60">{item.label}</dt>
                                    <dd className="order-1 text-xl font-semibold text-white">{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    <div className="flex max-w-lg gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10 ring-inset">
                        <ShieldTick className="mt-0.5 size-5 shrink-0 text-brand-300" aria-hidden="true" />
                        <p className="text-sm text-white/70">
                            <span className="font-semibold text-white">Bank staff will never ask for your password, OTP or PIN.</span> Report anything suspicious on the
                            cyber-crime helpline 1930.
                        </p>
                    </div>
                </div>
            </aside>

            <div className="flex flex-1 flex-col">
                <div className="flex items-center justify-between gap-4 px-6 pt-6 md:px-10">
                    <span className="lg:hidden">
                        <AuthWordmark />
                    </span>
                    <p className="ml-auto text-sm text-tertiary">
                        <span className="hidden sm:inline">New customer? </span>
                        <RouterLink to="/register" className="font-semibold text-brand-secondary hover:text-brand-secondary_hover">
                            Open an account
                        </RouterLink>
                    </p>
                </div>

                <main className="flex flex-1 items-center justify-center px-6 py-12 md:px-10">
                    <div className="flex w-full max-w-100 flex-col gap-8">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-display-xs font-semibold text-primary">Log in to NetBanking</h1>
                            <p className="text-md text-tertiary">Enter your registered email address or 11-digit Customer ID.</p>
                        </div>

                        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
                            {formError && (
                                <div role="alert" className="flex gap-3 rounded-lg bg-error-primary p-3 text-sm text-error-primary ring-1 ring-error_subtle ring-inset">
                                    <AlertCircle className="size-5 shrink-0" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            <Input
                                label="Username"
                                placeholder="Email or Customer ID"
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

                            <Button type="submit" size="lg" className="mt-1" isLoading={isSubmitting} showTextWhileLoading>
                                Log in
                            </Button>
                        </form>

                        <div className="flex flex-col gap-3 border-t border-secondary pt-6">
                            <p className="text-xs font-medium text-quaternary">Demo access — select to fill</p>
                            <div className="grid grid-cols-2 gap-2">
                                {DEMO_LOGINS.map((demo) => (
                                    <button
                                        key={demo.username}
                                        type="button"
                                        onClick={() => fillDemo(demo)}
                                        className="flex cursor-pointer flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left ring-1 ring-secondary transition duration-100 ease-linear ring-inset outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                                    >
                                        <span className="text-sm font-medium text-secondary">{demo.label}</span>
                                        <span className="text-xs text-quaternary">{demo.note}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>

                <AuthFooter className="px-6 pb-6 md:px-10" />
            </div>
        </div>
    );
};
