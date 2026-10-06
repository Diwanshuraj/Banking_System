import type {
    Account,
    AdminCreateCustomerRequest,
    AdminMetrics,
    AdminUserDetail,
    ApiErrorBody,
    AuthResponse,
    Beneficiary,
    BeneficiaryRequest,
    BillPayment,
    BillPaymentRequest,
    BillerCategory,
    Card,
    CardControlsRequest,
    CashRequest,
    ChangePasswordRequest,
    Dashboard,
    FdRate,
    FixedDeposit,
    Loan,
    LoanApplicationRequest,
    LoanDecisionRequest,
    LoanProduct,
    LoanRepayRequest,
    LoanStatus,
    LoginRequest,
    Notification,
    OpenAccountRequest,
    OpenFdRequest,
    Page,
    ProfileUpdateRequest,
    RegisterRequest,
    ServiceRequest,
    ServiceRequestCreate,
    ServiceRequestStatus,
    ServiceRequestUpdate,
    SetPinRequest,
    Setting,
    Transaction,
    TransactionQuery,
    TransferLimits,
    TransferReceipt,
    TransferRequest,
    UpiLookup,
    User,
    UserStatus,
} from "@/lib/types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "bnb.token";

export const tokenStore = {
    get: () => {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch {
            return null;
        }
    },
    set: (token: string) => {
        try {
            localStorage.setItem(TOKEN_KEY, token);
        } catch {
            /* storage unavailable */
        }
    },
    clear: () => {
        try {
            localStorage.removeItem(TOKEN_KEY);
        } catch {
            /* storage unavailable */
        }
    },
};

export class ApiError extends Error {
    status: number;
    fieldErrors?: Record<string, string>;

    constructor(body: ApiErrorBody) {
        super(body.message);
        this.status = body.status;
        this.fieldErrors = body.errors;
    }
}

/** Called when the backend rejects the session so the auth provider can sign the user out. */
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (handler: () => void) => {
    onUnauthorized = handler;
};

type Params = Record<string, string | number | boolean | undefined | null>;

const buildQuery = (params?: Params) => {
    if (!params) return "";
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
    });
    const qs = search.toString();
    return qs ? `?${qs}` : "";
};

async function request<T>(method: string, path: string, body?: unknown, params?: Params): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
        response = await fetch(BASE_URL + path + buildQuery(params), {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new ApiError({ status: 0, message: "Cannot reach the bank server. Check that the backend is running on port 8080." });
    }

    if (response.status === 401 && token) onUnauthorized();

    if (!response.ok) {
        let errorBody: ApiErrorBody = { status: response.status, message: response.statusText || "Request failed" };
        try {
            errorBody = { ...errorBody, ...(await response.json()) };
        } catch {
            /* non-JSON error */
        }
        throw new ApiError(errorBody);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
}

const get = <T>(path: string, params?: Params) => request<T>("GET", path, undefined, params);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
const put = <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {});
const patch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {});
const del = <T>(path: string) => request<T>("DELETE", path);

/** Downloads a file from an authenticated endpoint. */
async function download(path: string, params: Params, filename: string) {
    const token = tokenStore.get();
    const response = await fetch(BASE_URL + path + buildQuery(params), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new ApiError({ status: response.status, message: "Download failed" });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export const api = {
    auth: {
        login: (body: LoginRequest) => post<AuthResponse>("/auth/login", body),
        register: (body: RegisterRequest) => post<AuthResponse>("/auth/register", body),
        me: () => get<User>("/auth/me"),
    },

    dashboard: () => get<Dashboard>("/dashboard"),

    accounts: {
        list: () => get<Account[]>("/accounts"),
        get: (id: number) => get<Account>(`/accounts/${id}`),
        open: (body: OpenAccountRequest) => post<Account>("/accounts", body),
        downloadStatement: (id: number, from: string, to: string) =>
            download(`/accounts/${id}/statement.csv`, { from, to }, `statement-${id}-${from}-to-${to}.csv`),
    },

    transactions: {
        list: (query: TransactionQuery) => get<Page<Transaction>>("/transactions", { ...query }),
    },

    beneficiaries: {
        list: () => get<Beneficiary[]>("/beneficiaries"),
        create: (body: BeneficiaryRequest) => post<Beneficiary>("/beneficiaries", body),
        remove: (id: number) => del<void>(`/beneficiaries/${id}`),
    },

    transfers: {
        create: (body: TransferRequest) => post<TransferReceipt>("/transfers", body),
        limits: () => get<TransferLimits>("/transfers/limits"),
        lookupUpi: (upiId: string) => get<UpiLookup>("/transfers/upi/lookup", { upiId }),
    },

    deposits: {
        list: () => get<FixedDeposit[]>("/fixed-deposits"),
        rates: () => get<FdRate[]>("/fixed-deposits/rates"),
        open: (body: OpenFdRequest) => post<FixedDeposit>("/fixed-deposits", body),
        close: (id: number, pin: string) => post<FixedDeposit>(`/fixed-deposits/${id}/close`, { pin }),
    },

    loans: {
        list: () => get<Loan[]>("/loans"),
        products: () => get<LoanProduct[]>("/loans/products"),
        apply: (body: LoanApplicationRequest) => post<Loan>("/loans", body),
        repay: (id: number, body: LoanRepayRequest) => post<Loan>(`/loans/${id}/repay`, body),
    },

    cards: {
        list: () => get<Card[]>("/cards"),
        updateControls: (id: number, body: CardControlsRequest) => put<Card>(`/cards/${id}/controls`, body),
        block: (id: number) => post<Card>(`/cards/${id}/block`),
        unblock: (id: number) => post<Card>(`/cards/${id}/unblock`),
        hotlist: (id: number) => post<Card>(`/cards/${id}/hotlist`),
    },

    bills: {
        billers: () => get<BillerCategory[]>("/bills/billers"),
        pay: (body: BillPaymentRequest) => post<BillPayment>("/bills/pay", body),
        history: () => get<BillPayment[]>("/bills/history"),
    },

    serviceRequests: {
        list: () => get<ServiceRequest[]>("/service-requests"),
        create: (body: ServiceRequestCreate) => post<ServiceRequest>("/service-requests", body),
    },

    notifications: {
        list: () => get<Notification[]>("/notifications"),
        markRead: (id: number) => post<void>(`/notifications/${id}/read`),
        markAllRead: () => post<void>("/notifications/read-all"),
    },

    profile: {
        update: (body: ProfileUpdateRequest) => put<User>("/profile", body),
        changePassword: (body: ChangePasswordRequest) => post<void>("/profile/password", body),
        setPin: (body: SetPinRequest) => post<void>("/profile/pin", body),
    },

    admin: {
        metrics: () => get<AdminMetrics>("/admin/metrics"),
        users: (q?: string) => get<User[]>("/admin/users", { q }),
        user: (id: number) => get<AdminUserDetail>(`/admin/users/${id}`),
        createCustomer: (body: AdminCreateCustomerRequest) => post<AdminUserDetail>("/admin/users", body),
        setUserStatus: (id: number, status: UserStatus) => patch<User>(`/admin/users/${id}/status`, { status }),
        accounts: (q?: string) => get<Account[]>("/admin/accounts", { q }),
        setAccountStatus: (id: number, status: "ACTIVE" | "FROZEN") => patch<Account>(`/admin/accounts/${id}/status`, { status }),
        cash: (id: number, body: CashRequest) => post<Transaction>(`/admin/accounts/${id}/cash`, body),
        transactions: (query: TransactionQuery) => get<Page<Transaction>>("/admin/transactions", { ...query }),
        loans: (status?: LoanStatus) => get<Loan[]>("/admin/loans", { status }),
        decideLoan: (id: number, body: LoanDecisionRequest) => post<Loan>(`/admin/loans/${id}/decision`, body),
        serviceRequests: (status?: ServiceRequestStatus) => get<ServiceRequest[]>("/admin/service-requests", { status }),
        updateServiceRequest: (id: number, body: ServiceRequestUpdate) => patch<ServiceRequest>(`/admin/service-requests/${id}`, body),
        settings: () => get<Setting[]>("/admin/settings"),
        updateSetting: (key: string, value: string) => put<Setting>(`/admin/settings/${key}`, { value }),
        creditInterest: () => post<{ accounts: number; total: number }>("/admin/interest/credit"),
    },
};
