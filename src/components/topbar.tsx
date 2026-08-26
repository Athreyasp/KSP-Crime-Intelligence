import { Bell, Search, Calendar as CalendarIcon, Command as CmdIcon, Radio, ShieldAlert, Scale, Fingerprint, CheckCircle2, AlertCircle, Database } from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouterState, Link } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { GlobalSearch } from "@/components/global-search";
import { cn } from "@/lib/utils";
import { useDb } from "@/hooks/use-db";
import { useLanguage } from "@/hooks/use-language";
import { toast } from "sonner";

const ROUTE_LABELS: Record<string, { crumb: string; kicker: string }> = {
  "/": { crumb: "Overview", kicker: "Command Deck" },
  "/hotspots": { crumb: "Hotspots", kicker: "Spatial Intelligence" },
  "/network": { crumb: "Network Analysis", kicker: "Link Discovery" },
  "/offenders": { crumb: "Repeat Offenders", kicker: "Watchlist" },
  "/predictive": { crumb: "Predictive Intel", kicker: "Forecast Engine" },
  "/sociological": { crumb: "Sociological", kicker: "Correlational Study" },
  "/cases": { crumb: "Case Explorer", kicker: "FIR Archive" },
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
  const { language, setLanguage, t } = useLanguage();

  const { cases: allCases } = useDb();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  const prevCasesRef = useRef<any[]>([]);

  // Set initial unread count based on loaded cases
  useEffect(() => {
    if (allCases.length > 0 && !hasInitialized) {
      // Find number of active notifications
      const sortedCases = [...allCases].sort((a, b) => new Date(b.registeredDate).getTime() - new Date(a.registeredDate).getTime());
      let count = 0;
      sortedCases.forEach((c) => {
        if (c.gravity === "Heinous") count++;
        c.accused.forEach((a) => { if (a.arrestId) count++; });
        if (c.status !== "Under Investigation") count++;
        count++; // Default registration alerts
      });
      setUnreadCount(Math.min(5, count));
      setHasInitialized(true);
      prevCasesRef.current = allCases;
    }
  }, [allCases, hasInitialized]);

  // Clear unread count when dropdown is opened
  useEffect(() => {
    if (showNotifications) {
      setUnreadCount(0);
    }
  }, [showNotifications]);

  // Detect when new cases are added and update unread count if dropdown is closed
  useEffect(() => {
    if (hasInitialized && allCases.length > prevCasesRef.current.length) {
      const diff = allCases.length - prevCasesRef.current.length;
      if (!showNotifications) {
        setUnreadCount(prev => Math.min(5, prev + diff));
      }

      // Display real-time toast notifications for newly indexed cases
      const prevIds = new Set(prevCasesRef.current.map(c => c.caseMasterId));
      const newCases = allCases.filter(c => !prevIds.has(c.caseMasterId));

      newCases.forEach(c => {
        const isHeinous = c.gravity === "Heinous";
        const msg = isHeinous ? "🚨 HEINOUS CRIME REGISTERED" : "📋 CASE REGISTRY INDEXED";
        const description = `${c.crimeHead.name} at ${c.policeStation} (Crime No. ${c.crimeNo})`;
        if (isHeinous) {
          toast.error(msg, {
            description,
            duration: 6000,
          });
        } else {
          toast.info(msg, {
            description,
            duration: 5000,
          });
        }
      });
    }
    prevCasesRef.current = allCases;
  }, [allCases, showNotifications, hasInitialized]);

  // Compile genuine intelligence notifications from cases
  const notifications = useMemo(() => {
    const list: { id: string; type: "heinous" | "arrest" | "status" | "info"; title: string; desc: string; time: string; caseId?: string }[] = [];

    // Sort all cases by registration date descending to get recent activities
    const sortedCases = [...allCases].sort((a, b) => new Date(b.registeredDate).getTime() - new Date(a.registeredDate).getTime());

    sortedCases.forEach((c) => {
      const caseTime = new Date(c.registeredDate).toLocaleDateString("en-IN") + " " + (c.hour ? `${String(c.hour).padStart(2, "0")}:00` : "10:00");

      // 1. High-priority heinous alerts
      if (c.gravity === "Heinous") {
        list.push({
          id: `heinous-${c.caseMasterId}`,
          type: "heinous",
          title: "🚨 HEINOUS CRIME REGISTERED",
          desc: `${c.crimeHead.name} reported at ${c.policeStation} (Crime No. ${c.crimeNo})`,
          time: caseTime,
          caseId: String(c.caseMasterId)
        });
      }

      c.accused.forEach((a) => {
        if (a.arrestId) {
          list.push({
            id: `arrest-${c.caseMasterId}-${a.name}`,
            type: "arrest",
            title: "🚔 SUSPECT IN CUSTODY",
            desc: `Accused ${a.name} arrested & produced to court under Crime No. ${c.crimeNo}`,
            time: caseTime,
            caseId: String(c.caseMasterId)
          });
        }
      });

      // 3. Status updates
      if (c.status !== "Under Investigation") {
        list.push({
          id: `status-${c.caseMasterId}`,
          type: "status",
          title: "📌 INVESTIGATION RECORD FILED",
          desc: `FIR #${c.crimeNo} case file shifted to '${c.status}' status`,
          time: caseTime,
          caseId: String(c.caseMasterId)
        });
      }

      // 4. Default registration alerts
      list.push({
        id: `reg-${c.caseMasterId}`,
        type: "info",
        title: "📋 CASE REGISTRY INDEXED",
        desc: `New case registered under Crime Head: ${c.crimeHead.name} (PS: ${c.policeStation})`,
        time: caseTime,
        caseId: String(c.caseMasterId)
      });
    });

    // Fallback if no cases exist
    if (list.length === 0) {
      list.push({
        id: "welcome",
        type: "info",
        title: "⚡ LIVE LOG ACTIVE",
        desc: "Crime Intelligence database live sync online. Awaiting new case registration reports.",
        time: "Just Now"
      });
    }

    return list.slice(0, 5); // Max 5 recent alerts
  }, [allCases]);

  // Close notifications dropdown on click outside
  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

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

  const getTranslatedCrumb = (path: string): string => {
    switch (path) {
      case "/": return t("navOverview");
      case "/hotspots": return t("navHotspots");
      case "/network": return t("navNetwork");
      case "/offenders": return t("navOffenders");
      case "/predictive": return t("navPredictive");
      case "/sociological": return t("navSociological");
      case "/cases": return t("navCases");
      default: return label.crumb;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-paper/95 backdrop-blur">
        {/* Meta strip — ink ribbon */}
        <div className="flex items-center gap-3 bg-ink px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-paper/80">
          <span className="flex items-center gap-1.5">
            <Database className="h-3 w-3 text-signal" />
            <span className="text-paper">SCRB · SECURE SYSTEM</span>
          </span>
          <span className="text-paper/40">|</span>
          <span className="hidden sm:inline">{dateStr}</span>
          <span className="hidden sm:inline text-paper/40">|</span>
          <span className="tabular-nums text-signal">{timeStr} IST</span>

        </div>

        {/* Main bar — editorial masthead */}
        <div className="flex h-14 items-center gap-3 px-3">
          {/* Route crumb — big serif kicker */}
          <div className="hidden md:flex items-baseline gap-2.5">
            <span className="font-editorial text-xl italic leading-none text-ink">
              {getTranslatedCrumb(key)}
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-muted-foreground">
              / {label.kicker}
            </span>
          </div>

          {/* Search — bold framed lozenge */}
          {/* Search — bold framed lozenge */}
          <button
            ref={searchButtonRef}
            onClick={() => setOpen(true)}
            className="group ml-auto md:ml-4 flex flex-1 max-w-lg items-center gap-2 rounded-sm border-2 border-ink bg-paper px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2 transition-all"
            aria-label="Open search"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink text-paper">
              <Search className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <span className="hidden sm:inline text-ink/70 group-hover:text-ink">{t("searchPlaceholder")}</span>
            <span className="sm:hidden text-ink/70">Search…</span>
            <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded-sm border border-ink/30 bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-ink">
              {isMac ? <CmdIcon className="h-3 w-3" /> : "Ctrl"}<span>K</span>
            </kbd>
          </button>

          {/* Language Switcher */}
          <div className="flex items-center border-2 border-ink rounded-sm overflow-hidden bg-paper select-none shrink-0">
            <button
              onClick={() => setLanguage("en")}
              className={cn(
                "px-2.5 py-1 font-mono text-[10px] uppercase font-bold transition-all",
                language === "en" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink hover:bg-ink/5"
              )}
            >
              EN
            </button>
            <div className="w-[2px] h-5 bg-ink" />
            <button
              onClick={() => setLanguage("kn")}
              className={cn(
                "px-2.5 py-1 font-mono text-[10px] uppercase font-bold transition-all",
                language === "kn" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink hover:bg-ink/5"
              )}
            >
              ಕನ್ನಡ
            </button>
          </div>

          {/* Alerts — bell in bold stamp */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-9 w-9 items-center justify-center rounded-sm border-2 border-ink bg-paper hover:bg-surface-2 text-ink transition-colors"
              aria-label="Toggle notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={2} />
              {unreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 min-w-5 rounded-full border-2 border-ink bg-signal text-white p-0 text-[9px] leading-none font-mono font-bold flex items-center justify-center">
                  {unreadCount}
                </Badge>
              )}
            </button>

            {/* Dropdown Popover */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-sm border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_oklch(0.19_0_0)] z-30 space-y-3">
                <div className="flex items-center justify-between border-b border-ink/20 pb-2">
                  <span className="font-mono text-xs uppercase tracking-wider font-bold text-ink flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-signal animate-pulse" />
                    Live Alerts Feed
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground font-mono">
                    {notifications.length} Active
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-ink/10 pr-1">
                  {notifications.map((n) => {
                    const content = (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink block">
                            {n.title}
                          </span>
                          <span className="text-[8px] font-mono text-muted-foreground shrink-0 mt-0.5">
                            {n.time}
                          </span>
                        </div>
                        <p className="text-[10px] text-ink/85 leading-relaxed font-sans">
                          {n.desc}
                        </p>
                      </>
                    );

                    if (n.caseId) {
                      return (
                        <Link
                          key={n.id}
                          to="/cases/$caseId"
                          params={{ caseId: n.caseId }}
                          onClick={() => setShowNotifications(false)}
                          className="block py-2 px-1 text-inherit hover:no-underline hover:bg-surface-2 transition-colors duration-150 rounded cursor-pointer"
                        >
                          {content}
                        </Link>
                      );
                    }

                    return (
                      <div key={n.id} className="py-2 px-1">
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <GlobalSearch open={open} onOpenChange={setOpen} />
    </>
  );
}
