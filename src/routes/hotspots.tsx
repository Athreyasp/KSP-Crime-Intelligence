import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, ChevronRight, Download, FileText, GitCompare, X,
  BarChart3, Clock, PieChart, Flame, ShieldAlert, TrendingUp, Activity
} from "lucide-react";
import { jsPDF } from "jspdf";
import { CRIME_HEADS } from "@/data/mock";
import { type SubArea, type MicroSpot } from "@/data/mock";
import { useDb } from "@/hooks/use-db";
import { useLanguage } from "@/hooks/use-language";
import { computeSubAreas, computeMicroSpots } from "@/lib/db";
import karnatakaMap from "@/data/karnataka-map.json";
import { StateMapGL } from "@/components/hotspots/state-map-gl";
import { SubAreaMapGL } from "@/components/hotspots/sub-area-map-gl";
import { MicroSpotMapGL } from "@/components/hotspots/micro-spot-map-gl";

const NAME_ALIAS: Record<string, string> = {
  "Bengaluru Urban": "Bangalore",
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

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function Hotspots() {
  const { cases: allCases, districtStats: DISTRICT_STATS, hourly: HOURLY, offenders: allOffenders = [] } = useDb();
  const { t } = useLanguage();
  const [hour, setHour] = useState<number[]>([0, 23]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"state" | "district" | "area">("state");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<number[]>([30, 70]); // percent of max
  const [spikeThreshold, setSpikeThreshold] = useState<number[]>([15]);

  const [crimeFilter, setCrimeFilter] = useState<string>("all");
  const [bandFilter, setBandFilter] = useState<string>("all");
  const mapWrapRef = useRef<HTMLDivElement | null>(null);

  const [hasProcessedParam, setHasProcessedParam] = useState(false);

  useEffect(() => {
    if (hasProcessedParam) return;
    const searchString = window.location.search || (window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "");
    const params = new URLSearchParams(searchString);
    const districtQuery = params.get("district");
    if (districtQuery && DISTRICT_STATS.length > 0) {
      const queryLower = districtQuery.toLowerCase();
      const match = DISTRICT_STATS.find(s => 
        s.district.name.toLowerCase() === queryLower ||
        toGeo(s.district.name).toLowerCase() === queryLower ||
        toGeo(s.district.name).toLowerCase().includes(queryLower) ||
        s.district.name.toLowerCase().includes(queryLower)
      );
      if (match) {
        setSelectedId(match.district.id);
        setViewMode("district");
        setHasProcessedParam(true);
        const newUrl = window.location.pathname + window.location.hash.split("?")[0];
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [DISTRICT_STATS, hasProcessedParam]);

  const filteredDistrictStats = useMemo(() => {
    return DISTRICT_STATS.map(s => {
      let cases = (allCases || []).filter(c => c.district.id === s.district.id || toGeoSVG(c.district.name) === toGeoSVG(s.district.name));
      if (crimeFilter !== "all") cases = cases.filter(c => c.crimeHead.name === crimeFilter);
      if (hour[0] > 0 || hour[1] < 23) cases = cases.filter(c => c.hour >= hour[0] && c.hour <= hour[1]);
      const total = cases.length;
      const heinous = cases.filter(c => c.gravity === "Heinous").length;
      const arrests = cases.reduce((acc, c) => acc + (c.accused?.filter(a => a.arrestId).length || 0), 0);
      return { ...s, total, heinous, arrests };
    });
  }, [DISTRICT_STATS, allCases, crimeFilter, hour]);

  const filteredMaxTotal = Math.max(...filteredDistrictStats.map(d => d.total), 1);
  const filteredMinTotal = Math.min(...filteredDistrictStats.map(d => d.total), 0);

  const selected = filteredDistrictStats.find(d => d.district.id === selectedId) ?? filteredDistrictStats[0] ?? { district: { id: 1, name: "Bengaluru Urban" }, total: 0, heinous: 0, arrests: 0, riskScore: 50, spike: 0 };
  const activeDistrict = useMemo(() => {
    const targetId = hoveredId ?? selectedId;
    return filteredDistrictStats.find(d => d.district.id === targetId) ?? selected;
  }, [filteredDistrictStats, hoveredId, selectedId, selected]);

  const lowT = thresholds[0] / 100;
  const highT = thresholds[1] / 100;

  const selectedGeo: GeoDistrict | undefined = useMemo(
    () => karnatakaMap.districts.find(g => g.name === toGeo(selected.district.name)),
    [selected]
  );

  const allAreas: SubArea[] = useMemo(() => computeSubAreas(selected.district.id, DISTRICT_STATS), [selected, DISTRICT_STATS]);

  const activeCases = useMemo(() => {
    let cases = (allCases || []).filter(c => c.district.id === activeDistrict.district.id || toGeoSVG(c.district.name) === toGeoSVG(activeDistrict.district.name));
    if (crimeFilter !== "all") cases = cases.filter(c => c.crimeHead.name === crimeFilter);
    if (hour[0] > 0 || hour[1] < 23) cases = cases.filter(c => c.hour >= hour[0] && c.hour <= hour[1]);
    return cases;
  }, [allCases, activeDistrict, crimeFilter, hour]);

  // 1. Hourly 24h profile
  const activeHourly = useMemo(() => {
    const counts = Array(24).fill(0);
    activeCases.forEach(c => {
      const h = typeof c.hour === "number" && c.hour >= 0 && c.hour < 24 ? c.hour : 10;
      counts[h] = (counts[h] || 0) + 1;
    });
    return counts.map((count, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      count,
      h
    }));
  }, [activeCases]);

  const maxActiveHourly = Math.max(...activeHourly.map(d => d.count), 1);
  const peakHourObj = activeHourly.reduce((max, cur) => cur.count > max.count ? cur : max, activeHourly[0] || { hour: "18:00", count: 0 });

  // 2. Crime taxonomy mix
  const activeTaxonomy = useMemo(() => {
    const total = activeCases.length || 1;
    return CRIME_HEADS.map(ch => {
      const count = activeCases.filter(c => c.crimeHead.id === ch.id).length;
      return {
        ...ch,
        count,
        pct: Math.round((count / total) * 100)
      };
    }).sort((a, b) => b.count - a.count);
  }, [activeCases]);

  // 3. Gravity breakdown (Heinous vs Non-Heinous)
  const activeGravity = useMemo(() => {
    const total = activeCases.length || 1;
    const heinousCount = activeCases.filter(c => c.gravity === "Heinous").length;
    const nonHeinousCount = Math.max(0, total - heinousCount);
    const heinousPct = Math.round((heinousCount / total) * 100);
    return { heinousCount, nonHeinousCount, heinousPct };
  }, [activeCases]);

  // 4. Status disposal mix
  const activeStatus = useMemo(() => {
    const total = activeCases.length || 1;
    const pending = activeCases.filter(c => c.status === "Under Investigation").length;
    const chargeSheeted = activeCases.filter(c => c.status === "Charge Sheeted").length;
    const closed = activeCases.filter(c => c.status === "Closed").length;
    const trial = activeCases.filter(c => c.status === "Pending Trial").length;
    return [
      { name: "Under Inv.", count: pending, color: "#f59e0b", pct: Math.round((pending / total) * 100) },
      { name: "Charge Sheeted", count: chargeSheeted, color: "#22c3e6", pct: Math.round((chargeSheeted / total) * 100) },
      { name: "Closed", count: closed, color: "#10b981", pct: Math.round((closed / total) * 100) },
      { name: "Pending Trial", count: trial, color: "#a855f7", pct: Math.round((trial / total) * 100) },
    ];
  }, [activeCases]);

  // 5. Day of week incident velocity
  const activeDayOfWeek = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const counts: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    activeCases.forEach(c => {
      const dt = new Date(c.registeredDate || c.incidentDate || Date.now());
      const dayIdx = (dt.getDay() + 6) % 7; // Mon = 0
      const dName = days[dayIdx] || "Mon";
      counts[dName] = (counts[dName] || 0) + 1;
    });
    const maxVal = Math.max(...Object.values(counts), 1);
    return days.map(d => ({ day: d, count: counts[d] || 0, maxVal }));
  }, [activeCases]);

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

  const areaCases = useMemo(() => {
    if (!selectedArea) return [];
    return allCases.filter(c => {
      if (!c.latitude || !c.longitude) return false;
      const dist = haversineDistance(c.latitude, c.longitude, selectedArea.lat, selectedArea.lng);
      return dist <= 3.5;
    });
  }, [allCases, selectedArea]);

  const localOffenders = useMemo(() => {
    if (!selectedArea || !allOffenders) return [];
    return allOffenders
      .filter(o => o.jurisdictions.includes(selected.district.name))
      .slice(0, 3);
  }, [allOffenders, selected, selectedArea]);

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
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="mr-1.5 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

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
            {(viewMode === "state" || viewMode === "district") && (
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
                <StateMapSVG
                  districtStats={filteredDistrictStats}
                  minTotal={filteredMinTotal}
                  maxTotal={filteredMaxTotal}
                  selectedId={selected.district.id}
                  hoveredId={hoveredId}
                  onHover={(id) => setHoveredId(id)}
                  onSelect={(id) => openDistrict(id)}
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
                <MicroSpotMapGL
                  area={selectedArea}
                  cases={allCases}
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

            {/* Choropleth legend & Dual-Thumb Range Slider */}
            <div className="mt-4 rounded-md border border-border bg-surface-2 p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Choropleth Class Breaks</span>
                <span className="font-mono text-[10px] text-signal font-bold bg-signal/10 px-2 py-0.5 rounded border border-signal/30">
                  Low: {thresholds[0]}% · High: ≥ {thresholds[1]}%
                </span>
              </div>
              
              <div
                className="h-3 w-full rounded-full border border-border/50 shadow-inner"
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
              
              <Slider
                value={thresholds}
                onValueChange={(v) => {
                  if (v.length === 2 && v[0] < v[1]) setThresholds(v);
                }}
                min={5}
                max={95}
                step={5}
                className="mt-2"
              />

              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0% (Min)</span>
                <span className="text-primary font-bold">Class Break 1: {thresholds[0]}%</span>
                <span className="text-alert font-bold">Class Break 2: {thresholds[1]}%</span>
                <span>100% (Max)</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t border-border/30">
                Drag both handles to adjust heat threshold breaks across Karnataka districts in real-time.
              </p>
            </div>

            {/* Time-of-day Range Slider */}
            <div className="mt-3 rounded-md border border-border bg-surface-2 p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-signal" />
                  Time-of-Day Active Window
                </span>
                <span className="font-mono text-signal font-bold bg-signal/10 px-2 py-0.5 rounded border border-signal/30">
                  {String(hour[0]).padStart(2, "0")}:00 – {String(hour[1]).padStart(2, "0")}:00
                </span>
              </div>

              <Slider
                value={hour}
                onValueChange={(v) => {
                  if (v.length === 2 && v[0] <= v[1]) setHour(v);
                }}
                min={0}
                max={23}
                step={1}
                className="mt-2"
              />

              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
              </div>

              {/* Time Band Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant={hour[0] === 0 && hour[1] === 23 ? "default" : "outline"}
                  className="h-6 text-[10px] px-2"
                  onClick={() => setHour([0, 23])}
                >
                  Full 24h
                </Button>
                <Button
                  size="sm"
                  variant={hour[0] === 0 && hour[1] === 6 ? "default" : "outline"}
                  className="h-6 text-[10px] px-2"
                  onClick={() => setHour([0, 6])}
                >
                  Night (00-06)
                </Button>
                <Button
                  size="sm"
                  variant={hour[0] === 6 && hour[1] === 12 ? "default" : "outline"}
                  className="h-6 text-[10px] px-2"
                  onClick={() => setHour([6, 12])}
                >
                  Morning (06-12)
                </Button>
                <Button
                  size="sm"
                  variant={hour[0] === 12 && hour[1] === 18 ? "default" : "outline"}
                  className="h-6 text-[10px] px-2"
                  onClick={() => setHour([12, 18])}
                >
                  Afternoon (12-18)
                </Button>
                <Button
                  size="sm"
                  variant={hour[0] === 18 && hour[1] === 23 ? "default" : "outline"}
                  className="h-6 text-[10px] px-2"
                  onClick={() => setHour([18, 23])}
                >
                  Evening (18-23)
                </Button>
              </div>
            </div>

            {/* Red-zone Spike Threshold Slider */}
            <div className="mt-3 rounded-md border border-border bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="pulse-alert h-2 w-2 rounded-full bg-alert" />
                  Red-Zone Spike Alert Sensitivity
                </span>
                <span className="font-mono text-alert font-bold bg-alert/10 px-2 py-0.5 rounded border border-alert/30">
                  +{spikeThreshold[0]}%
                </span>
              </div>

              <Slider
                value={spikeThreshold}
                onValueChange={setSpikeThreshold}
                min={0}
                max={50}
                step={1}
                className="mt-2"
              />

              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0% (All)</span><span>+15% (Standard)</span><span>+25% (Elevated)</span><span>+50% (Extreme)</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t border-border/30">
                Districts or beats whose FIR volume increases by more than <span className="font-mono text-alert font-bold">+{spikeThreshold[0]}%</span> vs baseline pulse red.
              </p>
            </div>

          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border flex flex-col h-full">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-editorial flex items-center gap-2 text-foreground">
                  {viewMode === "area" && selectedArea ? selectedArea.name : activeDistrict.district.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {viewMode === "area" && selectedArea
                    ? `Area in ${activeDistrict.district.name}`
                    : viewMode === "district"
                      ? "Sub-area geospatial intelligence"
                      : "Live district intelligence dossier"}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider border-signal/40 text-signal">
                ID #{String(activeDistrict.district.id).padStart(2, "0")}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-3 pt-3 overflow-y-auto pr-1">
            {viewMode === "area" && selectedArea ? (
              <div className="space-y-4">
                {/* Module A: Stats */}
                <div className="grid grid-cols-2 gap-2.5">
                  <Stat label={t("FIRs")} value={selectedArea.firs} />
                  <Stat label={t("Spike")} value={`${selectedArea.spike > 0 ? "+" : ""}${selectedArea.spike}%`} accent={selectedArea.spike > 15 ? "alert" : undefined} />
                </div>

                {/* Module B: AI PCR Directives */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-blue-800 font-bold">
                    <ShieldAlert className="h-4 w-4" />
                    <span>{t("Patrol Dispatch Directive")}</span>
                  </div>
                  <div className="text-[11px] leading-relaxed text-blue-700 font-medium">
                    {selectedArea.spike > 15 ? (
                      <span>⚠️ <strong>{t("CRITICAL SPIKE DETECTED:")}</strong> {t("Position PCR Van #3 at main junction from")} {selectedArea.peakHours}. {t("Increase foot beats targeting")} {t(selectedArea.topCrime)}.</span>
                    ) : (
                      <span>⚡ <strong>{t("ROUTINE INSTRUCTIONS:")}</strong> {t("Establish static patrol point at")} {t(selectedArea.name)} {t("during peak hours:")} {selectedArea.peakHours}. {t("Monitor for suspicious activity matching")} {t(selectedArea.topCrime)}.</span>
                    )}
                  </div>
                </div>

                {/* Module C: Interactive Geographic Case Log */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span>{t("Geographic Case Log")} ({areaCases.length})</span>
                  </div>
                  <div className="max-h-[190px] overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40 bg-white">
                    {areaCases.map(c => {
                      const isSelected = selectedMicroId === String(c.caseMasterId);
                      return (
                        <div
                          key={c.caseMasterId}
                          onClick={() => setSelectedMicroId(isSelected ? null : String(c.caseMasterId))}
                          className={`p-2 text-[11px] transition-colors cursor-pointer ${isSelected ? "bg-blue-50/80 border-l-2 border-blue-600" : "hover:bg-slate-50"}`}
                        >
                          <div className="flex items-center justify-between font-mono font-bold text-[#0f172a]">
                            <span>{c.crimeNo}</span>
                            <span className="text-[9px] text-muted-foreground font-normal">{new Date(c.registeredDate).toLocaleDateString("en-IN")}</span>
                          </div>
                          <div className="font-semibold text-slate-700 mt-0.5">{t(c.crimeHead.name)}</div>
                          <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">{c.briefFacts}</div>
                        </div>
                      );
                    })}
                    {areaCases.length === 0 && (
                      <div className="p-4 text-center text-xs text-muted-foreground bg-slate-50/50">
                        {t("No cases registered in this exact precinct.")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Module D: Repeat Offender Watchlist */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-foreground">{t("Repeat Offender Watchlist")}</div>
                  <div className="space-y-1.5">
                    {localOffenders.map(o => (
                      <div key={o.id} className="flex items-center justify-between p-2 rounded-xl border border-border/60 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-blue-100/70 border border-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-700 uppercase shrink-0">
                            {o.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#0f172a]">{o.name}</div>
                            <div className="text-[9px] text-muted-foreground leading-tight">{o.moTags.slice(0, 2).map(tg => t(tg)).join(", ")}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${o.riskScore > 75 ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
                            {o.riskScore}
                          </span>
                        </div>
                      </div>
                    ))}
                    {localOffenders.length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground bg-slate-50/50 rounded-xl">
                        {t("No known repeat offenders registered in this district.")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Total FIRs" value={activeDistrict.total} />
                  <Stat label="Heinous Share" value={`${activeGravity.heinousPct}%`} accent="alert" />
                  <Stat label="Arrests" value={activeDistrict.arrests} accent="success" />
                  <Stat label="Risk Score" value={`${activeDistrict.riskScore}/100`} accent="warning" />
                </div>

                {/* District Threat Index Meter */}
                <div className="rounded-md border border-border bg-surface-2 p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">District Threat Index</span>
                    <span className="font-mono text-[10px] font-bold text-signal">
                      {activeDistrict.riskScore > 75 ? "CRITICAL" : activeDistrict.riskScore > 50 ? "HIGH" : "MODERATE"} ({activeDistrict.riskScore}/100)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden border border-border/40">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${activeDistrict.riskScore}%`,
                        background: activeDistrict.riskScore > 75 ? "oklch(0.60 0.24 25)" : activeDistrict.riskScore > 45 ? "oklch(0.80 0.16 75)" : "oklch(0.78 0.14 210)"
                      }}
                    />
                  </div>
                </div>

                {/* GRAPH 1: 24h Temporal Profile Curve */}
                <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-signal" />
                      <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-foreground">24h Incident Profile</span>
                    </div>
                    <span className="font-mono text-[9px] text-signal font-bold bg-signal/10 px-1.5 py-0.5 rounded border border-signal/30">
                      Peak {peakHourObj?.hour} ({peakHourObj?.count})
                    </span>
                  </div>

                  <div className="flex items-end gap-1 h-16 pt-2 pb-1 border-b border-border/30">
                    {activeHourly.map((h) => {
                      const inWindow = h.h >= hour[0] && h.h <= hour[1];
                      const heightPct = Math.max(8, (h.count / maxActiveHourly) * 100);
                      const isPeak = h.count === maxActiveHourly && h.count > 0;
                      return (
                        <div
                          key={h.hour}
                          title={`${h.hour} · ${h.count} FIRs`}
                          className={`flex-1 rounded-t-sm transition-all relative ${
                            isPeak
                              ? "bg-signal"
                              : inWindow
                                ? "bg-primary hover:bg-primary/80"
                                : "bg-muted/40 hover:bg-muted"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between font-mono text-[8px] text-muted-foreground">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>23:00</span>
                  </div>
                </div>

                {/* GRAPH 2: Major Crime Taxonomy Mix */}
                <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5 text-signal" />
                      <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-foreground">Crime Taxonomy Mix</span>
                    </div>
                    <span className="font-mono text-[9px] text-muted-foreground">{activeCases.length} Cases</span>
                  </div>

                  <div className="space-y-2">
                    {activeTaxonomy.slice(0, 5).map((ch) => (
                      <div key={ch.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[10px] font-medium text-foreground truncate max-w-[150px]">{ch.name}</span>
                          <span className="font-mono text-[9px] font-bold text-muted-foreground">{ch.count} ({ch.pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-background overflow-hidden border border-border/30">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${ch.pct}%`, backgroundColor: ch.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GRAPH 3: Heinous vs Non-Heinous Severity Ring & Donut Chart */}
                <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-alert" />
                      <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-foreground">Heinous Offence Ratio</span>
                    </div>
                    <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${activeGravity.heinousPct > 20 ? "bg-alert/20 text-alert" : "bg-success/20 text-success"}`}>
                      {activeGravity.heinousCount} Heinous
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="relative h-12 w-12 flex-none">
                      <svg viewBox="0 0 36 36" className="h-full w-full transform -rotate-90">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="oklch(0.25 0.02 250)"
                          strokeWidth="3.8"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="3.8"
                          strokeDasharray={`${activeGravity.heinousPct}, 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-foreground">
                        {activeGravity.heinousPct}%
                      </div>
                    </div>
                    <div className="flex-1 space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Heinous Crimes:</span>
                        <span className="font-mono font-bold text-alert">{activeGravity.heinousCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Non-Heinous:</span>
                        <span className="font-mono font-bold text-foreground">{activeGravity.nonHeinousCount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRAPH 4: Investigation & Case Disposal Mix */}
                <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-signal" />
                      <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-foreground">Case Disposal Mix</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden flex border border-border/40">
                    {activeStatus.map(st => (
                      <div key={st.name} style={{ width: `${st.pct}%`, backgroundColor: st.color }} title={`${st.name}: ${st.count}`} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[9px] pt-1">
                    {activeStatus.map(st => (
                      <div key={st.name} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: st.color }} />
                        <span className="text-muted-foreground truncate">{st.name}:</span>
                        <span className="font-mono font-bold text-foreground ml-auto">{st.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GRAPH 5: 7-Day Day-of-Week Incident Velocity */}
                <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-signal" />
                      <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-foreground">Weekly Incident Velocity</span>
                    </div>
                  </div>
                  <div className="flex items-end gap-2 h-14 pt-2 pb-1 border-b border-border/30">
                    {activeDayOfWeek.map(dw => {
                      const hPct = Math.max(10, (dw.count / dw.maxVal) * 100);
                      return (
                        <div
                          key={dw.day}
                          title={`${dw.day}: ${dw.count} FIRs`}
                          className="flex-1 bg-primary/80 hover:bg-primary rounded-t-sm transition-all cursor-pointer"
                          style={{ height: `${hPct}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between font-mono text-[8px] text-muted-foreground px-0.5">
                    {activeDayOfWeek.map(dw => (
                      <span key={dw.day} className="flex-1 text-center">{dw.day}</span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Sub-areas / Hotspot Street List */}
            {viewMode === "district" && (
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider font-bold text-foreground">Top Hotspot Areas</p>
                  <span className="font-mono text-[9px] text-muted-foreground">{rankedAreas.length} zones</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {rankedAreas.map((a, i) => {
                    const active = selectedAreaId === a.id;
                    const heat = a.firs / maxAreaFirs;
                    return (
                      <button
                        key={a.id}
                        onClick={() => openArea(a.id)}
                        className={`w-full text-left rounded-md border p-1.5 transition-all ${
                          active
                            ? "border-signal bg-signal/10"
                            : "border-border bg-surface-2 hover:bg-surface-1"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[9px] text-muted-foreground w-4">#{i + 1}</span>
                            <span className="text-[11px] font-semibold truncate text-foreground">{a.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {a.spike > 15 && <span className="pulse-alert h-1.5 w-1.5 rounded-full bg-alert" />}
                            <span className="font-mono text-[10px] font-bold">{a.firs}</span>
                          </div>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[9px] text-muted-foreground">
                          <span className="truncate">{a.topCrime}</span>
                          <span className="font-mono text-signal">{a.peakHours}</span>
                        </div>
                        <div className="mt-1 h-1 w-full rounded-full bg-background overflow-hidden">
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

const SVG_NAME_ALIAS: Record<string, string> = {
  "Bengaluru Urban": "Bangalore",
  "Bengaluru Rural": "Bangalore Rural",
  "Mangaluru": "Dakshina Kannada",
  "Hubballi-Dharwad": "Dharwad",
  "Belagavi": "Belgaum",
  "Kalaburagi": "Gulbarga",
  "Ballari": "Bellary",
  "Vijayapura": "Bijapur",
  "Tumakuru": "Tumkur",
  "Shivamogga": "Shimoga",
  "Chikkamagaluru": "Chikmagalur",
  "Chamarajanagara": "Chamrajnagar",
  "Mysuru": "Mysore",
  "Bagalkote": "Bagalkot",
  "Vijayanagara": "Bellary",
};
const toGeoSVG = (n: string) => SVG_NAME_ALIAS[n] ?? n;

function StateMapSVG({
  districtStats,
  minTotal,
  maxTotal,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  lowT,
  highT,
}: {
  districtStats: any[];
  minTotal: number;
  maxTotal: number;
  selectedId: number | null;
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
  lowT: number;
  highT: number;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="relative h-full w-full bg-surface-2 grid-bg select-none overflow-hidden rounded-md border border-border"
      onMouseLeave={() => onHover(null)}
    >
      <svg viewBox={`0 0 ${karnatakaMap.width} ${karnatakaMap.height}`} className="h-full w-full p-2">
        <defs>
          <filter id="glow-selected-svg" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* District Boundaries */}
        {karnatakaMap.districts.map((geo) => {
          const stat = districtStats.find(s => toGeoSVG(s.district.name) === geo.name);
          const rawTotal = stat ? stat.total : 0;
          const ratio = maxTotal > minTotal ? (rawTotal - minTotal) / (maxTotal - minTotal || 1) : 0;

          // Multi-Stop Choropleth Shading
          const fill = choroplethColor(ratio, lowT, highT);
          const isSel = stat && selectedId === stat.district.id;
          const isHov = stat && hoveredId === stat.district.id;

          return (
            <path
              key={geo.name}
              d={geo.d}
              fill={fill}
              fillOpacity={isSel ? 0.95 : isHov ? 0.85 : rawTotal > 0 ? 0.72 : 0.45}
              stroke={isSel ? "#1e40af" : isHov ? "#3b82f6" : "#64748b"}
              strokeWidth={isSel ? 2.2 : isHov ? 1.6 : 0.95}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={isSel ? "url(#glow-selected-svg)" : undefined}
              className="transition-all duration-150 cursor-pointer hover:brightness-110"
              onMouseEnter={() => { if (stat) onHover(stat.district.id); }}
              onClick={() => { if (stat) onSelect(stat.district.id); }}
            >
              <title>{stat?.district.name ?? geo.name}{stat ? ` · ${stat.total} FIRs` : ""}</title>
            </path>
          );
        })}

        {/* Red Zone Pulsing Radar Indicators */}
        {karnatakaMap.districts.map((geo) => {
          const stat = districtStats.find(s => toGeoSVG(s.district.name) === geo.name);
          if (!stat || stat.spike <= 15) return null;
          return (
            <g key={`pulse-${geo.name}`} pointerEvents="none">
              <circle cx={geo.cx} cy={geo.cy} r={5} fill="#dc2626" opacity={0.8}>
                <animate attributeName="r" from="5" to="18" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.9" to="0" dur="1.8s" repeatCount="indefinite" />
              </circle>
              <circle cx={geo.cx} cy={geo.cy} r={3} fill="#dc2626" />
            </g>
          );
        })}

        {/* District Labels */}
        {karnatakaMap.districts.map((geo) => {
          const stat = districtStats.find(s => toGeoSVG(s.district.name) === geo.name);
          const isSel = stat && selectedId === stat.district.id;
          const isHov = stat && hoveredId === stat.district.id;
          const displayName = stat?.district.name ?? geo.name;

          return (
            <text
              key={`lbl-${geo.name}`}
              x={geo.cx}
              y={geo.cy}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none select-none font-sans font-bold text-[8.5px]"
              style={{
                fill: isSel ? "#0284c7" : isHov ? "#0369a1" : "oklch(0.2 0.03 250)",
                stroke: "#ffffff",
                strokeWidth: "2.8px",
                paintOrder: "stroke fill",
                strokeLinejoin: "round",
              }}
            >
              {t(displayName)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function choroplethColor(ratio: number, low: number, high: number) {
  if (ratio >= high) return "oklch(0.60 0.24 25)";     // Crimson Red
  if (ratio >= (low + high) / 2) return "oklch(0.70 0.20 40)"; // Warning Orange
  if (ratio >= low) return "oklch(0.80 0.16 75)";       // Signal Amber
  if (ratio >= low / 2) return "oklch(0.78 0.14 210)";  // Electric Blue
  return "oklch(0.85 0.08 200)";                         // Cool Cyan
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
  const { t } = useLanguage();
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
            title={`${t(a.name)} · ${a.firs} ${t("FIRs")} · ${t(a.topCrime)} · ${t(a.peakHours)}`}
            aria-label={`${t(a.name)} · ${a.firs} ${t("FIRs")}`}
            onClick={() => onSelectArea(a.id)}
            className={`absolute w-[116px] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background/95 px-2 py-1.5 text-left shadow-sm backdrop-blur transition-all hover:scale-[1.02] hover:bg-surface-1 ${
              active ? "border-primary ring-2 ring-primary/20" : dim ? "border-border/60 opacity-55" : "border-border"
            }`}
            style={{
              left: `${((x - vb.x) / vb.w) * 100}%`,
              top: `${((y - vb.y) / vb.h) * 100}%`,
            }}
          >
            <span className="block truncate text-[11px] font-semibold leading-none text-foreground">{t(a.name)}</span>
            <span className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-none text-muted-foreground">
              <span>{a.firs} {t("FIRs")}</span>
              <span>{t(a.peakHours)}</span>
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



function Stat({ label, value, accent }: { label: string; value: number | string; accent?: "alert" | "success" | "warning" }) {
  const cls = accent === "alert" ? "text-alert" : accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
