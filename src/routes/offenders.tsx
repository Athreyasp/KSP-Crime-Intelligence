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
  const roleStyle: Record<string, string> = {
    "Co-Accused": "border-alert/40 text-alert bg-alert/5",
    "Handler": "border-warning/40 text-warning bg-warning/5",
    "Informant": "border-primary/40 text-primary bg-primary/5",
    "Victim": "border-border text-muted-foreground bg-surface-2",
  };
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Connected Persons · Link Analysis
      </p>
      <div className="rounded-md border border-border bg-surface-2 p-3">
        {/* Radial connection diagram */}
        <div className="relative mx-auto aspect-square w-full max-w-[340px]">
          <svg viewBox="0 0 340 340" className="h-full w-full">
            {associates.map((a, i) => {
              const angle = (i / associates.length) * Math.PI * 2 - Math.PI / 2;
              const x = 170 + Math.cos(angle) * 130;
              const y = 170 + Math.sin(angle) * 130;
              return (
                <line key={`l-${i}`} x1={170} y1={170} x2={x} y2={y}
                  stroke="oklch(0.78 0.14 195)" strokeOpacity={a.strength / 200} strokeWidth={a.strength / 40} />
              );
            })}
            <circle cx={170} cy={170} r={26} fill="oklch(0.68 0.22 28)" fillOpacity={0.9} stroke="oklch(0.16 0.02 250)" strokeWidth={2} />
            <text x={170} y={174} textAnchor="middle" fontSize="10" fill="oklch(0.98 0 0)" fontFamily="Inter" fontWeight="600">
              SUBJECT
            </text>
            {associates.map((a, i) => {
              const angle = (i / associates.length) * Math.PI * 2 - Math.PI / 2;
              const x = 170 + Math.cos(angle) * 130;
              const y = 170 + Math.sin(angle) * 130;
              const fill = a.role === "Victim" ? "oklch(0.78 0.16 70)"
                : a.role === "Handler" ? "oklch(0.78 0.16 70)"
                : a.role === "Informant" ? "oklch(0.78 0.14 195)"
                : "oklch(0.68 0.22 28)";
              return (
                <g key={`n-${i}`}>
                  <circle cx={x} cy={y} r={14} fill={fill} fillOpacity={0.85} stroke="oklch(0.16 0.02 250)" strokeWidth={2} />
                  <text x={x} y={y - 20} textAnchor="middle" fontSize="9" fill="oklch(0.95 0.01 250)" fontFamily="Inter">
                    {a.name.split(" ")[0]}
                  </text>
                  <text x={x} y={y + 28} textAnchor="middle" fontSize="8" fill="oklch(0.68 0.02 250)" fontFamily="Inter">
                    {a.role}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Table */}
        <div className="mt-3 divide-y divide-border rounded-md border border-border bg-background">
          {associates.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.name}</p>
                <p className="truncate text-muted-foreground">{a.relation} · {a.sharedCases} shared case(s)</p>
              </div>
              <Badge variant="outline" className={`text-[10px] ${roleStyle[a.role]}`}>{a.role}</Badge>
              <div className="hidden sm:flex h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-primary" style={{ width: `${a.strength}%` }} />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{a.strength}</span>
            </div>
          ))}
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
