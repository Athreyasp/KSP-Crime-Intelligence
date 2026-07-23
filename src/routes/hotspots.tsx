import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronRight, Download, FileText, GitCompare, X } from "lucide-react";
import { jsPDF } from "jspdf";
import { CRIME_HEADS } from "@/data/mock";
import { type SubArea, type MicroSpot } from "@/data/mock";
import { useDb } from "@/hooks/use-db";
import { computeSubAreas, computeMicroSpots } from "@/lib/db";
import karnatakaMap from "@/data/karnataka-map.json";
import { StateMapGL } from "@/components/hotspots/state-map-gl";
import { SubAreaMapGL } from "@/components/hotspots/sub-area-map-gl";

const NAME_ALIAS: Record<string, string> = {
  "Bengaluru City": "Bangalore",
  "Bengaluru Rural": "Bangalore Rural",
  "Mysuru": "Mysore",
  "Mangaluru": "Dakshina Kannada",
  "Hubballi-Dharwad": "Dharwad",
  "Belagavi": "Belgaum",
  "Kalaburagi": "Gulbarga",
  "Ballari": "Bellary",
  "Vijayapura": "Bijapur",
  "Tumakuru": "Tumkur",
  "Shivamogga": "Shimoga",
  "Chikkamagaluru": "Chikmagalur",
};
const toGeo = (n: string) => NAME_ALIAS[n] ?? n;

const PEAK_BANDS = ["00:00–06:00", "06:00–12:00", "12:00–18:00", "18:00–24:00"];
const bandRange = (b: string): [number, number] => {
  const map: Record<string, [number, number]> = {
    "00:00–06:00": [0, 5],
    "06:00–12:00": [6, 11],
    "12:00–18:00": [12, 17],
    "18:00–24:00": [18, 23],
  };
  return map[b] ?? [0, 23];
};

export const Route = createFileRoute("/hotspots")({
  head: () => ({
    meta: [
      { title: "Hotspots · KSP Crime Intelligence" },
      { name: "description", content: "Spatiotemporal crime clusters and district-level drill-down for Karnataka." },
      { property: "og:title", content: "Crime Hotspots · KSP Intelligence" },
      { property: "og:description", content: "Interactive district map with time-of-day filter and red-zone spike alerts." },
    ],
  }),
  component: Hotspots,
});

type GeoDistrict = (typeof karnatakaMap.districts)[number];

function pathBBox(d: string) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const re = /([MLml])\s*(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const x = parseFloat(m[2]);
    const y = parseFloat(m[3]);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

type Point = { x: number; y: number };
type Box = ReturnType<typeof pathBBox>;

function pathPoints(d: string): Point[] {
  const points: Point[] = [];
  const re = /[MLml]\s*(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
  return points;
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function nearestInsidePoint(target: Point, box: Box, polygon: Point[]) {
  if (polygon.length < 3 || pointInPolygon(target, polygon)) return target;

  let best: Point | null = null;
  let bestDist = Infinity;
  const steps = 30;
  for (let yStep = 0; yStep <= steps; yStep++) {
    for (let xStep = 0; xStep <= steps; xStep++) {
      const point = {
        x: box.minX + (box.w * xStep) / steps,
        y: box.minY + (box.h * yStep) / steps,
      };
      if (!pointInPolygon(point, polygon)) continue;
      const dist = (point.x - target.x) ** 2 + (point.y - target.y) ** 2;
      if (dist < bestDist) {
        best = point;
        bestDist = dist;
      }
    }
  }
  return best ?? target;
}

function areaMarkerLayout(areas: SubArea[], box: Box, polygon: Point[]) {
  const n = areas.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * (box.w / Math.max(box.h, 1)))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  const size = Math.min(cellW, cellH);

  return areas.map((area, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const target = {
      x: box.minX + col * cellW + cellW / 2,
      y: box.minY + row * cellH + cellH / 2,
    };
    const point = nearestInsidePoint(target, box, polygon);
    const fontSize = Math.max(3.2, Math.min(5.4, size * 0.12));
    const badgeW = Math.min(Math.max(area.name.length * fontSize * 0.62 + 9, size * 0.62), cellW * 0.92);
    const badgeH = Math.max(10, fontSize * 2.35);
    return { area, x: point.x, y: point.y, badgeW, badgeH, fontSize };
  });
}

const COLOR_LOW = "oklch(0.88 0.05 195)";
const COLOR_MID_LOW = "oklch(0.78 0.14 195)";
const COLOR_MID_HIGH = "oklch(0.78 0.16 70)";
const COLOR_HIGH = "oklch(0.68 0.22 28)";

function heatColor(heat: number, low: number, high: number) {
  if (heat >= high) return COLOR_HIGH;
  if (heat >= (low + high) / 2) return COLOR_MID_HIGH;
  if (heat >= low) return COLOR_MID_LOW;
  return COLOR_LOW;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function areasToCsv(areas: SubArea[], districtName: string) {
  const header = "Rank,District,Area,FIRs,Top Crime,Peak Hours,Spike %\n";
  const rows = areas.map((a, i) =>
    [i + 1, districtName, a.name, a.firs, a.topCrime, a.peakHours, a.spike]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");
  return header + rows;
}

async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const vb = svg.viewBox.baseVal;
  const w = vb.width || svg.clientWidth;
  const h = vb.height || svg.clientHeight;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const xml = new XMLSerializer().serializeToString(clone);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("svg image load failed"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function Hotspots() {
  const { districtStats: DISTRICT_STATS, hourly: HOURLY } = useDb();
  const [hour, setHour] = useState<number[]>([0, 23]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"state" | "district" | "area">("state");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<number[]>([30, 70]); // percent of max
  const [spikeThreshold, setSpikeThreshold] = useState<number[]>([15]);

  const [crimeFilter, setCrimeFilter] = useState<string>("all");
  const [bandFilter, setBandFilter] = useState<string>("all");
  const [compareMode, setCompareMode] = useState(false);
  const defaultA = DISTRICT_STATS[0]?.district.id ?? 1;
  const defaultB = DISTRICT_STATS[1]?.district.id ?? defaultA;
  const [compareAId, setCompareAId] = useState<number>(defaultA);
  const [compareBId, setCompareBId] = useState<number>(defaultB);
  const mapWrapRef = useRef<HTMLDivElement | null>(null);

  const maxTotal = Math.max(...DISTRICT_STATS.map(d => d.total), 1);
  const selected = DISTRICT_STATS.find(d => d.district.id === selectedId) ?? DISTRICT_STATS[0] ?? { district: { id: 1, name: "Bengaluru City" }, total: 0 };
  const lowT = thresholds[0] / 100;
  const highT = thresholds[1] / 100;

  const selectedGeo: GeoDistrict | undefined = useMemo(
    () => karnatakaMap.districts.find(g => g.name === toGeo(selected.district.name)),
    [selected]
  );

  const allAreas: SubArea[] = useMemo(() => computeSubAreas(selected.district.id, DISTRICT_STATS), [selected, DISTRICT_STATS]);

  const matchesFilters = (a: SubArea) => {
    if (crimeFilter !== "all" && a.topCrime !== crimeFilter) return false;
    if (bandFilter !== "all") {
      const [lo, hi] = bandRange(bandFilter);
      const [alo, ahi] = bandRange(a.peakHours);
      if (ahi < lo || alo > hi) return false;
    }
    return true;
  };

  const rankedAreas = useMemo(() => {
    return [...allAreas].sort((a, b) => {
      const am = matchesFilters(a) ? 1 : 0;
      const bm = matchesFilters(b) ? 1 : 0;
      if (am !== bm) return bm - am;
      return b.firs - a.firs;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAreas, crimeFilter, bandFilter]);

  const maxAreaFirs = Math.max(...allAreas.map(a => a.firs), 1);
  const selectedArea = allAreas.find(a => a.id === selectedAreaId) ?? null;
  const microSpots = useMemo(() => (selectedArea ? computeMicroSpots(selectedArea) : []), [selectedArea]);
  const maxMicroFirs = Math.max(...microSpots.map(m => m.firs), 1);
  const [selectedMicroId, setSelectedMicroId] = useState<string | null>(null);
  const selectedMicro = microSpots.find(m => m.id === selectedMicroId) ?? null;

  const openDistrict = (districtId: number) => {
    setSelectedId(districtId);
    setViewMode("district");
    setSelectedAreaId(null);
    setSelectedMicroId(null);
    setCrimeFilter("all");
    setBandFilter("all");
  };

  const openArea = (areaId: string) => {
    setSelectedAreaId(areaId);
    setSelectedMicroId(null);
    setViewMode("area");
  };

  const handleExportCsv = () => {
    const label = viewMode === "district" ? selected.district.name : "Karnataka";
    if (viewMode === "district") {
      const csv = areasToCsv(rankedAreas, selected.district.name);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `hotspot-areas_${label}.csv`);
    } else {
      const header = "District,Total FIRs,Heinous,Arrests,Risk Score,Spike %\n";
      const rows = DISTRICT_STATS.map(s =>
        [s.district.name, s.total, s.heinous, s.arrests, s.riskScore, s.spike]
          .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ).join("\n");
      downloadBlob(new Blob([header + rows], { type: "text/csv;charset=utf-8" }), `hotspot-districts_Karnataka.csv`);
    }
  };

  const handleExportPdf = async () => {
    const svg = mapWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const pngUrl = await svgToPngDataUrl(svg as SVGSVGElement, 2);
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 32;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("KSP Crime Intelligence — Hotspot Report", margin, 48);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const subtitle = viewMode === "district"
      ? `${selected.district.name} · sub-area drill-down`
      : "Karnataka statewide";
    pdf.text(subtitle, margin, 66);
    pdf.text(new Date().toLocaleString(), pageW - margin, 66, { align: "right" });

    const imgW = pageW - margin * 2;
    const imgH = imgW * 0.8;
    pdf.addImage(pngUrl, "PNG", margin, 82, imgW, imgH);

    let y = 82 + imgH + 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(viewMode === "district" ? "Top Hotspot Areas" : "District Ranking", margin, y);
    y += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    if (viewMode === "district") {
      pdf.setFont("helvetica", "bold");
      pdf.text("#", margin, y);
      pdf.text("Area", margin + 22, y);
      pdf.text("FIRs", margin + 200, y);
      pdf.text("Top Crime", margin + 240, y);
      pdf.text("Peak", margin + 400, y);
      pdf.text("Spike", margin + 470, y);
      pdf.setFont("helvetica", "normal");
      y += 12;
      rankedAreas.forEach((a, i) => {
        if (y > 780) { pdf.addPage(); y = 60; }
        pdf.text(String(i + 1), margin, y);
        pdf.text(a.name, margin + 22, y);
        pdf.text(String(a.firs), margin + 200, y);
        pdf.text(a.topCrime, margin + 240, y);
        pdf.text(a.peakHours, margin + 400, y);
        pdf.text(`${a.spike > 0 ? "+" : ""}${a.spike}%`, margin + 470, y);
        y += 12;
      });
    } else {
      pdf.setFont("helvetica", "bold");
      pdf.text("District", margin, y);
      pdf.text("FIRs", margin + 180, y);
      pdf.text("Heinous", margin + 230, y);
      pdf.text("Arrests", margin + 300, y);
      pdf.text("Risk", margin + 370, y);
      pdf.text("Spike", margin + 430, y);
      pdf.setFont("helvetica", "normal");
      y += 12;
      [...DISTRICT_STATS].sort((a, b) => b.total - a.total).forEach(s => {
        if (y > 780) { pdf.addPage(); y = 60; }
        pdf.text(s.district.name, margin, y);
        pdf.text(String(s.total), margin + 180, y);
        pdf.text(String(s.heinous), margin + 230, y);
        pdf.text(String(s.arrests), margin + 300, y);
        pdf.text(String(s.riskScore), margin + 370, y);
        pdf.text(`${s.spike > 0 ? "+" : ""}${s.spike}%`, margin + 430, y);
        y += 12;
      });
    }

    pdf.save(`hotspot-report_${viewMode === "district" ? selected.district.name : "Karnataka"}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Geospatial Hotspots</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === "state"
              ? "Spatiotemporal cluster analysis · Karnataka districts"
              : `Drill-down · ${selected.district.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileText className="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button variant={compareMode ? "default" : "outline"} size="sm" onClick={() => setCompareMode(v => !v)}>
            <GitCompare className="mr-1.5 h-4 w-4" /> Compare
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="mr-1.5 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {compareMode && (
        <ComparePanel
          aId={compareAId}
          bId={compareBId}
          onChangeA={setCompareAId}
          onChangeB={setCompareBId}
          onClose={() => setCompareMode(false)}
          crimeFilter={crimeFilter}
          bandFilter={bandFilter}
          onCrimeFilter={setCrimeFilter}
          onBandFilter={setBandFilter}
          lowT={lowT}
          highT={highT}
          matchesFilters={matchesFilters}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <button
          onClick={() => { setViewMode("state"); setSelectedAreaId(null); setSelectedMicroId(null); }}
          className={`hover:text-primary transition-colors ${viewMode === "state" ? "text-foreground font-medium" : "text-muted-foreground"}`}
        >
          Karnataka
        </button>
        {(viewMode === "district" || viewMode === "area") && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => { setViewMode("district"); setSelectedAreaId(null); setSelectedMicroId(null); }}
              className={`hover:text-primary transition-colors ${viewMode === "district" ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              {selected.district.name}
            </button>
          </>
        )}
        {viewMode === "area" && selectedArea && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium">{selectedArea.name}</span>
          </>
        )}
      </nav>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-surface-1 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {viewMode === "state" ? "District Heatmap" : `${selected.district.name} · Sub-Area Heatmap`}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {viewMode === "state"
                    ? "Click a district to drill down · pulses indicate active spikes"
                    : "Click a zone to inspect area-level activity"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "district" && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Filters</span>
                <Select value={crimeFilter} onValueChange={setCrimeFilter}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="All crime types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All crime types</SelectItem>
                    {CRIME_HEADS.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bandFilter} onValueChange={setBandFilter}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="All time bands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time bands</SelectItem>
                    {PEAK_BANDS.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(crimeFilter !== "all" || bandFilter !== "all") && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs"
                    onClick={() => { setCrimeFilter("all"); setBandFilter("all"); }}>
                    Clear
                  </Button>
                )}
              </div>
            )}

            <div ref={mapWrapRef} className="relative aspect-[5/4] rounded-md border border-border bg-surface-2 grid-bg overflow-hidden">
              {viewMode === "state" ? (
                <StateMapGL
                  districtStats={DISTRICT_STATS}
                  maxTotal={maxTotal}
                  selectedId={selectedId}
                  onSelect={openDistrict}
                  lowT={lowT}
                  highT={highT}
                />
              ) : viewMode === "district" ? (
                <SubAreaMapGL
                  districtName={selected.district.name}
                  areas={allAreas}
                  maxAreaFirs={maxAreaFirs}
                  selectedAreaId={selectedAreaId}
                  onSelectArea={(id) => openArea(id)}
                  matchesFilters={matchesFilters}
                  filtersActive={crimeFilter !== "all" || bandFilter !== "all"}
                  lowT={lowT}
                  highT={highT}
                  spikeThreshold={spikeThreshold[0]}
                />

              ) : viewMode === "area" && selectedArea ? (
                <AreaMap
                  area={selectedArea}
                  spots={microSpots}
                  maxFirs={maxMicroFirs}
                  selectedSpotId={selectedMicroId}
                  onSelectSpot={setSelectedMicroId}
                  lowT={lowT}
                  highT={highT}
                />
              ) : null}

              {viewMode === "district" && (
                <button
                  onClick={() => { setViewMode("state"); setSelectedAreaId(null); setSelectedMicroId(null); }}
                  className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 backdrop-blur px-3 py-1 text-xs font-medium hover:bg-surface-2 transition-colors shadow-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Karnataka
                </button>
              )}
              {viewMode === "area" && (
                <button
                  onClick={() => { setViewMode("district"); setSelectedMicroId(null); }}
                  className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 backdrop-blur px-3 py-1 text-xs font-medium hover:bg-surface-2 transition-colors shadow-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {selected.district.name}
                </button>
              )}
            </div>

            {/* Choropleth legend */}
            <div className="mt-4 rounded-md border border-border bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Choropleth scale</span>
                <span className="text-muted-foreground text-[10px]">
                  % of max {viewMode === "district" ? "area" : "district"} FIRs
                </span>
              </div>
              <div
                className="h-3 w-full rounded-sm border border-border"
                style={{
                  background: `linear-gradient(to right,
                    ${COLOR_LOW} 0%,
                    ${COLOR_LOW} ${thresholds[0]}%,
                    ${COLOR_MID_LOW} ${thresholds[0]}%,
                    ${COLOR_MID_HIGH} ${(thresholds[0] + thresholds[1]) / 2}%,
                    ${COLOR_HIGH} ${thresholds[1]}%,
                    ${COLOR_HIGH} 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0%</span>
                <span className="text-foreground">low → {thresholds[0]}%</span>
                <span className="text-foreground">high ≥ {thresholds[1]}%</span>
                <span>100%</span>
              </div>
              <Slider
                value={thresholds}
                onValueChange={(v) => {
                  if (v.length === 2 && v[0] < v[1]) setThresholds(v);
                }}
                min={5}
                max={95}
                step={5}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Drag the two handles to redraw class breaks. Below <span className="font-mono text-foreground">{thresholds[0]}%</span> = low intensity (teal), between = medium (amber), above <span className="font-mono text-foreground">{thresholds[1]}%</span> = high (red). Values normalized against the largest observed FIR count in view.
              </p>
            </div>

            <div className="mt-3 rounded-md border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Time-of-day window</span>
                <span className="font-mono">{String(hour[0]).padStart(2, "0")}:00 – {String(hour[1]).padStart(2, "0")}:00</span>
              </div>
              <Slider value={hour} onValueChange={setHour} min={0} max={23} step={1} className="mt-3" />
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="pulse-alert h-2 w-2 rounded-full bg-alert" />
                  Red-zone spike threshold
                </span>
                <span className="font-mono text-alert">+{spikeThreshold[0]}%</span>
              </div>
              <Slider
                value={spikeThreshold}
                onValueChange={setSpikeThreshold}
                min={0}
                max={50}
                step={1}
                className="mt-3"
              />
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0%</span><span>15%</span><span>25%</span><span>50%</span>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
                Areas whose FIR volume rises above <span className="font-mono text-foreground">+{spikeThreshold[0]}%</span> vs baseline pulse red on the map.
              </p>
            </div>

          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {viewMode === "area" && selectedArea ? selectedArea.name : selected.district.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {viewMode === "area" && selectedArea
                ? `Area in ${selected.district.name}`
                : viewMode === "district"
                  ? "Area-level intelligence"
                  : "District drill-down"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {viewMode === "area" && selectedArea ? (
              <div className="grid grid-cols-2 gap-3">
                <Stat label="FIRs" value={selectedArea.firs} />
                <Stat label="Spike" value={`${selectedArea.spike > 0 ? "+" : ""}${selectedArea.spike}%`} accent={selectedArea.spike > 15 ? "alert" : undefined} />
                <div className="col-span-2 rounded-md border border-border bg-surface-2 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Top crime</p>
                  <p className="mt-1 text-sm font-medium">{selectedArea.topCrime}</p>
                </div>
                <div className="col-span-2 rounded-md border border-border bg-surface-2 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Peak hours</p>
                  <p className="mt-1 font-mono text-sm">{selectedArea.peakHours}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Total FIRs" value={selected.total} />
                  <Stat label="Heinous" value={selected.heinous} accent="alert" />
                  <Stat label="Arrests" value={selected.arrests} accent="success" />
                  <Stat label="Risk Score" value={selected.riskScore} accent="warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Spike vs 6-mo average</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-display text-3xl font-semibold ${selected.spike > 0 ? "text-alert" : "text-success"}`}>
                      {selected.spike > 0 ? "+" : ""}{selected.spike}%
                    </span>
                    {selected.spike > 15 && <Badge className="bg-alert text-alert-foreground">RED ZONE</Badge>}
                  </div>
                </div>
              </>
            )}

            {viewMode === "area" ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Street-level hotspots</p>
                  <span className="text-[10px] text-muted-foreground">{microSpots.length} beats</span>
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {microSpots.map((m, i) => {
                    const active = selectedMicroId === m.id;
                    const heat = m.firs / maxMicroFirs;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMicroId(active ? null : m.id)}
                        className={`w-full text-left rounded-md border p-2 transition-all ${
                          active ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:bg-surface-1"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-muted-foreground w-4">#{i + 1}</span>
                            <span className="text-sm font-medium truncate">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {m.spike > 15 && <span className="pulse-alert h-1.5 w-1.5 rounded-full bg-alert" />}
                            <span className="font-mono text-xs">{m.firs}</span>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="truncate">{m.topCrime}</span>
                          <span className="font-mono">{m.peakHours}</span>
                        </div>
                        <div className="mt-1.5 h-1 w-full rounded-full bg-background overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(heat * 100).toFixed(0)}%`, background: heatColor(heat, lowT, highT) }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedMicro && (
                  <div className="mt-2 rounded-md border border-border bg-surface-2 p-2 text-[11px] text-muted-foreground">
                    <span className="text-foreground font-medium">{selectedMicro.name}</span> · {selectedMicro.firs} FIRs · {selectedMicro.topCrime} · peak {selectedMicro.peakHours}
                  </div>
                )}
              </div>
            ) : viewMode === "district" ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Top hotspot areas</p>
                  {(crimeFilter !== "all" || bandFilter !== "all") && (
                    <span className="text-[10px] text-muted-foreground">
                      {rankedAreas.filter(matchesFilters).length} match
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {rankedAreas.map((a, i) => {
                    const active = selectedAreaId === a.id;
                    const heat = a.firs / maxAreaFirs;
                    const match = matchesFilters(a);
                    return (
                      <button
                        key={a.id}
                        onClick={() => openArea(a.id)}
                        className={`w-full text-left rounded-md border p-2 transition-all ${
                          active
                            ? "border-primary bg-primary/10"
                            : match
                              ? "border-border bg-surface-2 hover:bg-surface-1"
                              : "border-border/50 bg-surface-2/50 opacity-50 hover:opacity-75"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-muted-foreground w-4">#{i + 1}</span>
                            <span className="text-sm font-medium truncate">{a.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {a.spike > 15 && <span className="pulse-alert h-1.5 w-1.5 rounded-full bg-alert" />}
                            <span className="font-mono text-xs">{a.firs}</span>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="truncate">{a.topCrime}</span>
                          <span className="font-mono">{a.peakHours}</span>
                        </div>
                        <div className="mt-1.5 h-1 w-full rounded-full bg-background overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(heat * 100).toFixed(0)}%`, background: heatColor(heat, lowT, highT) }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Peak hours (statewide)</p>
                <div className="flex items-end gap-1 h-16">
                  {HOURLY.map(h => {
                    const active = parseInt(h.hour) >= hour[0] && parseInt(h.hour) <= hour[1];
                    const max = Math.max(...HOURLY.map(x => x.count));
                    return <div key={h.hour} className={`flex-1 rounded-sm ${active ? "bg-primary" : "bg-surface-2"}`}
                      style={{ height: `${(h.count / max) * 100}%` }} />;
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-surface-1 border-border">
        <CardHeader className="pb-2"><CardTitle className="text-base">Emerging Trend Alerts</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {DISTRICT_STATS.filter(d => d.spike > 15).slice(0, 6).map(d => (
              <button
                key={d.district.id}
                onClick={() => openDistrict(d.district.id)}
                className="text-left rounded-md border border-alert/30 bg-alert/5 p-3 hover:bg-alert/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{d.district.name}</span>
                  <span className="pulse-alert h-2 w-2 rounded-full bg-alert" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">FIR volume up {d.spike}% vs baseline</p>
                <p className="mt-2 font-mono text-xs text-alert">{d.total} incidents · {d.heinous} heinous</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StateMap({
  maxTotal,
  selectedId,
  onSelect,
  lowT,
  highT,
}: {
  maxTotal: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  lowT: number;
  highT: number;
}) {
  return (
    <svg viewBox={`0 0 ${karnatakaMap.width} ${karnatakaMap.height}`} className="absolute inset-0 h-full w-full">
      {karnatakaMap.districts.map((geo) => {
        const stat = DISTRICT_STATS.find(s => toGeo(s.district.name) === geo.name);
        const heat = stat ? stat.total / maxTotal : 0;
        const fill = heatColor(heat, lowT, highT);
        const isSel = stat && selectedId === stat.district.id;
        return (
          <path
            key={geo.name}
            d={geo.d}
            fill={fill}
            fillOpacity={heat > 0 ? 0.6 : 0.35}
            stroke={isSel ? "oklch(0.35 0.15 250)" : "oklch(0.55 0.03 250)"}
            strokeWidth={isSel ? 2 : 0.6}
            style={{ cursor: stat ? "pointer" : "default" }}
            onClick={() => stat && onSelect(stat.district.id)}
          >
            <title>{stat?.district.name ?? geo.name}{stat ? ` · ${stat.total} FIRs` : ""}</title>
          </path>
        );
      })}
      {karnatakaMap.districts.map((geo) => {
        const stat = DISTRICT_STATS.find(s => toGeo(s.district.name) === geo.name);
        if (!stat || stat.spike <= 15) return null;
        return (
          <circle key={`p-${geo.name}`} cx={geo.cx} cy={geo.cy} r={4} fill="oklch(0.68 0.22 28)">
            <animate attributeName="r" from="4" to="14" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.9" to="0" dur="1.8s" repeatCount="indefinite" />
          </circle>
        );
      })}
      {karnatakaMap.districts.map((geo) => (
        <text key={`t-${geo.name}`} x={geo.cx} y={geo.cy} textAnchor="middle" fontSize="7"
          fill="oklch(0.25 0.02 250)" fontFamily="Inter" pointerEvents="none">{geo.name}</text>
      ))}
    </svg>
  );
}

function DistrictMap({
  geo,
  areas,
  maxAreaFirs,
  selectedAreaId,
  onSelectArea,
  matchesFilters,
  filtersActive,
  lowT,
  highT,
}: {
  geo: GeoDistrict;
  areas: SubArea[];
  maxAreaFirs: number;
  selectedAreaId: string | null;
  onSelectArea: (id: string | null) => void;
  matchesFilters: (a: SubArea) => boolean;
  filtersActive: boolean;
  lowT: number;
  highT: number;
}) {
  const bbox = useMemo(() => pathBBox(geo.d), [geo]);
  const polygon = useMemo(() => pathPoints(geo.d), [geo]);
  const pad = Math.max(bbox.w, bbox.h) * 0.08;
  const vb = {
    x: bbox.minX - pad,
    y: bbox.minY - pad,
    w: bbox.w + pad * 2,
    h: bbox.h + pad * 2,
  };
  const markers = useMemo(() => areaMarkerLayout(areas, bbox, polygon), [areas, bbox, polygon]);
  const clipId = `clip-${geo.name.replace(/\s+/g, "-")}`;

  return (
    <div className="absolute inset-0">
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <path d={geo.d} />
          </clipPath>
        </defs>

        <path d={geo.d} fill="oklch(0.95 0.01 250)" stroke="oklch(0.45 0.03 250)" strokeWidth={0.8} />

        <g clipPath={`url(#${clipId})`} pointerEvents="none">
          {markers.map(({ area: a, x, y }) => {
            const heat = a.firs / maxAreaFirs;
            const active = selectedAreaId === a.id;
            const dim = filtersActive && !matchesFilters(a);
            return (
              <circle
                key={`f-${a.id}`}
                cx={x}
                cy={y}
                r={Math.max(bbox.w, bbox.h) * 0.13}
                fill={dim ? "oklch(0.85 0.005 250)" : heatColor(heat, lowT, highT)}
                fillOpacity={dim ? 0.25 : active ? 0.72 : 0.48}
              />
            );
          })}
        </g>

        <g clipPath={`url(#${clipId})`} pointerEvents="none">
          {markers.map(({ area: a, x, y }) => {
            const dim = filtersActive && !matchesFilters(a);
            if (dim || a.spike <= 15) return null;
            const r0 = Math.max(bbox.w, bbox.h) * 0.018;
            return (
              <circle key={`p-${a.id}`} cx={x} cy={y} r={r0} fill="oklch(0.55 0.22 28)">
                <animate attributeName="r" from={r0} to={r0 * 2.75} dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            );
          })}
        </g>

        <path d={geo.d} fill="none" stroke="oklch(0.3 0.04 250)" strokeWidth={1.2} pointerEvents="none" />
      </svg>

      {markers.map(({ area: a, x, y }) => {
        const active = selectedAreaId === a.id;
        const dim = filtersActive && !matchesFilters(a);
        const heat = a.firs / maxAreaFirs;
        return (
          <button
            key={a.id}
            type="button"
            title={`${a.name} · ${a.firs} FIRs · ${a.topCrime} · ${a.peakHours}`}
            aria-label={`${a.name} · ${a.firs} FIRs`}
            onClick={() => onSelectArea(a.id)}
            className={`absolute w-[116px] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background/95 px-2 py-1.5 text-left shadow-sm backdrop-blur transition-all hover:scale-[1.02] hover:bg-surface-1 ${
              active ? "border-primary ring-2 ring-primary/20" : dim ? "border-border/60 opacity-55" : "border-border"
            }`}
            style={{
              left: `${((x - vb.x) / vb.w) * 100}%`,
              top: `${((y - vb.y) / vb.h) * 100}%`,
            }}
          >
            <span className="block truncate text-[11px] font-semibold leading-none text-foreground">{a.name}</span>
            <span className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-none text-muted-foreground">
              <span>{a.firs} FIRs</span>
              <span>{a.peakHours}</span>
            </span>
            <span className="mt-1 block h-1 rounded-full bg-surface-2 overflow-hidden">
              <span className="block h-full" style={{ width: `${Math.max(12, heat * 100)}%`, background: heatColor(heat, lowT, highT) }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AreaMap({
  area,
  spots,
  maxFirs,
  selectedSpotId,
  onSelectSpot,
  lowT,
  highT,
}: {
  area: SubArea;
  spots: MicroSpot[];
  maxFirs: number;
  selectedSpotId: string | null;
  onSelectSpot: (id: string | null) => void;
  lowT: number;
  highT: number;
}) {
  // Simple stylized street grid inside a rounded rect representing the sub-area
  const W = 100;
  const H = 80;
  const streets = [15, 30, 45, 60, 75, 90];
  const avenues = [15, 30, 45, 60, 75];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
      {/* base */}
      <rect x={2} y={2} width={W - 4} height={H - 4} rx={3} fill="oklch(0.96 0.01 250)" stroke="oklch(0.45 0.03 250)" strokeWidth={0.4} />
      {/* street grid */}
      {streets.map(x => (
        <line key={`v${x}`} x1={x} y1={4} x2={x} y2={H - 4} stroke="oklch(0.82 0.01 250)" strokeWidth={0.25} />
      ))}
      {avenues.map(y => (
        <line key={`h${y}`} x1={4} y1={y} x2={W - 4} y2={y} stroke="oklch(0.82 0.01 250)" strokeWidth={0.25} />
      ))}
      {/* label */}
      <text x={W / 2} y={9} textAnchor="middle" fontSize={3.2} fill="oklch(0.35 0.02 250)" fontFamily="Inter" fontWeight={600}>
        {area.name}
      </text>

      {/* hotspot points */}
      {spots.map(s => {
        const heat = s.firs / maxFirs;
        const cx = 4 + s.x * (W - 8);
        const cy = 12 + s.y * (H - 16);
        const r = 1.6 + heat * 3.2;
        const active = selectedSpotId === s.id;
        const color = heatColor(heat, lowT, highT);
        return (
          <g key={s.id} style={{ cursor: "pointer" }} onClick={() => onSelectSpot(active ? null : s.id)}>
            {s.spike > 15 && (
              <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.35}>
                <animate attributeName="r" from={r} to={r * 2.4} dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.6" to="0" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={color}
              stroke={active ? "oklch(0.3 0.15 250)" : "oklch(0.98 0 0)"}
              strokeWidth={active ? 0.6 : 0.3}
            >
              <title>{s.name} · {s.firs} FIRs · {s.topCrime} · {s.peakHours}</title>
            </circle>
            {active && (
              <text x={cx} y={cy - r - 1.2} textAnchor="middle" fontSize={2.6} fill="oklch(0.2 0.02 250)" fontFamily="Inter" fontWeight={600} pointerEvents="none">
                {s.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ComparePanel({
  aId, bId, onChangeA, onChangeB, onClose,
  crimeFilter, bandFilter, onCrimeFilter, onBandFilter,
  lowT, highT, matchesFilters,
}: {
  aId: number;
  bId: number;
  onChangeA: (id: number) => void;
  onChangeB: (id: number) => void;
  onClose: () => void;
  crimeFilter: string;
  bandFilter: string;
  onCrimeFilter: (v: string) => void;
  onBandFilter: (v: string) => void;
  lowT: number;
  highT: number;
  matchesFilters: (a: SubArea) => boolean;
}) {
  const statA = DISTRICT_STATS.find(s => s.district.id === aId)!;
  const statB = DISTRICT_STATS.find(s => s.district.id === bId)!;
  const geoA = karnatakaMap.districts.find(g => g.name === toGeo(statA.district.name));
  const geoB = karnatakaMap.districts.find(g => g.name === toGeo(statB.district.name));
  const areasA = getSubAreas(aId);
  const areasB = getSubAreas(bId);
  const sharedMax = Math.max(...areasA.map(a => a.firs), ...areasB.map(a => a.firs), 1);

  const rank = (arr: SubArea[]) => [...arr].sort((a, b) => {
    const am = matchesFilters(a) ? 1 : 0;
    const bm = matchesFilters(b) ? 1 : 0;
    if (am !== bm) return bm - am;
    return b.firs - a.firs;
  });
  const rankedA = rank(areasA);
  const rankedB = rank(areasB);
  const matchA = areasA.filter(matchesFilters);
  const matchB = areasB.filter(matchesFilters);
  const totalA = matchA.reduce((s, a) => s + a.firs, 0);
  const totalB = matchB.reduce((s, a) => s + a.firs, 0);

  return (
    <Card className="bg-surface-1 border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <GitCompare className="h-4 w-4" /> District Comparison
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Side-by-side hotspot rankings · shared crime type &amp; time band
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Shared filters</span>
          <Select value={crimeFilter} onValueChange={onCrimeFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All crime types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All crime types</SelectItem>
              {CRIME_HEADS.map(c => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bandFilter} onValueChange={onBandFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All time bands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time bands</SelectItem>
              {PEAK_BANDS.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(crimeFilter !== "all" || bandFilter !== "all") && (
            <Button variant="ghost" size="sm" className="h-8 text-xs"
              onClick={() => { onCrimeFilter("all"); onBandFilter("all"); }}>Clear</Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ComparePane
            side="A"
            statId={aId}
            onChange={onChangeA}
            excludeId={bId}
            geo={geoA}
            ranked={rankedA}
            sharedMax={sharedMax}
            matchesFilters={matchesFilters}
            lowT={lowT}
            highT={highT}
            totalFirs={totalA}
            matchCount={matchA.length}
          />
          <ComparePane
            side="B"
            statId={bId}
            onChange={onChangeB}
            excludeId={aId}
            geo={geoB}
            ranked={rankedB}
            sharedMax={sharedMax}
            matchesFilters={matchesFilters}
            lowT={lowT}
            highT={highT}
            totalFirs={totalB}
            matchCount={matchB.length}
          />
        </div>

        {/* Summary bar */}
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Filtered FIR volume</span>
            <span className="font-mono">
              <span className="text-primary">{statA.district.name}: {totalA}</span>
              {"  ·  "}
              <span className="text-warning">{statB.district.name}: {totalB}</span>
            </span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-background">
            <div className="bg-primary" style={{ width: `${(totalA / Math.max(totalA + totalB, 1)) * 100}%` }} />
            <div className="bg-warning" style={{ width: `${(totalB / Math.max(totalA + totalB, 1)) * 100}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparePane({
  side, statId, onChange, excludeId, geo, ranked, sharedMax,
  matchesFilters, lowT, highT, totalFirs, matchCount,
}: {
  side: "A" | "B";
  statId: number;
  onChange: (id: number) => void;
  excludeId: number;
  geo: GeoDistrict | undefined;
  ranked: SubArea[];
  sharedMax: number;
  matchesFilters: (a: SubArea) => boolean;
  lowT: number;
  highT: number;
  totalFirs: number;
  matchCount: number;
}) {
  const stat = DISTRICT_STATS.find(s => s.district.id === statId)!;
  return (
    <div className="rounded-md border border-border bg-surface-2 overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${side === "A" ? "bg-primary text-primary-foreground" : "bg-warning text-warning-foreground"}`}>{side}</span>
          <Select value={String(statId)} onValueChange={(v) => onChange(parseInt(v))}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISTRICT_STATS.filter(s => s.district.id !== excludeId).map(s => (
                <SelectItem key={s.district.id} value={String(s.district.id)}>{s.district.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-right text-[10px] text-muted-foreground">
          <div className="font-mono text-foreground">{totalFirs} FIRs</div>
          <div>{matchCount} areas match</div>
        </div>
      </div>

      <div className="relative aspect-[5/4] bg-surface-2 grid-bg">
        {geo ? (
          <DistrictMap
            geo={geo}
            areas={ranked}
            maxAreaFirs={sharedMax}
            selectedAreaId={null}
            onSelectArea={() => {}}
            matchesFilters={matchesFilters}
            filtersActive={ranked.some(a => !matchesFilters(a)) && ranked.some(a => matchesFilters(a))}
            lowT={lowT}
            highT={highT}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No geometry</div>
        )}
      </div>

      <div className="p-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          <span>Top areas</span>
          <span>{stat.spike > 0 ? "+" : ""}{stat.spike}% spike</span>
        </div>
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          {ranked.slice(0, 8).map((a, i) => {
            const match = matchesFilters(a);
            const heat = a.firs / sharedMax;
            return (
              <div key={a.id}
                className={`flex items-center gap-2 rounded p-1.5 text-xs ${match ? "bg-background" : "bg-background/40 opacity-60"}`}
              >
                <span className="font-mono text-[10px] text-muted-foreground w-4 text-right">{i + 1}</span>
                <span className="flex-1 truncate">{a.name}</span>
                <div className="w-16 h-1 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${heat * 100}%`, background: heatColor(heat, lowT, highT) }} />
                </div>
                <span className="font-mono w-8 text-right">{a.firs}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function Stat({ label, value, accent }: { label: string; value: number | string; accent?: "alert" | "success" | "warning" }) {
  const cls = accent === "alert" ? "text-alert" : accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
