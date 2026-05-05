import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export interface PageTabItem {
  label: string;
  path: string;
  badge?: number | string;
}

interface PageTabsProps {
  tabs: PageTabItem[];
  className?: string;
}

export function PageTabs({ tabs, className }: PageTabsProps) {
  const [currentPath, setLocation] = useLocation();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 mb-4",
        className,
      )}
      data-testid="page-tabs"
    >
      {tabs.map((tab) => {
        const isActive =
          currentPath === tab.path ||
          (tab.path !== "/" && currentPath.startsWith(tab.path + "/"));
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => {
              if (currentPath !== tab.path) setLocation(tab.path);
            }}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`page-tab-${tab.path.replace(/\//g, "-")}`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== 0 && tab.badge !== "" && (
              <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
