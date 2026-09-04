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
      const sortedCases = [...allCases].sort((a: any, b: any) => new Date(b.registeredDate).getTime() - new Date(a.registeredDate).getTime());
      let count = 0;
      sortedCases.forEach((c: any) => {
        if (c.gravity === "Heinous") count++;
        c.accused?.forEach((a: any) => { if (a.arrestId) count++; });
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
      const prevIds = new Set(prevCasesRef.current.map((c: any) => c.caseMasterId));
      const newCases = allCases.filter((c: any) => !prevIds.has(c.caseMasterId));

      newCases.forEach((c: any) => {
        const isHeinous = c.gravity === "Heinous";
        const msg = isHeinous ? `🚨 HEINOUS INTEL · FIR ${c.crimeNo}` : `📋 CASE INTEL INDEXED · FIR ${c.crimeNo}`;
        const shortBrief = c.briefFacts ? c.briefFacts.split(".")[0].trim() : `${c.crimeHead?.name || "Offence"} reported at ${c.policeStation}.`;
        const description = `${c.district?.name || "Karnataka"} (${c.policeStation}) — ${shortBrief}`;
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

  // Compile genuine short case intelligence analyses from database cases
  const notifications = useMemo(() => {
    const list: { 
      id: string; 
      type: "heinous" | "arrest" | "status" | "info"; 
      badgeText: string; 
      badgeStyle: string; 
      title: string; 
      stationTag: string; 
      analysis: string; 
      time: string; 
      caseId?: string 
    }[] = [];

    // Sort cases chronologically descending
    const sortedCases = [...allCases].sort((a, b) => new Date(b.registeredDate || b.incidentDate).getTime() - new Date(a.registeredDate || a.incidentDate).getTime());

    sortedCases.forEach((c) => {
      const caseDate = new Date(c.registeredDate || c.incidentDate);
      const caseTime = caseDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " " + (c.hour ? `${String(c.hour).padStart(2, "0")}:00` : "10:00");
      const crimeName = c.crimeHead?.name || "Offence";
      const districtName = c.district?.name || "Karnataka";
      const stationName = c.policeStation || "PS";
      const mo = c.moTag || "Standard MO";
      const accusedList = c.accused || [];
      const arrested = accusedList.filter((a: any) => a.arrestId || a.isArrested || a.arrestDate);

      // Clean 1-sentence brief facts summary
      let shortFact = c.briefFacts ? c.briefFacts.split(".")[0].trim() : `${crimeName} incident reported.`;
      if (shortFact.length > 85) {
        shortFact = shortFact.substring(0, 82) + "...";
      }

      // 1. Heinous Cases Analytical Brief
      if (c.gravity === "Heinous") {
        list.push({
          id: `heinous-${c.caseMasterId}`,
          type: "heinous",
          badgeText: "HEINOUS INTEL",
          badgeStyle: "bg-[#fce8e6] text-[#c5221f] border-[#f8b4b0]",
          title: `FIR ${c.crimeNo} · ${districtName}`,
          stationTag: `${crimeName} (${stationName})`,
          analysis: `🚨 ${shortFact} [MO: ${mo}]. ${accusedList.length > 0 ? `${accusedList.length} suspect(s) linked.` : "High risk priority."}`,
          time: caseTime,
          caseId: String(c.caseMasterId)
        });
      }

      // 2. Custody Arrest Brief
      if (arrested.length > 0) {
        const mainArrest = arrested[0];
        list.push({
          id: `arrest-${c.caseMasterId}-${mainArrest.name}`,
          type: "arrest",
          badgeText: "CUSTODY ARREST",
          badgeStyle: "bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa]",
          title: `FIR ${c.crimeNo} · ${districtName}`,
          stationTag: `${crimeName} (${stationName})`,
          analysis: `🚔 Accused ${mainArrest.name} in custody. Case brief: ${shortFact} [MO: ${mo}].`,
          time: caseTime,
          caseId: String(c.caseMasterId)
        });
      }

      // 3. Status Shift Brief
      if (c.status !== "Under Investigation") {
        list.push({
          id: `status-${c.caseMasterId}`,
          type: "status",
          badgeText: "RECORD FILED",
          badgeStyle: "bg-[#fef7e0] text-[#b06000] border-[#feefc3]",
          title: `FIR ${c.crimeNo} · ${districtName}`,
          stationTag: `${crimeName} (${stationName})`,
          analysis: `📌 Case status updated to '${c.status}'. Brief: ${shortFact}.`,
          time: caseTime,
          caseId: String(c.caseMasterId)
        });
      }

      // 4. Default Case Brief
      list.push({
        id: `brief-${c.caseMasterId}`,
        type: "info",
        badgeText: "CASE BRIEF",
        badgeStyle: "bg-[#e6f4ea] text-[#137333] border-[#ceead6]",
        title: `FIR ${c.crimeNo} · ${districtName}`,
        stationTag: `${crimeName} (${stationName})`,
        analysis: `📊 ${shortFact} [MO: ${mo}]. Status: ${c.status}.`,
        time: caseTime,
        caseId: String(c.caseMasterId)
      });
    });

    // Fallback
    if (list.length === 0) {
      list.push({
        id: "welcome",
        type: "info",
        badgeText: "LIVE LOG",
        badgeStyle: "bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa]",
        title: "KSP SCRB Live Feed",
        stationTag: "State Records Bureau",
        analysis: "Crime Intelligence database sync online. Awaiting FIR registrations.",
        time: "Just Now"
      });
    }

    return list.slice(0, 5); // Display top 5 recent analytical briefs
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
      case "/": return t("Overview");
      case "/hotspots": return t("Hotspots");
      case "/network": return t("Network");
      case "/offenders": return t("Offenders");
      case "/predictive": return t("Predictive");
      case "/sociological": return t("Sociological");
      case "/cases": return t("Cases");
      default: return t(label.crumb);
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
          {/* Sidebar Trigger on mobile */}
          <SidebarTrigger className="h-9 w-9 border-2 border-ink rounded-sm bg-paper text-ink hover:bg-surface-2 md:hidden shrink-0 flex items-center justify-center" />

          {/* Route crumb — big serif kicker */}
          <div className="hidden md:flex items-baseline gap-2.5">
            <span className="font-editorial text-xl italic leading-none text-ink">
              {getTranslatedCrumb(key)}
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-muted-foreground">
              / {t(label.kicker)}
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
            <span className="hidden sm:inline text-ink/70 group-hover:text-ink">{t("Search FIR, offender, district...")}</span>
            <span className="sm:hidden text-ink/70">Search…</span>
            <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded-sm border border-ink/30 bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-ink">
              {isMac ? <CmdIcon className="h-3 w-3" /> : "Ctrl"}<span>K</span>
            </kbd>
          </button>

          {/* Language Switcher */}
          <div className="flex items-center border-2 border-ink rounded-sm overflow-hidden bg-paper select-none shrink-0 notranslate">
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
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-[#dadce0] bg-white p-3.5 shadow-xl z-30 space-y-3 font-sans max-w-[calc(100vw-24px)]">
                <div className="flex items-center justify-between border-b border-[#dadce0] pb-2.5">
                  <span className="text-xs font-bold text-[#202124] uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-[#1a73e8] animate-pulse" />
                    Case Intelligence Briefs
                  </span>
                  <Badge variant="outline" className="bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa] text-[10px] font-semibold">
                    {notifications.length} {t("Alerts")}
                  </Badge>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#dadce0] pr-1">
                  {notifications.map((n) => {
                    const content = (
                      <div className="py-2.5 px-2 hover:bg-[#f8f9fa] rounded-lg transition-all space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Badge variant="outline" className={`text-[9px] font-semibold px-1.5 py-0.2 shrink-0 ${n.badgeStyle}`}>
                              {n.badgeText}
                            </Badge>
                            <span className="font-mono text-xs font-bold text-[#202124] truncate">
                              {n.title}
                            </span>
                          </div>
                          <span className="font-mono text-[9.5px] text-[#5f6368] shrink-0 font-medium">
                            {n.time}
                          </span>
                        </div>

                        <p className="text-[11px] font-semibold text-[#1a73e8] truncate">
                          {n.stationTag}
                        </p>

                        <p className="text-xs text-[#3c4043] leading-relaxed line-clamp-2">
                          {n.analysis}
                        </p>
                      </div>
                    );

                    if (n.caseId) {
                      return (
                        <Link
                          key={n.id}
                          to="/cases/$caseId"
                          params={{ caseId: n.caseId }}
                          onClick={() => setShowNotifications(false)}
                          className="block text-inherit hover:no-underline cursor-pointer"
                        >
                          {content}
                        </Link>
                      );
                    }

                    return <div key={n.id}>{content}</div>;
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
