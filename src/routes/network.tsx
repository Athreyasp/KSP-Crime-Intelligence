import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from "d3-force";
import {
  Search, Radar, Focus, Users, Car, Phone, MapPin as PinIcon, Fingerprint, FileText, Sparkles, ChevronRight,
  ShieldAlert, Eye, RotateCcw, Clock, Database, X, LayoutGrid, Network as NetworkIcon, ArrowUpRight, Shield, Globe, Navigation
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type EntityType, type RichNode, type RelationType } from "@/data/network-rich";
import { useDb } from "@/hooks/use-db";
import { useLanguage } from "@/hooks/use-language";
import { PageHeader } from "@/components/page-header";
import { DISTRICTS } from "@/data/mock";

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
/* Force Layout Hook (Spacious Anti-Congestion Physics)               */
/* ------------------------------------------------------------------ */
function useForceLayout(networkRich: any) {
  return useMemo(() => {
    if (!networkRich || !networkRich.nodes || networkRich.nodes.length === 0) {
      return { nodes: [], links: [] };
    }
    const nodes: SimNode[] = networkRich.nodes.map((n: any) => ({
      ...n,
      x: W / 2 + (Math.random() - 0.5) * 450,
      y: H / 2 + (Math.random() - 0.5) * 320
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
      .force("link", forceLink<SimNode, SimLink>(links).id((d: SimNode) => d.id).distance(155).strength(0.45))
      .force("charge", forceManyBody<SimNode>().strength(-460))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<SimNode>().radius(42).strength(0.85))
      .stop();

    for (let i = 0; i < 350; i++) sim.tick();
    return { nodes, links };
  }, [networkRich]);
}

/* ------------------------------------------------------------------ */
/* Geographic Spatial Projection Layout Hook                          */
/* ------------------------------------------------------------------ */
function useGeoLayout(nodes: SimNode[], links: SimLink[]) {
  return useMemo(() => {
    if (!nodes || nodes.length === 0) return { geoNodes: [], geoLinks: [] };

    // Map district names to normalized coordinates
    const districtMap = new Map<string, { x: number; y: number }>();
    DISTRICTS.forEach(d => {
      districtMap.set(d.name.toLowerCase(), {
        x: d.x * (W - 240) + 120,
        y: d.y * (H - 180) + 90,
      });
    });

    // Group nodes by district to compute radial offsets
    const districtNodesMap = new Map<string, SimNode[]>();
    nodes.forEach(n => {
      const dKey = (n.meta.district || "Bengaluru Urban").toLowerCase();
      if (!districtNodesMap.has(dKey)) districtNodesMap.set(dKey, []);
      districtNodesMap.get(dKey)!.push(n);
    });

    // Compute fixed geographic positions
    const geoNodeMap = new Map<string, SimNode>();
    nodes.forEach(n => {
      const dKey = (n.meta.district || "Bengaluru Urban").toLowerCase();
      const base = districtMap.get(dKey) || { x: W / 2, y: H / 2 };
      const group = districtNodesMap.get(dKey) || [n];
      const idxInGroup = group.indexOf(n);
      const totalInGroup = group.length;

      let gx = base.x;
      let gy = base.y;

      if (totalInGroup > 1) {
        const radius = Math.min(48, 22 + totalInGroup * 5);
        const angle = (idxInGroup * 2 * Math.PI) / totalInGroup;
        gx += radius * Math.cos(angle);
        gy += radius * Math.sin(angle);
      }

      geoNodeMap.set(n.id, { ...n, x: gx, y: gy });
    });

    const geoNodes = Array.from(geoNodeMap.values());
    const geoLinks = links.map(l => ({
      ...l,
      source: geoNodeMap.get(l.source.id) || l.source,
      target: geoNodeMap.get(l.target.id) || l.target,
    }));

    return { geoNodes, geoLinks };
  }, [nodes, links]);
}

export function NetworkPage() {
  const navigate = useNavigate();
  const { networkRich, cases } = useDb();
  const { nodes, links } = useForceLayout(networkRich);
  const { t, language } = useLanguage();

  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SimLink | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<SimLink | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"graph" | "directory">("graph");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Proactively clear any legacy local storage data as requested by the user
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.clear();
      } catch (e) {}
    }
  }, []);

  // Filter nodes strictly by State Overview or Selected District Hub
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      if (selectedDistrict === "all") return true;
      const nodeDist = (n.meta.district || "").toLowerCase();
      return nodeDist === selectedDistrict.toLowerCase();
    });
  }, [nodes, selectedDistrict]);

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

  // Nodes and links to render on the SVG canvas: when selected, only show target sub-network
  const svgLinks = useMemo(() => {
    if (!selected) return filteredLinks;
    return filteredLinks.filter(l => l.source.id === selected || l.target.id === selected);
  }, [filteredLinks, selected]);

  const svgNodes = useMemo(() => {
    if (!selected) return filteredNodes;
    const neighbors = new Set<string>();
    neighbors.add(selected);
    for (const l of filteredLinks) {
      if (l.source.id === selected) neighbors.add(l.target.id);
      if (l.target.id === selected) neighbors.add(l.source.id);
    }
    return filteredNodes.filter(n => neighbors.has(n.id));
  }, [filteredNodes, filteredLinks, selected]);

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

  const selectedNode = selected ? nodes.find(n => n.id === selected) : null;

  const getSuspectRelations = () => {
    if (!selectedNode) return [];
    const directLinks = links.filter(l => l.source.id === selectedNode.id || l.target.id === selectedNode.id);
    const relations: { name: string; id: string; type: string; relation: string; photo?: string }[] = [];
    
    // Find all cases this suspect is in
    const myCaseIds = new Set<string>();
    directLinks.forEach(l => {
      const peer = l.source.id === selectedNode.id ? l.target : l.source;
      if (peer.type === "case") {
        myCaseIds.add(peer.id);
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Suspect In" });
      } else if (peer.type === "vehicle") {
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Shared Vehicle" });
      } else if (peer.type === "phone") {
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Burner Phone" });
      }
    });

    // Find other suspects who are co-accused in the same cases
    const seenCoAccused = new Set<string>();
    links.forEach(l => {
      const isCaseSource = l.source.type === "case";
      const isCaseTarget = l.target.type === "case";
      if (!isCaseSource && !isCaseTarget) return;

      const caseId = isCaseSource ? l.source.id : l.target.id;
      const suspect = isCaseSource ? l.target : l.source;

      if (suspect.type === "accused" && suspect.id !== selectedNode.id && myCaseIds.has(caseId)) {
        if (!seenCoAccused.has(suspect.id)) {
          seenCoAccused.add(suspect.id);
          relations.push({ name: suspect.label, id: suspect.id, type: suspect.type, relation: "Co-Accused", photo: suspect.meta.photo });
        }
      }
    });

    return relations;
  };

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

  // Top high-activity Karnataka districts for quick pill selection
  const TOP_DISTRICTS = [
    "Bengaluru Urban", "Mysuru", "Dharwad", "Belagavi", "Ballari", "Dakshina Kannada", "Kalaburagi", "Tumakuru"
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* GOOGLE MATERIAL CLEAN HEADER */}
      <PageHeader
        section="03"
        eyebrow={t("Link Intelligence & Relational Graph")}
        title={t("Criminal Association Network")}
        description={t("Statewide and District-Wise Relational Intelligence Atlas")}
        actions={
          <div className="flex items-center gap-2">
            <Badge className="bg-[#e8f0fe] text-[#0b57d0] border border-[#0b57d0]/20 font-bold px-3 py-1 flex items-center gap-1.5 shadow-sm">
              <Database className="h-3.5 w-3.5 text-[#0b57d0]" />
              {selectedDistrict === "all" ? "Statewide Overview" : selectedDistrict} ({filteredNodes.length} Entities)
            </Badge>

            <div className="flex items-center gap-1 bg-[#f8f9fa] border border-[#dadce0] p-1 rounded-full">
              <button
                onClick={() => setViewMode("graph")}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1.5",
                  viewMode === "graph" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:text-[#202124]"
                )}
              >
                <NetworkIcon className="h-3.5 w-3.5" /> {t("Interactive Graph")}
              </button>
              <button
                onClick={() => setViewMode("directory")}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1.5",
                  viewMode === "directory" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:text-[#202124]"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> {t("Link Directory")}
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => { setSelected(null); setSelectedEdge(null); setPan({ x: 0, y: 0 }); setZoom(1); setSelectedDistrict("all"); }}
              className="h-8 border-[#dadce0] text-xs font-bold rounded-full bg-white text-[#202124] hover:bg-[#f8f9fa] shadow-sm"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5 text-[#0b57d0]" /> {t("Reset")}
            </Button>
          </div>
        }
      />

      {/* STREAMLINED STATE & DISTRICT-WISE DRILL-DOWN BAR */}
      <Card className="bg-white border-[#dadce0] rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#0b57d0]" />
            <span className="text-xs font-bold text-[#202124]">District Network Hub:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 flex-1">
            <button
              onClick={() => { setSelectedDistrict("all"); setSelected(null); setSelectedEdge(null); }}
              className={cn(
                "px-3.5 py-1.5 text-xs font-bold rounded-full border transition-all flex items-center gap-1",
                selectedDistrict === "all"
                  ? "bg-[#0b57d0] text-white border-[#0b57d0] shadow-sm"
                  : "bg-[#f8f9fa] text-[#5f6368] border-[#dadce0] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
              )}
            >
              🌐 All Karnataka State
            </button>

            {TOP_DISTRICTS.map(dName => (
              <button
                key={dName}
                onClick={() => { setSelectedDistrict(dName); setSelected(null); setSelectedEdge(null); }}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-full border transition-all flex items-center gap-1",
                  selectedDistrict.toLowerCase() === dName.toLowerCase()
                    ? "bg-[#0b57d0] text-white border-[#0b57d0] shadow-sm"
                    : "bg-[#f8f9fa] text-[#5f6368] border-[#dadce0] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
                )}
              >
                📍 {dName}
              </button>
            ))}

            <select
              value={selectedDistrict}
              onChange={e => { setSelectedDistrict(e.target.value); setSelected(null); setSelectedEdge(null); }}
              className="h-8 px-3 text-xs font-bold bg-[#f8f9fa] border border-[#dadce0] rounded-full text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#0b57d0]"
            >
              <option value="all">More Districts ({DISTRICTS.length})...</option>
              {DISTRICTS.map(d => (
                <option key={d.id} value={d.name}>📍 {d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* MAIN CONTENT AREA */}
      {viewMode === "graph" ? (
        /* MODE A: INTERACTIVE GRAPH CANVAS WITH ACCUSED MUGSHOTS & LINK POPOVERS */
        <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm overflow-hidden relative flex flex-col h-[640px]">
          
          {/* Zoom controls & Mode Indicator */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-md border border-[#dadce0] rounded-2xl p-1 shadow-sm">
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
              onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setSelectedEdge(null); } }}
            >
              {/* SVG Mugshot Pattern Definitions */}
              <defs>
                {svgNodes.filter(n => n.type === "accused" && n.meta.photo).map(n => (
                  <pattern
                    key={n.id}
                    id={`pattern-${n.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                    patternUnits="objectBoundingBox"
                    width="1"
                    height="1"
                  >
                    <image
                      href={n.meta.photo}
                      x="0"
                      y="0"
                      width="38"
                      height="38"
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </pattern>
                ))}
              </defs>

              <g transform={`translate(${pan.x * zoom} ${pan.y * zoom}) scale(${zoom})`}>
                
                {/* LINKS / CONNECTIONS */}
                {svgLinks.map((l, i) => {
                  const isFocused = activeFocusId && (l.source.id === activeFocusId || l.target.id === activeFocusId);
                  const isSelectedLink = selectedEdge && selectedEdge.source.id === l.source.id && selectedEdge.target.id === l.target.id;
                  const isHoveredLink = hoverEdge && hoverEdge.source.id === l.source.id && hoverEdge.target.id === l.target.id;
                  const isDimmed = activeFocusId && !isFocused;
                  const isCoAccused = l.relation === "co-accused";

                  return (
                    <g key={i} className="group">
                      {/* Wide Invisible Hit Target for Link Clicking */}
                      <line
                        x1={l.source.x}
                        y1={l.source.y}
                        x2={l.target.x}
                        y2={l.target.y}
                        stroke="transparent"
                        strokeWidth={14}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoverEdge(l)}
                        onMouseLeave={() => setHoverEdge(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdge(l);
                          setSelected(null);
                        }}
                      />

                      {/* Visible Link Line */}
                      <line
                        x1={l.source.x}
                        y1={l.source.y}
                        x2={l.target.x}
                        y2={l.target.y}
                        stroke={isSelectedLink ? "#0b57d0" : isFocused || isHoveredLink ? (isCoAccused ? "#d93025" : "#0b57d0") : isCoAccused ? "#d93025" : "#94a3b8"}
                        strokeOpacity={isDimmed ? 0.08 : isSelectedLink || isFocused || isHoveredLink ? 1 : 0.4}
                        strokeWidth={isSelectedLink ? 3.5 : isHoveredLink || isFocused ? 2.8 : isCoAccused ? 1.8 : 1.2}
                        strokeDasharray={l.relation === "drove" || l.relation === "called" ? "5 3" : "none"}
                        className="pointer-events-none transition-all duration-200"
                      />
                    </g>
                  );
                })}

                {/* NODES */}
                {svgNodes.map(n => {
                  const typeMeta = TYPE_META[n.type as EntityType];
                  const isAccused = n.type === "accused";
                  const r = isAccused ? 18 : n.type === "case" ? 12 : 10;
                  const isSelected = selected === n.id;
                  const isConnected = connectedNeighborIds.has(n.id);
                  const isDimmed = activeFocusId && !isConnected;
                  const patternId = isAccused && n.meta.photo ? `pattern-${n.id.replace(/[^a-zA-Z0-9_-]/g, "_")}` : null;

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
                        setSelectedEdge(null);
                      }}
                    >
                      {/* Node Halo */}
                      {(isSelected || hover === n.id) && (
                        <circle r={r + 8} fill={typeMeta.color} opacity={0.25} className="animate-pulse" />
                      )}

                      {/* Node Shape / Photo Mugshot */}
                      {isAccused ? (
                        <g>
                          <circle r={r + 2} fill="#ffffff" stroke={typeMeta.color} strokeWidth={isSelected ? 3.5 : 2} />
                          {patternId ? (
                            <circle r={r} fill={`url(#${patternId})`} />
                          ) : (
                            <circle r={r - 2} fill={typeMeta.color} />
                          )}
                        </g>
                      ) : (
                        <circle r={r} fill={typeMeta.color} stroke="#ffffff" strokeWidth={2} />
                      )}

                      {/* Clean Label */}
                      <text
                        y={r + 15}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight="bold"
                        fontFamily="DM Sans, sans-serif"
                        fill="#202124"
                        className="select-none shadow-sm"
                      >
                        {t(n.label)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* FLOATING LINK INTELLIGENCE POPOVER (WHEN CLICKING ANY CONNECTION LINK) */}
          {selectedEdge && (
            <div className="absolute top-4 left-4 z-30 w-80 sm:w-96 bg-white/95 backdrop-blur-md border border-[#0b57d0]/30 rounded-2xl p-4 shadow-2xl space-y-3 text-xs animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#e8f0fe] text-[#0b57d0] border border-[#0b57d0]/20 flex items-center gap-1 uppercase tracking-wider">
                  <Fingerprint className="h-3 w-3" /> Link Connection Intelligence
                </span>
                <X className="h-4 w-4 cursor-pointer text-[#5f6368] hover:text-[#202124]" onClick={() => setSelectedEdge(null)} />
              </div>

              {/* Photos & Connection Highlight */}
              <div className="p-3 bg-[#f8f9fa] rounded-xl border border-[#dadce0] space-y-3">
                <div className="flex items-center justify-around gap-2 text-center">
                  {/* Source Entity */}
                  <div className="flex flex-col items-center gap-1 max-w-[120px]">
                    {selectedEdge.source.meta?.photo ? (
                      <img src={selectedEdge.source.meta.photo} alt={selectedEdge.source.label} className="w-14 h-14 rounded-full object-cover border-2 border-[#d93025] shadow-md" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#e8f0fe] text-[#0b57d0] flex items-center justify-center font-bold text-sm border-2 border-[#0b57d0]">
                        {selectedEdge.source.label.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold text-xs text-[#202124] truncate w-full">{selectedEdge.source.label}</span>
                    <Badge className="text-[8px] bg-white text-[#5f6368] border uppercase">{selectedEdge.source.type}</Badge>
                  </div>

                  {/* Relationship Indicator */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-[#fce8e6] text-[#d93025] flex items-center justify-center font-bold shadow-inner">
                      🔗
                    </div>
                    <span className="font-mono text-[9px] font-bold text-[#d93025] uppercase tracking-tighter">
                      {selectedEdge.relation}
                    </span>
                  </div>

                  {/* Target Entity */}
                  <div className="flex flex-col items-center gap-1 max-w-[120px]">
                    {selectedEdge.target.meta?.photo ? (
                      <img src={selectedEdge.target.meta.photo} alt={selectedEdge.target.label} className="w-14 h-14 rounded-full object-cover border-2 border-[#d93025] shadow-md" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#fef7e0] text-[#e37400] flex items-center justify-center font-bold text-sm border-2 border-[#fde293]">
                        {selectedEdge.target.label.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold text-xs text-[#202124] truncate w-full">{selectedEdge.target.label}</span>
                    <Badge className="text-[8px] bg-white text-[#5f6368] border uppercase">{selectedEdge.target.type}</Badge>
                  </div>
                </div>

                <div className="text-[10px] text-[#5f6368] border-t border-[#dadce0]/60 pt-2 font-mono flex items-center justify-between">
                  <span>ASSOCIATION INDEX:</span>
                  <span className="font-bold text-[#0b57d0]">HIGH CONFIDENCE (94%)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelected(selectedEdge.source.id); setSelectedEdge(null); }}
                  className="flex-1 text-[11px] font-bold h-8 border-[#dadce0] rounded-xl text-[#0b57d0]"
                >
                  Focus {selectedEdge.source.label.split(" ")[0]}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelected(selectedEdge.target.id); setSelectedEdge(null); }}
                  className="flex-1 text-[11px] font-bold h-8 border-[#dadce0] rounded-xl text-[#0b57d0]"
                >
                  Focus {selectedEdge.target.label.split(" ")[0]}
                </Button>
              </div>
            </div>
          )}

          {/* FLOATING DOSSIER DRAWER ON NODE CLICK */}
          {selectedNode && (
            <div className="absolute top-3 right-3 bottom-3 left-3 sm:left-auto z-20 w-auto sm:w-80 bg-white border border-[#dadce0] rounded-2xl p-4 shadow-xl flex flex-col overflow-y-auto space-y-4 text-xs animate-in fade-in slide-in-from-right-2">
              
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: TYPE_META[selectedNode.type].bg, color: TYPE_META[selectedNode.type].color }}>
                  {TYPE_META[selectedNode.type].label}
                </span>
                <X className="h-4 w-4 cursor-pointer text-[#5f6368] hover:text-[#202124]" onClick={() => setSelected(null)} />
              </div>

              {/* Accused Photo Header */}
              {selectedNode.type === "accused" && selectedNode.meta.photo && (
                <div className="flex items-center gap-3 p-2 bg-[#f8f9fa] rounded-xl border border-[#dadce0]">
                  <img src={selectedNode.meta.photo} alt={selectedNode.label} className="w-16 h-16 rounded-full object-cover border-2 border-[#d93025] shadow-md shrink-0" />
                  <div>
                    <h3 className="font-display text-base font-bold text-[#202124]">{selectedNode.label}</h3>
                    {selectedNode.meta.aliases?.[0] && (
                      <p className="text-xs text-[#0b57d0] font-medium italic">a.k.a. {selectedNode.meta.aliases[0]}</p>
                    )}
                    <span className="text-[10px] text-[#5f6368] font-bold block mt-0.5">District: {selectedNode.meta.district || "Karnataka"}</span>
                  </div>
                </div>
              )}

              {selectedNode.type !== "accused" && (
                <div>
                  <h3 className="font-display text-base font-bold text-[#202124]">{selectedNode.label}</h3>
                </div>
              )}

              {selectedNode.type === "accused" && (
                <div className="p-3 rounded-xl bg-[#fce8e6] border border-[#f8b4b0] text-[#d93025] font-bold flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span>STATUS: WANTED SUSPECT</span>
                    <Badge className="bg-[#d93025] text-white text-[10px]">RISK {selectedNode.meta.riskScore || 80}/100</Badge>
                  </div>
                  <div className="text-[10px] text-[#c5221f] font-mono border-t border-[#f8b4b0]/40 pt-1 flex items-center gap-1 font-bold">
                    <span>ROLE:</span>
                    <span>
                      {(deg.get(selectedNode.id) || 0) >= 5
                        ? "🔴 SYNDICATE LEADER"
                        : (deg.get(selectedNode.id) || 0) >= 2
                        ? "🟡 GANG ASSOCIATE"
                        : "🟢 FIELD RUNNER"}
                    </span>
                  </div>
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

              {/* Intelligence Linkages */}
              <div className="space-y-1.5">
                <span className="text-[9px] uppercase font-bold text-[#5f6368] block">Intelligence Linkages</span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {getSuspectRelations().map((rel, rIdx) => (
                    <button
                      key={rIdx}
                      onClick={() => setSelected(rel.id)}
                      className="flex items-center justify-between w-full p-2 bg-[#f8f9fa] border border-[#dadce0] hover:bg-[#e8f0fe] hover:border-[#0b57d0] rounded-xl text-left transition-colors text-[10px]"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[150px]">
                        {rel.photo ? (
                          <img src={rel.photo} alt={rel.name} className="w-5 h-5 rounded-full object-cover border shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#0b57d0] shrink-0" />
                        )}
                        <span className="font-bold truncate text-[#202124]">{rel.name}</span>
                      </div>
                      <Badge className="bg-[#e8f0fe] text-[#0b57d0] text-[8px] hover:bg-[#e8f0fe] border border-[#0b57d0]/20 font-bold px-1.5 py-0">
                        {rel.relation}
                      </Badge>
                    </button>
                  ))}
                  {getSuspectRelations().length === 0 && (
                    <p className="text-[10px] text-[#5f6368] italic">No direct linked associates recorded.</p>
                  )}
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
                      navigate({ to: `/cases/${cid}` });
                    } else if (selectedNode.type === "accused") {
                      navigate({ to: "/offenders" });
                    } else if (selectedNode.type === "location") {
                      navigate({ to: "/hotspots" });
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
        /* MODE C: STRUCTURED LINK DIRECTORY MATRIX */
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

                <div className="flex items-center gap-3">
                  {n.type === "accused" && n.meta.photo && (
                    <img src={n.meta.photo} alt={n.label} className="w-12 h-12 rounded-full object-cover border-2 border-[#d93025] shadow-sm shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm text-[#202124]">{n.label}</h4>
                    <p className="text-xs text-[#5f6368]">District: {n.meta.district || "Karnataka"}</p>
                  </div>
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
