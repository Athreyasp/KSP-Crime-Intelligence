import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from "d3-force";
import {
  Search, Radar, Focus, Users, Car, Phone, MapPin as PinIcon, Fingerprint, FileText, Sparkles, ChevronRight,
  ShieldAlert, Eye, RotateCcw, Clock, Database, X, LayoutGrid, Network as NetworkIcon, ArrowUpRight, Shield, Globe, Navigation,
  Radio, Activity, CheckCircle2, ArrowRight, Maximize2, Download, PhoneCall, Smartphone, Signal
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type EntityType, type RichNode, type RelationType, type TravelCheckpoint, type CallLogEntry,
  createTravelHistory, getUniqueVehicleDetails, getFormatted10DigitPhone, createCallLogs, exportToCsv
} from "@/data/network-rich";
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
  phone:    { color: "#0284c7", bg: "#e0f2fe", border: "#7dd3fc", label: "Phone",   Icon: Phone },
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

  // State for Vehicle Travel History & Phone CDR Call Logs Modals
  const [trackingVehicleNode, setTrackingVehicleNode] = useState<SimNode | null>(null);
  const [trackingPhoneNode, setTrackingPhoneNode] = useState<SimNode | null>(null);

  // Proactively clear any legacy local storage data if needed
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
    
    // Find all cases this suspect/entity is in
    const myCaseIds = new Set<string>();
    directLinks.forEach(l => {
      const peer = l.source.id === selectedNode.id ? l.target : l.source;
      if (peer.type === "case") {
        myCaseIds.add(peer.id);
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Suspect In" });
      } else if (peer.type === "vehicle") {
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Shared Vehicle", photo: peer.meta?.photo });
      } else if (peer.type === "victim") {
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Target Victim", photo: peer.meta?.photo });
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
        /* MODE A: INTERACTIVE GRAPH CANVAS WITH ACCUSED, VICTIM & VEHICLE MUGSHOTS */
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
              {/* SVG Mugshot & Vehicle Photo Pattern Definitions */}
              <defs>
                {svgNodes.filter(n => n.meta?.photo).map(n => {
                  const isAccused = n.type === "accused";
                  const isVehicle = n.type === "vehicle";
                  const isVictim = n.type === "victim";
                  const diameter = isAccused ? 38 : isVehicle ? 34 : isVictim ? 32 : 24;

                  return (
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
                        width={diameter}
                        height={diameter}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </pattern>
                  );
                })}
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
                  const isVehicle = n.type === "vehicle";
                  const isVictim = n.type === "victim";
                  const r = isAccused ? 18 : isVehicle ? 16 : isVictim ? 15 : n.type === "case" ? 12 : 10;
                  const isSelected = selected === n.id;
                  const isConnected = connectedNeighborIds.has(n.id);
                  const isDimmed = activeFocusId && !isConnected;
                  const patternId = n.meta?.photo ? `pattern-${n.id.replace(/[^a-zA-Z0-9_-]/g, "_")}` : null;

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

                      {/* Node Shape / Image Mugshot / Vehicle / Victim Photo */}
                      {patternId ? (
                        <g>
                          <circle r={r + 2} fill="#ffffff" stroke={typeMeta.color} strokeWidth={isSelected ? 3.5 : 2} />
                          <circle r={r} fill={`url(#${patternId})`} />
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
                      <img src={selectedEdge.target.meta.photo} alt={selectedEdge.target.label} className="w-14 h-14 rounded-full object-cover border-2 border-[#a142f4] shadow-md" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#fef7e0] text-[#e37400] flex items-center justify-center font-bold text-sm border-2 border-[#fde293]">
                        {selectedEdge.target.label.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold text-xs text-[#202124] truncate w-full">{selectedEdge.target.label}</span>
                    <Badge className="text-[8px] bg-white text-[#5f6368] border uppercase">{selectedEdge.target.type}</Badge>
                  </div>
                </div>

                {/* If target or source is vehicle, show travel history quick button */}
                {(selectedEdge.source.type === "vehicle" || selectedEdge.target.type === "vehicle") && (
                  <Button
                    size="sm"
                    className="w-full bg-[#a142f4] hover:bg-[#8b2fc9] text-white font-bold text-xs rounded-xl py-1.5 flex items-center justify-center gap-1.5 shadow-sm mt-2"
                    onClick={() => {
                      const vehNode = selectedEdge.source.type === "vehicle" ? selectedEdge.source : selectedEdge.target;
                      setTrackingVehicleNode(vehNode);
                      setSelectedEdge(null);
                    }}
                  >
                    <Navigation className="h-3.5 w-3.5" /> Track Vehicle Travel Movement
                  </Button>
                )}

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

              {/* Victim Photo Header */}
              {selectedNode.type === "victim" && (
                <div className="flex items-center gap-3 p-2 bg-[#e8f0fe]/60 rounded-xl border border-[#aecbfa]">
                  {selectedNode.meta.photo ? (
                    <img src={selectedNode.meta.photo} alt={selectedNode.label} className="w-16 h-16 rounded-full object-cover border-2 border-[#1a73e8] shadow-md shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-lg border-2 border-[#1a73e8] shrink-0">
                      {selectedNode.label.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-display text-base font-bold text-[#202124]">{selectedNode.label}</h3>
                    <p className="text-xs text-[#1a73e8] font-bold">Victim of Recorded Crime</p>
                    <span className="text-[10px] text-[#5f6368] font-bold block mt-0.5">Age: {selectedNode.meta.age || "32"} · District: {selectedNode.meta.district || "Karnataka"}</span>
                  </div>
                </div>
              )}

              {/* Vehicle Photo Header & Travel Tracking Trigger */}
              {selectedNode.type === "vehicle" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-[#f3e8fd]/60 rounded-xl border border-[#d7aefb]">
                    {selectedNode.meta.photo ? (
                      <img src={selectedNode.meta.photo} alt={selectedNode.label} className="w-16 h-16 rounded-xl object-cover border-2 border-[#a142f4] shadow-md shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-[#a142f4] text-white flex items-center justify-center font-bold text-lg border-2 border-[#a142f4] shrink-0">
                        🚗
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <Badge className="bg-[#a142f4] text-white text-[10px] font-mono px-2 py-0.5 mb-1">{selectedNode.label}</Badge>
                      <h3 className="font-bold text-xs text-[#202124] truncate">{selectedNode.meta.vehicleDetails?.makeModel || "Vehicle Registration"}</h3>
                      <p className="text-[10px] text-[#5f6368]">Owner: {selectedNode.meta.vehicleDetails?.ownerName || "Registered Driver"}</p>
                    </div>
                  </div>

                  {/* PROMINENT VEHICLE TRAVEL TRACKING BUTTON */}
                  <Button
                    size="sm"
                    className="w-full bg-[#a142f4] hover:bg-[#8b2fc9] text-white font-bold text-xs rounded-xl py-2 flex items-center justify-center gap-1.5 shadow-md transition-transform active:scale-98"
                    onClick={() => setTrackingVehicleNode(selectedNode)}
                  >
                    <Navigation className="h-4 w-4 animate-pulse" /> Track Vehicle Movement & Travel History
                  </Button>
                </div>
              )}

              {/* Phone Header & CDR Call Logs Trigger */}
              {selectedNode.type === "phone" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-[#e0f2fe]/60 rounded-xl border border-[#7dd3fc]">
                    <div className="w-16 h-16 rounded-xl bg-[#0284c7] text-white flex items-center justify-center font-bold text-xl border-2 border-[#0284c7] shrink-0 shadow-sm">
                      📞
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <Badge className="bg-[#0284c7] text-white text-[10px] font-mono px-2 py-0.5 mb-1">{selectedNode.label}</Badge>
                      <h3 className="font-bold text-xs text-[#202124] truncate">{selectedNode.meta.phoneDetails?.subscriberName || "Phone Subscriber"}</h3>
                      <p className="text-[10px] text-[#5f6368]">Operator: <span className="font-bold text-[#0284c7]">{selectedNode.meta.phoneDetails?.operator || "Airtel Karnataka"}</span></p>
                    </div>
                  </div>

                  {/* PROMINENT CDR CALL LOGS BUTTON */}
                  <Button
                    size="sm"
                    className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs rounded-xl py-2 flex items-center justify-center gap-1.5 shadow-md transition-transform active:scale-98"
                    onClick={() => setTrackingPhoneNode(selectedNode)}
                  >
                    <PhoneCall className="h-4 w-4 animate-pulse" /> Track CDR Call Logs & Tower Intercepts
                  </Button>
                </div>
              )}

              {selectedNode.type !== "accused" && selectedNode.type !== "victim" && selectedNode.type !== "vehicle" && selectedNode.type !== "phone" && (
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
        /* MODE C: STRUCTURED LINK DIRECTORY MATRIX (WITH VEHICLE & VICTIM PHOTOS) */
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
                  {n.meta.photo ? (
                    <img
                      src={n.meta.photo}
                      alt={n.label}
                      className={cn(
                        "w-12 h-12 rounded-full object-cover border-2 shadow-sm shrink-0",
                        n.type === "accused" ? "border-[#d93025]" : n.type === "victim" ? "border-[#1a73e8]" : "border-[#a142f4]"
                      )}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#f8f9fa] border-2 border-[#dadce0] flex items-center justify-center font-bold text-xs shrink-0">
                      {n.label.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden flex-1">
                    <h4 className="font-bold text-sm text-[#202124] truncate">{n.label}</h4>
                    <p className="text-xs text-[#5f6368]">District: {n.meta.district || "Karnataka"}</p>
                    {n.type === "vehicle" && n.meta.vehicleDetails?.makeModel && (
                      <p className="text-[10px] text-[#a142f4] font-bold truncate">{n.meta.vehicleDetails.makeModel}</p>
                    )}
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

                {n.type === "vehicle" && (
                  <Button
                    size="sm"
                    className="w-full bg-[#f3e8fd] hover:bg-[#a142f4] text-[#a142f4] hover:text-white font-bold text-[11px] rounded-xl h-7 flex items-center justify-center gap-1 border border-[#d7aefb]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrackingVehicleNode(n);
                    }}
                  >
                    <Navigation className="h-3 w-3" /> Track Travel History
                  </Button>
                )}

                {n.type === "phone" && (
                  <Button
                    size="sm"
                    className="w-full bg-[#e0f2fe] hover:bg-[#0284c7] text-[#0284c7] hover:text-white font-bold text-[11px] rounded-xl h-7 flex items-center justify-center gap-1 border border-[#7dd3fc]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrackingPhoneNode(n);
                    }}
                  >
                    <PhoneCall className="h-3 w-3" /> Track CDR Call Logs
                  </Button>
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

      {/* ------------------------------------------------------------------ */}
      {/* VEHICLE MOVEMENT & ANPR TRAVEL HISTORY TRACKER MODAL              */}
      {/* ------------------------------------------------------------------ */}
      {trackingVehicleNode && (() => {
        const targetPlate = trackingVehicleNode.meta.plate || trackingVehicleNode.label;
        const fallbackInfo = getUniqueVehicleDetails(0, targetPlate);
        const vehCategory = trackingVehicleNode.meta.vehicleDetails?.category || fallbackInfo.vehicleDetails.category || "Vehicle";
        const vehMakeModel = trackingVehicleNode.meta.vehicleDetails?.makeModel || fallbackInfo.vehicleDetails.makeModel;
        const vehColor = trackingVehicleNode.meta.vehicleDetails?.color || fallbackInfo.vehicleDetails.color;
        const vehOwner = trackingVehicleNode.meta.vehicleDetails?.ownerName || fallbackInfo.vehicleDetails.ownerName;

        const travelLogs: TravelCheckpoint[] = (trackingVehicleNode.meta.travelHistory && trackingVehicleNode.meta.travelHistory.length > 0)
          ? trackingVehicleNode.meta.travelHistory
          : createTravelHistory(targetPlate, trackingVehicleNode.meta.district || "Bengaluru Urban", undefined, trackingVehicleNode.meta.photo);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white border border-[#dadce0] rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#f3e8fd] text-[#a142f4] flex items-center justify-center font-bold text-2xl border border-[#d7aefb] shadow-sm">
                    {vehCategory === "Motorcycle" ? "🏍️" : vehCategory === "Scooter" ? "🛵" : vehCategory === "Auto Rickshaw" ? "🛺" : "🚘"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#a142f4] text-white text-xs font-mono px-3 py-0.5 font-bold shadow-sm">
                        {targetPlate}
                      </Badge>
                      <Badge className="bg-[#f3e8fd] text-[#a142f4] border border-[#d7aefb] text-[10px] font-bold uppercase">
                        {vehCategory}
                      </Badge>
                      <Badge className="bg-[#fce8e6] text-[#d93025] border border-[#f8b4b0] text-[10px] font-bold">
                        ANPR HOTLISTED
                      </Badge>
                    </div>
                    <h2 className="text-xl font-display font-bold text-[#202124] mt-1">
                      Travel & Movement Tracking Log for <span className="text-[#a142f4] font-mono">{targetPlate}</span>
                    </h2>
                    <p className="text-xs text-[#5f6368]">
                      Real-time Automatic License Plate Recognition & CCTV Toll Plaza Scan Path strictly for registration <span className="font-mono font-bold text-[#202124]">{targetPlate}</span> across Karnataka
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTrackingVehicleNode(null)}
                  className="h-8 w-8 p-0 rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Vehicle Specs & Snapshot Overview Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#f8f9fa] border border-[#dadce0] rounded-2xl p-4">
                {/* Image Preview */}
                <div className="relative rounded-xl overflow-hidden border border-[#dadce0] h-36 bg-slate-900 flex items-center justify-center">
                  {trackingVehicleNode.meta.photo ? (
                    <img src={trackingVehicleNode.meta.photo} alt={targetPlate} className="w-full h-full object-cover" />
                  ) : (
                    <Car className="h-16 w-16 text-slate-500" />
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md text-white font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
                    <Eye className="h-3 w-3 text-[#a142f4]" /> CCTV Snapshot ({targetPlate})
                  </div>
                </div>

                {/* Specs */}
                <div className="space-y-1.5 text-xs text-[#202124]">
                  <span className="text-[10px] font-bold uppercase text-[#5f6368] block">Registered Vehicle Details</span>
                  <p className="font-bold text-sm text-[#0b57d0]">
                    {vehMakeModel}
                  </p>
                  <p><span className="text-[#5f6368]">Category:</span> <span className="font-bold text-[#a142f4]">{vehCategory}</span></p>
                  <p><span className="text-[#5f6368]">License Plate:</span> <span className="font-mono font-bold text-[#a142f4]">{targetPlate}</span></p>
                  <p><span className="text-[#5f6368]">Color:</span> {vehColor}</p>
                  <p><span className="text-[#5f6368]">Registered Owner:</span> {vehOwner}</p>
                </div>

                {/* Quick Metrics */}
                <div className="space-y-2 bg-white border border-[#dadce0] rounded-xl p-3 flex flex-col justify-between text-xs">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="text-[#5f6368] font-bold">Scanned Vehicle:</span>
                    <span className="font-mono font-bold text-[#a142f4]">{targetPlate}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="text-[#5f6368] font-bold">Total Scans Today:</span>
                    <span className="font-mono font-bold text-[#0b57d0]">{travelLogs.length} Checkpoints</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="text-[#5f6368] font-bold">Distance Covered:</span>
                    <span className="font-mono font-bold text-[#0b57d0]">184 km</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5f6368] font-bold">Active Status:</span>
                    <Badge className="bg-[#fce8e6] text-[#d93025] text-[9px] font-bold">ANPR TRACKING</Badge>
                  </div>
                </div>
              </div>

              {/* Travel Path Visual Timeline Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-[#202124] flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-[#0b57d0]" /> Karnataka Travel Route Path for {targetPlate}
                  </h3>
                  <span className="text-[10px] text-[#5f6368] font-mono">Target Plate: {targetPlate}</span>
                </div>
                
                <div className="bg-[#e8f0fe]/40 border border-[#aecbfa] rounded-2xl p-4 flex items-center justify-between overflow-x-auto gap-2">
                  {travelLogs.map((cp, idx) => (
                    <div key={idx} className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-8 h-8 rounded-full bg-[#0b57d0] text-white flex items-center justify-center font-bold text-xs shadow-md">
                          {idx + 1}
                        </div>
                        <span className="font-bold text-[10px] text-[#202124] mt-1 max-w-[90px] truncate">{cp.district}</span>
                        <span className="font-mono text-[8px] text-[#5f6368]">{cp.timestamp.split(" ")[1]}</span>
                      </div>
                      {idx < travelLogs.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-[#0b57d0] shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed ANPR Checkpoint Scan Logs */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-[#202124] flex items-center gap-1.5">
                  <Radio className="h-4 w-4 text-[#a142f4]" /> ANPR Camera Scans for Vehicle {targetPlate} ({travelLogs.length})
                </h3>

                <div className="space-y-2.5">
                  {travelLogs.map((cp: TravelCheckpoint, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white border border-[#dadce0] hover:border-[#a142f4] rounded-2xl transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left Info */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#f3e8fd] text-[#a142f4] flex items-center justify-center font-bold text-sm shrink-0 border border-[#d7aefb]">
                          #{idx + 1}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-[#202124]">{cp.locationName}</span>
                            <Badge className="bg-[#a142f4] text-white font-mono text-[9px] font-bold">
                              PLATE: {targetPlate}
                            </Badge>
                            <Badge className="bg-[#e6f4ea] text-[#188038] border border-[#a8dab5] text-[9px] font-mono">
                              {cp.cameraType}
                            </Badge>
                            <Badge className="bg-[#fce8e6] text-[#d93025] text-[9px] font-mono">
                              {cp.flagStatus}
                            </Badge>
                          </div>
                          <p className="text-xs text-[#5f6368]">
                            📍 District: <span className="font-bold text-[#202124]">{cp.district}</span> · Timestamp: <span className="font-mono text-[#0b57d0] font-bold">{cp.timestamp}</span> · Camera ID: <span className="font-mono text-[#202124]">{cp.checkpointId}</span>
                          </p>
                          {cp.occupantsDetected && cp.occupantsDetected.length > 0 && (
                            <div className="flex items-center gap-1.5 text-[10px] text-[#d93025] font-bold pt-0.5">
                              <span>👥 Vehicle {targetPlate} Occupants:</span>
                              <span className="bg-[#fce8e6] px-2 py-0.5 rounded-full border border-[#f8b4b0]">{cp.occupantsDetected.join(", ")}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Specs & Snapshot */}
                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-[#dadce0]">
                        <div className="text-right text-xs">
                          <p className="font-mono font-bold text-[#0b57d0] text-sm">{cp.speedKmph} km/h</p>
                          <p className="text-[10px] text-[#5f6368] font-mono">ANPR Match: {cp.anprConfidence}%</p>
                        </div>
                        <div className="relative">
                          <img
                            src={cp.imageSnapshot}
                            alt={`ANPR scan for ${targetPlate}`}
                            className="w-16 h-12 rounded-lg object-cover border border-[#dadce0] shadow-sm shrink-0"
                          />
                          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white font-mono text-[7px] px-1 rounded">
                            {targetPlate.slice(-4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Police Intelligence Command Bar */}
              <div className="pt-4 border-t border-[#dadce0] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-[#d93025] hover:bg-[#b31d13] text-white font-bold text-xs rounded-xl h-9 px-4 shadow-sm"
                    onClick={() => toast.success(`Hotlist Alert for vehicle ${targetPlate} broadcast to all PCR Vans & Checkposts!`)}
                  >
                    <Radio className="mr-1.5 h-4 w-4" /> Broadcast Hotlist Alert for {targetPlate}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#0b57d0] hover:bg-[#0842a0] text-white font-bold text-xs rounded-xl h-9 px-4 shadow-sm flex items-center gap-1.5"
                    onClick={() => {
                      const headers = [
                        "Checkpoint ID",
                        "Location / Toll Plaza",
                        "District",
                        "Timestamp",
                        "Speed (km/h)",
                        "Camera / ANPR Type",
                        "ANPR Match (%)",
                        "Occupants Detected",
                        "Flag Status",
                        "Latitude",
                        "Longitude"
                      ];
                      const rows = travelLogs.map(cp => [
                        cp.checkpointId,
                        cp.locationName,
                        cp.district,
                        cp.timestamp,
                        cp.speedKmph,
                        cp.cameraType,
                        `${cp.anprConfidence}%`,
                        (cp.occupantsDetected || []).join(" | "),
                        cp.flagStatus,
                        cp.coords.lat,
                        cp.coords.lng
                      ]);
                      exportToCsv(`ANPR_Vehicle_Movement_Log_${targetPlate.replace(/[^A-Z0-9]/g, "")}.csv`, headers, rows);
                      toast.success(`Exported ANPR Travel CSV for ${targetPlate}`);
                    }}
                  >
                    <Download className="h-4 w-4" /> Export ANPR Logs (CSV)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#dadce0] text-[#202124] font-bold text-xs rounded-xl h-9 px-4"
                    onClick={() => toast.info(`ANPR Travel Log PDF for vehicle ${targetPlate} exported!`)}
                  >
                    <FileText className="mr-1.5 h-4 w-4 text-[#0b57d0]" /> Export Travel Log PDF
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTrackingVehicleNode(null)}
                  className="text-xs font-bold text-[#5f6368] hover:text-[#202124]"
                >
                  Close Tracker Window
                </Button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ------------------------------------------------------------------ */}
      {/* PHONE CALL LOGS (CDR) & TOWER INTERCEPT TRACKER MODAL              */}
      {/* ------------------------------------------------------------------ */}
      {trackingPhoneNode && (() => {
        const targetPhone = trackingPhoneNode.meta.number || trackingPhoneNode.label;
        const subscriber = trackingPhoneNode.meta.phoneDetails?.subscriberName || "Suspect Subscriber";
        const operator = trackingPhoneNode.meta.phoneDetails?.operator || "Airtel Karnataka";
        const circle = trackingPhoneNode.meta.phoneDetails?.circle || "Karnataka Circle";
        const imei = trackingPhoneNode.meta.phoneDetails?.imei || "864902047132984";
        const districtName = trackingPhoneNode.meta.district || "Bengaluru Urban";

        const callLogs: CallLogEntry[] = (trackingPhoneNode.meta.callLogs && trackingPhoneNode.meta.callLogs.length > 0)
          ? trackingPhoneNode.meta.callLogs
          : createCallLogs(targetPhone, districtName, subscriber);

        const flaggedCallsCount = callLogs.filter(c => c.callStatus === "Intercept Flagged" || c.type === "Encrypted VOIP").length;
        const totalDurationSec = callLogs.reduce((acc, c) => acc + c.durationSeconds, 0);
        const totalDurationMin = Math.round(totalDurationSec / 60);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white border border-[#dadce0] rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center font-bold text-2xl border border-[#7dd3fc] shadow-sm">
                    📞
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#0284c7] text-white text-xs font-mono px-3 py-0.5 font-bold shadow-sm">
                        {targetPhone}
                      </Badge>
                      <Badge className="bg-[#e0f2fe] text-[#0284c7] border border-[#7dd3fc] text-[10px] font-bold uppercase">
                        10-DIGIT CDR INTERCEPT
                      </Badge>
                      {flaggedCallsCount > 0 && (
                        <Badge className="bg-[#fce8e6] text-[#d93025] border border-[#f8b4b0] text-[10px] font-bold flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> {flaggedCallsCount} FLAG INTERCEPT(S)
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-xl font-display font-bold text-[#202124] mt-1">
                      Call Detail Records (CDR) & Tower Dump Log for <span className="text-[#0284c7] font-mono">{targetPhone}</span>
                    </h2>
                    <p className="text-xs text-[#5f6368]">
                      Real-time Telecom Tower Intercept & Call Detail Record timeline strictly for 10-digit number <span className="font-mono font-bold text-[#202124]">{targetPhone}</span> across Karnataka
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTrackingPhoneNode(null)}
                  className="h-8 w-8 p-0 rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Phone Subscriber Specs & Overview Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#f8f9fa] border border-[#dadce0] rounded-2xl p-4">
                {/* Card Info */}
                <div className="bg-[#e0f2fe]/40 border border-[#7dd3fc] rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#0284c7] block mb-1">Subscriber Identity</span>
                    <h3 className="font-bold text-sm text-[#202124]">{subscriber}</h3>
                    <p className="font-mono font-bold text-xs text-[#0284c7] mt-0.5">{targetPhone}</p>
                  </div>
                  <div className="pt-2 border-t border-[#7dd3fc]/50 flex items-center justify-between text-[10px] text-[#5f6368]">
                    <span>Operator: <strong className="text-[#202124]">{operator}</strong></span>
                    <span>Status: <strong className="text-[#188038]">ACTIVE SIM</strong></span>
                  </div>
                </div>

                {/* Technical Hardware Specs */}
                <div className="space-y-1.5 text-xs text-[#202124]">
                  <span className="text-[10px] font-bold uppercase text-[#5f6368] block">Hardware & Telemetry Info</span>
                  <p><span className="text-[#5f6368]">Target Line:</span> <span className="font-mono font-bold text-[#0284c7]">{targetPhone}</span></p>
                  <p><span className="text-[#5f6368]">IMEI Identifier:</span> <span className="font-mono font-bold text-[#0b57d0]">{imei}</span></p>
                  <p><span className="text-[#5f6368]">Circle / Hub:</span> {circle}</p>
                  <p><span className="text-[#5f6368]">District Tower:</span> {districtName}</p>
                </div>

                {/* Quick Metrics */}
                <div className="space-y-2 bg-white border border-[#dadce0] rounded-xl p-3 flex flex-col justify-between text-xs">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="text-[#5f6368] font-bold">Total CDR Events:</span>
                    <span className="font-mono font-bold text-[#0284c7]">{callLogs.length} Records</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="text-[#5f6368] font-bold">Total Talk Time:</span>
                    <span className="font-mono font-bold text-[#0b57d0]">{totalDurationMin} mins ({totalDurationSec}s)</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="text-[#5f6368] font-bold">Flagged / Encrypted:</span>
                    <span className="font-mono font-bold text-[#d93025]">{flaggedCallsCount} Intercepts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5f6368] font-bold">Tower Intercept:</span>
                    <Badge className="bg-[#e0f2fe] text-[#0284c7] text-[9px] font-bold">CDR FEED SYNCED</Badge>
                  </div>
                </div>
              </div>

              {/* CDR Call Logs Table / List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-[#202124] flex items-center gap-1.5">
                    <PhoneCall className="h-4 w-4 text-[#0284c7]" /> Call Detail Records (CDR) Chronological Feed for {targetPhone}
                  </h3>
                  <span className="text-[10px] text-[#5f6368] font-mono">Total {callLogs.length} Records</span>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {callLogs.map((log) => (
                    <div
                      key={log.callId}
                      className={cn(
                        "p-3 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs transition-all",
                        log.callStatus === "Intercept Flagged" || log.type === "Encrypted VOIP"
                          ? "bg-[#fce8e6]/40 border-[#f8b4b0] hover:bg-[#fce8e6]/70"
                          : "bg-[#f8f9fa] border-[#dadce0] hover:bg-white hover:border-[#0b57d0] shadow-2xs"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border mt-0.5",
                          log.type === "Incoming" ? "bg-[#e6f4ea] text-[#188038] border-[#a8dab5]" :
                          log.type === "Outgoing" ? "bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa]" :
                          log.type === "Encrypted VOIP" ? "bg-[#fce8e6] text-[#d93025] border-[#f8b4b0]" :
                          "bg-[#fef7e0] text-[#b06000] border-[#fde293]"
                        )}>
                          {log.type === "Incoming" ? "📥" : log.type === "Outgoing" ? "📤" : log.type === "Encrypted VOIP" ? "🔐" : "💬"}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-[#202124]">{log.otherPartyNumber}</span>
                            <Badge className="bg-[#f1f3f4] text-[#202124] border border-[#dadce0] text-[9px] font-bold">
                              {log.otherPartyName}
                            </Badge>
                            <Badge className={cn(
                              "text-[9px] font-mono font-bold",
                              log.type === "Incoming" ? "bg-[#e6f4ea] text-[#188038]" :
                              log.type === "Outgoing" ? "bg-[#e8f0fe] text-[#1a73e8]" :
                              log.type === "Encrypted VOIP" ? "bg-[#fce8e6] text-[#d93025]" : "bg-[#fef7e0] text-[#b06000]"
                            )}>
                              {log.type}
                            </Badge>
                            {log.callStatus === "Intercept Flagged" && (
                              <Badge className="bg-[#d93025] text-white text-[9px] font-bold">
                                FLAGGED INTERCEPT
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-[#5f6368]">
                            📡 Cell Tower: <span className="font-bold text-[#202124]">{log.towerLocation}</span> ({log.towerId}) · District: <span className="font-bold text-[#202124]">{log.district}</span> · Timestamp: <span className="font-mono text-[#0b57d0] font-bold">{log.timestamp}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 border-[#dadce0] w-full md:w-auto justify-between md:justify-end">
                        <div className="text-right text-xs">
                          <span className="font-mono font-bold text-xs text-[#0284c7]">
                            {log.durationSeconds > 0 ? `${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s` : "0s (No Ans)"}
                          </span>
                          <span className="text-[10px] text-[#5f6368] block font-mono">IMEI: {log.imei.slice(-6)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Police CDR Action & Export Bar */}
              <div className="pt-4 border-t border-[#dadce0] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs rounded-xl h-9 px-4 shadow-sm flex items-center gap-1.5"
                    onClick={() => {
                      const headers = [
                        "Call ID",
                        "Timestamp",
                        "Call Type",
                        "Target Contact Number",
                        "Contact Name / Role",
                        "Duration (Seconds)",
                        "Tower ID",
                        "Tower Location",
                        "District",
                        "Subscriber IMEI",
                        "Call Intercept Status",
                        "Latitude",
                        "Longitude"
                      ];
                      const rows = callLogs.map(log => [
                        log.callId,
                        log.timestamp,
                        log.type,
                        log.otherPartyNumber,
                        log.otherPartyName,
                        log.durationSeconds,
                        log.towerId,
                        log.towerLocation,
                        log.district,
                        log.imei,
                        log.callStatus,
                        log.coords.lat,
                        log.coords.lng
                      ]);
                      exportToCsv(`CDR_Call_Logs_${targetPhone.replace(/[^0-9]/g, "")}.csv`, headers, rows);
                      toast.success(`Exported CDR Call Detail Records CSV for ${targetPhone}`);
                    }}
                  >
                    <Download className="h-4 w-4" /> Export CDR Logs (CSV)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#dadce0] text-[#202124] font-bold text-xs rounded-xl h-9 px-4"
                    onClick={() => toast.info(`CDR Telemetry PDF Forensic Report for number ${targetPhone} exported!`)}
                  >
                    <FileText className="mr-1.5 h-4 w-4 text-[#0284c7]" /> Export CDR PDF Report
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTrackingPhoneNode(null)}
                  className="text-xs font-bold text-[#5f6368] hover:text-[#202124]"
                >
                  Close CDR Window
                </Button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
