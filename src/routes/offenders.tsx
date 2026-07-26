import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDb } from "@/hooks/use-db";
import { ChevronRight, MapPin, Fingerprint, Users, Sparkles, TriangleAlert, Clock, Target } from "lucide-react";
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

  useEffect(() => {
    if (!openId && OFFENDERS.length > 0) {
      setOpenId(OFFENDERS[0].id);
    }
  }, [OFFENDERS, openId]);

  const filtered = OFFENDERS.filter(o => o.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.riskScore - a.riskScore);
  const active = OFFENDERS.find(o => o.id === openId) || OFFENDERS[0];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        section="§ 04"
        eyebrow="Watchlist · Cross-jurisdictional"
        title="Repeat Offender Tracker"
        description="Individuals linked to multiple FIRs — Modus Operandi, associates and predictive next-action intelligence."
        actions={<Badge variant="outline" className="border-signal/40 text-signal">{OFFENDERS.length} on watchlist</Badge>}
      />

      {OFFENDERS.length === 0 ? (
        <Card className="p-8 text-center bg-surface-1 border-border">
          <p className="text-sm text-muted-foreground italic">No repeat offenders registered yet. Offender profiles and predictive next-action intelligence will be displayed here once cases with accused details are added.</p>
          <div className="mt-4">
            <Link to="/cases/new" className="inline-flex items-center gap-1.5 bg-ink px-4 py-2 text-xs font-semibold text-paper hover:bg-signal transition-colors">
              Register new FIR Case
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5 items-start">
        <Card className="lg:col-span-2 bg-surface-1 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Watchlist</CardTitle>
            <Input placeholder="Search offender…" value={q} onChange={e => setQ(e.target.value)} className="mt-2 bg-surface-2 border-border" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[560px] overflow-y-auto">
              {filtered.map(o => (
                <button key={o.id} onClick={() => setOpenId(o.id)}
                  className={`flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left hover:bg-surface-2 ${openId === o.id ? "bg-surface-2" : ""}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display font-semibold text-sm ${
                    o.riskScore > 80 ? "bg-alert/20 text-alert" : o.riskScore > 60 ? "bg-warning/20 text-warning" : "bg-primary/15 text-primary"
                  }`}>
                    {o.name.split(" ").map(x => x[0]).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{o.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{o.incidentCount} FIRs · {o.jurisdictions.length} districts</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${o.riskScore > 80 ? "border-alert/40 text-alert" : o.riskScore > 60 ? "border-warning/40 text-warning" : "border-primary/40 text-primary"}`}>
                    {o.riskScore}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {active && (
          <Card className="lg:col-span-3 bg-surface-1 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{active.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{active.id} · Age {active.age} · {active.gender}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk score</p>
                  <p className={`font-display text-3xl font-semibold ${active.riskScore > 80 ? "text-alert" : active.riskScore > 60 ? "text-warning" : "text-primary"}`}>
                    {active.riskScore}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Incidents</p>
                  <p className="mt-1 font-display text-2xl">{active.incidentCount}</p>
                </div>
                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Districts</p>
                  <p className="mt-1 font-display text-2xl">{active.jurisdictions.length}</p>
                </div>
                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">MO Patterns</p>
                  <p className="mt-1 font-display text-2xl">{active.moTags.length}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Fingerprint className="h-3.5 w-3.5" /> Modus Operandi</p>
                <div className="flex flex-wrap gap-1.5">
                  {active.moTags.map(m => <Badge key={m} variant="outline" className="border-primary/40 text-primary">{m}</Badge>)}
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Jurisdictions</p>
                <div className="flex flex-wrap gap-1.5">
                  {active.jurisdictions.map(j => <Badge key={j} variant="secondary" className="bg-surface-2">{j}</Badge>)}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Incident Timeline</p>
                <div className="relative pl-4">
                  <span className="absolute left-1 top-1 bottom-1 w-px bg-border" />
                  <div className="space-y-3">
                    {active.cases.slice(0, 6).map(cid => {
                      const c = CASES.find(x => x.caseMasterId === cid);
                      if (!c) return null;
                      return (
                        <div key={cid} className="relative">
                          <span className="absolute -left-3 top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
                          <div className="rounded-md border border-border bg-surface-2 p-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono">FIR {c.caseMasterId}</span>
                              <span className="text-muted-foreground">{new Date(c.registeredDate).toLocaleDateString("en-IN")}</span>
                            </div>
                            <p className="mt-1 text-sm">{c.crimeHead.name} · <span className="text-muted-foreground">{c.district.name}</span></p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{c.moTag}</Badge>
                              <Badge variant="outline" className={`text-[10px] ${c.gravity === "Heinous" ? "border-alert/40 text-alert" : ""}`}>{c.gravity}</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Connected persons / associates */}
              <AssociatesPanel offenderId={active.id} />

              {/* Predictive intelligence — what they will likely do next */}
              <PredictionPanel offenderId={active.id} offenderName={active.name} />
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
    "Co-Accused": { color: "#dc2626", bg: "#fef2f2", text: "#991b1b" },
    "Handler": { color: "#7c3aed", bg: "#f3e8fd", text: "#5b21b6" },
    "Informant": { color: "#2563eb", bg: "#eff6ff", text: "#1e40af" },
    "Victim": { color: "#d97706", bg: "#fffbe8", text: "#92400e" },
  };

  const CX = 250;
  const CY = 220;
  const RAD = 135;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-[#475569]">
          <Users className="h-4 w-4 text-[#2563eb]" /> Criminal Syndicate Link Analysis
        </p>
        <Badge className="bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] font-mono text-[10px] font-bold px-2.5 py-0.5">
          {associates.length} Connected Associates
        </Badge>
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm space-y-4">
        {/* Cinematic Link Diagram */}
        <div className="relative mx-auto aspect-square w-full max-w-[460px] bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] p-2 overflow-hidden shadow-inner flex items-center justify-center">
          {/* Grid Dot Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px] opacity-50 pointer-events-none" />

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
                    stroke={isHovered ? meta.color : "#94a3b8"}
                    strokeOpacity={isHovered ? 1 : 0.45}
                    strokeWidth={isHovered ? 3.5 : Math.max(1.5, a.strength / 30)}
                    strokeDasharray={a.role === "Victim" ? "4 3" : "none"}
                    filter={isHovered ? "url(#glow-link)" : undefined}
                  />
                </g>
              );
            })}

            {/* Center Subject Node */}
            <g transform={`translate(${CX}, ${CY})`}>
              <circle r={36} fill="#dc2626" opacity={0.15} className="animate-pulse" />
              <circle r={26} fill="#0f172a" stroke="#dc2626" strokeWidth={3} />
              <text textAnchor="middle" y={-3} fontSize="9" fill="#94a3b8" fontFamily="JetBrains Mono" fontWeight="bold">
                TARGET
              </text>
              <text textAnchor="middle" y={9} fontSize="10" fill="#ffffff" fontFamily="Space Grotesk, sans-serif" fontWeight="bold">
                SUBJECT
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

              // Smart text positioning relative to angle
              let textX = 0;
              let textY = -22;
              let textAnchor = "middle";

              if (cos > 0.3) {
                textX = 22;
                textY = 4;
                textAnchor = "start";
              } else if (cos < -0.3) {
                textX = -22;
                textY = 4;
                textAnchor = "end";
              } else if (sin > 0.3) {
                textX = 0;
                textY = 28;
                textAnchor = "middle";
              }

              return (
                <g
                  key={`node-${i}`}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer transition-transform duration-200"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Outer ring */}
                  <circle
                    r={isHovered ? 18 : 14}
                    fill={meta.bg}
                    stroke={meta.color}
                    strokeWidth={isHovered ? 3 : 2}
                  />
                  
                  {/* Core Icon Dot */}
                  <circle r={5} fill={meta.color} />

                  {/* PERFECTLY ALIGNED READABLE LABELS */}
                  <text
                    x={textX}
                    y={textY}
                    textAnchor={textAnchor}
                    fontSize="11"
                    fontWeight="bold"
                    fill="#0f172a"
                    fontFamily="DM Sans, sans-serif"
                    style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 4 } as React.CSSProperties}
                  >
                    {a.name}
                  </text>

                  <text
                    x={textX}
                    y={textY + (textY > 0 ? 13 : 13)}
                    textAnchor={textAnchor}
                    fontSize="9"
                    fontWeight="bold"
                    fill={meta.text}
                    fontFamily="JetBrains Mono, monospace"
                    style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 } as React.CSSProperties}
                  >
                    {a.role} ({a.sharedCases} FIRs)
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Bottom Diagram Legend */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-3 bg-white/95 backdrop-blur border border-[#e2e8f0] rounded-xl py-1.5 px-3 text-[10px] font-semibold text-[#475569] shadow-sm">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" /> Co-Accused</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#7c3aed]" /> Handler</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" /> Informant</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#d97706]" /> Victim</span>
          </div>
        </div>

        {/* Perfectly Aligned Associates Grid Table */}
        <div className="divide-y divide-[#f1f5f9] rounded-xl border border-[#e2e8f0] bg-white overflow-hidden">
          {associates.map((a, i) => {
            const isHovered = hoveredIdx === i;
            const meta = roleMeta[a.role] || roleMeta["Co-Accused"];
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`grid grid-cols-[1fr_100px_90px_50px] items-center gap-3 px-3.5 py-2.5 text-xs transition-colors cursor-pointer ${
                  isHovered ? "bg-[#eff6ff]" : "hover:bg-[#f8fafc]"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-[#0f172a]">{a.name}</p>
                  <p className="truncate text-[11px] text-[#64748b]">{a.relation} · {a.sharedCases} shared FIR(s)</p>
                </div>

                <div className="text-center">
                  <span className="font-semibold text-[10px] px-2 py-0.5 rounded-full inline-block" style={{ background: meta.bg, color: meta.text }}>
                    {a.role}
                  </span>
                </div>

                <div className="hidden sm:flex items-center h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div className="h-full bg-[#2563eb]" style={{ width: `${a.strength}%` }} />
                </div>

                <span className="font-mono text-[11px] font-bold text-[#475569] text-right">{a.strength}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PredictionPanel({ offenderId, offenderName }: { offenderId: string; offenderName: string }) {
  const { offenderPredictions: OFFENDER_PREDICTIONS } = useDb();
  const pred = OFFENDER_PREDICTIONS[offenderId];
  if (!pred) return null;
  const confColor = pred.confidence === "High" ? "text-alert border-alert/40 bg-alert/10"
    : pred.confidence === "Medium" ? "text-warning border-warning/40 bg-warning/10"
    : "text-primary border-primary/40 bg-primary/10";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Predictive Intelligence · Next Likely Action
        </p>
        <Badge className={`border text-[10px] ${confColor}`}>{pred.confidence} confidence</Badge>
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Forecast</p>
            <p className="mt-1 text-base font-semibold">
              {offenderName} is likely to attempt <span className="text-primary">{pred.nextCrime}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              within <span className="text-foreground font-medium">{pred.window}</span> — most probable in{" "}
              <span className="text-foreground font-medium">{pred.district}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Probability</p>
            <p className="font-display text-3xl font-semibold text-primary">{pred.probability}%</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-border bg-background p-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><Target className="h-3 w-3" /> Target MO</p>
            <p className="mt-0.5 font-medium">{pred.nextCrime}</p>
          </div>
          <div className="rounded border border-border bg-background p-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><MapPin className="h-3 w-3" /> Likely District</p>
            <p className="mt-0.5 font-medium">{pred.district}</p>
          </div>
          <div className="rounded border border-border bg-background p-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><Clock className="h-3 w-3" /> Time Band</p>
            <p className="mt-0.5 font-medium">{pred.timeBand}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">14-Day Risk Trajectory</p>
          <div className="h-32">
            <ResponsiveContainer>
              <AreaChart data={pred.timeline}>
                <defs>
                  <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.68 0.22 28)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.68 0.22 28)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.03 250)" />
                <XAxis dataKey="day" stroke="oklch(0.68 0.02 250)" fontSize={10} />
                <YAxis stroke="oklch(0.68 0.02 250)" fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "oklch(0.2 0.025 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="risk" stroke="oklch(0.68 0.22 28)" strokeWidth={2} fill="url(#predGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <TriangleAlert className="h-3 w-3 text-warning" /> Model Drivers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pred.drivers.map((d, i) => (
              <Badge key={i} variant="outline" className="text-[10px] border-border">{d}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
