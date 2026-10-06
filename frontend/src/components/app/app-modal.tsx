import type { FC, ReactNode } from "react";
import { useState } from "react";
import { AlertTriangle, Lock01 } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { PinInput } from "@/components/base/input/pin-input";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { errorMessage } from "@/hooks/use-api";
import { cx } from "@/utils/cx";

interface AppModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: ReactNode;
    icon?: FC<{ className?: string }>;
    iconColor?: "brand" | "gray" | "success" | "warning" | "error";
    children?: ReactNode;
    /** Footer buttons; defaults to none. */
    footer?: ReactNode;
    /** Tailwind max-width class, e.g. "sm:max-w-lg". */
    widthClassName?: string;
}

/** Standard Untitled UI modal shell: icon, title, body, footer. */
export const AppModal = ({ isOpen, onClose, title, description, icon, iconColor = "brand", children, footer, widthClassName }: AppModalProps) => (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onClose()} isDismissable>
        <Modal className={cx("sm:max-w-md", widthClassName)}>
            <Dialog aria-label={title}>
                <div className="relative w-full">
                    <div className="absolute top-3 right-3">
                        <CloseButton size="md" onPress={onClose} />
                    </div>
                    <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                        {icon && <FeaturedIcon icon={icon} color={iconColor} theme="light" size="lg" />}
                        <div className="flex flex-col gap-1 pr-8">
                            <h2 className="text-lg font-semibold text-primary">{title}</h2>
                            {description && <div className="text-sm text-tertiary">{description}</div>}
                        </div>
                    </div>
                    {children && <div className="px-4 pt-5 sm:px-6">{children}</div>}
                    {footer ? <div className="flex flex-col-reverse gap-3 p-4 pt-6 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">{footer}</div> : <div className="h-6" />}
                </div>
            </Dialog>
        </Modal>
    </ModalOverlay>
);

interface PinModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called with the 6-digit PIN; throw to show the error inside the modal. */
    onConfirm: (pin: string) => Promise<void>;
    title?: string;
    /** Summary of what is being authorised, e.g. amount and payee. */
    summary?: ReactNode;
    confirmLabel?: string;
}

/** Asks for the 6-digit transaction PIN before any money movement. */
export const PinModal = ({ isOpen, onClose, onConfirm, title = "Authorise with transaction PIN", summary, confirmLabel = "Confirm" }: PinModalProps) => {
    const [pin, setPin] = useState("");
    const [error, setError] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const close = () => {
        setPin("");
        setError(undefined);
        onClose();
    };

    const submit = async () => {
        if (pin.length !== 6) {
            setError("Enter all 6 digits of your transaction PIN.");
            return;
        }
        setIsSubmitting(true);
        setError(undefined);
        try {
            await onConfirm(pin);
            setPin("");
        } catch (err) {
            setError(errorMessage(err));
            setPin("");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppModal
            isOpen={isOpen}
            onClose={close}
            title={title}
            icon={Lock01}
            description="Enter the 6-digit PIN you set under Profile & security. Never share it with anyone, including bank staff."
            footer={
                <>
                    <Button color="secondary" size="lg" onClick={close} isDisabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button size="lg" onClick={submit} isLoading={isSubmitting} showTextWhileLoading>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                {summary && <div className="rounded-lg bg-secondary p-4 text-sm text-secondary">{summary}</div>}
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <PinInput size="xs" invalid={Boolean(error)} disabled={isSubmitting}>
                        <PinInput.Label>Transaction PIN</PinInput.Label>
                        <PinInput.Group maxLength={6} value={pin} onChange={setPin} autoFocus inputMode="numeric" pattern="^[0-9]*$" type="password">
                            {[0, 1, 2, 3, 4, 5].map((index) => (
                                <PinInput.Slot key={index} index={index} />
                            ))}
                        </PinInput.Group>
                        {error && <p className="text-sm text-error-primary">{error}</p>}
                    </PinInput>
                </form>
            </div>
        </AppModal>
    );
};

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    title: string;
    description: ReactNode;
    confirmLabel?: string;
    destructive?: boolean;
    children?: ReactNode;
}

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, description, confirmLabel = "Confirm", destructive, children }: ConfirmModalProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const confirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            description={description}
            icon={AlertTriangle}
            iconColor={destructive ? "error" : "warning"}
            footer={
                <>
                    <Button color="secondary" size="lg" onClick={onClose} isDisabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button color={destructive ? "primary-destructive" : "primary"} size="lg" onClick={confirm} isLoading={isSubmitting} showTextWhileLoading>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {children}
        </AppModal>
    );
};
