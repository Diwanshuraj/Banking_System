import { Suspense, createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { AppSidebar } from "@/components/app/app-sidebar";
import { LoadingState } from "@/components/app/data-states";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

interface NotificationCountContextType {
    unread: number;
    refreshUnread: () => void;
}

const NotificationCountContext = createContext<NotificationCountContextType>({ unread: 0, refreshUnread: () => {} });

/** Lets pages refresh the sidebar's unread badge after marking notifications read or moving money. */
export const useNotificationCount = () => useContext(NotificationCountContext);

const PageContainer = () => (
    <main className="min-w-0 flex-1 bg-primary lg:pl-70 print:pl-0">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8 lg:py-10">
            <Suspense fallback={<LoadingState />}>
                <Outlet />
            </Suspense>
        </div>
    </main>
);

/** Signed-in customer area. Admins are sent to the admin console. */
export const CustomerLayout = () => {
    const { user, isRestoring } = useAuth();
    const location = useLocation();
    const [unread, setUnread] = useState(0);

    const refreshUnread = useCallback(() => {
        api.notifications
            .list()
            .then((items) => setUnread(items.filter((item) => !item.read).length))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (user?.role === "ROLE_CUSTOMER") refreshUnread();
    }, [user, refreshUnread, location.pathname]);

    if (isRestoring) return <LoadingState label="Restoring your session…" className="min-h-dvh" />;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    if (user.role === "ROLE_ADMIN") return <Navigate to="/admin" replace />;

    return (
        <NotificationCountContext.Provider value={{ unread, refreshUnread }}>
            <div className="flex min-h-dvh flex-col bg-primary lg:flex-row">
                <AppSidebar variant="customer" unread={unread} />
                <PageContainer />
            </div>
        </NotificationCountContext.Provider>
    );
};

export const AdminLayout = () => {
    const { user, isRestoring } = useAuth();
    const location = useLocation();

    if (isRestoring) return <LoadingState label="Restoring your session…" className="min-h-dvh" />;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    if (user.role !== "ROLE_ADMIN") return <Navigate to="/" replace />;

    return (
        <div className="flex min-h-dvh flex-col bg-primary lg:flex-row">
            <AppSidebar variant="admin" />
            <PageContainer />
        </div>
    );
};
