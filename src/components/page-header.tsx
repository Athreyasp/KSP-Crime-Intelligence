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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 font-sans font-semibold text-[10px] uppercase tracking-[0.2em] text-signal">
              {section ? `${section} · ` : ""}{eyebrow}
            </p>
          )}
          <h1 className="truncate font-display text-2xl font-semibold md:text-3xl">{title}</h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 self-center">{actions}</div>}
      </div>
    </header>
  );
}
