import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ResponsiveContainer, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  ComposedChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from "recharts";
import { DISTRICTS } from "@/data/mock";
import { useDb } from "@/hooks/use-db";
import { Sparkles, TriangleAlert, TrendingUp, Cpu, Terminal, User, ShieldCheck, Search, Network, CheckSquare, Square, Clock, MapPin, Activity, ShieldAlert, Fingerprint, Brain, Info, Sliders, Scale, CheckCircle2, Copy } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { toast } from "sonner";

import {
  predictCrimeCategory,
  computeDistrictRiskScores,
  detectAnomalies,
  forecastDailyCrimes,
  getDistrictDemo
} from "@/lib/ml-engine";


export const Route = createFileRoute("/predictive")({
  head: () => ({
    meta: [
      { title: "Predictive Intelligence · KSP" },
      { name: "description", content: "AI-driven risk scoring, anomaly detection and crime forecasting for the Karnataka SCRB." },
      { property: "og:title", content: "AI Predictive Intelligence" },
      { property: "og:description", content: "Forecast high-risk areas and emerging crime typologies with model-based analytics." },
    ],
  }),
  component: Predictive,
});

const chartAxis = { stroke: "#94a3b8", fontSize: 10, fontFamily: "monospace" };

function Predictive() {
  const { districtStats: DISTRICT_STATS, cases: CASES } = useDb();
  const { t, language } = useLanguage();



  // Dynamic Risk Stats calculation (Model 2)
  const computedRiskStats = useMemo(() => {
    return computeDistrictRiskScores(CASES);
  }, [CASES]);

  // Compute top risk districts mapping to UI expectations
  const topRisk = useMemo(() => {
    return computedRiskStats.slice(0, 6).map(r => {
      const distInfo = DISTRICTS.find(d => d.name === r.districtName) || DISTRICTS[0];
      const stats = DISTRICT_STATS.find((s: any) => s.district.name === r.districtName) || { heinous: 0, arrests: 0 };
      return {
        district: distInfo,
        total: r.totalCrimes,
        heinous: stats.heinous,
        arrests: stats.arrests,
        riskScore: r.compositeRiskScore,
        spike: Math.round((r.compositeRiskScore - 20) * 0.6)
      };
    });
  }, [computedRiskStats, DISTRICT_STATS]);

  // Live anomaly logs filtered (Model 3)
  const anomalies = useMemo(() => {
    return detectAnomalies(CASES).slice(0, 4);
  }, [CASES]);

  // Dynamic 14-day statewide forecast (Model 4)
  const forecastData = useMemo(() => {
    return forecastDailyCrimes(CASES);
  }, [CASES]);

  // Compute Radar Chart data for top 3 risk districts
  const radarData = useMemo(() => {
    if (topRisk.length < 3) return [];
    const metrics = [
      { key: "total", label: "Crime Volume" },
      { key: "heinous", label: "Heinous Offenses" },
      { key: "arrests", label: "Arrest Frequency" },
      { key: "riskScore", label: "AI Threat Rating" },
      { key: "spike", label: "Trend Spike Index" }
    ];
    
    const maxes = {
      total: Math.max(...topRisk.map(d => d.total), 1),
      heinous: Math.max(...topRisk.map(d => d.heinous), 1),
      arrests: Math.max(...topRisk.map(d => d.arrests), 1),
      riskScore: 100,
      spike: 60
    };

    return metrics.map(m => {
      const out: any = { subject: t(m.label) };
      topRisk.slice(0, 3).forEach((d, idx) => {
        const rawVal = (d as any)[m.key];
        let normVal = 0;
        if (m.key === "spike") {
          normVal = Math.round(50 + (rawVal / maxes.spike) * 45);
        } else {
          normVal = Math.round((rawVal / (maxes as any)[m.key]) * 100);
        }
        out[`dist_${idx}`] = Math.max(10, Math.min(100, normVal));
      });
      return out;
    });
  }, [topRisk, t]);

  // AI Scenario Simulator States
  const [simDistrict, setSimDistrict] = useState("Bengaluru Urban");
  const [simHour, setSimHour] = useState(22);
  const [simDayOfWeek, setSimDayOfWeek] = useState(6); // Saturday
  const [simMonth, setSimMonth] = useState(10); // October
  
  const defaultDemo = useMemo(() => {
    return getDistrictDemo(simDistrict);
  }, [simDistrict]);

  const [simUnemployment, setSimUnemployment] = useState(defaultDemo.unemployment);
  const [simUrbanization, setSimUrbanization] = useState(defaultDemo.urbanization);

  // Sync sliders when district is switched
  useEffect(() => {
    setSimUnemployment(defaultDemo.unemployment);
    setSimUrbanization(defaultDemo.urbanization);
  }, [simDistrict, defaultDemo]);

  // Compute model predictions on the fly (Model 1)
  const simulatedPredictions = useMemo(() => {
    const isWeekend = simDayOfWeek === 0 || simDayOfWeek === 6;
    const isNight = simHour >= 22 || simHour <= 5;
    return predictCrimeCategory({
      districtName: simDistrict,
      hour: simHour,
      dayOfWeek: simDayOfWeek,
      month: simMonth,
      isWeekend,
      isNight,
      customUnemployment: simUnemployment,
      customUrbanization: simUrbanization
    });
  }, [simDistrict, simHour, simDayOfWeek, simMonth, simUnemployment, simUrbanization]);

  // Compute simulated risk rating (Model 2)
  const simulatedRiskRating = useMemo(() => {
    const distStats = computedRiskStats.find(s => s.districtName === simDistrict) || { compositeRiskScore: 35.0 };
    // Adjust based on custom sliders compared to default demographics
    const unemploymentDiff = simUnemployment - defaultDemo.unemployment;
    const urbanizationDiff = simUrbanization - defaultDemo.urbanization;
    
    // Scale slider adjustments directly into the risk score
    const adjustedScore = distStats.compositeRiskScore + (unemploymentDiff * 2) + (urbanizationDiff * 15);
    return Math.max(10, Math.min(99, Number(adjustedScore.toFixed(1))));
  }, [simDistrict, simUnemployment, simUrbanization, defaultDemo, computedRiskStats]);

  // Compute simulated anomaly index (Model 3)
  const simulatedAnomalyIndex = useMemo(() => {
    let base = 15;
    const isWeekend = simDayOfWeek === 0 || simDayOfWeek === 6;
    const isNight = simHour >= 22 || simHour <= 5;
    
    // If night-time cyber / economic crime (spatiotemporal mismatch)
    const topCategory = simulatedPredictions[0]?.category;
    if (isNight && (topCategory === "Cyber Crimes" || topCategory === "Economic Offences")) {
      base += 35;
    }
    // High unemployment mismatch
    if (simUnemployment > 7.5 && isNight && isWeekend) {
      base += 20;
    }
    // Scale with urbanization
    base += Math.round(simUrbanization * 15);
    return Math.max(5, Math.min(95, base));
  }, [simDayOfWeek, simHour, simulatedPredictions, simUnemployment, simUrbanization]);



  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        section="05"
        eyebrow={t("AI/ML Powered · Model v2.4")}
        title={t("AI Risk Forecast")}
        description={t("AI-driven risk scoring, anomaly detection and crime forecasting")}
        actions={<Badge className="bg-primary/10 text-primary border border-primary/20 gap-1 font-mono text-[10px]"><Sparkles className="h-3 w-3 animate-pulse" /> {t("Live model")}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-surface-1 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-ink">{t("14-Day Statewide Crime Forecast & Anomaly Index")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("Predicted FIR volume (left axis) with 90% confidence bands vs AI Anomaly Probability (right axis)")}</p>
              </div>
              <Badge className="bg-primary/10 text-primary border border-primary/20 gap-1 font-mono text-[10px]"><TrendingUp className="h-3 w-3" /> {t("Expected +8%")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={forecastData}>
                  <defs>
                    <linearGradient id="predictedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" {...chartAxis} />
                  <YAxis yAxisId="left" {...chartAxis} label={{ value: t("Predicted FIRs"), angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 9, fill: '#5f6368', fontFamily: 'monospace' } }} />
                  <YAxis yAxisId="right" orientation="right" {...chartAxis} label={{ value: t("Anomaly Index %"), angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 9, fill: '#5f6368', fontFamily: 'monospace' } }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                      color: "var(--ink)"
                    }}
                  />
                  {/* Translucent confidence bands */}
                  <Area yAxisId="left" type="monotone" dataKey="upper" stroke="transparent" fill="var(--primary)" fillOpacity={0.05} />
                  <Area yAxisId="left" type="monotone" dataKey="lower" stroke="transparent" fill="transparent" />
                  {/* Predicted area line */}
                  <Area yAxisId="left" type="monotone" dataKey="predicted" stroke="var(--primary)" strokeWidth={2.5} fill="url(#predictedGrad)" />
                  {/* Anomaly line overlay */}
                  <Line yAxisId="right" type="monotone" dataKey="anomalyIndex" stroke="oklch(0.62 0.16 20)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-ink">{t("Top District Threat Vector")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("Normalized radar Threat profile of top 3 risk centers")}</p>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col items-center justify-between h-[320px]">
            <div className="h-[200px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8.5, fill: "#5f6368", fontFamily: "monospace" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 7, fill: "#5f6368" }} stroke="var(--border)" />
                  <Radar name={t(topRisk[0]?.district.name || "")} dataKey="dist_0" stroke="oklch(0.62 0.16 20)" fill="oklch(0.62 0.16 20)" fillOpacity={0.25} />
                  <Radar name={t(topRisk[1]?.district.name || "")} dataKey="dist_1" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
                  <Radar name={t(topRisk[2]?.district.name || "")} dataKey="dist_2" stroke="oklch(0.55 0.15 140)" fill="oklch(0.55 0.15 140)" fillOpacity={0.15} />
                  <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", fontSize: 10, color: "var(--ink)" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
            {/* List labels */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-border pt-3 text-[10px]">
              {topRisk.slice(0, 3).map((d, idx) => {
                const colors = [
                  "border-l-2 border-rose-500 text-rose-600 bg-rose-500/5",
                  "border-l-2 border-blue-500 text-blue-600 bg-blue-500/5",
                  "border-l-2 border-emerald-500 text-emerald-600 bg-emerald-500/5"
                ];
                return (
                  <div key={d.district.id} className={`pl-2 py-1 rounded-r border border-border ${colors[idx] || "text-slate-400"}`}>
                    <span className="font-semibold block truncate text-[9.5px] text-ink">{t(d.district.name)}</span>
                    <span className="font-mono text-[8.5px] opacity-80 text-muted-foreground">{t("Score")}: {d.riskScore}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🚀 INTERACTIVE AI SCENARIO SIMULATOR (Explainable AI) */}
      <Card className="bg-surface-1 border-border shadow-md overflow-hidden">
        <CardHeader className="pb-3 border-b border-border bg-surface-2/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Brain className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-ink">{t("Interactive AI Scenario Simulator")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("Adjust temporal features and demographics to run simulated ML predictions (Models 1-3)")}</p>
              </div>
            </div>
            <Badge className="bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 font-mono text-[10px] px-2 py-0.5"><Sliders className="h-3.5 w-3.5" /> {t("Model Sandbox v2.4")}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* COLUMN 1: SIMULATOR INPUTS */}
            <div className="lg:col-span-1 space-y-5 bg-surface-2 border border-border p-5 rounded-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2"><Sliders className="h-4 w-4 text-primary" /> {t("Simulation Inputs")}</h3>
              
              {/* Input 1: District */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" /> {t("District")}</label>
                <select
                  value={simDistrict}
                  onChange={e => setSimDistrict(e.target.value)}
                  className="w-full bg-surface-1 border border-border text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary text-ink outline-none transition-all"
                >
                  {DISTRICTS.map(d => (
                    <option key={d.id} value={d.name}>{t(d.name)}</option>
                  ))}
                </select>
              </div>

              {/* Input 2: Hour of Day */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1 text-ink"><Clock className="h-3.5 w-3.5 text-primary" /> {t("Hour of Day")}</span>
                  <span className="font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{String(simHour).padStart(2, '0')}:00 hrs</span>
                </div>
                <Slider
                  min={0}
                  max={23}
                  step={1}
                  value={[simHour]}
                  onValueChange={val => setSimHour(val[0])}
                  className="py-2"
                />
              </div>

              {/* Input 3: Day of Week */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink block">{t("Day of Week")}</label>
                <select
                  value={simDayOfWeek}
                  onChange={e => setSimDayOfWeek(Number(e.target.value))}
                  className="w-full bg-surface-1 border border-border text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary text-ink outline-none transition-all"
                >
                  <option value={1}>{t("Monday")}</option>
                  <option value={2}>{t("Tuesday")}</option>
                  <option value={3}>{t("Wednesday")}</option>
                  <option value={4}>{t("Thursday")}</option>
                  <option value={5}>{t("Friday")}</option>
                  <option value={6}>{t("Saturday")}</option>
                  <option value={0}>{t("Sunday")}</option>
                </select>
              </div>

              {/* Input 4: Month */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink block">{t("Month")}</label>
                <select
                  value={simMonth}
                  onChange={e => setSimMonth(Number(e.target.value))}
                  className="w-full bg-surface-1 border border-border text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary text-ink outline-none transition-all"
                >
                  <option value={1}>{t("January")}</option>
                  <option value={2}>{t("February")}</option>
                  <option value={3}>{t("March")}</option>
                  <option value={4}>{t("April")}</option>
                  <option value={5}>{t("May")}</option>
                  <option value={6}>{t("June")}</option>
                  <option value={7}>{t("July")}</option>
                  <option value={8}>{t("August")}</option>
                  <option value={9}>{t("September")}</option>
                  <option value={10}>{t("October")}</option>
                  <option value={11}>{t("November")}</option>
                  <option value={12}>{t("December")}</option>
                </select>
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Socio-Economic Modifiers")}</h4>
                
                {/* Slider: Unemployment */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-ink">{t("Unemployment Rate")}</span>
                    <span className="font-mono text-primary font-bold">{simUnemployment.toFixed(1)}%</span>
                  </div>
                  <Slider
                    min={2.0}
                    max={15.0}
                    step={0.1}
                    value={[simUnemployment]}
                    onValueChange={val => setSimUnemployment(val[0])}
                    className="py-1"
                  />
                  <p className="text-[9px] text-muted-foreground font-medium">{t("Base value for this district:")} {defaultDemo.unemployment}%</p>
                </div>

                {/* Slider: Urbanization */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-ink">{t("Urbanization Index")}</span>
                    <span className="font-mono text-primary font-bold">{(simUrbanization * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    min={0.10}
                    max={0.99}
                    step={0.01}
                    value={[simUrbanization]}
                    onValueChange={val => setSimUrbanization(val[0])}
                    className="py-1"
                  />
                  <p className="text-[9px] text-muted-foreground font-medium">{t("Base value for this district:")} {(defaultDemo.urbanization * 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>

            {/* COLUMN 2 & 3: MODEL PREDICTIONS & EXPLAINABLE AI */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Row 2.1: Key KPI Predictions */}
              <div className="grid gap-4 md:grid-cols-3">
                
                {/* Gauge Scorer Card */}
                <div className="p-4 bg-surface-2 border border-border rounded-xl flex items-center justify-between shadow-sm">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">{t("Predicted Risk Rating")}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-ink font-mono tracking-tight">{simulatedRiskRating}</span>
                      <span className="text-xs text-muted-foreground">/100</span>
                    </div>
                    <Badge className={`text-[9px] font-bold uppercase border mt-2 ${
                      simulatedRiskRating >= 45 
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' 
                        : simulatedRiskRating >= 33 
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' 
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    }`}>
                      {simulatedRiskRating >= 45 ? t("High Threat") : simulatedRiskRating >= 33 ? t("Medium Threat") : t("Low Threat")}
                    </Badge>
                  </div>
                  
                  {/* SVG Gauge */}
                  <div className="h-16 w-16 relative flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="32" cy="32" r="26" fill="transparent" stroke="var(--border)" strokeWidth="4.5" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        fill="transparent"
                        stroke={simulatedRiskRating >= 45 ? "#ef4444" : simulatedRiskRating >= 33 ? "#f59e0b" : "#10b981"}
                        strokeWidth="4.5"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 - (simulatedRiskRating / 100) * 2 * Math.PI * 26}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute font-mono text-[9px] font-bold text-muted-foreground">Index</span>
                  </div>
                </div>

                <div className="p-4 bg-surface-2 border border-border rounded-xl flex flex-col justify-between shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Primary Crime Threat")}</span>
                  <p className="text-sm font-extrabold text-ink mt-2 line-clamp-1 flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full animate-ping shrink-0" style={{ backgroundColor: simulatedPredictions[0]?.color }} />
                    {t(simulatedPredictions[0]?.category || "None")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("Top ML score:")} <strong className="font-mono text-primary font-bold">{simulatedPredictions[0]?.probability}%</strong>
                  </p>
                </div>

                <div className="p-4 bg-surface-2 border border-border rounded-xl flex flex-col justify-between shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Anomaly Probability")}</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-extrabold text-ink font-mono tracking-tight">{simulatedAnomalyIndex}%</span>
                  </div>
                  <div className="mt-3">
                    <Badge className={`text-[9px] font-bold uppercase border ${
                      simulatedAnomalyIndex >= 40 
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse' 
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    }`}>
                      {simulatedAnomalyIndex >= 40 ? t("Atypical Pattern") : t("Standard Pattern")}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Row 2.2: Category Probability bars */}
              <div className="p-5 border border-border bg-surface-2 rounded-xl space-y-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border pb-2">
                  <Activity className="h-4 w-4 text-primary" /> {t("Crime Typology Class Probabilities (Model 1)")}
                </h4>
                
                <div className="space-y-3.5">
                  {simulatedPredictions.map((pred, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-ink">{t(pred.category)}</span>
                        <span className="font-mono text-primary font-bold bg-primary/10 border border-primary/25 px-1.5 rounded">{pred.probability}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-1 rounded-full overflow-hidden border border-border/40">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pred.probability}%`,
                            backgroundColor: pred.color,
                            boxShadow: `0 0 8px ${pred.color}80`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2.3: Explainable AI Rationale */}
              <div className="p-4 border border-cyan-500/20 bg-cyan-500/5 rounded-xl space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> {t("Explainable AI (XAI) Inference Rationale")}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t("This model prediction leverages a simulated Random Forest pipeline. The following parameters drove this result:")}
                </p>
                <div className="grid gap-3 md:grid-cols-2 text-xs pt-1">
                  <div className="p-3 bg-surface-1 rounded-lg border border-border/60">
                    <span className="font-bold text-ink block">{t("Demographic Influence (Weight: 45%)")}</span>
                    <span className="text-[11px] text-muted-foreground mt-1 block leading-normal">
                      {simUnemployment > 6.0 
                        ? `${t("High Unemployment")} (${simUnemployment.toFixed(1)}%) ${t("and high Urbanization Index")} (${(simUrbanization*100).toFixed(0)}%) ${t("drives up Property Crime and Cyber Fraud probabilities.")}`
                        : `${t("Moderate demographics suppress baseline heinous offenses and threat indexes.")}`}
                    </span>
                  </div>
                  <div className="p-3 bg-surface-1 rounded-lg border border-border/60">
                    <span className="font-bold text-ink block">{t("Temporal Co-occurrence (Weight: 55%)")}</span>
                    <span className="text-[11px] text-muted-foreground mt-1 block leading-normal">
                      {(simHour >= 22 || simHour <= 5) 
                        ? `${t("Off-peak nighttime frame")} (${String(simHour).padStart(2, '0')}:00 hrs) ${t("increases nighttime getaway crime patterns (Theft/Burglary/Narcotics).")}`
                        : `${t("Business-hour registration timeframe suppresses random brawls/night property spikes but triggers higher Cyber/Economic risk scores.")}`}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-1 border-border shadow-md overflow-hidden">
        <CardHeader className="pb-3 border-b border-border bg-surface-2/60">
          <CardTitle className="text-base flex items-center gap-2.5 text-ink">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20">
              <TriangleAlert className="h-4 w-4 text-rose-600 animate-pulse" />
            </div>
            {t("Anomaly Detection (Model 3)")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("Cases deviating from standard behavioural patterns · flagged for investigator review")}</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {anomalies.map(c => (
              <div key={c.caseMasterId} className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 flex flex-col justify-between hover:border-rose-500/40 transition-all shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-rose-500 font-bold">
                      {c.crimeNo.startsWith("FIR") ? c.crimeNo : `FIR ${c.crimeNo}`}
                    </span>
                    <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/30 text-[10px] font-mono">{t("Score")} · {c.score}</Badge>
                  </div>
                  <p className="mt-2.5 text-xs font-bold text-ink uppercase tracking-tight">{t(c.crimeHead)} — {t(c.districtName)}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-normal line-clamp-2">{t(c.briefFacts)}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-rose-500/25 flex flex-wrap gap-1.5">
                  {c.reasons.map((r: string, rIdx: number) => (
                    <Badge key={rIdx} variant="outline" className="text-[9.5px] border-rose-500/20 text-rose-600 bg-rose-500/5 font-medium px-2 py-0.5 rounded-full">
                      {t(r)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            {anomalies.length === 0 && (
              <div className="col-span-full py-10 text-center text-xs text-muted-foreground italic">
                {t("No anomalous or heinous patterns identified in the current records database.")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
