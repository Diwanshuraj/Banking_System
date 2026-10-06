import { useState } from "react";
import { Coins01, RefreshCcw01, Save01, Settings01 } from "@untitledui/icons";
import { ConfirmModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { errorMessage, useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { formatINR, humanize } from "@/lib/format";
import type { Setting } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

const isBoolean = (value: string) => value === "true" || value === "false";
const NUMERIC = /^-?\d+(\.\d+)?$/;
const isNumeric = (value: string) => NUMERIC.test(value.trim());

/** Unit hint for well-known keys. */
const unitFor = (key: string) => {
    if (/RATE|PCT|PERCENT/i.test(key)) return "%";
    if (/LIMIT|AMOUNT|BALANCE|FEE/i.test(key)) return "₹";
    return undefined;
};

export const AdminSettingsPage = () => {
    const toast = useToast();
    const settings = useApi(() => api.admin.settings(), []);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [savingKey, setSavingKey] = useState<string>();
    const [isInterestOpen, setIsInterestOpen] = useState(false);

    const list = settings.data ?? [];
    const changedKeys = list.filter((s) => drafts[s.key] !== undefined && drafts[s.key] !== s.value).map((s) => s.key);

    const setDraft = (key: string, value: string) => {
        setDrafts((d) => ({ ...d, [key]: value }));
        setErrors((e) => {
            const next = { ...e };
            delete next[key];
            return next;
        });
    };

    const validate = (setting: Setting, value: string) => {
        if (!value.trim()) return "A value is required.";
        if (isNumeric(setting.value) && !isNumeric(value)) return "Enter a valid number.";
        if (isNumeric(setting.value) && Number(value) < 0) return "Value cannot be negative.";
        return undefined;
    };

    const saveKeys = async (keys: string[]) => {
        const nextErrors: Record<string, string> = {};
        for (const key of keys) {
            const setting = list.find((s) => s.key === key)!;
            const error = validate(setting, drafts[key]);
            if (error) nextErrors[key] = error;
        }
        if (Object.keys(nextErrors).length) {
            setErrors((e) => ({ ...e, ...nextErrors }));
            return;
        }

        const results = await Promise.allSettled(keys.map((key) => api.admin.updateSetting(key, drafts[key].trim())));
        const saved: Setting[] = [];
        const failed: Record<string, string> = {};
        results.forEach((result, index) => {
            const key = keys[index];
            if (result.status === "fulfilled") saved.push(result.value ?? { ...list.find((s) => s.key === key)!, value: drafts[key].trim() });
            else {
                const err = result.reason;
                failed[key] = err instanceof ApiError ? (err.fieldErrors?.value ?? err.message) : errorMessage(err);
            }
        });

        if (saved.length) {
            settings.setData(list.map((s) => saved.find((u) => u.key === s.key) ?? s));
            setDrafts((d) => {
                const next = { ...d };
                saved.forEach((s) => delete next[s.key]);
                return next;
            });
        }
        setErrors((e) => ({ ...e, ...failed }));

        if (Object.keys(failed).length === 0) {
            toast.success(saved.length === 1 ? "Setting saved" : "Settings saved", saved.map((s) => humanize(s.key)).join(", "));
        } else {
            toast.error("Some settings weren't saved", `${Object.keys(failed).length} of ${keys.length} failed. See the highlighted fields.`);
        }
    };

    const saveAll = async () => {
        setIsSaving(true);
        try {
            await saveKeys(changedKeys);
        } finally {
            setIsSaving(false);
        }
    };

    const saveOne = async (key: string) => {
        setSavingKey(key);
        try {
            await saveKeys([key]);
        } finally {
            setSavingKey(undefined);
        }
    };

    const creditInterest = async () => {
        try {
            const result = await api.admin.creditInterest();
            toast.success("Savings interest credited", `${result.accounts} ${result.accounts === 1 ? "account" : "accounts"} credited a total of ${formatINR(result.total)}.`);
            setIsInterestOpen(false);
        } catch (err) {
            toast.error("Couldn't credit interest", errorMessage(err));
        }
    };

    const savingsRate = list.find((s) => s.key === "SAVINGS_INTEREST_RATE")?.value;

    return (
        <>
            <PageHeader title="System settings" description="Limits, security policies and bank-wide operations." />

            <SectionCard
                title="Configuration"
                description="Changes apply immediately to all customers."
                actions={
                    list.length > 0 && (
                        <>
                            {changedKeys.length > 0 && (
                                <Button
                                    color="secondary"
                                    size="sm"
                                    iconLeading={RefreshCcw01}
                                    onClick={() => {
                                        setDrafts({});
                                        setErrors({});
                                    }}
                                    isDisabled={isSaving}
                                >
                                    Discard
                                </Button>
                            )}
                            <Button size="sm" iconLeading={Save01} onClick={saveAll} isDisabled={changedKeys.length === 0} isLoading={isSaving} showTextWhileLoading>
                                {changedKeys.length > 0 ? `Save changes (${changedKeys.length})` : "Save changes"}
                            </Button>
                        </>
                    )
                }
                flush
            >
                {settings.isLoading && !settings.data ? (
                    <LoadingState label="Loading settings…" />
                ) : settings.error && !settings.data ? (
                    <ErrorState message={settings.error.message} onRetry={settings.reload} />
                ) : list.length === 0 ? (
                    <EmptyPanel icon={Settings01} title="No settings found" description="The backend hasn't published any configurable settings." />
                ) : (
                    <ul className="divide-y divide-secondary">
                        {list.map((setting) => {
                            const value = drafts[setting.key] ?? setting.value;
                            const changed = drafts[setting.key] !== undefined && drafts[setting.key] !== setting.value;
                            const boolean = isBoolean(setting.value);
                            const numeric = !boolean && isNumeric(setting.value);
                            const unit = numeric ? unitFor(setting.key) : undefined;
                            const error = errors[setting.key];

                            return (
                                <li
                                    key={setting.key}
                                    className={cx(
                                        "grid grid-cols-1 gap-4 px-4 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-center md:gap-8 md:px-6",
                                        changed && "bg-secondary_alt",
                                    )}
                                >
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-primary">{humanize(setting.key)}</p>
                                            {changed && (
                                                <Badge size="sm" type="pill-color" color="brand">
                                                    Unsaved
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-tertiary">{setting.description}</p>
                                        <code className="text-xs text-quaternary">{setting.key}</code>
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            {boolean ? (
                                                <Toggle
                                                    size="md"
                                                    isSelected={value === "true"}
                                                    onChange={(selected) => setDraft(setting.key, String(selected))}
                                                    label={value === "true" ? "Enabled" : "Disabled"}
                                                    aria-label={humanize(setting.key)}
                                                />
                                            ) : (
                                                <Input
                                                    aria-label={humanize(setting.key)}
                                                    size="sm"
                                                    value={value}
                                                    inputMode={numeric ? "decimal" : undefined}
                                                    onChange={(next) => setDraft(setting.key, next)}
                                                    isInvalid={Boolean(error)}
                                                    hint={error ?? (unit ? (unit === "%" ? "Percent per annum" : "Amount in rupees") : undefined)}
                                                    inputClassName="tabular-nums"
                                                />
                                            )}
                                            {boolean && error && <p className="mt-1.5 text-sm text-error-primary">{error}</p>}
                                        </div>
                                        <Button
                                            size="sm"
                                            color="secondary"
                                            onClick={() => saveOne(setting.key)}
                                            isDisabled={!changed || isSaving}
                                            isLoading={savingKey === setting.key}
                                            className={cx(!changed && "invisible")}
                                        >
                                            Save
                                        </Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </SectionCard>

            <SectionCard title="Operations" description="Bank-wide batch jobs. Each run is recorded in the transaction ledger.">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-primary">Credit savings interest for this month</p>
                        <p className="text-sm text-tertiary">
                            Credits monthly interest{savingsRate ? ` at ${savingsRate}% p.a.` : ""} to every active savings account based on its balance.
                        </p>
                    </div>
                    <Button color="secondary" iconLeading={Coins01} onClick={() => setIsInterestOpen(true)} className="shrink-0">
                        Credit interest
                    </Button>
                </div>
            </SectionCard>

            <ConfirmModal
                isOpen={isInterestOpen}
                onClose={() => setIsInterestOpen(false)}
                onConfirm={creditInterest}
                title="Credit savings interest?"
                description="This posts an interest credit to every active savings account for the current month. Run it only once per month — the credits cannot be reversed from here."
                confirmLabel="Credit interest"
            />
        </>
    );
};
