import type { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description?: ReactNode;
    /** Buttons shown on the right (stacked under the title on mobile). */
    actions?: ReactNode;
}

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
    <div className="flex flex-col gap-4 border-b border-secondary pb-5 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-display-xs font-semibold text-primary">{title}</h1>
            {description && <p className="text-md text-tertiary">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
);

interface SectionCardProps {
    title?: string;
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    /** Remove body padding, e.g. for edge-to-edge lists. */
    flush?: boolean;
}

/** White card with an optional header row — the standard content container. */
export const SectionCard = ({ title, description, actions, children, className, flush }: SectionCardProps) => (
    <section className={`overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary ${className ?? ""}`}>
        {(title || actions) && (
            <div className="flex flex-col gap-3 border-b border-secondary px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
                <div className="flex min-w-0 flex-col gap-0.5">
                    {title && <h2 className="text-md font-semibold text-primary">{title}</h2>}
                    {description && <p className="text-sm text-tertiary">{description}</p>}
                </div>
                {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>
        )}
        <div className={flush ? "" : "p-4 md:p-6"}>{children}</div>
    </section>
);
