import { useState } from "react";
import { AlertOctagon, CreditCard02, Globe01, Lock01, LockUnlocked01, Monitor01, ShoppingCart01, Wifi } from "@untitledui/icons";
import { Link } from "react-router";
import { ConfirmModal } from "@/components/app/app-modal";
import { BankMark } from "@/components/app/bank-logo";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/base/buttons/button";
import { Slider } from "@/components/base/slider/slider";
import { Toggle } from "@/components/base/toggle/toggle";
import { MastercardIcon, RuPayIcon, VisaIcon } from "@/components/foundations/payment-icons";
import { errorMessage, useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatINR, formatINRShort, maskAccount } from "@/lib/format";
import type { Card, CardControlsRequest } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

const networkIcon = { RUPAY: RuPayIcon, VISA: VisaIcon, MASTERCARD: MastercardIcon };

const controlsOf = (card: Card): CardControlsRequest => ({
    onlineEnabled: card.onlineEnabled,
    internationalEnabled: card.internationalEnabled,
    contactlessEnabled: card.contactlessEnabled,
    atmEnabled: card.atmEnabled,
    atmLimit: card.atmLimit,
    posLimit: card.posLimit,
    onlineLimit: card.onlineLimit,
});

/** Physical-card style visual. Uses fixed card colours like a real card; greyed out when not usable. */
const CardVisual = ({ card }: { card: Card }) => {
    const Network = networkIcon[card.network];
    const inactive = card.status !== "ACTIVE";
    return (
        <div
            className={cx(
                "relative flex aspect-[1.586] w-full max-w-sm flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br from-brand-700 to-brand-950 p-5 text-white shadow-lg select-none",
                inactive && "opacity-60 grayscale",
            )}
            aria-label={`${card.network} ${card.variant} debit card ending ${card.last4}`}
        >
            <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-white/5" />
            <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <BankMark className="size-7" />
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs font-semibold">Bharat National Bank</span>
                        <span className="text-[10px] tracking-wide text-white/70 uppercase">{card.variant} debit</span>
                    </div>
                </div>
                <Wifi className="size-5 rotate-90 text-white/80" aria-hidden="true" />
            </div>

            <div className="relative flex flex-col gap-3">
                <div className="h-7 w-10 rounded-md bg-linear-to-br from-yellow-200 to-yellow-500 opacity-90" aria-hidden="true" />
                <span className="font-mono text-lg tracking-widest tabular-nums sm:text-xl">{card.maskedNumber}</span>
            </div>

            <div className="relative flex items-end justify-between gap-3">
                <div className="flex min-w-0 gap-5">
                    <div className="flex min-w-0 flex-col">
                        <span className="text-[10px] text-white/70 uppercase">Card holder</span>
                        <span className="truncate text-sm font-medium uppercase">{card.cardHolder}</span>
                    </div>
                    <div className="flex shrink-0 flex-col">
                        <span className="text-[10px] text-white/70 uppercase">Valid thru</span>
                        <span className="text-sm font-medium tabular-nums">{card.expiry}</span>
                    </div>
                </div>
                <Network className="h-7 w-auto shrink-0" />
            </div>

            {card.status !== "ACTIVE" && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                        {card.status === "HOTLISTED" ? "Hotlisted" : "Temporarily blocked"}
                    </span>
                </div>
            )}
        </div>
    );
};

const LimitSlider = ({ label, icon: Icon, value, max, onChange, isDisabled, hint }: { label: string; icon: typeof Monitor01; value: number; max: number; onChange: (value: number) => void; isDisabled?: boolean; hint?: string }) => (
    <div className={cx("flex flex-col gap-2", isDisabled && "opacity-60")}>
        <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-secondary">
                <Icon className="size-4 text-fg-quaternary" />
                {label}
            </span>
            <span className="text-sm font-semibold text-primary tabular-nums">{formatINR(value)}</span>
        </div>
        <div className="px-3">
            <Slider aria-label={label} minValue={0} maxValue={max} step={1000} value={value} onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)} isDisabled={isDisabled} />
        </div>
        <div className="flex justify-between text-xs text-tertiary tabular-nums">
            <span>{hint ?? "₹0"}</span>
            <span>{formatINRShort(max)}</span>
        </div>
    </div>
);

const CardPanel = ({ card, onUpdated }: { card: Card; onUpdated: (card: Card) => void }) => {
    const toast = useToast();
    const [draft, setDraft] = useState<CardControlsRequest>(() => controlsOf(card));
    const [savedFor, setSavedFor] = useState(card);
    const [isSaving, setIsSaving] = useState(false);
    const [confirm, setConfirm] = useState<"block" | "unblock" | "hotlist" | null>(null);

    // Re-sync the draft whenever the server copy changes.
    if (savedFor !== card) {
        setSavedFor(card);
        setDraft(controlsOf(card));
    }

    const readOnly = card.status === "HOTLISTED";
    const original = controlsOf(card);
    const isDirty = (Object.keys(original) as (keyof CardControlsRequest)[]).some((key) => original[key] !== draft[key]);

    const set = <K extends keyof CardControlsRequest>(key: K, value: CardControlsRequest[K]) => setDraft((current) => ({ ...current, [key]: value }));

    const save = async () => {
        setIsSaving(true);
        try {
            const updated = await api.cards.updateControls(card.id, draft);
            onUpdated(updated);
            toast.success("Card settings saved", `Changes to card ending ${card.last4} are effective immediately.`);
        } catch (err) {
            toast.error("Couldn't save card settings", errorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    const runAction = async () => {
        if (!confirm) return;
        try {
            const updated = confirm === "block" ? await api.cards.block(card.id) : confirm === "unblock" ? await api.cards.unblock(card.id) : await api.cards.hotlist(card.id);
            onUpdated(updated);
            setConfirm(null);
            if (confirm === "block") toast.success("Card blocked", `Card ending ${card.last4} is temporarily blocked. Unblock it any time.`);
            if (confirm === "unblock") toast.success("Card unblocked", `Card ending ${card.last4} is active again.`);
            if (confirm === "hotlist") toast.success("Card hotlisted", "The card is permanently blocked. Raise a reissue request to get a new card.");
        } catch (err) {
            toast.error("Action failed", errorMessage(err));
        }
    };

    const toggles: { key: "onlineEnabled" | "internationalEnabled" | "contactlessEnabled" | "atmEnabled"; label: string; hint: string; icon: typeof Globe01 }[] = [
        { key: "onlineEnabled", label: "Online transactions", hint: "E-commerce and in-app payments", icon: ShoppingCart01 },
        { key: "internationalEnabled", label: "International usage", hint: "Payments and withdrawals outside India", icon: Globe01 },
        { key: "contactlessEnabled", label: "Contactless (tap & pay)", hint: "Tap payments up to ₹5,000 without PIN", icon: Wifi },
        { key: "atmEnabled", label: "ATM withdrawals", hint: "Cash withdrawals at any ATM", icon: Monitor01 },
    ];

    return (
        <section className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
            <div className="flex flex-col gap-3 border-b border-secondary px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-md font-semibold text-primary">
                            {card.variant} debit card ·· {card.last4}
                        </h2>
                        <StatusBadge status={card.status} />
                    </div>
                    <p className="text-sm text-tertiary">Linked to account {maskAccount(card.accountNumber)}</p>
                </div>
                {!readOnly && (
                    <div className="flex flex-wrap gap-2">
                        {card.status === "ACTIVE" ? (
                            <Button color="secondary" size="sm" iconLeading={Lock01} onClick={() => setConfirm("block")}>
                                Block temporarily
                            </Button>
                        ) : (
                            <Button color="secondary" size="sm" iconLeading={LockUnlocked01} onClick={() => setConfirm("unblock")}>
                                Unblock
                            </Button>
                        )}
                        <Button color="secondary-destructive" size="sm" iconLeading={AlertOctagon} onClick={() => setConfirm("hotlist")}>
                            Report lost/stolen
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-8 p-4 md:p-6 xl:grid-cols-5">
                <div className="flex flex-col items-center gap-4 xl:col-span-2 xl:items-start">
                    <CardVisual card={card} />
                    {readOnly ? (
                        <p className="max-w-sm text-sm text-tertiary">
                            This card was reported lost or stolen and is permanently blocked. Raise a <Link to="/services" className="font-semibold text-brand-secondary hover:underline">debit card reissue</Link> request to get a replacement.
                        </p>
                    ) : card.status === "BLOCKED" ? (
                        <p className="max-w-sm text-sm text-tertiary">All transactions are declined while the card is blocked. Your settings below are kept for when you unblock it.</p>
                    ) : null}
                </div>

                <div className="flex min-w-0 flex-col gap-6 xl:col-span-3">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold text-primary">Usage controls</h3>
                        <p className="text-sm text-tertiary">Switch off channels you don't use to reduce fraud risk.</p>
                    </div>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {toggles.map(({ key, label, hint, icon: Icon }) => (
                            <li key={key} className="flex items-start justify-between gap-3 rounded-lg p-3 ring-1 ring-secondary ring-inset">
                                <div className="flex min-w-0 items-start gap-3">
                                    <Icon className="mt-0.5 size-5 shrink-0 text-fg-quaternary" />
                                    <div className="flex min-w-0 flex-col">
                                        <span className="text-sm font-medium text-secondary">{label}</span>
                                        <span className="text-xs text-tertiary">{hint}</span>
                                    </div>
                                </div>
                                <Toggle aria-label={label} size="sm" isSelected={draft[key]} onChange={(value) => set(key, value)} isDisabled={readOnly} />
                            </li>
                        ))}
                    </ul>

                    <div className="flex flex-col gap-1 pt-2">
                        <h3 className="text-sm font-semibold text-primary">Daily limits</h3>
                        <p className="text-sm text-tertiary">Set each limit anywhere up to {formatINR(card.maxLimit)}.</p>
                    </div>
                    <div className="flex flex-col gap-6">
                        <LimitSlider label="ATM withdrawal" icon={Monitor01} value={draft.atmLimit} max={card.maxLimit} onChange={(value) => set("atmLimit", value)} isDisabled={readOnly || !draft.atmEnabled} hint={!draft.atmEnabled ? "ATM usage is off" : undefined} />
                        <LimitSlider label="POS / in-store" icon={CreditCard02} value={draft.posLimit} max={card.maxLimit} onChange={(value) => set("posLimit", value)} isDisabled={readOnly} />
                        <LimitSlider label="Online" icon={ShoppingCart01} value={draft.onlineLimit} max={card.maxLimit} onChange={(value) => set("onlineLimit", value)} isDisabled={readOnly || !draft.onlineEnabled} hint={!draft.onlineEnabled ? "Online usage is off" : undefined} />
                    </div>

                    {!readOnly && (
                        <div className="flex flex-col-reverse gap-3 border-t border-secondary pt-5 sm:flex-row sm:justify-end">
                            <Button color="secondary" onClick={() => setDraft(original)} isDisabled={!isDirty || isSaving}>
                                Discard
                            </Button>
                            <Button onClick={save} isDisabled={!isDirty} isLoading={isSaving} showTextWhileLoading>
                                Save changes
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirm === "block" || confirm === "unblock"}
                onClose={() => setConfirm(null)}
                onConfirm={runAction}
                title={confirm === "unblock" ? "Unblock this card?" : "Block this card temporarily?"}
                confirmLabel={confirm === "unblock" ? "Unblock card" : "Block card"}
                description={
                    confirm === "unblock"
                        ? `Card ending ${card.last4} will work again with your saved usage controls and limits.`
                        : `All transactions on card ending ${card.last4} will be declined until you unblock it. Use this if you've misplaced the card.`
                }
            />
            <ConfirmModal
                isOpen={confirm === "hotlist"}
                onClose={() => setConfirm(null)}
                onConfirm={runAction}
                destructive
                title="Report card lost or stolen?"
                confirmLabel="Hotlist card permanently"
                description={
                    <>
                        Card ending <span className="font-semibold text-secondary">{card.last4}</span> will be <span className="font-semibold text-secondary">permanently blocked</span>. This can't be undone — you'll need to request a replacement card.
                    </>
                }
            />
        </section>
    );
};

export const CardsPage = () => {
    const { data, error, isLoading, reload, setData } = useApi(() => api.cards.list(), []);

    return (
        <>
            <PageHeader title="Debit cards" description="Control where and how your cards work, set limits, and block a card instantly." />

            {isLoading && !data ? (
                <LoadingState label="Loading your cards…" />
            ) : error && !data ? (
                <ErrorState message={error.message} onRetry={reload} />
            ) : !data || data.length === 0 ? (
                <SectionCard>
                    <EmptyPanel
                        icon={CreditCard02}
                        title="No debit cards"
                        description="You don't have a debit card yet. Request one from Service requests."
                        action={<Button href="/services">Go to service requests</Button>}
                    />
                </SectionCard>
            ) : (
                <div className="flex flex-col gap-6">
                    {data.map((card) => (
                        <CardPanel key={card.id} card={card} onUpdated={(updated) => setData(data.map((item) => (item.id === updated.id ? updated : item)))} />
                    ))}
                </div>
            )}
        </>
    );
};
