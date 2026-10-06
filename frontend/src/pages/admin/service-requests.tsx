import { useState } from "react";
import { Edit05, Ticket01 } from "@untitledui/icons";
import { AppModal } from "@/components/app/app-modal";
import { EmptyPanel, ErrorState, LoadingState } from "@/components/app/data-states";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs } from "@/components/application/tabs/tabs";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, humanize, maskAccount } from "@/lib/format";
import type { ServiceRequest, ServiceRequestStatus } from "@/lib/types";
import { useToast } from "@/providers/toast-provider";
import { cx } from "@/utils/cx";

type Filter = ServiceRequestStatus | "ALL";

const FILTERS: { id: Filter; label: string }[] = [
    { id: "OPEN", label: "Open" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "COMPLETED", label: "Completed" },
    { id: "REJECTED", label: "Rejected" },
    { id: "ALL", label: "All" },
];

const STATUSES: { id: ServiceRequestStatus; label: string; supportingText: string }[] = [
    { id: "OPEN", label: "Open", supportingText: "Awaiting action" },
    { id: "IN_PROGRESS", label: "In progress", supportingText: "Being worked on" },
    { id: "COMPLETED", label: "Completed", supportingText: "Resolved" },
    { id: "REJECTED", label: "Rejected", supportingText: "Cannot be fulfilled" },
];

export const AdminServiceRequestsPage = () => {
    const toast = useToast();
    const [filter, setFilter] = useState<Filter>("OPEN");
    const requests = useApi(() => api.admin.serviceRequests(filter === "ALL" ? undefined : filter), [filter]);

    const [editing, setEditing] = useState<ServiceRequest>();
    const [status, setStatus] = useState<ServiceRequestStatus>("OPEN");
    const [remarks, setRemarks] = useState("");
    const [errors, setErrors] = useState<{ status?: string; remarks?: string; form?: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openEditor = (request: ServiceRequest) => {
        setEditing(request);
        setStatus(request.status === "OPEN" ? "IN_PROGRESS" : request.status);
        setRemarks(request.remarks ?? "");
        setErrors({});
    };

    const closeEditor = () => {
        if (!isSubmitting) setEditing(undefined);
    };

    const save = async () => {
        if (!editing) return;
        if (status === "REJECTED" && remarks.trim().length < 5) {
            setErrors({ remarks: "Explain to the customer why the request was rejected." });
            return;
        }
        setIsSubmitting(true);
        setErrors({});
        try {
            const updated = await api.admin.updateServiceRequest(editing.id, { status, remarks: remarks.trim() || undefined });
            toast.success("Request updated", `${updated.ticketNumber} is now ${humanize(updated.status).toLowerCase()}.`);
            setEditing(undefined);
            requests.reload();
        } catch (err) {
            if (err instanceof ApiError) setErrors({ status: err.fieldErrors?.status, remarks: err.fieldErrors?.remarks, form: err.message });
            else setErrors({ form: "Something went wrong. Please try again." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const list = requests.data ?? [];
    const current = FILTERS.find((f) => f.id === filter)!;

    return (
        <>
            <PageHeader title="Service requests" description="Cheque books, card reissues, KYC and other customer requests." />

            <SectionCard
                title={filter === "ALL" ? "All requests" : `${current.label} requests`}
                description={requests.data ? `${list.length} ${list.length === 1 ? "request" : "requests"}` : undefined}
                actions={
                    <div className="max-w-full overflow-x-auto">
                        <Tabs selectedKey={filter} onSelectionChange={(key) => setFilter(key as Filter)} className="w-auto">
                            <Tabs.List type="button-minimal" size="sm" items={FILTERS.map((f) => ({ id: f.id, label: f.label }))} />
                        </Tabs>
                    </div>
                }
                flush
            >
                {requests.isLoading && !requests.data ? (
                    <LoadingState label="Loading requests…" />
                ) : requests.error && !requests.data ? (
                    <ErrorState message={requests.error.message} onRetry={requests.reload} />
                ) : list.length === 0 ? (
                    <EmptyPanel
                        icon={Ticket01}
                        title={filter === "ALL" ? "No service requests" : `No ${current.label.toLowerCase()} requests`}
                        description="Requests raised by customers will appear here."
                    />
                ) : (
                    <div className={cx("relative overflow-x-auto transition-opacity", requests.isLoading && "opacity-60")}>
                        <table className="w-full min-w-[960px] text-left text-sm">
                            <thead className="bg-secondary text-xs font-semibold whitespace-nowrap text-tertiary">
                                <tr>
                                    <th className="px-6 py-3">Ticket</th>
                                    <th className="px-4 py-3">Customer</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Account</th>
                                    <th className="px-4 py-3">Details</th>
                                    <th className="px-4 py-3">Created</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary">
                                {list.map((request) => (
                                    <tr key={request.id} className="align-top hover:bg-primary_hover">
                                        <td className="px-6 py-4 font-medium whitespace-nowrap text-primary">{request.ticketNumber}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-secondary">{request.customerName}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-secondary">{humanize(request.type)}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-secondary tabular-nums">
                                            {request.accountNumber ? maskAccount(request.accountNumber) : "—"}
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="line-clamp-2 max-w-72 text-secondary" title={request.details}>
                                                {request.details}
                                            </p>
                                            {request.remarks && (
                                                <p className="mt-1 line-clamp-1 max-w-72 text-xs text-tertiary" title={request.remarks}>
                                                    Remarks: {request.remarks}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-tertiary">{formatDateTime(request.createdAt)}</td>
                                        <td className="px-4 py-4">
                                            <StatusBadge status={request.status} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button size="sm" color="secondary" iconLeading={Edit05} onClick={() => openEditor(request)}>
                                                Update
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <AppModal
                isOpen={Boolean(editing)}
                onClose={closeEditor}
                title="Update service request"
                description={editing && `${editing.ticketNumber} · ${humanize(editing.type)} · ${editing.customerName}`}
                icon={Ticket01}
                widthClassName="sm:max-w-lg"
                footer={
                    <>
                        <Button color="secondary" size="lg" onClick={closeEditor} isDisabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button size="lg" onClick={save} isLoading={isSubmitting} showTextWhileLoading>
                            Save update
                        </Button>
                    </>
                }
            >
                {editing && (
                    <form
                        className="flex flex-col gap-5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            save();
                        }}
                    >
                        <div className="flex flex-col gap-1.5 rounded-lg bg-secondary p-4 text-sm">
                            <span className="font-medium text-secondary">Customer's request</span>
                            <p className="whitespace-pre-line text-tertiary">{editing.details}</p>
                            <span className="text-xs text-quaternary">
                                Raised {formatDateTime(editing.createdAt)}
                                {editing.accountNumber && ` · ${maskAccount(editing.accountNumber)}`}
                            </span>
                        </div>
                        <Select
                            label="Status"
                            items={STATUSES}
                            value={status}
                            onChange={(key) => {
                                if (key) setStatus(key as ServiceRequestStatus);
                                setErrors((e) => ({ ...e, status: undefined, remarks: undefined }));
                            }}
                            isInvalid={Boolean(errors.status)}
                            hint={errors.status}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
                        </Select>
                        <TextArea
                            label="Remarks"
                            placeholder={status === "REJECTED" ? "Reason shown to the customer" : "e.g. Cheque book dispatched via Speed Post"}
                            rows={3}
                            value={remarks}
                            onChange={(value) => {
                                setRemarks(value);
                                setErrors((e) => ({ ...e, remarks: undefined }));
                            }}
                            isRequired={status === "REJECTED"}
                            isInvalid={Boolean(errors.remarks)}
                            hint={errors.remarks ?? "Visible to the customer."}
                        />
                        {errors.form && <p className="text-sm text-error-primary">{errors.form}</p>}
                    </form>
                )}
            </AppModal>
        </>
    );
};
