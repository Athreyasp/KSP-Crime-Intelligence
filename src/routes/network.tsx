import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from "d3-force";
import { Search, Route as RouteIcon, Radar, Focus, Users, Car, Phone, MapPin as PinIcon, Fingerprint, FileText, Sparkles, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relationColor, type EntityType, type RichNode, type RelationType } from "@/data/network-rich";
import { useDb } from "@/hooks/use-db";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Association Atlas · KSP Crime Intelligence" },
      { name: "description", content: "Investigator-grade link analysis: entities, relationships, clusters, and predicted next moves." },
      { property: "og:title", content: "Association Atlas — Link Analysis" },
      { property: "og:description", content: "Force-directed criminal network with cluster hulls, dossiers and predictive next-action intelligence." },
    ],
  }),
  component: NetworkPage,
});

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */
type SimNode = RichNode & SimulationNodeDatum & { x: number; y: number };
type SimLink = { source: SimNode; target: SimNode; relation: import("@/data/network-rich").RelationType; weight: number };

const W = 900;
const H = 600;

function useForceLayout(networkRich: any) {
  return useMemo(() => {
    if (!networkRich || !networkRich.nodes || networkRich.nodes.length === 0) {
      return { nodes: [], links: [] };
    }
    const nodes: SimNode[] = networkRich.nodes.map((n: any) => ({ ...n, x: W / 2 + Math.random() * 40 - 20, y: H / 2 + Math.random() * 40 - 20 }));
    const idx = new Map(nodes.map(n => [n.id, n]));
    const links = networkRich.edges.map((e: any) => ({
      source: idx.get(e.source)!, target: idx.get(e.target)!, relation: e.relation, weight: e.weight,
    })) as SimLink[];

    const sim = forceSimulation(nodes)
      .force("link", forceLink<SimNode, SimLink>(links).id((d: SimNode) => d.id).distance((l: SimLink) => 90 / (l.weight || 1)).strength(0.6))
      .force("charge", forceManyBody<SimNode>().strength(-260))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<SimNode>().radius(22).strength(0.9))
      .stop();

    for (let i = 0; i < 320; i++) sim.tick();
    return { nodes, links };
  }, [networkRich]);
}

/* ------------------------------------------------------------------ */
/* Icons/shapes for entity types                                       */
/* ------------------------------------------------------------------ */
const TYPE_META: Record<EntityType, { color: string; label: string; Icon: typeof Users }> = {
  accused:  { color: "var(--signal)",              label: "Accused",  Icon: Fingerprint },
  victim:   { color: "var(--amber-ink)",           label: "Victim",   Icon: Users },
  case:     { color: "oklch(0.45 0.03 250)",       label: "Case",     Icon: FileText },
  location: { color: "oklch(0.55 0.14 195)",       label: "Location", Icon: PinIcon },
  vehicle:  { color: "oklch(0.55 0.14 155)",       label: "Vehicle",  Icon: Car },
  phone:    { color: "oklch(0.55 0.15 300)",       label: "Phone",    Icon: Phone },
};

/* ------------------------------------------------------------------ */

function NetworkPage() {
  const { networkRich } = useDb();
  const { nodes, links } = useForceLayout(networkRich);
  
  const deg = useMemo(() => {
    const m = new Map<string, number>();
    if (!networkRich || !networkRich.edges) return m;
    for (const e of networkRich.edges) {
      m.set(e.source, (m.get(e.source) ?? 0) + 1);
      m.set(e.target, (m.get(e.target) ?? 0) + 1);
    }
    return m;
  }, [networkRich]);

  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | EntityType>("all");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const focused = selected ?? hover;
  const neighbors = useMemo(() => {
    const set = new Set<string>();
    if (!focused || !networkRich || !networkRich.edges) return set;
    for (const e of networkRich.edges) {
      if (e.source === focused) set.add(e.target);
      if (e.target === focused) set.add(e.source);
    }
    return set;
  }, [focused, networkRich]);

  const filteredNodes = nodes.filter(n => {
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    if (query && !n.label.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const selectedNode = selected ? nodes.find(n => n.id === selected) : null;

  // pan drag
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { ox: pan.x, oy: pan.y, px: e.clientX, py: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPan({ x: dragRef.current.ox + (e.clientX - dragRef.current.px) / zoom, y: dragRef.current.oy + (e.clientY - dragRef.current.py) / zoom });
  };
  const onPointerUp = () => (dragRef.current = null);

  const eventTimeline = useMemo(() => {
    const cluster = selectedNode?.cluster;
    if (!cluster) return [];
    return nodes
      .filter(n => n.cluster === cluster && (n.type === "case" || n.type === "accused"))
      .map(n => ({ id: n.id, label: n.label, type: n.type, when: n.meta.firstSeen ?? n.meta.lastSeen ?? "" }))
      .filter(x => x.when)
      .sort((a, b) => a.when.localeCompare(b.when));
  }, [selectedNode, nodes]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="editorial-rule">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal">§ 02 · Link Intelligence</div>
            <h1 className="font-editorial text-3xl md:text-4xl leading-none mt-1">Association Atlas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {nodes.length} entities · {links.length} relationships · {networkRich?.clusters.length ?? 0} clusters detected
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-signal/10 text-signal border border-signal/40 font-mono uppercase tracking-widest text-[9px]">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-signal pulse-alert" />
              Live graph
            </Badge>
            <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest">
              Model v1.4 · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </Badge>
          </div>
        </div>
      </header>

      {nodes.length === 0 ? (
        <Card className="p-8 text-center bg-surface-1 border-border">
          <p className="text-sm text-muted-foreground italic">No relationship network maps generated yet. Entity relationship links will be visualized here once cases with accused/victim details are added.</p>
          <div className="mt-4">
            <Link to="/cases/new" className="inline-flex items-center gap-1.5 bg-ink px-4 py-2 text-xs font-semibold text-paper hover:bg-signal transition-colors">
              Register new FIR Case
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-12 md:auto-rows-[minmax(0,auto)] items-stretch">
        {/* ---------------- Entity Rail ---------------- */}
        <Card className="md:col-span-4 lg:col-span-3 md:h-[600px] bg-surface-1 border-ink shadow-hard flex flex-col min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Zone 1</div>
            <CardTitle className="text-sm">Entity Rail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col min-h-0">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search person, case, phone…"
                className="h-8 pl-7 text-xs bg-paper border-ink/30" />
            </div>
            <div className="flex flex-wrap gap-1">
              {(["all", "accused", "victim", "case", "location", "vehicle", "phone"] as const).map(k => (
                <button key={k} onClick={() => setTypeFilter(k)}
                  className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors",
                    typeFilter === k ? "border-ink bg-ink text-paper" : "border-ink/25 text-muted-foreground hover:text-ink hover:border-ink/60")}>
                  {k}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2 space-y-1">
              {filteredNodes
                .sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0))
                .slice(0, 40)
                .map(n => {
                  const t = TYPE_META[n.type as EntityType];
                  const d = deg.get(n.id) ?? 0;
                  const risk = n.meta.riskScore ?? 0;
                  const active = selected === n.id;
                  return (
                    <button key={n.id} onClick={() => setSelected(n.id)}
                      className={cn("w-full text-left rounded-sm border px-2 py-1.5 transition-all group",
                        active ? "border-ink bg-paper shadow-hard" : "border-transparent hover:border-ink/30 hover:bg-paper")}>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-ink/40" style={{ background: t.color, color: "var(--paper)" }}>
                          <t.Icon className="h-3 w-3" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-medium">{n.label}</div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                            {t.label} · {d} link{d === 1 ? "" : "s"}
                          </div>
                        </div>
                        <ChevronRight className={cn("h-3 w-3 text-muted-foreground shrink-0", active && "text-signal")} />
                      </div>
                      {n.type === "accused" && (
                        <div className="mt-1.5 h-1 rounded-full bg-ink/10 overflow-hidden">
                          <div className="h-full bg-signal" style={{ width: `${risk}%` }} />
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* ---------------- Graph Canvas ---------------- */}
        <Card className="md:col-span-8 lg:col-span-6 md:h-[600px] bg-surface-1 border-ink shadow-hard overflow-hidden flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 shrink-0">
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Zone 2 · Canvas</div>
              <CardTitle className="text-sm truncate">Force-directed graph {selected && <span className="ml-2 font-mono text-[10px] text-signal">FOCUS: {selectedNode?.label}</span>}</CardTitle>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-mono" onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}>+</Button>
              <span className="font-mono text-[10px] tabular-nums w-8 text-center">{zoom.toFixed(1)}×</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-mono" onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}>−</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-mono ml-2" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setSelected(null); }}>
                <Focus className="h-3 w-3 mr-1" /> Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <div className="relative h-full min-h-[420px] bg-paper grid-bg border-t border-ink/20">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
              >
                <defs>
                  <filter id="halo" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                  <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="0.7" fill="oklch(0.28 0.02 260 / 0.15)" />
                  </pattern>
                </defs>

                <g transform={`translate(${pan.x * zoom} ${pan.y * zoom}) scale(${zoom})`}>
                  {/* Cluster hulls */}
                  {networkRich?.clusters?.map(c => {
                    const pts = nodes.filter(n => n.cluster === c.id);
                    if (pts.length < 3) return null;
                    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
                    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
                    const r = Math.max(...pts.map(p => Math.hypot(p.x - cx, p.y - cy))) + 30;
                    const isFocus = selectedNode?.cluster === c.id;
                    return (
                      <g key={c.id}>
                        <circle cx={cx} cy={cy} r={r}
                          fill={isFocus ? "var(--signal)" : "var(--ink)"}
                          fillOpacity={isFocus ? 0.06 : 0.03}
                          stroke={isFocus ? "var(--signal)" : "var(--ink)"}
                          strokeOpacity={isFocus ? 0.6 : 0.25}
                          strokeWidth={1}
                          strokeDasharray="4 4" />
                        <text x={cx - r * 0.7} y={cy - r + 14} fontFamily="JetBrains Mono" fontSize={10}
                          fill={isFocus ? "var(--signal)" : "var(--muted-foreground)"}
                          className="uppercase tracking-widest">
                          Cluster {c.id}
                        </text>
                      </g>
                    );
                  })}

                  {/* Edges */}
                  {links.map((l, i) => {
                    const dim = focused && !(neighbors.has(l.source.id) && (l.source.id === focused || l.target.id === focused) || (l.source.id === focused || l.target.id === focused));
                    const active = focused && (l.source.id === focused || l.target.id === focused);
                    return (
                      <line key={i} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
                        stroke={active ? relationColor(l.relation) : "var(--ink)"}
                        strokeOpacity={active ? 0.85 : dim ? 0.08 : 0.28}
                        strokeWidth={active ? 1.6 : 0.7}
                      />
                    );
                  })}

                  {/* Nodes */}
                  {nodes.map(n => {
                    const t = TYPE_META[n.type as EntityType];
                    const d = deg.get(n.id) ?? 1;
                    const r = n.type === "accused" ? 10 + Math.min(6, d) : n.type === "case" ? 6 : n.type === "location" ? 8 : 6;
                    const isFocus = focused === n.id;
                    const isNeighbor = focused && neighbors.has(n.id);
                    const isDim = focused && !isFocus && !isNeighbor;

                    return (
                      <g key={n.id}
                        transform={`translate(${n.x} ${n.y})`}
                        style={{ cursor: "pointer", opacity: isDim ? 0.15 : 1, transition: "opacity 0.2s" }}
                        onMouseEnter={() => setHover(n.id)}
                        onMouseLeave={() => setHover(null)}
                        onClick={(e) => { e.stopPropagation(); setSelected(n.id); }}>
                        {isFocus && <circle r={r + 14} fill={t.color} opacity={0.35} filter="url(#halo)" />}
                        {n.type === "accused" ? (
                          <polygon points={hexPoints(r + 2)} fill={t.color} stroke="var(--ink)" strokeWidth={1.5} />
                        ) : n.type === "case" ? (
                          <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.2} />
                        ) : n.type === "location" ? (
                          <polygon points={diamondPoints(r + 1)} fill={t.color} stroke="var(--ink)" strokeWidth={1.2} />
                        ) : (
                          <circle r={r} fill={t.color} stroke="var(--ink)" strokeWidth={1.2} />
                        )}
                        {(isFocus || isNeighbor || n.type === "accused") && (
                          <text y={r + 12} textAnchor="middle" fontSize={9} fontFamily="DM Sans"
                            fill="var(--ink)"
                            style={{ paintOrder: "stroke", stroke: "var(--paper)", strokeWidth: 3 } as React.CSSProperties}>
                            {n.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Legend overlay */}
              <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 rounded-sm border border-ink/25 bg-paper/90 backdrop-blur px-2 py-1.5">
                {(Object.entries(TYPE_META) as [EntityType, typeof TYPE_META.accused][]).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider">
                    <span className="h-2 w-2 rounded-sm" style={{ background: v.color }} />
                    {v.label}
                  </div>
                ))}
              </div>

              {/* Mini legend for relations */}
              <div className="absolute top-2 right-2 rounded-sm border border-ink/25 bg-paper/90 backdrop-blur px-2 py-1.5 space-y-0.5">
                {(["co-accused", "victim-of", "occurred-at", "called", "drove"] as const).map(r => (
                  <div key={r} className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider">
                    <span className="h-[2px] w-4" style={{ background: relationColor(r) }} />
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------------- Dossier ---------------- */}
        <Card className="md:col-span-12 lg:col-span-3 lg:h-[600px] bg-surface-1 border-ink shadow-hard flex flex-col min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Zone 3</div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-signal" /> Dossier
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto">
            {!selectedNode ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto h-10 w-10 flex items-center justify-center rounded-md border border-ink/25 bg-paper">
                  <Radar className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="font-editorial italic text-sm text-muted-foreground leading-snug">
                  "Every connection is a lead. Every lead is a case waiting to be closed."
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  Select an entity to open its file
                </p>
              </div>
            ) : (
              <DossierPanel node={selectedNode} nodes={nodes} deg={deg} edges={networkRich.edges} onOpen={id => setSelected(id)} />
            )}
          </CardContent>
        </Card>

        {/* ---------------- Timeline ---------------- */}
        <Card className="md:col-span-12 lg:col-span-8 bg-surface-1 border-ink shadow-hard flex flex-col">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Zone 4</div>
              <CardTitle className="text-sm">Cluster timeline {selectedNode && <span className="ml-2 font-mono text-[10px] text-signal">{selectedNode.cluster}</span>}</CardTitle>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{eventTimeline.length} events</span>
          </CardHeader>
          <CardContent>
            {eventTimeline.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Select a node to see its cluster's timeline.</p>
            ) : (
              <div className="relative py-4">
                <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-ink" />
                <div className="relative flex justify-between">
                  {eventTimeline.map((ev) => (
                    <button key={ev.id} onClick={() => setSelected(ev.id)}
                      className="group flex flex-col items-center gap-1">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground group-hover:text-ink">
                        {ev.when.slice(5)}
                      </span>
                      <span className={cn(
                        "h-3 w-3 rounded-full border-2 border-ink transition-all",
                        ev.type === "accused" ? "bg-signal" : "bg-paper group-hover:bg-signal"
                      )} />
                      <span className="max-w-[80px] truncate text-[10px] group-hover:text-signal">{ev.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------- Patterns ---------------- */}
        <Card className="md:col-span-12 lg:col-span-4 bg-surface-1 border-ink shadow-hard flex flex-col">
          <CardHeader className="pb-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Zone 5</div>
            <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-signal" /> Detected patterns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {networkRich.clusters.map((c: any, i: number) => {
              const size = nodes.filter(n => n.cluster === c.id).length;
              const kindColor = c.kind === "organised" ? "signal" : c.kind === "recurring-mo" ? "warning" : "info";
              return (
                <button key={c.id}
                  onClick={() => {
                    const first = nodes.find(n => n.cluster === c.id && n.type === "accused");
                    if (first) setSelected(first.id);
                  }}
                  className={cn("w-full text-left rounded-sm border p-2.5 transition-all",
                    `border-${kindColor}/40 bg-${kindColor}/5 hover:bg-${kindColor}/10 hover:shadow-hard`)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] uppercase tracking-widest">Cluster {c.id}</span>
                    <Badge className={cn("border font-mono text-[9px] uppercase",
                      `bg-${kindColor}/15 text-${kindColor} border-${kindColor}/40`)}>{c.kind.replace("-", " ")}</Badge>
                  </div>
                  <div className="text-[12px] font-medium">{c.label}</div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>{size} entities · confidence {60 + i * 8}%</span>
                    <span className="flex items-center gap-1 text-ink"><RouteIcon className="h-3 w-3" /> View</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}

/* --- helpers --- */
function hexPoints(r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${Math.cos(a) * r},${Math.sin(a) * r}`;
  }).join(" ");
}
function diamondPoints(r: number) {
  return `0,${-r} ${r},0 0,${r} ${-r},0`;
}

/* --- Dossier subcomponent --- */
function DossierPanel({ node, nodes, deg, edges, onOpen }: { node: RichNode; nodes: RichNode[]; deg: Map<string, number>; edges: any[]; onOpen: (id: string) => void }) {
  const t = TYPE_META[node.type as EntityType];
  const links = edges
    .filter(e => e.source === node.id || e.target === node.id)
    .map(e => {
      const otherId = e.source === node.id ? e.target : e.source;
      return { other: nodes.find(n => n.id === otherId)!, relation: e.relation, weight: e.weight };
    })
    .filter(x => x.other)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

  const pred = node.meta.predictedNext;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center border border-ink shadow-hard" style={{ background: t.color, color: "var(--paper)" }}>
          <t.Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t.label} · {node.cluster}</div>
          <div className="font-semibold text-sm truncate">{node.label}</div>
          {node.meta.aliases?.[0] && <div className="font-editorial italic text-[11px] text-muted-foreground">a.k.a. {node.meta.aliases[0]}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {node.meta.age && <StatBox k="Age" v={String(node.meta.age)} />}
        {node.meta.district && <StatBox k="District" v={node.meta.district} />}
        {node.meta.activeFIRs != null && <StatBox k="Active FIRs" v={String(node.meta.activeFIRs)} />}
        <StatBox k="Links" v={String(deg.get(node.id) ?? 0)} />
        {node.meta.firstSeen && <StatBox k="First seen" v={node.meta.firstSeen} />}
        {node.meta.lastSeen && <StatBox k="Last seen" v={node.meta.lastSeen} />}
      </div>

      {node.meta.riskScore != null && (
        <div>
          <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
            <span>Risk score</span><span className="text-signal">{node.meta.riskScore}/100</span>
          </div>
          <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <div className="h-full bg-signal" style={{ width: `${node.meta.riskScore}%` }} />
          </div>
        </div>
      )}

      {pred && (
        <div className="rounded-sm border border-signal/40 bg-signal/5 p-2">
          <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-signal mb-1">
            <Sparkles className="h-3 w-3" /> Predicted next
          </div>
          <div className="text-[12px] font-medium">{pred.crime}</div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>{pred.window}</span><span className="text-signal">{pred.probability}% likely</span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-ink/10 overflow-hidden">
            <div className="h-full bg-signal" style={{ width: `${pred.probability}%` }} />
          </div>
        </div>
      )}

      <div>
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Connected to</div>
        <div className="space-y-1">
          {links.map((l, i) => {
            const ot = TYPE_META[l.other.type as EntityType];
            return (
              <button key={i} onClick={() => onOpen(l.other.id)}
                className="w-full text-left flex items-center gap-2 rounded-sm border border-transparent hover:border-ink/30 hover:bg-paper px-1.5 py-1">
                <span className="h-4 w-4 rounded-sm flex items-center justify-center" style={{ background: ot.color }}>
                  <ot.Icon className="h-2.5 w-2.5 text-paper" />
                </span>
                <span className="flex-1 truncate text-[11px]">{l.other.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{l.relation}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatBox({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-sm border border-ink/20 bg-paper px-2 py-1">
      <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="text-[12px] font-medium truncate">{v}</div>
    </div>
  );
}
