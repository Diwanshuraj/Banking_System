// Shared API contract between the React app and the Spring Boot backend (/api).
// Amounts are rupees as JSON numbers; dates are ISO-8601 strings ("2026-09-26" or "2026-09-26T14:32:00").

export type Role = "ROLE_ADMIN" | "ROLE_CUSTOMER";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "LOCKED";

export interface User {
    id: number;
    customerId: string; // CIF number, 11 digits
    fullName: string;
    email: string;
    phone: string;
    role: Role;
    status: UserStatus;
    panNumber: string | null;
    aadhaarMasked: string | null; // "XXXX-XXXX-9012"
    dateOfBirth: string | null;
    address: string | null;
    hasTransactionPin: boolean;
    lastLoginAt: string | null;
    createdAt: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface LoginRequest {
    username: string; // email or customer ID
    password: string;
}

export interface RegisterRequest {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    panNumber: string;
    aadhaarNumber: string;
    dateOfBirth: string;
    address: string;
    accountType: AccountType;
}

export type AccountType = "SAVINGS" | "CURRENT" | "SALARY";
export type AccountStatus = "ACTIVE" | "FROZEN" | "CLOSED";

export interface Account {
    id: number;
    accountNumber: string;
    ifscCode: string;
    branchName: string;
    accountType: AccountType;
    balance: number;
    currency: string;
    status: AccountStatus;
    interestRate: number;
    nomineeName: string | null;
    upiId: string | null;
    holderName: string;
    openedAt: string;
}

export type Channel = "UPI" | "IMPS" | "NEFT" | "RTGS" | "INTERNAL" | "BILL_PAYMENT" | "FIXED_DEPOSIT" | "LOAN" | "INTEREST" | "CASH";
export type Direction = "CREDIT" | "DEBIT";
export type TxnStatus = "SUCCESS" | "PENDING" | "FAILED";

export interface Transaction {
    id: number;
    referenceId: string;
    accountId: number;
    accountNumber: string;
    direction: Direction;
    channel: Channel;
    amount: number;
    balanceAfter: number;
    counterpartyName: string | null;
    counterpartyAccount: string | null;
    description: string;
    status: TxnStatus;
    createdAt: string;
}

export interface Page<T> {
    content: T[];
    page: number; // zero-based
    size: number;
    totalElements: number;
    totalPages: number;
}

export interface TransactionQuery {
    accountId?: number;
    from?: string; // yyyy-mm-dd
    to?: string;
    direction?: Direction;
    channel?: Channel;
    q?: string;
    page?: number;
    size?: number;
}

export interface Beneficiary {
    id: number;
    name: string;
    nickname: string | null;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    transferLimit: number;
    internal: boolean; // account is held with this bank
    coolingPeriodEndsAt: string; // new payees are capped at ₹25,000 until this time
    createdAt: string;
}

export interface BeneficiaryRequest {
    name: string;
    nickname?: string;
    accountNumber: string;
    ifscCode: string;
    transferLimit: number;
}

export type TransferMode = "INTERNAL" | "IMPS" | "NEFT" | "RTGS" | "UPI";

export interface TransferRequest {
    fromAccountId: number;
    mode: TransferMode;
    beneficiaryId?: number; // IMPS / NEFT / RTGS / INTERNAL to a payee
    toAccountId?: number; // INTERNAL between own accounts
    upiId?: string; // UPI
    amount: number;
    remarks?: string;
    pin: string; // 6-digit transaction PIN
}

export interface TransferReceipt {
    referenceId: string;
    mode: TransferMode;
    amount: number;
    fromAccountNumber: string;
    toName: string;
    toAccount: string;
    status: TxnStatus;
    balanceAfter: number;
    timestamp: string;
    message: string;
}

export interface UpiLookup {
    upiId: string;
    name: string;
    bankName: string;
}

export interface TransferLimits {
    dailyLimit: number;
    usedToday: number;
    upiDailyLimit: number;
    upiUsedToday: number;
    impsMax: number;
    upiMax: number;
    rtgsMin: number;
    newPayeeLimit: number;
}

export type FdStatus = "ACTIVE" | "MATURED" | "CLOSED";

export interface FixedDeposit {
    id: number;
    fdNumber: string;
    principal: number;
    interestRate: number;
    tenureMonths: number;
    startDate: string;
    maturityDate: string;
    maturityAmount: number;
    currentValue: number;
    status: FdStatus;
    sourceAccountNumber: string;
    autoRenew: boolean;
    closedAt: string | null;
    payoutAmount: number | null;
}

export interface FdRate {
    minMonths: number;
    maxMonths: number;
    label: string;
    rate: number;
    seniorRate: number;
}

export interface OpenFdRequest {
    sourceAccountId: number;
    amount: number;
    tenureMonths: number;
    autoRenew: boolean;
    pin: string;
}

export type LoanType = "HOME" | "PERSONAL" | "CAR" | "EDUCATION" | "GOLD";
export type LoanStatus = "PENDING" | "REJECTED" | "ACTIVE" | "CLOSED";

export interface LoanProduct {
    type: LoanType;
    name: string;
    rate: number;
    maxAmount: number;
    maxTenureMonths: number;
    processingFeePct: number;
    description: string;
}

export interface Loan {
    id: number;
    loanNumber: string;
    type: LoanType;
    principal: number;
    interestRate: number;
    tenureMonths: number;
    emi: number;
    outstanding: number;
    emisPaid: number;
    status: LoanStatus;
    purpose: string;
    monthlyIncome: number;
    disbursementAccountNumber: string;
    applicantName: string;
    appliedAt: string;
    decidedAt: string | null;
    nextDueDate: string | null;
    remarks: string | null;
}

export interface LoanApplicationRequest {
    type: LoanType;
    amount: number;
    tenureMonths: number;
    purpose: string;
    monthlyIncome: number;
    disbursementAccountId: number;
}

export interface LoanRepayRequest {
    accountId: number;
    amount: number;
    pin: string;
}

export type CardStatus = "ACTIVE" | "BLOCKED" | "HOTLISTED";

export interface Card {
    id: number;
    accountId: number;
    accountNumber: string;
    cardHolder: string;
    maskedNumber: string; // "4214 •••• •••• 3812"
    last4: string;
    network: "RUPAY" | "VISA" | "MASTERCARD";
    variant: string; // "Classic", "Platinum"
    expiry: string; // "MM/YY"
    status: CardStatus;
    onlineEnabled: boolean;
    internationalEnabled: boolean;
    contactlessEnabled: boolean;
    atmEnabled: boolean;
    atmLimit: number;
    posLimit: number;
    onlineLimit: number;
    maxLimit: number; // ceiling for each of the three limits
}

export interface CardControlsRequest {
    onlineEnabled: boolean;
    internationalEnabled: boolean;
    contactlessEnabled: boolean;
    atmEnabled: boolean;
    atmLimit: number;
    posLimit: number;
    onlineLimit: number;
}

export type BillCategory = "ELECTRICITY" | "MOBILE" | "DTH" | "WATER" | "GAS" | "BROADBAND" | "FASTAG" | "INSURANCE" | "CREDIT_CARD";

export interface BillerCategory {
    category: BillCategory;
    label: string;
    consumerLabel: string; // e.g. "Consumer number", "Mobile number"
    billers: string[];
}

export interface BillPaymentRequest {
    accountId: number;
    category: BillCategory;
    billerName: string;
    consumerNumber: string;
    amount: number;
    pin: string;
}

export interface BillPayment {
    id: number;
    referenceId: string;
    category: BillCategory;
    billerName: string;
    consumerNumber: string;
    amount: number;
    accountNumber: string;
    status: TxnStatus;
    createdAt: string;
}

export type ServiceRequestType =
    | "CHEQUE_BOOK"
    | "STOP_CHEQUE"
    | "DEBIT_CARD_REISSUE"
    | "ADDRESS_CHANGE"
    | "NOMINEE_UPDATE"
    | "KYC_UPDATE"
    | "ACCOUNT_CLOSURE";
export type ServiceRequestStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

export interface ServiceRequest {
    id: number;
    ticketNumber: string;
    type: ServiceRequestType;
    accountNumber: string | null;
    details: string;
    status: ServiceRequestStatus;
    remarks: string | null;
    customerName: string;
    createdAt: string;
    updatedAt: string;
}

export interface ServiceRequestCreate {
    type: ServiceRequestType;
    accountId?: number;
    details: string;
}

export type NotificationCategory = "TRANSACTION" | "SECURITY" | "ACCOUNT" | "LOAN" | "GENERAL";

export interface Notification {
    id: number;
    title: string;
    message: string;
    category: NotificationCategory;
    read: boolean;
    createdAt: string;
}

export interface MonthlyFlow {
    month: string; // "Apr 26"
    credit: number;
    debit: number;
}

export interface Dashboard {
    accounts: Account[];
    totalBalance: number;
    recentTransactions: Transaction[];
    monthly: MonthlyFlow[]; // last 6 months, oldest first
    fdCount: number;
    fdTotal: number;
    loanCount: number;
    loanOutstanding: number;
    unreadNotifications: number;
    limits: TransferLimits;
}

export interface ProfileUpdateRequest {
    phone: string;
    address: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface SetPinRequest {
    password: string; // login password, to authorise the change
    pin: string;
}

export interface OpenAccountRequest {
    accountType: AccountType;
    nomineeName?: string;
}

// ---------- Admin ----------

export interface AdminMetrics {
    totalCustomers: number;
    activeAccounts: number;
    frozenAccounts: number;
    totalDeposits: number;
    todayVolume: number;
    todayTransactions: number;
    pendingLoans: number;
    openRequests: number;
    loanBook: number;
    channelBreakdown: { channel: Channel; count: number; amount: number }[];
    dailyVolume: { date: string; amount: number; count: number }[]; // last 14 days, oldest first
}

export interface AdminUserDetail extends User {
    accounts: Account[];
}

export interface AdminCreateCustomerRequest extends RegisterRequest {
    openingDeposit: number;
}

export interface CashRequest {
    type: "DEPOSIT" | "WITHDRAWAL";
    amount: number;
    remarks?: string;
}

export interface LoanDecisionRequest {
    approve: boolean;
    remarks?: string;
}

export interface ServiceRequestUpdate {
    status: ServiceRequestStatus;
    remarks?: string;
}

export interface Setting {
    key: string;
    value: string;
    description: string;
}

export interface ApiErrorBody {
    status: number;
    message: string;
    errors?: Record<string, string>; // field -> message for validation errors
}
