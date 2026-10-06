import { useEffect, useState } from "react";
import { Bank, Snowflake01, Sun } from "@untitledui/icons";
import { AppModal, ConfirmModal } from "@/components/app/app-modal";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { errorMessage } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { formatINR, humanize } from "@/lib/format";
import type { Account, CashRequest } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";

type CashType = CashRequest["type"];

interface CashModalProps {
    /** The account to post cash to; the modal is open while this is set. */
    account: Account | null;
    onClose: () => void;
    /** Called after a successful posting so the caller can reload. */
    onDone: () => void;
}

/** Branch counter cash deposit / withdrawal against a customer account. */
export const CashModal = ({ account, onClose, onDone }: CashModalProps) => {
    const toast = useToast();
    const [type, setType] = useState<CashType>("DEPOSIT");
    const [amount, setAmount] = useState("");
    const [remarks, setRemarks] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (account) {
            setType("DEPOSIT");
            setAmount("");
            setRemarks("");
            setErrors({});
            setFormError(undefined);
        }
    }, [account]);

    if (!account) return null;

    const submit = async () => {
        const value = Number(amount);
        const next: Record<string, string> = {};
        if (!amount.trim() || !Number.isFinite(value) || value <= 0) next.amount = "Enter an amount greater than ₹0.";
        else if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) next.amount = "Use at most 2 decimal places.";
        else if (type === "WITHDRAWAL" && value > account.balance) next.amount = `Withdrawal can't exceed the balance of ${formatINR(account.balance)}.`;
        if (remarks.length > 140) next.remarks = "Keep remarks under 140 characters.";
        setErrors(next);
        setFormError(undefined);
        if (Object.keys(next).length) return;

        setIsSubmitting(true);
        try {
            const txn = await api.admin.cash(account.id, { type, amount: value, remarks: remarks.trim() || undefined });
            toast.success(
                type === "DEPOSIT" ? "Cash deposited" : "Cash withdrawn",
                `${formatINR(value)} ${type === "DEPOSIT" ? "credited to" : "debited from"} ${account.accountNumber}. Ref ${txn.referenceId}.`,
            );
            onDone();
            onClose();
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
            setFormError(errorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppModal
            isOpen
            onClose={onClose}
            title="Cash deposit / withdrawal"
            icon={Bank}
            description={
                <>
                    {account.holderName} · {account.accountNumber} · Available balance{" "}
                    <span className="font-semibold text-secondary tabular-nums">{formatINR(account.balance)}</span>
                </>
            }
            footer={
                <>
                    <Button color="secondary" size="lg" onClick={onClose} isDisabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button size="lg" onClick={submit} isLoading={isSubmitting} showTextWhileLoading>
                        {type === "DEPOSIT" ? "Deposit cash" : "Withdraw cash"}
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
                <ButtonGroup
                    size="md"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[type]}
                    onSelectionChange={(keys) => {
                        const key = [...keys][0] as CashType | undefined;
                        if (key) setType(key);
                    }}
                    className="w-full [&>*]:flex-1 [&>*]:justify-center"
                >
                    <ButtonGroupItem id="DEPOSIT">Deposit</ButtonGroupItem>
                    <ButtonGroupItem id="WITHDRAWAL">Withdrawal</ButtonGroupItem>
                </ButtonGroup>

                <Input
                    label="Amount (₹)"
                    isRequired
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(value) => setAmount(value.replace(/[^\d.]/g, ""))}
                    isInvalid={Boolean(errors.amount)}
                    hint={errors.amount ?? (type === "WITHDRAWAL" ? `Up to ${formatINR(account.balance)}` : undefined)}
                    autoFocus
                />
                <TextArea
                    label="Remarks"
                    placeholder="e.g. Counter deposit by self"
                    rows={2}
                    value={remarks}
                    onChange={setRemarks}
                    isInvalid={Boolean(errors.remarks)}
                    hint={errors.remarks}
                />
                {formError && <p className="text-sm text-error-primary">{formError}</p>}
            </form>
        </AppModal>
    );
};

interface FreezeModalProps {
    account: Account | null;
    onClose: () => void;
    onDone: (account: Account) => void;
}

/** Confirms freezing or unfreezing an account. */
export const FreezeModal = ({ account, onClose, onDone }: FreezeModalProps) => {
    const toast = useToast();
    if (!account) return null;
    const freezing = account.status === "ACTIVE";

    const confirm = async () => {
        try {
            const updated = await api.admin.setAccountStatus(account.id, freezing ? "FROZEN" : "ACTIVE");
            toast.success(freezing ? "Account frozen" : "Account unfrozen", `${account.accountNumber} is now ${humanize(updated.status).toLowerCase()}.`);
            onDone(updated);
            onClose();
        } catch (err) {
            toast.error(freezing ? "Couldn't freeze account" : "Couldn't unfreeze account", errorMessage(err));
        }
    };

    return (
        <ConfirmModal
            isOpen
            onClose={onClose}
            onConfirm={confirm}
            destructive={freezing}
            title={freezing ? "Freeze this account?" : "Unfreeze this account?"}
            confirmLabel={freezing ? "Freeze account" : "Unfreeze account"}
            description={
                freezing
                    ? `${account.holderName}'s account ${account.accountNumber} won't be able to send money until it is unfrozen. Incoming credits still post.`
                    : `${account.holderName}'s account ${account.accountNumber} will be able to transact normally again.`
            }
        />
    );
};

export const freezeIcon = (account: Account) => (account.status === "FROZEN" ? Sun : Snowflake01);
