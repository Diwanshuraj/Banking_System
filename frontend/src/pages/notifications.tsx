import type { FC } from "react";
import { useState } from "react";
import { Bell01, CheckDone01, CoinsStacked01, Receipt, ShieldTick, Wallet02 } from "@untitledui/icons";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader } from "@/components/app/page-header";
import { useNotificationCount } from "@/components/app/app-layout";
import { Tabs } from "@/components/application/tabs/tabs";
import { Button } from "@/components/base/buttons/button";
import { errorMessage, useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Notification, NotificationCategory } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

type TabKey = "ALL" | Exclude<NotificationCategory, "GENERAL">;

const TABS: { id: TabKey; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "TRANSACTION", label: "Transactions" },
    { id: "SECURITY", label: "Security" },
    { id: "ACCOUNT", label: "Account" },
    { id: "LOAN", label: "Loans" },
];

const CATEGORY_STYLE: Record<NotificationCategory, { icon: FC<{ className?: string }>; className: string; label: string }> = {
    TRANSACTION: { icon: Receipt, className: "bg-brand-secondary text-fg-brand-primary", label: "Transaction" },
    SECURITY: { icon: ShieldTick, className: "bg-error-secondary text-fg-error-primary", label: "Security" },
    ACCOUNT: { icon: Wallet02, className: "bg-success-secondary text-fg-success-primary", label: "Account" },
    LOAN: { icon: CoinsStacked01, className: "bg-warning-secondary text-fg-warning-primary", label: "Loan" },
    GENERAL: { icon: Bell01, className: "bg-secondary text-fg-quaternary", label: "General" },
};

const dayKey = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return "Earlier";
};

const groupByDay = (items: Notification[]) => {
    const groups: { label: string; items: Notification[] }[] = [];
    items.forEach((item) => {
        const label = dayKey(item.createdAt);
        const group = groups.find((entry) => entry.label === label);
        if (group) group.items.push(item);
        else groups.push({ label, items: [item] });
    });
    return groups;
};

const NotificationRow = ({ item, onRead }: { item: Notification; onRead: (item: Notification) => void }) => {
    const { icon: Icon, className, label } = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.GENERAL;
    return (
        <li>
            <button
                type="button"
                onClick={() => onRead(item)}
                className={cx(
                    "flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2 md:gap-4 md:px-6",
                    !item.read && "bg-brand-primary_alt/50",
                )}
                aria-label={`${item.read ? "" : "Unread: "}${item.title}`}
            >
                <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-full", className)}>
                    <Icon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-3">
                        <p className={cx("text-sm text-primary", item.read ? "font-medium" : "font-semibold")}>{item.title}</p>
                        <div className="flex shrink-0 items-center gap-2">
                            <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)} className="text-xs whitespace-nowrap text-tertiary">
                                {formatRelative(item.createdAt)}
                            </time>
                            <span
                                aria-hidden="true"
                                className={cx("size-2 rounded-full", item.read ? "bg-transparent" : "bg-brand-solid")}
                            />
                        </div>
                    </div>
                    <p className="text-sm text-tertiary">{item.message}</p>
                    <span className="text-xs font-medium text-quaternary">{label}</span>
                </div>
            </button>
        </li>
    );
};

export const NotificationsPage = () => {
    const toast = useToast();
    const { refreshUnread } = useNotificationCount();
    const { data, error, isLoading, reload, setData } = useApi(() => api.notifications.list(), []);
    const [tab, setTab] = useState<TabKey>("ALL");
    const [isMarkingAll, setIsMarkingAll] = useState(false);

    const all = [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const unreadCount = all.filter((item) => !item.read).length;
    const visible = tab === "ALL" ? all : all.filter((item) => item.category === tab);
    const unreadIn = (key: TabKey) => all.filter((item) => !item.read && (key === "ALL" || item.category === key)).length;

    const markRead = async (item: Notification) => {
        if (item.read || !data) return;
        setData(data.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
        try {
            await api.notifications.markRead(item.id);
            refreshUnread();
        } catch (err) {
            setData(data);
            toast.error("Couldn't update notification", errorMessage(err));
        }
    };

    const markAllRead = async () => {
        if (!data) return;
        setIsMarkingAll(true);
        try {
            await api.notifications.markAllRead();
            setData(data.map((entry) => ({ ...entry, read: true })));
            refreshUnread();
            toast.success("All caught up", "Every notification is marked as read.");
        } catch (err) {
            toast.error("Couldn't mark notifications as read", errorMessage(err));
        } finally {
            setIsMarkingAll(false);
        }
    };

    return (
        <>
            <PageHeader
                title="Notifications"
                description={data ? (unreadCount > 0 ? `You have ${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}.` : "You're all caught up.") : "Alerts about your transactions, security and accounts."}
                actions={
                    <Button color="secondary" size="md" iconLeading={CheckDone01} onClick={markAllRead} isLoading={isMarkingAll} showTextWhileLoading isDisabled={unreadCount === 0}>
                        Mark all as read
                    </Button>
                }
            />

            <section className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
                <div className="overflow-x-auto border-b border-secondary px-4 pt-4 md:px-6">
                    <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key as TabKey)}>
                        <Tabs.List type="underline" size="sm" aria-label="Notification categories" className="w-max min-w-full before:hidden">
                            {TABS.map((item) => {
                                const count = data ? unreadIn(item.id) : 0;
                                return <Tabs.Item key={item.id} id={item.id} label={item.label} badge={count > 0 ? count : undefined} />;
                            })}
                        </Tabs.List>
                    </Tabs>
                </div>

                {!data ? (
                    error ? (
                        <ErrorState message={error.message} onRetry={reload} />
                    ) : isLoading ? (
                        <LoadingState label="Loading notifications…" />
                    ) : null
                ) : visible.length === 0 ? (
                    <EmptyPanel
                        icon={Bell01}
                        title="No notifications"
                        description={tab === "ALL" ? "We'll let you know when something happens on your accounts." : "Nothing in this category yet."}
                    />
                ) : (
                    <div className="flex flex-col">
                        {groupByDay(visible).map((group) => (
                            <div key={group.label}>
                                <h3 className="border-b border-secondary bg-secondary_alt px-4 py-2 text-xs font-semibold text-tertiary md:px-6">{group.label}</h3>
                                <ul className="divide-y divide-secondary">
                                    {group.items.map((item) => (
                                        <NotificationRow key={item.id} item={item} onRead={markRead} />
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </>
    );
};
