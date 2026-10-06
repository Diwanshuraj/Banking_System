import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { AdminLayout, CustomerLayout } from "@/components/app/app-layout";
import { LoadingState } from "@/components/app/data-states";
import { NotFound } from "@/pages/not-found";
import { AuthProvider } from "@/providers/auth-provider";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import "@/styles/globals.css";

// Each page is its own chunk, loaded on first visit.
const AccountDetailPage = lazy(() => import("@/pages/account-detail").then((m) => ({ default: m.AccountDetailPage })));
const AccountsPage = lazy(() => import("@/pages/accounts").then((m) => ({ default: m.AccountsPage })));
const AdminAccountsPage = lazy(() => import("@/pages/admin/accounts").then((m) => ({ default: m.AdminAccountsPage })));
const AdminCustomerDetailPage = lazy(() => import("@/pages/admin/customer-detail").then((m) => ({ default: m.AdminCustomerDetailPage })));
const AdminCustomersPage = lazy(() => import("@/pages/admin/customers").then((m) => ({ default: m.AdminCustomersPage })));
const AdminLoansPage = lazy(() => import("@/pages/admin/loans").then((m) => ({ default: m.AdminLoansPage })));
const AdminOverviewPage = lazy(() => import("@/pages/admin/overview").then((m) => ({ default: m.AdminOverviewPage })));
const AdminServiceRequestsPage = lazy(() => import("@/pages/admin/service-requests").then((m) => ({ default: m.AdminServiceRequestsPage })));
const AdminSettingsPage = lazy(() => import("@/pages/admin/settings").then((m) => ({ default: m.AdminSettingsPage })));
const AdminTransactionsPage = lazy(() => import("@/pages/admin/transactions").then((m) => ({ default: m.AdminTransactionsPage })));
const BeneficiariesPage = lazy(() => import("@/pages/beneficiaries").then((m) => ({ default: m.BeneficiariesPage })));
const BillsPage = lazy(() => import("@/pages/bills").then((m) => ({ default: m.BillsPage })));
const CardsPage = lazy(() => import("@/pages/cards").then((m) => ({ default: m.CardsPage })));
const DashboardPage = lazy(() => import("@/pages/dashboard").then((m) => ({ default: m.DashboardPage })));
const DepositsPage = lazy(() => import("@/pages/deposits").then((m) => ({ default: m.DepositsPage })));
const LoansPage = lazy(() => import("@/pages/loans").then((m) => ({ default: m.LoansPage })));
const LoginPage = lazy(() => import("@/pages/login").then((m) => ({ default: m.LoginPage })));
const NotificationsPage = lazy(() => import("@/pages/notifications").then((m) => ({ default: m.NotificationsPage })));
const ProfilePage = lazy(() => import("@/pages/profile").then((m) => ({ default: m.ProfilePage })));
const RegisterPage = lazy(() => import("@/pages/register").then((m) => ({ default: m.RegisterPage })));
const ServiceRequestsPage = lazy(() => import("@/pages/service-requests").then((m) => ({ default: m.ServiceRequestsPage })));
const TransactionsPage = lazy(() => import("@/pages/transactions").then((m) => ({ default: m.TransactionsPage })));
const TransferPage = lazy(() => import("@/pages/transfer").then((m) => ({ default: m.TransferPage })));

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="light">
            <BrowserRouter>
                <RouteProvider>
                    <ToastProvider>
                        <AuthProvider>
                            <Suspense fallback={<LoadingState className="min-h-dvh" />}>
                                <Routes>
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route path="/register" element={<RegisterPage />} />

                                    <Route element={<CustomerLayout />}>
                                        <Route path="/" element={<DashboardPage />} />
                                        <Route path="/accounts" element={<AccountsPage />} />
                                        <Route path="/accounts/:id" element={<AccountDetailPage />} />
                                        <Route path="/transfer" element={<TransferPage />} />
                                        <Route path="/beneficiaries" element={<BeneficiariesPage />} />
                                        <Route path="/transactions" element={<TransactionsPage />} />
                                        <Route path="/bills" element={<BillsPage />} />
                                        <Route path="/deposits" element={<DepositsPage />} />
                                        <Route path="/loans" element={<LoansPage />} />
                                        <Route path="/cards" element={<CardsPage />} />
                                        <Route path="/services" element={<ServiceRequestsPage />} />
                                        <Route path="/notifications" element={<NotificationsPage />} />
                                        <Route path="/profile" element={<ProfilePage />} />
                                    </Route>

                                    <Route path="/admin" element={<AdminLayout />}>
                                        <Route index element={<AdminOverviewPage />} />
                                        <Route path="customers" element={<AdminCustomersPage />} />
                                        <Route path="customers/:id" element={<AdminCustomerDetailPage />} />
                                        <Route path="accounts" element={<AdminAccountsPage />} />
                                        <Route path="transactions" element={<AdminTransactionsPage />} />
                                        <Route path="loans" element={<AdminLoansPage />} />
                                        <Route path="requests" element={<AdminServiceRequestsPage />} />
                                        <Route path="settings" element={<AdminSettingsPage />} />
                                    </Route>

                                    <Route path="*" element={<NotFound />} />
                                </Routes>
                            </Suspense>
                        </AuthProvider>
                    </ToastProvider>
                </RouteProvider>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>,
);
