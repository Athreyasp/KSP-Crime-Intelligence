import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  section?: string;
}

export function PageHeader({ eyebrow, title, description, actions, section }: PageHeaderProps) {
  return (
    <header className="border-b border-border pb-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="mb-1 font-sans font-semibold text-[10px] uppercase tracking-[0.2em] text-signal">
              {section ? `${section.replace(/§\s*/, "")} · ` : ""}{eyebrow}
            </p>
          )}
          <h1 className="font-display text-2xl font-semibold md:text-3xl text-foreground break-words leading-tight">{title}</h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-center">{actions}</div>}
      </div>
    </header>
  );
}
