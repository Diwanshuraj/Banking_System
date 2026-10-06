import type { FC, ReactNode } from "react";
import { AlertCircle, RefreshCw01, SearchLg } from "@untitledui/icons";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Button } from "@/components/base/buttons/button";

export const LoadingState = ({ label = "Loading…", className }: { label?: string; className?: string }) => (
    <div className={`flex min-h-48 items-center justify-center py-10 ${className ?? ""}`}>
        <LoadingIndicator type="line-spinner" size="md" label={label} />
    </div>
);

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <EmptyState size="sm" className="py-10">
        <EmptyState.Header pattern="none">
            <EmptyState.FeaturedIcon icon={AlertCircle} color="error" theme="light" />
        </EmptyState.Header>
        <EmptyState.Content>
            <EmptyState.Title>Couldn't load this</EmptyState.Title>
            <EmptyState.Description>{message}</EmptyState.Description>
        </EmptyState.Content>
        {onRetry && (
            <EmptyState.Footer>
                <Button color="secondary" size="md" iconLeading={RefreshCw01} onClick={onRetry}>
                    Try again
                </Button>
            </EmptyState.Footer>
        )}
    </EmptyState>
);

interface EmptyPanelProps {
    title: string;
    description?: string;
    icon?: FC<{ className?: string }>;
    action?: ReactNode;
}

export const EmptyPanel = ({ title, description, icon = SearchLg, action }: EmptyPanelProps) => (
    <EmptyState size="sm" className="py-10">
        <EmptyState.Header pattern="circle" patternSize="sm">
            <EmptyState.FeaturedIcon icon={icon} color="gray" theme="modern" />
        </EmptyState.Header>
        <EmptyState.Content>
            <EmptyState.Title>{title}</EmptyState.Title>
            {description && <EmptyState.Description>{description}</EmptyState.Description>}
        </EmptyState.Content>
        {action && <EmptyState.Footer>{action}</EmptyState.Footer>}
    </EmptyState>
);
