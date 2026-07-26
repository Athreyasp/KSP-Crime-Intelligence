import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, MapPin, Network, UserSearch, Brain, LineChart, FolderSearch, Shield, Plus, Database,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: typeof MapPin; live?: boolean; badge?: string };

const ITEMS: NavItem[] = [
  { title: "Overview",     url: "/",             icon: LayoutDashboard, live: true },
  { title: "Hotspots",     url: "/hotspots",     icon: MapPin,          badge: "6" },
  { title: "Network",      url: "/network",      icon: Network },
  { title: "Offenders",    url: "/offenders",    icon: UserSearch },
  { title: "Predictive",   url: "/predictive",   icon: Brain,           live: true },
  { title: "Sociological", url: "/sociological", icon: LineChart },
  { title: "Cases",        url: "/cases",        icon: FolderSearch },
  { title: "New FIR",      url: "/cases/new",    icon: Plus },
  { title: "Zoho Console", url: "/zoho-console", icon: Database,        badge: "27 Tables" },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const stamp = mounted ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      {/* Masthead */}
      <SidebarHeader className="p-0 bg-sidebar">
        <div className={cn(
          "flex items-center gap-3 px-4 pt-5 pb-4",
          collapsed && "flex-col gap-2 px-0 pt-4"
        )}>
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-paper border border-ink shadow-hard">
              <Shield className="h-4 w-4 text-signal" strokeWidth={2.5} />
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="font-editorial italic text-[15px] text-sidebar-foreground -mb-0.5">Karnataka</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/60">
                Crime Intelligence · SCRB
              </div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="mx-4 mb-1 flex items-center gap-2">
            <div className="h-[3px] flex-1 bg-ink" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/55">
              § Nav
            </span>
            <div className="h-[3px] w-4 bg-signal" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="bg-sidebar px-2 py-2">
        <nav className="flex flex-col gap-1">
          {ITEMS.map((item, idx) => {
            const active = isActive(item.url);
            const Icon = item.icon;
            const num = String(idx + 1).padStart(2, "0");
            return (
              <Link
                key={item.url}
                to={item.url}
                title={collapsed ? item.title : undefined}
                className={cn(
                  "group relative flex items-center gap-2 rounded-md text-[13px] transition-all",
                  collapsed ? "justify-center px-0 py-2" : "px-2 py-2",
                  active
                    ? "bg-paper text-ink border border-ink shadow-hard"
                    : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                {active && !collapsed && (
                  <span className="absolute -left-[5px] top-1.5 bottom-1.5 w-[4px] rounded-sm bg-signal" />
                )}
                {!collapsed && (
                  <span className={cn(
                    "font-mono text-[10px] tabular-nums w-6 text-center transition-colors",
                    active ? "text-signal font-semibold" : "text-sidebar-foreground/40 group-hover:text-signal"
                  )}>
                    {num}
                  </span>
                )}
                <span className={cn(
                  "flex items-center justify-center shrink-0",
                  collapsed && "h-8 w-8 rounded-md border",
                  collapsed && active
                    ? "bg-signal border-ink text-primary-foreground shadow-hard"
                    : collapsed && "bg-paper/10 border-sidebar-border/50"
                )}>
                  <Icon
                    className={cn("h-4 w-4", !collapsed && active && "text-signal")}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </span>
                {!collapsed && (
                  <>
                    <span className={cn("truncate flex-1", active && "font-semibold tracking-tight")}>{item.title}</span>
                    {item.live && (
                      <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-signal">
                        <span className="h-1.5 w-1.5 rounded-full bg-signal pulse-alert" />
                        Live
                      </span>
                    )}
                    {!item.live && item.badge && (
                      <span className="rounded-sm border border-signal/50 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-signal">
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
      <SidebarFooter className="p-0 bg-sidebar">
        {!collapsed ? (
          <div className="m-3 rounded-md border border-signal/40 bg-signal/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success pulse-alert" />
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-signal font-semibold">
                Classified · Internal
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-sidebar-foreground/70">
              <span>Feed live</span>
              <span className="tabular-nums">↻ {stamp}</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-3">
            <span className="h-2 w-2 rounded-full bg-success pulse-alert" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
