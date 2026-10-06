import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, InfoCircle } from "@untitledui/icons";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { cx } from "@/utils/cx";

type ToastTone = "success" | "error" | "info";

interface Toast {
    id: number;
    tone: ToastTone;
    title: string;
    description?: string;
}

interface ToastContextType {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within a ToastProvider");
    return context;
};

const toneIcon = {
    success: { icon: CheckCircle, color: "success" as const },
    error: { icon: AlertCircle, color: "error" as const },
    info: { icon: InfoCircle, color: "brand" as const },
};

let nextId = 1;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

    const push = useCallback(
        (tone: ToastTone, title: string, description?: string) => {
            const id = nextId++;
            setToasts((current) => [...current.slice(-3), { id, tone, title, description }]);
            setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4500);
        },
        [dismiss],
    );

    const value = useMemo(
        () => ({
            success: (title: string, description?: string) => push("success", title, description),
            error: (title: string, description?: string) => push("error", title, description),
            info: (title: string, description?: string) => push("info", title, description),
        }),
        [push],
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-60 flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role={toast.tone === "error" ? "alert" : "status"}
                        className={cx(
                            "pointer-events-auto flex w-full items-start gap-3 rounded-xl bg-primary_alt p-4 shadow-lg ring-1 ring-secondary_alt sm:w-96",
                            "animate-in duration-200 fade-in slide-in-from-bottom-2",
                        )}
                    >
                        <FeaturedIcon icon={toneIcon[toast.tone].icon} color={toneIcon[toast.tone].color} theme="outline" size="sm" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                            <p className="text-sm font-semibold text-primary">{toast.title}</p>
                            {toast.description && <p className="text-sm text-tertiary">{toast.description}</p>}
                        </div>
                        <CloseButton size="sm" onPress={() => dismiss(toast.id)} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
