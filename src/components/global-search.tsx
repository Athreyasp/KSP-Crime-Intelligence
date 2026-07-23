import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, MapPin, Network, UserSearch, Brain, LineChart,
  FolderSearch, FileText, Building2, Fingerprint,
} from "lucide-react";
import { DISTRICTS } from "@/data/mock";
import { useDb } from "@/hooks/use-db";

const PAGES = [
  { title: "Overview", url: "/", icon: LayoutDashboard, hint: "Statewide KPIs" },
  { title: "Hotspots", url: "/hotspots", icon: MapPin, hint: "Geospatial map" },
  { title: "Network Analysis", url: "/network", icon: Network, hint: "Association graph" },
  { title: "Repeat Offenders", url: "/offenders", icon: UserSearch, hint: "Watchlist" },
  { title: "Predictive Intel", url: "/predictive", icon: Brain, hint: "Forecasts" },
  { title: "Sociological", url: "/sociological", icon: LineChart, hint: "Correlations" },
  { title: "Case Explorer", url: "/cases", icon: FolderSearch, hint: "FIR corpus" },
] as const;

export function GlobalSearch({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { cases: CASES, offenders: OFFENDERS } = useDb();

  const q = query.trim().toLowerCase();

  const cases = useMemo(() => {
    if (!q) return CASES.slice(0, 5);
    return CASES.filter(c =>
      c.crimeNo.toLowerCase().includes(q) ||
      c.complainant.name.toLowerCase().includes(q) ||
      c.district.name.toLowerCase().includes(q) ||
      c.crimeHead.name.toLowerCase().includes(q) ||
      c.moTag.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [q]);

  const offenders = useMemo(() => {
    if (!q) return OFFENDERS.slice(0, 4);
    return OFFENDERS.filter(o =>
      o.name.toLowerCase().includes(q) ||
      o.moTags.some(m => m.toLowerCase().includes(q)) ||
      o.jurisdictions.some(j => j.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [q]);

  const districts = useMemo(() => {
    if (!q) return [];
    return DISTRICTS.filter(d => d.name.toLowerCase().includes(q)).slice(0, 5);
  }, [q]);

  const pages = useMemo(() => {
    if (!q) return PAGES;
    return PAGES.filter(p =>
      p.title.toLowerCase().includes(q) || p.hint.toLowerCase().includes(q)
    );
  }, [q]);

  const go = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate({ to: path });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search FIR, offender, district, page…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {pages.length > 0 && (
          <CommandGroup heading="Navigate">
            {pages.map(p => (
              <CommandItem
                key={p.url}
                value={`page ${p.title} ${p.hint}`.toLowerCase()}
                onSelect={() => go(p.url)}
              >
                <p.icon className="mr-2 h-4 w-4 text-primary" />
                <span>{p.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{p.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {districts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Districts">
              {districts.map(d => (
                <CommandItem
                  key={d.id}
                  value={`district ${d.name}`.toLowerCase()}
                  onSelect={() => go("/hotspots")}
                >
                  <Building2 className="mr-2 h-4 w-4 text-primary" />
                  <span>{d.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Pop. {(d.population / 1e6).toFixed(1)}M
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {offenders.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Offenders">
              {offenders.map(o => (
                <CommandItem
                  key={o.id}
                  value={`offender ${o.name} ${o.moTags.join(" ")}`.toLowerCase()}
                  onSelect={() => go("/offenders")}
                >
                  <Fingerprint className="mr-2 h-4 w-4 text-primary" />
                  <span>{o.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {o.incidentCount} FIRs · risk {o.riskScore}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {cases.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="FIR Cases">
              {cases.map(c => (
                <CommandItem
                  key={c.caseMasterId}
                  value={`case ${c.crimeNo} ${c.complainant.name} ${c.district.name} ${c.crimeHead.name} ${c.moTag}`.toLowerCase()}
                  onSelect={() => go(`/cases/${c.caseMasterId}`)}
                >
                  <FileText className="mr-2 h-4 w-4 text-primary" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-xs truncate">{c.crimeNo.slice(0, 18)}…</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {c.crimeHead.name} · {c.district.name}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
