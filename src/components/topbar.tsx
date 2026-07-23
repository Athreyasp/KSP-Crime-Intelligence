import { Bell, Search, Calendar as CalendarIcon, Command as CmdIcon, Radio } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { GlobalSearch } from "@/components/global-search";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, { crumb: string; kicker: string }> = {
  "/":              { crumb: "Overview",         kicker: "Command Deck" },
  "/hotspots":      { crumb: "Hotspots",         kicker: "Spatial Intelligence" },
  "/network":       { crumb: "Network Analysis", kicker: "Link Discovery" },
  "/offenders":     { crumb: "Repeat Offenders", kicker: "Watchlist" },
  "/predictive":    { crumb: "Predictive Intel", kicker: "Forecast Engine" },
  "/sociological":  { crumb: "Sociological",     kicker: "Correlational Study" },
  "/cases":         { crumb: "Case Explorer",    kicker: "FIR Archive" },
};

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function Topbar() {
  const [open, setOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = useRouterState({ select: s => s.location.pathname });
  const now = useNow();
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          searchButtonRef.current?.focus();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const key = Object.keys(ROUTE_LABELS).find(
    k => (k === "/" ? pathname === "/" : pathname.startsWith(k))
  ) ?? "/";
  const label = ROUTE_LABELS[key];

  const timeStr = now
    ? now.toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";
  const dateStr = now
    ? now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
    : "";

  return (
    <>
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-paper/95 backdrop-blur">
        {/* Meta strip — ink ribbon */}
        <div className="flex items-center gap-3 bg-ink px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-paper/80">
          <span className="flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-signal" />
            <span className="text-paper">SCRB · LIVE</span>
          </span>
          <span className="text-paper/40">|</span>
          <span className="hidden sm:inline">{dateStr}</span>
          <span className="hidden sm:inline text-paper/40">|</span>
          <span className="tabular-nums text-signal">{timeStr} IST</span>

        </div>

        {/* Main bar — editorial masthead */}
        <div className="flex h-14 items-center gap-3 px-3">
          <SidebarTrigger className="rounded-sm border border-ink/20 hover:bg-surface-2" />

          {/* Route crumb — big serif kicker */}
          <div className="hidden md:flex items-baseline gap-2.5 border-l border-ink/15 pl-3">
            <span className="font-editorial text-xl italic leading-none text-ink">
              {label.crumb}
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-muted-foreground">
              / {label.kicker}
            </span>
          </div>

          {/* Search — bold framed lozenge */}
          <button
            ref={searchButtonRef}
            onClick={() => setOpen(true)}
            className={cn(
              "group ml-auto md:ml-4 flex flex-1 max-w-lg items-center gap-2 rounded-sm border-2 border-ink bg-paper px-3 py-2 text-sm text-muted-foreground",
              "shadow-[3px_3px_0_0_oklch(0.19_0_0)] hover:shadow-[4px_4px_0_0_oklch(0.58_0.22_27)] hover:-translate-x-px hover:-translate-y-px transition-all"
            )}
            aria-label="Open search"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink text-paper">
              <Search className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline text-ink/70 group-hover:text-ink">Search FIR, offender, district…</span>
            <span className="sm:hidden text-ink/70">Search…</span>
            <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded-sm border border-ink/30 bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-ink">
              {isMac ? <CmdIcon className="h-3 w-3" /> : "Ctrl"}<span>K</span>
            </kbd>
          </button>

          {/* Date range — stamped chip */}
          <button className="hidden lg:inline-flex items-center gap-2 rounded-sm border-2 border-ink bg-paper px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-ink shadow-[2px_2px_0_0_oklch(0.19_0_0)] hover:shadow-[3px_3px_0_0_oklch(0.58_0.22_27)] hover:-translate-x-px hover:-translate-y-px transition-all">
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>30d</span>
          </button>

          {/* Alerts — bell in bold stamp */}
          <button className="relative flex h-9 w-9 items-center justify-center rounded-sm border-2 border-ink bg-signal text-primary-foreground shadow-[2px_2px_0_0_oklch(0.19_0_0)] hover:shadow-[3px_3px_0_0_oklch(0.19_0_0)] hover:-translate-x-px hover:-translate-y-px transition-all">
            <Bell className="h-4 w-4" strokeWidth={2.5} />
            <Badge className="absolute -top-2 -right-2 h-5 min-w-5 rounded-full border-2 border-ink bg-paper text-ink p-0 text-[10px] leading-none font-mono font-bold flex items-center justify-center">
              6
            </Badge>
          </button>
        </div>
      </header>

      <GlobalSearch open={open} onOpenChange={setOpen} />
    </>
  );
}
