"use client";

interface HubSubNavTab {
  id: string;
  label: string;
}

interface HubSubNavProps {
  tabs: HubSubNavTab[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

/** In-hub segmented control — sits above merged section content. */
export default function HubSubNav({ tabs, active, onChange, ariaLabel }: HubSubNavProps) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-none"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`
              shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              focus:outline-none focus:ring-2 focus:ring-[var(--bf-neon-primary)] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]
              ${isActive
                ? "bg-[#00d4ff]/15 text-[var(--bf-neon-primary)] border border-[var(--bf-neon-primary)]/30"
                : "text-[var(--bf-text-secondary)] border border-transparent hover:bg-white/5 hover:text-white"
              }
            `}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}