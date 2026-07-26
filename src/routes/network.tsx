import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from "d3-force";
import {
  Search, Radar, Focus, Users, Car, Phone, MapPin as PinIcon, Fingerprint, FileText, Sparkles, ChevronRight,
  ShieldAlert, Eye, RotateCcw, Clock, Database, X, LayoutGrid, Network as NetworkIcon, ArrowUpRight, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type EntityType, type RichNode, type RelationType } from "@/data/network-rich";
import { useDb } from "@/hooks/use-db";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Network Atlas · Google Material Police Intelligence" },
      { name: "description", content: "Ultra-clean Google Material 3 link intelligence workspace derived from Zoho database FIR records." },
    ],
  }),
  component: NetworkPage,
});

/* ------------------------------------------------------------------ */
/* Types & Metadata Palette                                           */
/* ------------------------------------------------------------------ */
type SimNode = RichNode & SimulationNodeDatum & { x: number; y: number };
type SimLink = { source: SimNode; target: SimNode; relation: RelationType; weight: number };

const W = 1000;
const H = 620;

const TYPE_META: Record<EntityType, { color: string; bg: string; border: string; label: string; Icon: typeof Users }> = {
  accused:  { color: "#d93025", bg: "#fce8e6", border: "#f8b4b0", label: "Suspect", Icon: Fingerprint },
  victim:   { color: "#1a73e8", bg: "#e8f0fe", border: "#aecbfa", label: "Victim",  Icon: Users },
  case:     { color: "#e37400", bg: "#fef7e0", border: "#fde293", label: "FIR Case", Icon: FileText },
  location: { color: "#188038", bg: "#e6f4ea", border: "#a8dab5", label: "Location", Icon: PinIcon },
  vehicle:  { color: "#a142f4", bg: "#f3e8fd", border: "#d7aefb", label: "Vehicle", Icon: Car },
  phone:    { color: "#ec4899", bg: "#fce7f3", border: "#f9a8d4", label: "Phone",   Icon: Phone },
};

/* ------------------------------------------------------------------ */
/* Force Layout Hook                                                  */
/* ------------------------------------------------------------------ */
function useForceLayout(networkRich: any) {
  return useMemo(() => {
    if (!networkRich || !networkRich.nodes || networkRich.nodes.length === 0) {
      return { nodes: [], links: [] };
    }
    const nodes: SimNode[] = networkRich.nodes.map((n: any) => ({
      ...n,
      x: W / 2 + (Math.random() - 0.5) * 380,
      y: H / 2 + (Math.random() - 0.5) * 280
    }));
    const idx = new Map(nodes.map(n => [n.id, n]));
    const links = networkRich.edges
      .map((e: any) => ({
        source: idx.get(e.source)!,
        target: idx.get(e.target)!,
        relation: e.relation,
        weight: e.weight || 1,
      }))
      .filter((l: any) => l.source && l.target) as SimLink[];

    const sim = forceSimulation(nodes)
      .force("link", forceLink<SimNode, SimLink>(links).id((d: SimNode) => d.id).distance(125).strength(0.5))
      .force("charge", forceManyBody<SimNode>().strength(-280))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<SimNode>().radius(30).strength(0.8))
      .stop();

    for (let i = 0; i < 350; i++) sim.tick();
    return { nodes, links };
  }, [networkRich]);
}

export function NetworkPage() {
  const { networkRich, cases } = useDb();
  const { nodes, links } = useForceLayout(networkRich);

  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | EntityType>("all");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"graph" | "directory">("graph");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (query && !n.label.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [nodes, typeFilter, query]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const filteredLinks = useMemo(() => {
    return links.filter(l => filteredNodeIds.has(l.source.id) && filteredNodeIds.has(l.target.id));
  }, [links, filteredNodeIds]);

  const deg = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of filteredLinks) {
      m.set(l.source.id, (m.get(l.source.id) ?? 0) + 1);
      m.set(l.target.id, (m.get(l.target.id) ?? 0) + 1);
    }
    return m;
  }, [filteredLinks]);

  // Focus Highlight
  const activeFocusId = selected || hover;
  const connectedNeighborIds = useMemo(() => {
    const set = new Set<string>();
    if (!activeFocusId) return set;
    set.add(activeFocusId);
    for (const l of filteredLinks) {
      if (l.source.id === activeFocusId) set.add(l.target.id);
      if (l.target.id === activeFocusId) set.add(l.source.id);
    }
    return set;
  }, [activeFocusId, filteredLinks]);

  // Default select first suspect
  useEffect(() => {
    if (!selected && filteredNodes.length > 0) {
      const firstAccused = filteredNodes.find(n => n.type === "accused");
      if (firstAccused) setSelected(firstAccused.id);
    }
  }, [filteredNodes, selected]);

  const selectedNode = selected ? nodes.find(n => n.id === selected) : null;

  // Pan / Drag controls
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-12">
      {/* GOOGLE MATERIAL CLEAN HEADER */}
      <PageHeader
        section="§ 02"
        eyebrow="Karnataka State Police · State Crime Records Bureau"
        title="Network & Association Atlas"
        description="Clean & intuitive link intelligence workspace. Powered 100% live by Zoho Catalyst FIR database."
        actions={
          <div className="flex items-center gap-2">
            <Badge className="bg-[#e8f0fe] text-[#0b57d0] border border-[#0b57d0]/20 font-bold px-3 py-1 flex items-center gap-1.5 shadow-sm">
              <Database className="h-3.5 w-3.5 text-[#0b57d0]" />
              Zoho Live Data ({filteredNodes.length} Entities)
            </Badge>

            <div className="flex items-center gap-1 bg-[#f8f9fa] border border-[#dadce0] p-1 rounded-full">
              <button
                onClick={() => setViewMode("graph")}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1.5",
                  viewMode === "graph" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:text-[#202124]"
                )}
              >
                <NetworkIcon className="h-3.5 w-3.5" /> Interactive Graph
              </button>
              <button
                onClick={() => setViewMode("directory")}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1.5",
                  viewMode === "directory" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:text-[#202124]"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Link Directory
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => { setSelected(null); setPan({ x: 0, y: 0 }); setZoom(1); setQuery(""); setTypeFilter("all"); }}
              className="h-8 border-[#dadce0] text-xs font-bold rounded-full bg-white text-[#202124] hover:bg-[#f8f9fa] shadow-sm"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5 text-[#0b57d0]" /> Reset
            </Button>
          </div>
        }
      />

      {/* PROMINENT GOOGLE SEARCH & FILTER BAR */}
      <Card className="bg-white border-[#dadce0] rounded-2xl p-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#5f6368]" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search suspect name, FIR crime number, vehicle plate, wiretap phone..."
              className="h-10 pl-10 text-xs bg-[#f8f9fa] border-[#dadce0] focus:bg-white rounded-xl text-[#202124]"
            />
          </div>

          {/* Type Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "accused", "victim", "case", "location", "vehicle", "phone"] as const).map(k => (
              <button
                key={k}
                onClick={() => setTypeFilter(k)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-full border transition-all uppercase tracking-wider",
                  typeFilter === k
                    ? "bg-[#0b57d0] text-white border-[#0b57d0] shadow-sm"
                    : "bg-[#f8f9fa] text-[#5f6368] border-[#dadce0] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* MAIN CONTENT AREA */}
      {viewMode === "graph" ? (
        /* MODE A: INTERACTIVE GRAPH CANVAS */
        <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm overflow-hidden relative flex flex-col h-[640px]">
          
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white border border-[#dadce0] rounded-2xl p-1 shadow-sm">
            <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} className="h-7 w-7 p-0 text-[#5f6368]">
              +
            </Button>
            <span className="font-mono text-[10px] text-[#5f6368] px-1 font-bold">{zoom.toFixed(1)}x</span>
            <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.max(0.6, z - 0.2))} className="h-7 w-7 p-0 text-[#5f6368]">
              -
            </Button>
          </div>

          <div className="flex-1 relative bg-[#ffffff] overflow-hidden">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
            >
              <g transform={`translate(${pan.x * zoom} ${pan.y * zoom}) scale(${zoom})`}>
                
                {/* LINKS */}
                {filteredLinks.map((l, i) => {
                  const isFocused = activeFocusId && (l.source.id === activeFocusId || l.target.id === activeFocusId);
                  const isDimmed = activeFocusId && !isFocused;
                  const isCoAccused = l.relation === "co-accused";

                  return (
                    <g key={i}>
                      <line
                        x1={l.source.x}
                        y1={l.source.y}
                        x2={l.target.x}
                        y2={l.target.y}
                        stroke={isFocused ? (isCoAccused ? "#d93025" : "#0b57d0") : isCoAccused ? "#d93025" : "#94a3b8"}
                        strokeOpacity={isDimmed ? 0.08 : isFocused ? 0.95 : 0.35}
                        strokeWidth={isFocused ? 2.5 : isCoAccused ? 1.6 : 1.2}
                        strokeDasharray={l.relation === "drove" || l.relation === "called" ? "4 3" : "none"}
                      />
                    </g>
                  );
                })}

                {/* NODES */}
                {filteredNodes.map(n => {
                  const t = TYPE_META[n.type as EntityType];
                  const r = n.type === "accused" ? 15 : n.type === "case" ? 11 : 9;
                  const isSelected = selected === n.id;
                  const isConnected = connectedNeighborIds.has(n.id);
                  const isDimmed = activeFocusId && !isConnected;

                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x} ${n.y})`}
                      className="cursor-pointer transition-opacity duration-200"
                      opacity={isDimmed ? 0.2 : 1}
                      onMouseEnter={() => setHover(n.id)}
                      onMouseLeave={() => setHover(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(n.id);
                      }}
                    >
                      {/* Node Halo */}
                      {isSelected && (
                        <circle r={r + 8} fill={t.color} opacity={0.2} />
                      )}

                      {/* Node Shape */}
                      {n.type === "accused" ? (
                        <g>
                          <circle r={r + 2} fill="#ffffff" stroke={t.color} strokeWidth={isSelected ? 3 : 2} />
                          <circle r={r - 3} fill={t.color} />
                        </g>
                      ) : (
                        <circle r={r} fill={t.color} stroke="#ffffff" strokeWidth={2} />
                      )}

                      {/* Clean Label */}
                      <text
                        y={r + 14}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight="bold"
                        fontFamily="DM Sans, sans-serif"
                        fill="#202124"
                        className="select-none"
                      >
                        {n.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* FLOATING DOSSIER DRAWER ON CLICK */}
          {selectedNode && (
            <div className="absolute top-3 right-3 bottom-3 z-20 w-80 bg-white border border-[#dadce0] rounded-2xl p-4 shadow-xl flex flex-col overflow-y-auto space-y-4 text-xs">
              
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: TYPE_META[selectedNode.type].bg, color: TYPE_META[selectedNode.type].color }}>
                  {TYPE_META[selectedNode.type].label}
                </span>
                <X className="h-4 w-4 cursor-pointer text-[#5f6368] hover:text-[#202124]" onClick={() => setSelected(null)} />
              </div>

              <div>
                <h3 className="font-display text-base font-bold text-[#202124]">{selectedNode.label}</h3>
                {selectedNode.meta.aliases?.[0] && (
                  <p className="text-xs text-[#0b57d0] font-medium italic">a.k.a. {selectedNode.meta.aliases[0]}</p>
                )}
              </div>

              {selectedNode.type === "accused" && (
                <div className="p-3 rounded-xl bg-[#fce8e6] border border-[#f8b4b0] text-[#d93025] font-bold flex items-center justify-between">
                  <span>STATUS: WANTED SUSPECT</span>
                  <Badge className="bg-[#d93025] text-white text-[10px]">RISK {selectedNode.meta.riskScore || 80}/100</Badge>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[#202124]">
                <div className="p-2.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0]">
                  <span className="text-[9px] uppercase font-bold text-[#5f6368] block">District</span>
                  <span className="font-bold text-xs">{selectedNode.meta.district || "Karnataka"}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0]">
                  <span className="text-[9px] uppercase font-bold text-[#5f6368] block">Links</span>
                  <span className="font-bold text-xs text-[#0b57d0]">{deg.get(selectedNode.id) ?? 0} Connected</span>
                </div>
              </div>

              {/* AI Prediction */}
              {selectedNode.meta.predictedNext && (
                <div className="p-3 rounded-xl bg-[#fef7e0] border border-[#f9ab00]/40 text-[#202124] space-y-1">
                  <div className="flex items-center gap-1 text-xs font-bold text-[#e37400]">
                    <Sparkles className="h-3.5 w-3.5 text-[#e37400]" /> Predicted Next Move
                  </div>
                  <p className="font-bold text-xs">{selectedNode.meta.predictedNext.crime} in {selectedNode.meta.district || "Bengaluru"}</p>
                  <p className="text-[10px] text-[#5f6368] font-mono">{selectedNode.meta.predictedNext.probability}% Probability · {selectedNode.meta.predictedNext.window}</p>
                </div>
              )}

              <div className="pt-2 border-t">
                <Button
                  size="sm"
                  className="w-full bg-[#0b57d0] text-white rounded-xl font-bold text-xs"
                  onClick={() => {
                    if (selectedNode.type === "case") {
                      const cid = selectedNode.id.replace("C-", "");
                      window.location.href = `/cases/${cid}`;
                    }
                  }}
                >
                  Inspect Details <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        /* MODE B: STRUCTURED LINK DIRECTORY MATRIX */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNodes.map(n => {
            const t = TYPE_META[n.type as EntityType];
            const d = deg.get(n.id) ?? 0;
            const isSelected = selected === n.id;

            return (
              <Card
                key={n.id}
                onClick={() => setSelected(n.id)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative overflow-hidden",
                  isSelected ? "border-[#0b57d0] bg-[#e8f0fe]/40 shadow-sm ring-1 ring-[#0b57d0]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: t.bg, color: t.color }}>
                    <t.Icon className="h-3 w-3" /> {t.label}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[#5f6368]">{d} Link(s)</span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-[#202124]">{n.label}</h4>
                  <p className="text-xs text-[#5f6368]">District: {n.meta.district || "Karnataka"}</p>
                </div>

                {n.type === "accused" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-[#5f6368]">Criminal Risk Score</span>
                      <span className="text-[#d93025]">{n.meta.riskScore || 75}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#f1f3f4] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#f9ab00] to-[#d93025]" style={{ width: `${n.meta.riskScore || 75}%` }} />
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-[#dadce0] flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-[#5f6368]">ID: {n.id}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(n.id);
                      setViewMode("graph");
                    }}
                    className="h-6 px-2 text-[11px] font-bold text-[#0b57d0]"
                  >
                    Focus Graph <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
