import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, MapPin, Network, UserSearch, Brain, LineChart, FolderSearch, Shield, Plus, LogOut
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";

import kspLogo from "@/assets/karnataka-police-logo.png";

type NavItem = { 
  title: string; 
  url: string; 
  icon: typeof MapPin; 
  badge?: string 
};

const ITEMS: NavItem[] = [
  { title: "Overview",     url: "/",             icon: LayoutDashboard },
  { title: "Hotspots",     url: "/hotspots",     icon: MapPin },
  { title: "Network",      url: "/network",      icon: Network },
  { title: "Offenders",    url: "/offenders",    icon: UserSearch },
  { title: "Predictive",   url: "/predictive",   icon: Brain },
  { title: "Sociological", url: "/sociological", icon: LineChart },
  { title: "Cases",        url: "/cases",        icon: FolderSearch },
  { title: "New FIR",      url: "/cases/new",    icon: Plus },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t } = useLanguage();
  const { logout } = useAuth();
  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    if (url === "/cases") return pathname.startsWith("/cases") && !pathname.startsWith("/cases/new");
    return pathname.startsWith(url);
  };

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const stamp = mounted ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";

  return (
    <Sidebar collapsible="icon" className="border-r-2 border-ink bg-paper text-ink">
      {/* Masthead */}
      <SidebarHeader className="p-0 bg-paper border-b border-ink/15">
        <div className={cn(
          "flex items-center gap-3 px-4 pt-5 pb-4",
          collapsed && "flex-col gap-2 px-0 pt-4"
        )}>
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper border-2 border-ink overflow-hidden shadow-sm">
              <img src={kspLogo} alt="KSP Logo" className="h-7 w-7 object-contain" />
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="font-editorial italic text-[16px] text-ink tracking-wide">Karnataka</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/60">
                Crime Intelligence · SCRB
              </div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="mx-4 mb-2 flex items-center gap-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-ink/20 to-transparent" />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/50">
              {t("Navigation Registry")}
            </span>
            <div className="h-[1px] w-8 bg-signal" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="bg-paper px-2 py-2">
        <nav className="flex flex-col gap-1">
          {ITEMS.map((item, idx) => {
            const active = isActive(item.url);
            const Icon = item.icon;
            const num = String(idx + 1).padStart(2, "0");
            return (
              <Link
                key={item.url}
                to={item.url}
                title={collapsed ? t(item.title) : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg text-[13px] transition-all duration-300 font-medium",
                  collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                  active
                    ? "bg-[#f1f3f4] text-ink border-2 border-ink font-bold"
                    : "text-ink/75 hover:text-ink hover:bg-ink/5 hover:translate-x-1"
                )}
              >
                {/* Left accent slide-in bar */}
                {active && !collapsed && (
                  <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r bg-signal shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                )}
                
                {!collapsed && (
                  <span className={cn(
                    "font-mono text-[10px] tabular-nums w-5 text-left transition-colors duration-300",
                    active ? "text-signal font-bold" : "text-ink/40 group-hover:text-signal"
                  )}>
                    {num}
                  </span>
                )}
                
                <span className={cn(
                  "flex items-center justify-center shrink-0 rounded-md transition-colors duration-300",
                  collapsed && "h-8 w-8 border",
                  collapsed && active
                    ? "bg-signal/15 border-2 border-ink text-signal"
                    : collapsed && "bg-paper border-ink"
                )}>
                  <Icon
                    className={cn("h-4 w-4 transition-colors duration-300", 
                      active ? "text-signal" : "text-ink/75 group-hover:text-ink"
                    )}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </span>
                
                {!collapsed && (
                  <>
                    <span className={cn("truncate flex-1 tracking-wide", active && "font-bold text-ink")}>
                      {t(item.title)}
                    </span>
                    {item.badge && (
                      <span className="rounded border border-red-500/30 bg-red-50 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-red-600">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </SidebarContent>

      {/* Classified stamp footer */}
      <SidebarFooter className="p-0 bg-paper border-t border-ink/15 space-y-2 pb-4">
        {!collapsed ? (
          <>
            <div className="m-3 mb-1 rounded-lg border border-ink/15 bg-surface-2 p-3 shadow-inner space-y-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-signal font-bold">
                  SECURE CONSOLE
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[9.5px] text-ink/70">
                <span className="text-[9px] text-ink/50 uppercase tracking-wider">Feed Sync</span>
                <span className="tabular-nums font-bold text-emerald-600">ONLINE</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[9.5px] text-ink/70">
                <span className="text-[9px] text-ink/50 uppercase tracking-wider">Telemetry</span>
                <span className="tabular-nums text-ink/80">↻ {stamp}</span>
              </div>
            </div>
            <div className="px-3">
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-ink/70 hover:text-signal hover:bg-red-500/5 border border-transparent hover:border-red-500/20 transition-all duration-300 group cursor-pointer"
              >
                <LogOut className="h-4 w-4 text-ink/50 group-hover:text-signal transition-colors duration-300" />
                <span className="truncate tracking-wide">{t("Logout") || "Logout"}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <button
              onClick={logout}
              title="Logout"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-ink/15 hover:border-red-500/30 text-ink/70 hover:text-signal hover:bg-red-500/10 transition-all duration-300 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
