import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpRight, ArrowDownRight, AlertTriangle, Shield, FileText, Gavel,
  Radar, Database, RefreshCw, ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useDb } from "@/hooks/use-db";
import { DISTRICTS } from "@/data/mock";
import { getCatalystSyncInfo, syncWithCatalyst } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · KSP Crime Intelligence" },
      { name: "description", content: "Statewide FIR overview, spatial cartogram, live alerts and 30-day trend for the Karnataka State Crime Records Bureau." },
      { property: "og:title", content: "Overview · KSP Crime Intelligence" },
      { property: "og:description", content: "Karnataka spatial cartogram with real-time FIR volume, arrests, gravity mix, and 30-day trend." },
    ],
  }),
  component: Overview,
});

/* palette pulled from :root — kept in JS for SVG fills */
const INK = "oklch(0.19 0 0)";
const SIGNAL = "oklch(0.58 0.22 27)";
const AMBER = "oklch(0.78 0.16 78)";
const PAPER = "oklch(0.965 0.008 85)";
const RULE = "oklch(0.86 0.012 85)";
const MUTED = "oklch(0.42 0.01 85)";

/* ─────────────────────────────────────────────────────────
   HEX CARTOGRAM — the centerpiece
   Each district is a flat-top hex, positioned from its
   normalized geo (x,y), colored by FIR volume.
   ───────────────────────────────────────────────────────── */
function hexPath(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

function heatFill(t: number) {
  // t 0..1 — paper → amber → signal → ink
  if (t < 0.33) return `color-mix(in oklab, ${PAPER} ${100 - t * 3 * 60}%, ${AMBER})`;
  if (t < 0.66) return `color-mix(in oklab, ${AMBER} ${100 - (t - 0.33) * 3 * 60}%, ${SIGNAL})`;
  return `color-mix(in oklab, ${SIGNAL} ${100 - (t - 0.66) * 3 * 55}%, ${INK})`;
}

function Cartogram({
  selectedId, onSelect,
}: { selectedId: number | null; onSelect: (id: number) => void }) {
  const { kpis: KPIS, districtStats: DISTRICT_STATS } = useDb();
  const { t: trans } = useLanguage();
  const W = 760, H = 560;
  const PAD = 60;
  const R = 34;

  const max = Math.max(...DISTRICT_STATS.map(d => d.total));

  const positioned = useMemo(() => {
    const pos = DISTRICT_STATS.map(s => ({
      ...s,
      cx: PAD + s.district.x * (W - PAD * 2),
      cy: PAD + s.district.y * (H - PAD * 2),
    }));

    // Relax positions so hexes never overlap (flat-top hex min-dist ≈ √3·R)
    const MIN_DIST = Math.sqrt(3) * R + 4;
    for (let iter = 0; iter < 120; iter++) {
      let moved = 0;
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const a = pos[i], b = pos[j];
          const dx = b.cx - a.cx, dy = b.cy - a.cy;
          const dist = Math.hypot(dx, dy) || 0.01;
          if (dist < MIN_DIST) {
            const push = (MIN_DIST - dist) / 2;
            const ux = dx / dist, uy = dy / dist;
            a.cx -= ux * push; a.cy -= uy * push;
            b.cx += ux * push; b.cy += uy * push;
            moved += push;
          }
        }
      }
      // clamp inside frame
      for (const p of pos) {
        p.cx = Math.max(PAD, Math.min(W - PAD, p.cx));
        p.cy = Math.max(PAD, Math.min(H - PAD, p.cy));
      }
      if (moved < 0.5) break;
    }
    return pos;
  }, []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 600 }}>
      <defs>
        <pattern id="carto-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke={RULE} strokeWidth="0.5" opacity="0.3" />
        </pattern>
        <filter id="hex-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="2" stdDeviation="0" floodColor={INK} floodOpacity="0.9" />
        </filter>
      </defs>

      {/* frame */}
      <rect x="0" y="0" width={W} height={H} fill={PAPER} />
      <rect x="0" y="0" width={W} height={H} fill="url(#carto-grid)" />
      <rect x="8" y="8" width={W - 16} height={H - 16} fill="none" stroke={INK} strokeWidth="1" />

      {/* corner marks */}
      {[[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]].map(([x, y], i) => (
        <g key={i}>
          <line x1={x - 10} y1={y} x2={x + 10} y2={y} stroke={SIGNAL} strokeWidth="1.5" />
          <line x1={x} y1={y - 10} x2={x} y2={y + 10} stroke={SIGNAL} strokeWidth="1.5" />
        </g>
      ))}

      {/* title stamp */}
      <text x="20" y="30" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={INK} fontWeight="700" letterSpacing="0.1em">
        {trans("KARNATAKA SPATIAL CARTOGRAM")}
      </text>
      <text x={W - 20} y="30" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={MUTED} letterSpacing="0.24em" textAnchor="end">
        N={KPIS.totalFIRs}  ·  Δ30d
      </text>

      {/* faint state silhouette hint via convex-ish hull line */}
      <path
        d={(() => {
          const outer = [...positioned].sort((a, b) => Math.atan2(a.cy - H / 2, a.cx - W / 2) - Math.atan2(b.cy - H / 2, b.cx - W / 2));
          return `M ${outer.map(p => `${p.cx},${p.cy}`).join(" L ")} Z`;
        })()}
        fill="none" stroke={INK} strokeWidth="0.5" strokeDasharray="2 4" opacity="0.25"
      />

      {/* hexes */}
      {positioned.map(d => {
        const t = d.total / max;
        const isSelected = selectedId === d.district.id;
        const displayName = trans(d.district.name);
        return (
          <g
            key={d.district.id}
            onClick={() => onSelect(d.district.id)}
            style={{ cursor: "pointer" }}
          >
            {/* hex shadow (offset black stamp) */}
            <path d={hexPath(d.cx + 2.5, d.cy + 2.5, R)} fill={INK} opacity={isSelected ? 1 : 0.85} />
            {/* hex fill */}
            <path
              d={hexPath(d.cx, d.cy, R)}
              fill={heatFill(t)}
              stroke={INK}
              strokeWidth={isSelected ? 2.2 : 1.2}
            />
            {/* selection ring */}
            {isSelected && (
              <path d={hexPath(d.cx, d.cy, R + 7)} fill="none" stroke={SIGNAL} strokeWidth="2" strokeDasharray="3 3" />
            )}
            {/* volume number */}
            <text x={d.cx} y={d.cy - 3} textAnchor="middle"
              fontFamily="Space Grotesk, sans-serif" fontSize="13" fontWeight="700"
              fill={t > 0.6 ? PAPER : INK}>
              {d.total}
            </text>
            {/* district name */}
            <text x={d.cx} y={d.cy + 10} textAnchor="middle"
              fontFamily="JetBrains Mono, monospace" fontSize="7.5"
              letterSpacing="0.05em"
              fill={t > 0.6 ? PAPER : INK} opacity="0.85">
              {displayName.length > 12 ? displayName.slice(0, 11) + "…" : displayName}
            </text>
          </g>
        );
      })}

      {/* legend gradient */}
      <g transform={`translate(20 ${H - 32})`}>
        <text fontFamily="JetBrains Mono, monospace" fontSize="8" fill={MUTED} letterSpacing="0.2em">{trans("FIR VOLUME")}</text>
        <g transform="translate(0 6)">
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => (
            <rect key={i} x={i * 22} y={0} width="20" height="8" fill={heatFill(t)} stroke={INK} strokeWidth="0.5" />
          ))}
          <text x="0" y="20" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={MUTED}>{trans("LOW")}</text>
          <text x="132" y="20" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={MUTED} textAnchor="end">{trans("HIGH")}</text>
        </g>
      </g>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
   RADIAL TIMELINE — 24h ring around selected district
   ───────────────────────────────────────────────────────── */
function DistrictRadial({ districtId }: { districtId: number }) {
  const { cases: CASES } = useDb();
  const hours = useMemo(() => {
    const dc = CASES.filter((c: any) => c.district.id === districtId);
    return Array.from({ length: 24 }, (_, h) => dc.filter((c: any) => c.hour === h).length);
  }, [districtId, CASES]);

  const S = 220, cx = S / 2, cy = S / 2, rIn = 34, rOut = 90;
  const max = Math.max(...hours, 1);
  const peakIdx = hours.reduce((b, v, i, arr) => (v > arr[b] ? i : b), 0);

  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[240px]">
      {[0.33, 0.66, 1].map(t => (
        <circle key={t} cx={cx} cy={cy} r={rIn + (rOut - rIn) * t}
          fill="none" stroke={RULE} strokeDasharray="1 3" />
      ))}
      {[0, 6, 12, 18].map(h => {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        return (
          <text key={h} x={cx + Math.cos(a) * (rOut + 12)} y={cy + Math.sin(a) * (rOut + 12)}
            fontSize="9" fontFamily="JetBrains Mono, monospace"
            fill={INK} textAnchor="middle" dominantBaseline="middle" opacity="0.6">
            {String(h).padStart(2, "0")}
          </text>
        );
      })}
      {hours.map((v, i) => {
        const a0 = (i / 24) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / 24) * Math.PI * 2 - Math.PI / 2;
        const rr = rIn + (v / max) * (rOut - rIn);
        const p = (r: number, a: number) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
        const d = `M ${p(rIn, a0)} L ${p(rr, a0)} A ${rr} ${rr} 0 0 1 ${p(rr, a1)} L ${p(rIn, a1)} A ${rIn} ${rIn} 0 0 0 ${p(rIn, a0)} Z`;
        return <path key={i} d={d} fill={i === peakIdx ? SIGNAL : INK} opacity={i === peakIdx ? 1 : 0.78} stroke={PAPER} strokeWidth="0.5" />;
      })}
      <circle cx={cx} cy={cy} r={rIn - 3} fill={PAPER} stroke={INK} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={MUTED}>PEAK HR</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="16" fontWeight="700" fill={INK}>
        {String(peakIdx).padStart(2, "0")}:00
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
   KPI TILE
   ───────────────────────────────────────────────────────── */
function Sparkline({ values, color, w = 100, h = 28 }: { values: number[]; color: string; w?: number; h?: number }) {
  const min = Math.min(...values), max = Math.max(...values), r = max - min || 1;
  const step = w / (values.length - 1);
  
  const points = values.map((v, i) => ({
    x: i * step,
    y: h - ((v - min) / r) * (h - 6) - 3
  }));
  
  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(" L ")}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;
  const gradId = `spark-grad-${Math.floor(Math.random() * 100000)}`;
  const lastPt = points[points.length - 1] || { x: w, y: h / 2 };

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill={color} />
    </svg>
  );
}

function KPI({
  label, value, delta, up, series, tone = "ink",
}: {
  label: string; value: string | number; delta: string; up: boolean;
  series: number[]; tone?: "ink" | "signal";
}) {
  const color = tone === "signal" ? SIGNAL : INK;
  return (
    <div className="bento-card bento-card-hover p-4 md:p-5">
      <div className="flex items-center justify-between gap-2 border-b border-ink/15 pb-2.5">
        <span className="font-sans text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">{label}</span>
        <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-bold ${up ? "text-signal" : "text-success"}`}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {delta}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="font-display text-[34px] leading-none font-bold tracking-tight" style={{ color }}>
          {value}
        </p>
        <Sparkline values={series} color={color} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN
   ───────────────────────────────────────────────────────── */
function Overview() {
  const {
    cases: allCases,
    kpis: KPIS,
    dailyTrend: DAILY_TREND,
    districtStats: DISTRICT_STATS,
    alerts: ALERTS,
    headDist: HEAD_DIST,
  } = useDb();

  const { language, t } = useLanguage();

  // Sort cases dynamically by date and Case ID descending (most recent first)
  const sortedCasesForFeed = [...allCases].sort((a, b) => {
    const dateDiff = new Date(b.registeredDate).getTime() - new Date(a.registeredDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.caseMasterId - a.caseMasterId;
  });

  const [selectedId, setSelectedId] = useState<number>(() => DISTRICT_STATS[0]?.district.id ?? 1);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInfo = getCatalystSyncInfo();

  const handleManualSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading("Syncing database with Zoho/Catalyst...");
    try {
      await syncWithCatalyst();
      toast.success("Database synced successfully!", { id: toastId });
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const selected = DISTRICT_STATS.find(d => d.district.id === selectedId) || DISTRICT_STATS[0] || {
    district: DISTRICTS[0], total: 0, heinous: 0, arrests: 0, riskScore: 0, spike: 0
  };

  const totalLiveFIRs = allCases.length;
  const heinousCount = allCases.filter(c => c.gravity === "Heinous").length;
  const heinousSharePct = Math.round((heinousCount / (totalLiveFIRs || 1)) * 100);

  const firs14 = DAILY_TREND.slice(-14).map(d => d.firs);
  const hein14 = DAILY_TREND.slice(-14).map(d => Math.round((d.heinous / (d.firs || 1)) * 100));
  const arr14 = DAILY_TREND.slice(-14).map(d => d.arrests);
  const cs14 = DAILY_TREND.slice(-14).map((d, i) => Math.round(d.firs * 0.35 + Math.sin(i) * 2));
  const clearance = Math.round((KPIS.chargeSheeted / (totalLiveFIRs || 1)) * 100);
  const critical = ALERTS.filter(a => a.severity === "critical" || a.severity === "high").length;
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* ───────── MASTHEAD & TICKER GROUP ───────── */}
      <div className="relative border-y-4 border-ink">
        {/* Sync Console button — top-right corner */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded border border-ink/35 bg-paper px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] font-bold text-ink hover:bg-ink hover:text-paper transition-all duration-150 shadow-sm"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin text-signal" : ""}`} />
            {isSyncing ? t("syncing") : t("syncConsole")}
          </button>
        </div>
        <header className="py-6 flex flex-col items-center text-center space-y-2.5">
          <h1 className="font-editorial text-[44px] md:text-[58px] leading-[0.95] tracking-tight text-ink">
            {language === "kn" ? (
              <>ಕರ್ನಾಟಕ <em className="text-signal font-serif">ಅಪರಾಧ</em> ದೈನಿಕ.</>
            ) : (
              <>The Karnataka <em className="text-signal font-serif">Crime</em> Daily.</>
            )}
          </h1>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest font-display">
            {t("Karnataka State Police · Strategic Crime Intelligence Console")}
          </p>
        </header>

        {/* ───────── TICKER ───────── */}
        <div className="relative overflow-hidden border-t border-ink bg-ink">
          <div className="flex whitespace-nowrap ticker-scroll py-2">
            {[...ALERTS, ...ALERTS].map((a, i) => (
              <span key={i} className="mx-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper">
                <span className={`h-1.5 w-1.5 rounded-full ${a.severity === "critical" ? "bg-signal" : a.severity === "high" ? "bg-warning" : "bg-paper/60"}`} />
                <span className="text-paper/60">{a.severity}</span>
                <span className="text-signal">◆</span>
                <span>{a.district}</span>
                <span className="text-paper/50">—</span>
                <span>{a.text}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ───────── KPI ROW ───────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/cases" className="block text-inherit hover:no-underline">
          <KPI label={t("totalFirs")} value={KPIS.totalFIRs} delta="+6.4%" up series={firs14} />
        </Link>
        <Link to="/cases" search={{ gravity: "Heinous" } as any} className="block text-inherit hover:no-underline">
          <KPI label={t("heinousShare")} value={`${KPIS.heinousPct}%`} delta="-2.1%" up={false} series={hein14} tone="signal" />
        </Link>
        <Link to="/cases" className="block text-inherit hover:no-underline">
          <KPI label={t("arrests")} value={KPIS.arrests} delta="+11.8%" up={false} series={arr14} />
        </Link>
        <Link to="/cases" search={{ status: "Charge Sheeted" } as any} className="block text-inherit hover:no-underline">
          <KPI label={t("chargeSheeted")} value={KPIS.chargeSheeted} delta="+4.2%" up={false} series={cs14} />
        </Link>
      </div>

      {/* ───────── SPATIAL CARTOGRAM CANVAS ───────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="grid gap-4 lg:grid-cols-[1.55fr_1fr]"
      >
        {/* MAP */}
        <div className="bento-card p-4 md:p-5">
          <div className="mb-3 flex items-start justify-between border-b-2 border-ink pb-2">
            <div>
              <h2 className="font-editorial text-2xl leading-none text-ink">{t("Spatial Cartogram")}</h2>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("Tap a district hex to interrogate the record")}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t("Selected")}</p>
              <p className="font-display text-sm font-bold text-signal">{t(selected.district.name)}</p>
            </div>
          </div>
          <Cartogram selectedId={selectedId} onSelect={setSelectedId} />

          {/* Spatial intelligence ribbon to utilize card bottom space */}
          <div className="mt-4 pt-4 border-t border-ink/15 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-md border border-ink/10 bg-surface-2 p-3 space-y-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{t("CRITICAL THREAT ZONE")}</p>
              <p className="font-display text-base font-bold text-signal truncate">
                {t([...DISTRICT_STATS].sort((a, b) => b.riskScore - a.riskScore)[0]?.district.name || "None")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("Threat index at")} <span className="font-mono text-signal font-bold">{[...DISTRICT_STATS].sort((a, b) => b.riskScore - a.riskScore)[0]?.riskScore || 0}/100</span>
              </p>
            </div>
            <div className="rounded-md border border-ink/10 bg-surface-2 p-3 space-y-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{t("MAX RATE ACCELERATION")}</p>
              <p className="font-display text-base font-bold text-ink truncate">
                {t([...DISTRICT_STATS].sort((a, b) => b.spike - a.spike)[0]?.district.name || "None")}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {t("Volume delta:")} <span className="text-emerald-600 font-bold">+{[...DISTRICT_STATS].sort((a, b) => b.spike - a.spike)[0]?.spike || 0}%</span> {t("vs baseline")}
              </p>
            </div>
            <div className="rounded-md border border-ink/10 bg-surface-2 p-3 space-y-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{t("SPIKE DENSITY MONITOR")}</p>
              <p className="font-display text-base font-bold text-ink truncate">
                {DISTRICT_STATS.filter(d => d.spike > 15).length} {t("Districts Spiking")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("Exceeding standard")} <span className="font-mono font-semibold text-signal">+15%</span> {t("threshold alert")}
              </p>
            </div>
          </div>
        </div>

        {/* DETAIL CARD */}
        <div className="flex flex-col gap-4">
          <div className="bento-card p-5">
            <div className="flex items-center gap-2 border-b border-ink/20 pb-2">
              <Radar className="h-4 w-4 text-signal" />
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{t("DISTRICT DOSSIER")}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">#{String(selected.district.id).padStart(3, "0")}</span>
            </div>
            <h3 className="mt-3 font-editorial text-3xl leading-none text-ink">{t(selected.district.name)}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {language === "kn" ? (
                <>ಜನಸಂಖ್ಯೆ {(selected.district.population / 1e6).toFixed(2)}M · ನಗರೀಕರಣ {selected.district.urbanization}% · ಅಕ್ಷರಸ್ಥತೆ {selected.district.literacy}%</>
              ) : (
                <>Population {(selected.district.population / 1e6).toFixed(2)}M · Urbanization {selected.district.urbanization}% · Literacy {selected.district.literacy}%</>
              )}
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="border-l-2 border-ink pl-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{t("FIRs")}</p>
                <p className="font-display text-xl font-bold">{selected.total}</p>
              </div>
              <div className="border-l-2 border-signal pl-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{t("Heinous")}</p>
                <p className="font-display text-xl font-bold text-signal">{selected.heinous}</p>
              </div>
              <div className="border-l-2 border-ink pl-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{t("Arrests")}</p>
                <p className="font-display text-xl font-bold">{selected.arrests}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{t("Risk score")}</p>
                <p className="font-display text-lg font-bold">{selected.riskScore}<span className="text-xs text-muted-foreground">/100</span></p>
                <div className="mt-1 h-1.5 w-32 border border-ink bg-paper">
                  <div className="h-full bg-signal" style={{ width: `${selected.riskScore}%` }} />
                </div>
              </div>
              <DistrictRadial districtId={selectedId} />
            </div>

            <Link to="/hotspots"
              className="mt-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.24em] text-ink hover:text-signal">
              {t("Drill into hotspots →")} </Link>
          </div>

          {/* ANOMALY TICKER — side panel */}
          <div className="bento-card p-5 flex-1">
            <div className="flex items-center justify-between border-b border-ink/20 pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-signal" />
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{t("ANOMALY BULLETIN")}</span>
              </div>
              <span className="rounded-sm bg-signal px-1.5 py-0.5 font-mono text-[9px] font-bold text-paper">
                {critical} {t("CRIT")}
              </span>
            </div>
            <ul className="mt-2 divide-y divide-ink/15">
              {ALERTS.slice(0, 5).map((a, i) => (
                <li key={a.id} className="grid grid-cols-[22px_1fr_auto] items-start gap-2 py-2.5">
                  <span className="font-editorial text-lg leading-none text-signal">{i + 1}.</span>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{t(a.severity)} · {t(a.district)}</p>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-ink">{t(a.text)}</p>
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground">{a.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.section>

      {/* ───────── SECOND ROW: TREND + TAXONOMY + CLEARANCE ───────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-6">
        {/* TREND */}
        <div className="bento-card p-5 lg:col-span-3">
          <div className="border-b-2 border-ink pb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">B1 · {t("Temporal")}</span>
            <h3 className="mt-1 font-editorial text-2xl leading-none">{t("30-Day Registration Trend")}</h3>
          </div>
          <TrendChart />
        </div>

        {/* TAXONOMY */}
        <div className="bento-card p-5 lg:col-span-2">
          <div className="border-b-2 border-ink pb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">B2 · {t("Taxonomy")}</span>
            <h3 className="mt-1 font-editorial text-2xl leading-none">{t("By Crime Head")}</h3>
          </div>
          <TaxonomyList />
        </div>

        {/* CLEARANCE */}
        <div className="bento-card p-5 lg:col-span-1 flex flex-col">
          <div className="border-b-2 border-ink pb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">B3 · {t("Outcome")}</span>
            <h3 className="mt-1 font-editorial text-xl leading-none">{t("Clearance")}</h3>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="relative">
              <svg viewBox="0 0 120 120" className="w-32 h-32">
                <circle cx="60" cy="60" r="52" fill="none" stroke={RULE} strokeWidth="10" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={SIGNAL} strokeWidth="10"
                  strokeDasharray={`${(clearance / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                  strokeLinecap="butt" transform="rotate(-90 60 60)" />
                <text x="60" y="66" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="26" fontWeight="700" fill={INK}>
                  {clearance}%
                </text>
              </svg>
            </div>
            <div className="mt-2 space-y-1 text-center">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {KPIS.chargeSheeted} {t("of")} {KPIS.totalFIRs}
              </p>
              <p className="font-editorial italic text-xs text-ink">{t("charge-sheeted")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── THIRD ROW: LIVE RECENT REGISTRY LOG ───────── */}
      <div className="bento-card p-5">
        <div className="border-b-2 border-ink pb-2 mb-4 flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">C1 · {t("Live Registry Feed")}</span>
            <h3 className="mt-1 font-editorial text-2xl leading-none">{t("Recent FIR Filings & Profile Registry")}</h3>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {language === "kn" ? "ಕೊನೆಯ 4 ಪ್ರಕರಣಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ" : "Showing last 4 cases"}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sortedCasesForFeed.slice(0, 4).map((c) => {
            const primaryVictim = c.victims?.[0];
            const primaryAccused = c.accused?.[0];
            return (
              <div key={c.caseMasterId} className="flex flex-col border border-ink/15 p-4 rounded-xl bg-paper/50 hover:bg-paper transition-all space-y-3.5 shadow-sm justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="font-mono text-[9px] border-signal text-signal px-2 py-0.5">{c.crimeNo}</Badge>
                    <span className="text-[10px] font-mono text-muted-foreground">{new Date(c.registeredDate).toLocaleDateString("en-IN")}</span>
                  </div>
                  <h4 className="font-bold text-sm text-ink mt-2.5 truncate">{t(c.crimeHead.name)}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{t(c.policeStation)}, {t(c.district.name)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${c.status === 'Charge Sheeted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-ink/5 text-ink/70'}`}>
                      {t(c.status)}
                    </span>
                    {c.status === 'Charge Sheeted' && c.chargesheetNo && (
                      <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-200">
                        {c.chargesheetNo}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2.5 border-t border-ink/10 text-xs">
                  {/* Police Officer */}
                  <div className="flex items-center gap-2">
                    {c.officerPhoto ? (
                      <img src={c.officerPhoto} alt="Officer" className="h-6 w-6 rounded-full object-cover border border-signal/20" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">IO</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] uppercase font-bold text-muted-foreground block">{t("Investigating Officer")}</span>
                      <p className="font-medium text-ink truncate">{c.registeringOfficer || "Officer"}</p>
                    </div>
                  </div>

                  {/* Victim */}
                  <div className="flex items-center gap-2">
                    {primaryVictim?.photo ? (
                      <img src={primaryVictim.photo} alt="Victim" className="h-6 w-6 rounded-full object-cover border border-emerald-500/20" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-[8px] font-bold text-emerald-600 shrink-0">VIC</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] uppercase font-bold text-muted-foreground block">{t("Primary Victim")}</span>
                      <p className="font-medium text-ink truncate">{primaryVictim?.name || t("Unknown")}</p>
                    </div>
                  </div>

                  {/* Accused */}
                  <div className="flex items-center gap-2">
                    {primaryAccused?.photo ? (
                      <img src={primaryAccused.photo} alt="Accused" className="h-6 w-6 rounded-full object-cover border border-red-500/20" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-[8px] font-bold text-red-600 shrink-0">MUG</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] uppercase font-bold text-muted-foreground block">{t("Primary Accused")}</span>
                      <p className="font-medium text-ink truncate">{primaryAccused?.name || t("Unknown")}</p>
                    </div>
                  </div>
                </div>

                <Link to={`/cases/${c.caseMasterId}`} className="pt-2 text-center">
                  <Button variant="ghost" size="sm" className="w-full text-xs font-bold hover:text-signal transition-colors h-7 gap-1">
                    {t("Open File")} <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            );
          })}
          {allCases.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-muted-foreground font-mono">
              {t("No live case files registered in datastore.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Trend line chart ─── */
function TrendChart() {
  const { dailyTrend: DAILY_TREND } = useDb();
  const { t } = useLanguage();
  const W = 460, H = 200, PAD = { l: 30, r: 12, t: 10, b: 22 };
  const inner = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b };
  const max = Math.max(...DAILY_TREND.map((d: any) => d.firs), 1);
  const xAt = (i: number) => PAD.l + (i / (DAILY_TREND.length - 1)) * inner.w;
  const yAt = (v: number) => PAD.t + inner.h - (v / max) * inner.h;

  const linePts = DAILY_TREND.map((d: any, i: number) => `${xAt(i)},${yAt(d.firs)}`).join(" L ");
  const areaPath = `M ${PAD.l},${PAD.t + inner.h} L ${linePts} L ${xAt(DAILY_TREND.length - 1)},${PAD.t + inner.h} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full h-auto">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={INK} strokeWidth="0.6" opacity="0.4" />
        </pattern>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + t * inner.h} y2={PAD.t + t * inner.h}
          stroke={RULE} strokeDasharray="2 3" />
      ))}
      <path d={areaPath} fill="url(#hatch)" />
      <path d={`M ${linePts}`} fill="none" stroke={INK} strokeWidth="2" />
      {/* heinous bars */}
      {DAILY_TREND.map((d: any, i: number) => {
        const bh = (d.heinous / max) * inner.h * 0.4;
        return (
          <rect key={i} x={xAt(i) - 3} y={PAD.t + inner.h - bh} width="6" height={bh} fill={SIGNAL} opacity="0.85" />
        );
      })}
      {/* end marker */}
      <circle cx={xAt(DAILY_TREND.length - 1)} cy={yAt(DAILY_TREND[DAILY_TREND.length - 1].firs)}
        r="4" fill={SIGNAL} stroke={INK} strokeWidth="1.5" />
      {/* y ticks */}
      <text x={PAD.l - 4} y={PAD.t + 8} textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={MUTED}>{max}</text>
      <text x={PAD.l - 4} y={PAD.t + inner.h} textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={MUTED}>0</text>
      {[0, 7, 14, 21, 29].map(i => (
        <text key={i} x={xAt(i)} y={H - 6} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={MUTED}>
          {DAILY_TREND[i].day}
        </text>
      ))}
      {/* legend */}
      <g transform={`translate(${W - 150} ${PAD.t + 4})`}>
        <line x1="0" y1="4" x2="14" y2="4" stroke={INK} strokeWidth="2" />
        <text x="18" y="7" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>{t("REGISTERED")}</text>
        <rect x="80" y="1" width="8" height="6" fill={SIGNAL} />
        <text x="92" y="7" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={INK}>{t("HEINOUS")}</text>
      </g>
    </svg>
  );
}

/* ─── Taxonomy list ─── */
function TaxonomyList() {
  const { headDist: HEAD_DIST } = useDb();
  const { t } = useLanguage();
  const total = HEAD_DIST.reduce((s: number, h: any) => s + h.value, 0) || 1;
  const sorted = [...HEAD_DIST].sort((a: any, b: any) => b.value - a.value);
  const max = sorted[0]?.value ?? 1;
  return (
    <ul className="mt-3 space-y-2.5">
      {sorted.map((h, i) => {
        const pct = Math.round((h.value / total) * 100);
        return (
          <li key={h.name} className="grid grid-cols-[20px_1fr_44px] items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-medium leading-tight">{t(h.name)}</span>
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{h.value}</span>
              </div>
              <div className="mt-1 h-1.5 w-full border border-ink bg-paper">
                <div className="h-full bg-ink" style={{ width: `${(h.value / max) * 100}%` }} />
              </div>
            </div>
            <span className="justify-self-end font-mono text-[10px] font-bold text-ink">{pct}%</span>
          </li>
        );
      })}
    </ul>
  );
}
