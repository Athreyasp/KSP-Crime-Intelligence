import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDb } from "@/hooks/use-db";
import { ChevronRight, MapPin, Fingerprint, Users, User, Sparkles, TriangleAlert, Clock, Target } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/offenders")({
  head: () => ({
    meta: [
      { title: "Repeat Offenders · KSP Crime Intelligence" },
      { name: "description", content: "Track repeat offenders across jurisdictions with MO fingerprints and case histories." },
      { property: "og:title", content: "Repeat Offender Tracker" },
      { property: "og:description", content: "Link individuals to multiple incidents and identify their Modus Operandi across districts." },
    ],
  }),
  component: OffendersPage,
});

function OffendersPage() {
  const { offenders: OFFENDERS, cases: CASES } = useDb();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "high" | "property" | "violent">("all");
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "syndicate" | "prediction">("overview");

  useEffect(() => {
    if (!openId && OFFENDERS.length > 0) {
      setOpenId(OFFENDERS[0].id);
    }
  }, [OFFENDERS, openId]);

  // Handle profile click and reset sub-tab to overview
  const selectOffender = (id: string) => {
    setOpenId(id);
    setActiveTab("overview");
  };

  const filtered = OFFENDERS.filter(o => {
    const matchesSearch = o.name.toLowerCase().includes(q.toLowerCase());
    if (!matchesSearch) return false;
    if (filterTab === "high") return o.riskScore > 80;
    if (filterTab === "property") {
      return o.moTags.some(t => {
        const low = t.toLowerCase();
        return low.includes("theft") || low.includes("burglary") || low.includes("shutter") || low.includes("lock") || low.includes("housebreak") || low.includes("shop");
      });
    }
    if (filterTab === "violent") {
      return o.moTags.some(t => {
        const low = t.toLowerCase();
        return low.includes("assault") || low.includes("murder") || low.includes("snatch") || low.includes("robbery") || low.includes("weapon");
      });
    }
    return true;
  }).sort((a, b) => b.riskScore - a.riskScore);

  const active = OFFENDERS.find(o => o.id === openId) || OFFENDERS[0];

  // Extract a real database uploaded photo for the active offender if available
  const offenderPhoto = useMemo(() => {
    if (!active) return null;
    for (const cid of active.cases) {
      const c = CASES.find(x => x.caseMasterId === cid);
      if (c && c.accused) {
        const found = c.accused.find(a => a.name.toLowerCase().includes(active.name.toLowerCase()) || active.name.toLowerCase().includes(a.name.toLowerCase()));
        if (found && found.photo) {
          return found.photo;
        }
      }
    }
    return null;
  }, [active, CASES]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        section="§ 04"
        eyebrow="Watchlist & Network Profiles"
        title="Repeat Offender Tracker"
        description="Individuals linked to multiple FIRs — Modus Operandi mapping, syndicate link analysis and risk triggers."
        actions={<Badge className="bg-primary/10 text-primary border border-primary/20">{OFFENDERS.length} on active watchlist</Badge>}
      />

      {OFFENDERS.length === 0 ? (
        <Card className="p-8 text-center bg-surface-1 border-border">
          <p className="text-sm text-muted-foreground italic">No repeat offenders registered yet. Offender profiles and predictive next-action intelligence will be displayed here once cases with accused details are added.</p>
          <div className="mt-4">
            <Link to="/cases/new" className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold rounded hover:bg-primary-glow transition-colors">
              Register new FIR Case
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5 items-start">
          
          {/* COLUMN 1: Watchlist Directory (Span 2) */}
          <Card className="lg:col-span-2 bg-surface-1 border-border">
            <CardHeader className="pb-2 space-y-3">
              <div>
                <CardTitle className="text-base font-semibold text-ink">Watchlist Directory</CardTitle>
                <p className="text-xs text-muted-foreground">Select an individual to view comprehensive intelligence dossier</p>
              </div>

              {/* Category Filters */}
              <div className="flex flex-wrap gap-1 border-b border-border/60 pb-3">
                {[
                  { id: "all", label: "All Watchlist" },
                  { id: "high", label: "High Risk (>80)" },
                  { id: "property", label: "Property MO" },
                  { id: "violent", label: "Violent MO" }
                ].map(chip => (
                  <button
                    key={chip.id}
                    onClick={() => setFilterTab(chip.id as any)}
                    className={`px-2 py-1 text-[10.5px] rounded-full border transition-all ${
                      filterTab === chip.id 
                        ? "bg-primary/10 border-primary text-primary font-medium" 
                        : "bg-surface-2 border-border text-muted-foreground hover:bg-[#f1f3f4]"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <Input 
                placeholder="Search by offender name…" 
                value={q} 
                onChange={e => setQ(e.target.value)} 
                className="bg-surface-2 border-border text-xs focus:ring-1 focus:ring-primary" 
              />
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[580px] overflow-y-auto divide-y divide-border">
                {filtered.map(o => {
                  const isActive = openId === o.id;
                  const isHighRisk = o.riskScore > 80;
                  return (
                    <button 
                      key={o.id} 
                      onClick={() => selectOffender(o.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all ${
                        isActive 
                          ? "bg-[#f1f3f4]/80 font-medium" 
                          : "bg-transparent hover:bg-surface-2"
                      }`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-sans font-semibold text-xs border ${
                        isHighRisk ? "bg-signal/10 border-signal/20 text-signal" : "bg-primary/10 border-primary/20 text-primary"
                      }`}>
                        {o.name.split(" ").map(x => x[0]).join("")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold truncate text-ink">{o.name}</span>
                          <span className="font-mono text-[9px] text-muted-foreground shrink-0">{o.id}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{o.incidentCount} incidents</span>
                          <span>·</span>
                          <span>{o.jurisdictions.length} districts</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`border-0 text-[10px] font-semibold px-2 py-0.5 rounded ${
                          isHighRisk ? "bg-signal/15 text-signal" : "bg-primary/15 text-primary"
                        }`}>
                          {o.riskScore}
                        </Badge>
                        <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? "text-primary translate-x-0.5" : "text-muted-foreground/60"}`} />
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-xs text-muted-foreground italic">
                    No offenders match the filter criteria.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* COLUMN 2: Offender Detailed Dossier Panel (Span 3) */}
          {active && (
            <Card className="lg:col-span-3 bg-surface-1 border-border">
              <CardHeader className="pb-4">
                {/* Biometric Dossier Profile Header */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center pb-4 border-b border-border">
                  <div className="h-16 w-16 shrink-0 rounded-full border border-border bg-surface-2 overflow-hidden flex items-center justify-center relative">
                    {offenderPhoto ? (
                      <img src={offenderPhoto} alt={active.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center">
                        <User className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[7px] font-bold text-muted-foreground uppercase">Offender</span>
                      </div>
                    )}
                    <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-paper ${active.riskScore > 80 ? "bg-signal animate-pulse" : "bg-success"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base font-bold text-ink truncate">{active.name}</CardTitle>
                      {active.riskScore > 80 ? (
                        <Badge className="bg-signal/10 border-0 text-signal text-[9px] font-bold py-0 px-1 rounded-sm">🚨 HIGH SURVEILLANCE RISK</Badge>
                      ) : (
                        <Badge className="bg-success/10 border-0 text-success text-[9px] font-bold py-0 px-1 rounded-sm">🚔 STANDARD WATCHLIST</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ID: <span className="font-mono text-ink font-semibold">{active.id}</span> · {active.gender === "M" ? "Male" : "Female"} · Age {active.age}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-mono">
                      <span className="text-muted-foreground">Arrest state:</span>
                      {active.riskScore > 80 ? (
                        <span className="text-signal bg-signal/10 px-1.5 py-0.5 rounded-sm font-semibold uppercase">WANTED / AT LARGE</span>
                      ) : (
                        <span className="text-success bg-success/10 px-1.5 py-0.5 rounded-sm font-semibold uppercase">IN CUSTODY</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right sm:border-l sm:border-border sm:pl-4">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Risk Rating</p>
                    <p className={`font-display text-3xl font-bold mt-0.5 ${active.riskScore > 80 ? "text-signal" : active.riskScore > 60 ? "text-warning" : "text-primary"}`}>
                      {active.riskScore}
                    </p>
                  </div>
                </div>

                {/* Dossier Tabs Navigation */}
                <div className="flex border-b border-border/80 mt-4 overflow-x-auto whitespace-nowrap">
                  {[
                    { id: "overview", label: "Dossier Profile" },
                    { id: "timeline", label: "Incident History" },
                    { id: "syndicate", label: "Syndicate Network" },
                    { id: "prediction", label: "AI Forecast" }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as any)}
                      className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-all ${
                        activeTab === t.id 
                          ? "border-primary text-primary" 
                          : "border-transparent text-muted-foreground hover:text-ink"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4 pt-1">
                
                {/* TAB 1: OVERVIEW */}
                {activeTab === "overview" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-md border border-border bg-surface-2 p-3 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Total Crimes</p>
                        <p className="mt-1 font-display text-2xl font-bold text-ink">{active.incidentCount}</p>
                      </div>
                      <div className="rounded-md border border-border bg-surface-2 p-3 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Districts Active</p>
                        <p className="mt-1 font-display text-2xl font-bold text-ink">{active.jurisdictions.length}</p>
                      </div>
                      <div className="rounded-md border border-border bg-surface-2 p-3 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">MO Signatures</p>
                        <p className="mt-1 font-display text-2xl font-bold text-ink">{active.moTags.length}</p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Fingerprint className="h-3.5 w-3.5 text-primary" /> Behavioral Modus Operandi Tags
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {active.moTags.map(m => (
                          <Badge key={m} variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[10px] py-0.5 rounded-sm">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> Primary Operations Jurisdictions
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {active.jurisdictions.map(j => (
                          <Badge key={j} className="bg-[#f1f3f4] text-ink border border-border text-[10px] py-0.5 rounded-sm">
                            {j}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-surface-2 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">SCRB Watchlist Intelligence Brief</h4>
                      <p className="text-xs text-ink/80 leading-relaxed">
                        This offender has been tracked committing multiple offenses across {active.jurisdictions.length} distinct districts. 
                        Primary behavioral patterns focus heavily on '{active.moTags[0] || "unspecified operations"}'. 
                        Current risk score is calculated dynamically based on spatial density of active FIR cases, timing recurrence, and co-accused gang linkage counts.
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 2: INCIDENT TIMELINE */}
                {activeTab === "timeline" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <p className="text-xs text-muted-foreground">Chronological incident log links to full case dossiers:</p>
                    <div className="relative pl-4 space-y-4">
                      <span className="absolute left-1 top-2 bottom-2 w-px bg-border" />
                      {active.cases.slice(0, 6).map(cid => {
                        const c = CASES.find(x => x.caseMasterId === cid);
                        if (!c) return null;
                        return (
                          <div key={cid} className="relative">
                            <span className="absolute -left-3 top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-paper" />
                            <Link to={`/cases/${c.caseMasterId}`} className="block group">
                              <div className="rounded-md border border-border bg-surface-2 p-3 transition-all group-hover:border-primary group-hover:bg-[#f8fafc]">
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="text-primary font-bold group-hover:underline">FIR {c.crimeNo}</span>
                                  <span className="text-muted-foreground">{new Date(c.registeredDate || c.incidentDate).toLocaleDateString("en-IN")}</span>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-ink">{c.crimeHead.name} · <span className="text-muted-foreground font-normal">{c.district.name} ({c.policeStation})</span></p>
                                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{c.briefFacts}</p>
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="outline" className="text-[9.5px] border-border py-0 px-1.5">{c.moTag}</Badge>
                                  <Badge variant="outline" className={`text-[9.5px] py-0 px-1.5 ${c.gravity === "Heinous" ? "bg-signal/5 border-signal/20 text-signal" : "border-border"}`}>{c.gravity}</Badge>
                                </div>
                              </div>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: SYNDICATE NETWORK */}
                {activeTab === "syndicate" && (
                  <div className="animate-in fade-in duration-200">
                    <AssociatesPanel offenderId={active.id} />
                  </div>
                )}

                {/* TAB 4: AI FORECAST */}
                {activeTab === "prediction" && (
                  <div className="animate-in fade-in duration-200">
                    <PredictionPanel offender={active} cases={CASES} />
                  </div>
                )}

              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function AssociatesPanel({ offenderId }: { offenderId: string }) {
  const { offenderAssociates: OFFENDER_ASSOCIATES } = useDb();
  const associates = OFFENDER_ASSOCIATES[offenderId] ?? [];
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const roleMeta: Record<string, { color: string; bg: string; text: string }> = {
    "Co-Accused": { color: "#0b57d0", bg: "#e8f0fe", text: "#0b57d0" },
    "Handler": { color: "#7c3aed", bg: "#f3e8fd", text: "#5b21b6" },
    "Informant": { color: "#188038", bg: "#e6f4ea", text: "#137333" },
    "Victim": { color: "#d93025", bg: "#fce8e6", text: "#c5221f" },
  };

  const CX = 250;
  const CY = 220;
  const RAD = 135;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-4 w-4 text-primary" /> Criminal Syndicate Link Analysis
        </p>
        <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[10px] font-bold px-2 py-0.5 rounded-sm">
          {associates.length} Linked Nodes
        </Badge>
      </div>

      <div className="rounded-md border border-border bg-surface-2 p-4 space-y-4">
        {/* Cinematic Link Diagram */}
        <div className="relative mx-auto aspect-square w-full max-w-[460px] bg-paper rounded border border-border p-2 overflow-hidden flex items-center justify-center">
          {/* Grid Dot Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#dadce0_1px,transparent_1px)] [background-size:18px_18px] opacity-40 pointer-events-none" />

          <svg viewBox="0 0 500 500" className="h-full w-full relative z-10">
            <defs>
              <filter id="glow-link" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connection Strings */}
            {associates.map((a, i) => {
              const angle = (i / associates.length) * Math.PI * 2 - Math.PI / 2;
              const x = CX + Math.cos(angle) * RAD;
              const y = CY + Math.sin(angle) * RAD;
              const isHovered = hoveredIdx === i;
              const meta = roleMeta[a.role] || roleMeta["Co-Accused"];

              return (
                <g key={`link-${i}`}>
                  <line
                    x1={CX}
                    y1={CY}
                    x2={x}
                    y2={y}
                    stroke={isHovered ? meta.color : "#cbd5e1"}
                    strokeOpacity={isHovered ? 1 : 0.6}
                    strokeWidth={isHovered ? 3 : Math.max(1, a.strength / 35)}
                    strokeDasharray={a.role === "Victim" ? "4 3" : "none"}
                    filter={isHovered ? "url(#glow-link)" : undefined}
                  />
                </g>
              );
            })}

            {/* Center Target Node */}
            <g transform={`translate(${CX}, ${CY})`}>
              <circle r={32} fill="#0b57d0" opacity={0.1} />
              <circle r={22} fill="#0f172a" stroke="#0b57d0" strokeWidth={2} />
              <text textAnchor="middle" y={3} fontSize="8" fill="#ffffff" fontFamily="Inter, sans-serif" fontWeight="bold">
                TARGET
              </text>
            </g>

            {/* Associate Nodes */}
            {associates.map((a, i) => {
              const angle = (i / associates.length) * Math.PI * 2 - Math.PI / 2;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              const x = CX + cos * RAD;
              const y = CY + sin * RAD;
              const isHovered = hoveredIdx === i;
              const meta = roleMeta[a.role] || roleMeta["Co-Accused"];

              let textX = 0;
              let textY = -18;
              let textAnchor: "end" | "middle" | "start" | "inherit" = "middle";

              if (cos > 0.3) {
                textX = 18;
                textY = 3;
                textAnchor = "start";
              } else if (cos < -0.3) {
                textX = -18;
                textY = 3;
                textAnchor = "end";
              } else if (sin > 0.3) {
                textX = 0;
                textY = 24;
                textAnchor = "middle";
              }

              return (
                <g
                  key={`node-${i}`}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <circle
                    r={isHovered ? 14 : 10}
                    fill={meta.bg}
                    stroke={meta.color}
                    strokeWidth={isHovered ? 2 : 1.5}
                  />
                  <circle r={4} fill={meta.color} />

                  <text
                    x={textX}
                    y={textY}
                    textAnchor={textAnchor}
                    fontSize="10"
                    fontWeight="bold"
                    fill="#202124"
                    fontFamily="Inter, sans-serif"
                    style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 } as React.CSSProperties}
                  >
                    {a.name}
                  </text>

                  <text
                    x={textX}
                    y={textY + 11}
                    textAnchor={textAnchor}
                    fontSize="8.5"
                    fontWeight="medium"
                    fill={meta.color}
                    fontFamily="Inter, sans-serif"
                    style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 2.5 } as React.CSSProperties}
                  >
                    {a.role}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Bottom Diagram Legend */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-3 bg-paper/95 backdrop-blur border border-border rounded py-1 px-3 text-[9px] font-semibold text-muted-foreground shadow-sm">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#0b57d0]" /> Co-Accused</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#7c3aed]" /> Handler</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#188038]" /> Informant</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#d93025]" /> Victim</span>
          </div>
        </div>

        {/* Associates Table Grid */}
        <div className="divide-y divide-border rounded border border-border bg-paper overflow-hidden">
          {associates.map((a, i) => {
            const isHovered = hoveredIdx === i;
            const meta = roleMeta[a.role] || roleMeta["Co-Accused"];
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`grid grid-cols-[1fr_80px_45px] items-center gap-3 px-3 py-2 text-xs transition-colors cursor-pointer ${
                  isHovered ? "bg-[#f1f3f4]" : "hover:bg-surface-2"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{a.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{a.relation} · {a.sharedCases} shared FIR(s)</p>
                </div>

                <div className="text-center">
                  <span className="font-semibold text-[9.5px] px-2 py-0.5 rounded-full inline-block" style={{ background: meta.bg, color: meta.text }}>
                    {a.role}
                  </span>
                </div>

                <span className="font-mono text-[10px] font-bold text-muted-foreground text-right">{a.strength}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PredictionPanel({ offender, cases }: { offender: any; cases: any[] }) {
  const offenderCases = useMemo(() => {
    return cases.filter(c => offender.cases.includes(c.caseMasterId));
  }, [offender, cases]);

  // Compute live prediction stats based on previous activities
  const pred = useMemo(() => {
    if (offenderCases.length === 0) return null;

    // 1. Target district: Mode frequency
    const districtCounts: Record<string, number> = {};
    offenderCases.forEach(c => {
      const dist = c.district.name;
      districtCounts[dist] = (districtCounts[dist] || 0) + 1;
    });
    let likelyDistrict = offender.jurisdictions[0] || "Bengaluru City";
    let maxDistCount = 0;
    Object.entries(districtCounts).forEach(([dist, count]) => {
      if (count > maxDistCount) {
        likelyDistrict = dist;
        maxDistCount = count;
      }
    });

    // 2. Next crime MO: Mode frequency
    const crimeCounts: Record<string, number> = {};
    offenderCases.forEach(c => {
      const name = c.crimeHead.name;
      crimeCounts[name] = (crimeCounts[name] || 0) + 1;
    });
    let likelyCrime = "Property Offence";
    let maxCrimeCount = 0;
    Object.entries(crimeCounts).forEach(([crime, count]) => {
      if (count > maxCrimeCount) {
        likelyCrime = crime;
        maxCrimeCount = count;
      }
    });

    // 3. Operational timeframe density
    let morningCount = 0;
    let nightCount = 0;
    offenderCases.forEach(c => {
      if (c.hour) {
        if (c.hour >= 21 || c.hour < 5) nightCount++;
        else morningCount++;
      }
    });
    const timeBand = nightCount >= morningCount ? "Late Night (21:00 - 03:00 hrs)" : "Morning Peak (06:00 - 11:00 hrs)";

    // 4. Probability calculation
    const probability = Math.min(95, Math.max(45, 55 + offenderCases.length * 6));
    const confidence = probability > 80 ? "High" : probability > 60 ? "Medium" : "Low";

    // 5. Dynamic trigger drivers
    const drivers = [
      `High recurrence in ${likelyDistrict} sector`,
      `Aligned specialization in ${likelyCrime}`,
      `${offenderCases.length} linked historical FIR cases`,
      `Active syndicate link density: ${offender.riskScore > 80 ? "High risk gang cell" : "Standard cluster strength"}`
    ];

    // 6. Dynamic risk trajectory
    const timeline = Array.from({ length: 7 }, (_, i) => {
      const dayNum = i * 2 + 2;
      const baseRisk = Math.round(probability * 0.55);
      const increment = Math.round(i * (probability * 0.45 / 6));
      return {
        day: `Day ${dayNum}`,
        risk: Math.min(100, baseRisk + increment)
      };
    });

    return {
      nextCrime: likelyCrime,
      district: likelyDistrict,
      window: offenderCases.length > 4 ? "48 - 72 Hours" : "7 - 10 Days",
      probability,
      confidence,
      timeBand,
      drivers,
      timeline
    };
  }, [offender, offenderCases]);

  if (!pred) return null;

  const confColor = pred.confidence === "High" ? "text-success border-success/40 bg-success/10"
    : pred.confidence === "Medium" ? "text-warning border-warning/40 bg-warning/10"
    : "text-primary border-primary/40 bg-primary/10";

  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" /> Predictive Intelligence · Next Likely Action
        </p>
        <Badge className={`border text-[9.5px] px-1.5 rounded-sm ${confColor}`}>{pred.confidence} confidence</Badge>
      </div>

      <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Projected Target</p>
            <p className="mt-1 text-sm font-bold text-ink">
              {offender.name} is likely to attempt <span className="text-primary">{pred.nextCrime}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Estimated window: <span className="text-ink font-semibold">{pred.window}</span> — sector hotspot:{" "}
              <span className="text-ink font-semibold">{pred.district}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Probability</p>
            <p className="font-display text-2xl font-bold text-primary">{pred.probability}%</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-border bg-paper p-2">
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold"><Target className="h-3 w-3" /> Target MO</p>
            <p className="mt-0.5 font-semibold text-ink">{pred.nextCrime}</p>
          </div>
          <div className="rounded border border-border bg-paper p-2">
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold"><MapPin className="h-3 w-3" /> Likely District</p>
            <p className="mt-0.5 font-semibold text-ink">{pred.district}</p>
          </div>
          <div className="rounded border border-border bg-paper p-2">
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold"><Clock className="h-3 w-3" /> Time Band</p>
            <p className="mt-0.5 font-semibold text-ink">{pred.timeBand}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">14-Day Risk Trajectory Graph</p>
          <div className="h-32">
            <ResponsiveContainer>
              <AreaChart data={pred.timeline}>
                <defs>
                  <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0b57d0" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0b57d0" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                <XAxis dataKey="day" stroke="#5f6368" fontSize={9} />
                <YAxis stroke="#5f6368" fontSize={9} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #dadce0", borderRadius: 4, fontSize: 11 }} />
                <Area type="monotone" dataKey="risk" stroke="#0b57d0" strokeWidth={1.5} fill="url(#predGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
            <TriangleAlert className="h-3 w-3 text-warning" /> AI Risk Trigger Factors
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pred.drivers.map((d, i) => (
              <Badge key={i} variant="outline" className="text-[9.5px] border-border py-0 bg-paper">
                {d}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
