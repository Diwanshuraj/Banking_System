import { useState } from "react";
import { CheckCircle, File06, XCircle } from "@untitledui/icons";
import { AppModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/application/tabs/tabs";
import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import { errorMessage, useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDate, formatINR, humanize, maskAccount } from "@/lib/format";
import type { Loan, LoanStatus } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

type Filter = LoanStatus | "ALL";

const FILTERS: { id: Filter; label: string }[] = [
    { id: "PENDING", label: "Pending" },
    { id: "ACTIVE", label: "Active" },
    { id: "REJECTED", label: "Rejected" },
    { id: "CLOSED", label: "Closed" },
    { id: "ALL", label: "All" },
];

const emiRatio = (loan: Loan) => (loan.monthlyIncome > 0 ? (loan.emi / loan.monthlyIncome) * 100 : undefined);

export const AdminLoansPage = () => {
    const toast = useToast();
    const [filter, setFilter] = useState<Filter>("PENDING");
    const loans = useApi(() => api.admin.loans(filter === "ALL" ? undefined : filter), [filter]);
    const [decision, setDecision] = useState<{ loan: Loan; approve: boolean }>();
    const [remarks, setRemarks] = useState("");
    const [remarksError, setRemarksError] = useState<string>();
    const [submitError, setSubmitError] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openDecision = (loan: Loan, approve: boolean) => {
        setDecision({ loan, approve });
        setRemarks("");
        setRemarksError(undefined);
        setSubmitError(undefined);
    };

    const closeDecision = () => {
        if (!isSubmitting) setDecision(undefined);
    };

    const submitDecision = async () => {
        if (!decision) return;
        if (!decision.approve && remarks.trim().length < 5) {
            setRemarksError("Give the customer a reason for the rejection.");
            return;
        }
        setIsSubmitting(true);
        setSubmitError(undefined);
        try {
            const updated = await api.admin.decideLoan(decision.loan.id, { approve: decision.approve, remarks: remarks.trim() || undefined });
            toast.success(
                decision.approve ? "Loan approved" : "Loan rejected",
                decision.approve
                    ? `${formatINR(updated.principal)} disbursed to ${maskAccount(updated.disbursementAccountNumber)}.`
                    : `${updated.loanNumber} has been rejected and the customer notified.`,
            );
            setDecision(undefined);
            loans.reload();
        } catch (err) {
            setSubmitError(errorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const list = loans.data ?? [];
    const label = FILTERS.find((f) => f.id === filter)?.label.toLowerCase();

    return (
        <>
            <PageHeader title="Loan applications" description="Review applications, approve disbursements and monitor the loan book." />

            <SectionCard
                title={`${FILTERS.find((f) => f.id === filter)?.label} loans`}
                description={loans.data ? `${list.length} ${list.length === 1 ? "loan" : "loans"}` : undefined}
                actions={
                    <div className="max-w-full overflow-x-auto">
                        <Tabs selectedKey={filter} onSelectionChange={(key) => setFilter(key as Filter)} className="w-auto">
                            <Tabs.List type="button-minimal" size="sm" items={FILTERS.map((f) => ({ id: f.id, label: f.label }))} />
                        </Tabs>
                    </div>
                }
                flush
            >
                {loans.isLoading && !loans.data ? (
                    <LoadingState label="Loading loans…" />
                ) : loans.error && !loans.data ? (
                    <ErrorState message={loans.error.message} onRetry={loans.reload} />
                ) : list.length === 0 ? (
                    <EmptyPanel icon={File06} title={`No ${filter === "ALL" ? "" : `${label} `}loans`} description="Loans matching this status will appear here." />
                ) : (
                    <div className={cx("relative overflow-x-auto transition-opacity", loans.isLoading && "opacity-60")}>
                        <table className="w-full min-w-[1100px] text-left text-sm">
                            <thead className="bg-secondary text-xs font-semibold whitespace-nowrap text-tertiary">
                                <tr>
                                    <th className="px-6 py-3">Applicant</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-right">Tenure</th>
                                    <th className="px-4 py-3 text-right">Rate</th>
                                    <th className="px-4 py-3 text-right">EMI</th>
                                    <th className="px-4 py-3 text-right">Monthly income</th>
                                    <th className="px-4 py-3 text-right">EMI / income</th>
                                    <th className="px-4 py-3">Applied</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary">
                                {list.map((loan) => {
                                    const ratio = emiRatio(loan);
                                    return (
                                        <tr key={loan.id} className="align-top hover:bg-primary_hover">
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-primary">{loan.applicantName}</p>
                                                <p className="text-tertiary">{loan.loanNumber}</p>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-secondary">
                                                {humanize(loan.type)}
                                                <p className="max-w-40 truncate text-xs text-tertiary" title={loan.purpose}>
                                                    {loan.purpose}
                                                </p>
                                            </td>
                                            <td className="px-4 py-4 text-right font-medium whitespace-nowrap text-primary tabular-nums">
                                                {formatINR(loan.principal)}
                                                {loan.status === "ACTIVE" && (
                                                    <p className="text-xs font-normal text-tertiary">{formatINR(loan.outstanding)} due</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right whitespace-nowrap text-secondary tabular-nums">{loan.tenureMonths} mo</td>
                                            <td className="px-4 py-4 text-right whitespace-nowrap text-secondary tabular-nums">{loan.interestRate.toFixed(2)}%</td>
                                            <td className="px-4 py-4 text-right whitespace-nowrap text-secondary tabular-nums">{formatINR(loan.emi)}</td>
                                            <td className="px-4 py-4 text-right whitespace-nowrap text-secondary tabular-nums">{formatINR(loan.monthlyIncome)}</td>
                                            <td className="px-4 py-4 text-right whitespace-nowrap tabular-nums">
                                                {ratio === undefined ? (
                                                    <span className="text-tertiary">—</span>
                                                ) : (
                                                    <span
                                                        className={cx(
                                                            "inline-flex rounded-md px-2 py-0.5 font-medium",
                                                            ratio > 50 ? "bg-error-primary text-error-primary" : "text-secondary",
                                                        )}
                                                        title={ratio > 50 ? "EMI exceeds 50% of monthly income" : undefined}
                                                    >
                                                        {ratio.toFixed(1)}%
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-secondary">{formatDate(loan.appliedAt)}</td>
                                            <td className="px-4 py-4">
                                                <StatusBadge status={loan.status} />
                                                {loan.remarks && loan.status !== "PENDING" && (
                                                    <p className="mt-1 max-w-44 truncate text-xs text-tertiary" title={loan.remarks}>
                                                        {loan.remarks}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {loan.status === "PENDING" && (
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" color="secondary-destructive" onClick={() => openDecision(loan, false)}>
                                                            Reject
                                                        </Button>
                                                        <Button size="sm" onClick={() => openDecision(loan, true)}>
                                                            Approve
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <AppModal
                isOpen={Boolean(decision)}
                onClose={closeDecision}
                title={decision?.approve ? "Approve and disburse loan" : "Reject loan application"}
                icon={decision?.approve ? CheckCircle : XCircle}
                iconColor={decision?.approve ? "success" : "error"}
                description={
                    decision &&
                    (decision.approve ? (
                        <>
                            Approving immediately credits <span className="font-semibold text-secondary">{formatINR(decision.loan.principal)}</span> to account{" "}
                            {maskAccount(decision.loan.disbursementAccountNumber)} and starts the EMI schedule. This cannot be undone.
                        </>
                    ) : (
                        "The customer will be notified with your remarks. No funds will be disbursed."
                    ))
                }
                footer={
                    <>
                        <Button color="secondary" size="lg" onClick={closeDecision} isDisabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            size="lg"
                            color={decision?.approve ? "primary" : "primary-destructive"}
                            onClick={submitDecision}
                            isLoading={isSubmitting}
                            showTextWhileLoading
                        >
                            {decision?.approve ? "Approve & disburse" : "Reject application"}
                        </Button>
                    </>
                }
            >
                {decision && (
                    <div className="flex flex-col gap-4">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-secondary p-4 text-sm">
                            <dt className="text-tertiary">Applicant</dt>
                            <dd className="text-right font-medium text-primary">{decision.loan.applicantName}</dd>
                            <dt className="text-tertiary">Loan</dt>
                            <dd className="text-right font-medium text-secondary">
                                {humanize(decision.loan.type)} · {decision.loan.loanNumber}
                            </dd>
                            <dt className="text-tertiary">Amount</dt>
                            <dd className="text-right font-medium text-secondary tabular-nums">{formatINR(decision.loan.principal)}</dd>
                            <dt className="text-tertiary">EMI</dt>
                            <dd className="text-right font-medium text-secondary tabular-nums">
                                {formatINR(decision.loan.emi)} × {decision.loan.tenureMonths}
                            </dd>
                            <dt className="text-tertiary">EMI / income</dt>
                            <dd className={cx("text-right font-medium tabular-nums", (emiRatio(decision.loan) ?? 0) > 50 ? "text-error-primary" : "text-secondary")}>
                                {emiRatio(decision.loan)?.toFixed(1) ?? "—"}%
                            </dd>
                        </dl>
                        <TextArea
                            label={decision.approve ? "Remarks (optional)" : "Reason for rejection"}
                            placeholder={decision.approve ? "e.g. Documents verified" : "e.g. EMI exceeds 50% of declared income"}
                            rows={3}
                            value={remarks}
                            onChange={(value) => {
                                setRemarks(value);
                                setRemarksError(undefined);
                            }}
                            isRequired={!decision.approve}
                            isInvalid={Boolean(remarksError)}
                            hint={remarksError}
                        />
                        {submitError && <p className="text-sm text-error-primary">{submitError}</p>}
                    </div>
                )}
            </AppModal>
        </>
    );
};
