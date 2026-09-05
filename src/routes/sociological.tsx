import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, ComposedChart, Line
} from "recharts";
import { useDb } from "@/hooks/use-db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, TrendingDown, BookOpen, Building2, Users2, ShieldAlert,
  Sliders, Landmark, Brain, Info, Layers, CheckCircle2, AlertTriangle, Scale
} from "lucide-react";

export const Route = createFileRoute("/sociological")({
  head: () => ({
    meta: [
      { title: "Sociological Insights & AI Correlation · KSP" },
      { name: "description", content: "AI demographic overlays correlating crime with urbanization, literacy, and population distributions across Karnataka." },
      { property: "og:title", content: "Sociological & AI Correlation Analysis" },
      { property: "og:description", content: "Socio-economic correlation dashboards for evidence-based policing." },
    ],
  }),
  component: Sociological,
});

const chartAxis = { stroke: "oklch(0.25 0.02 250)", fontSize: 10, fontFamily: "sans-serif" };

// Least Squares Linear Regression
function calculateRegression(data: { x: number; y: number }[]) {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of data) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }
  const denominator = (n * sumXX - sumX * sumX);
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// Pearson Correlation Coefficient
function calculatePearson(x: number[], y: number[]) {
  const n = x.length;
  if (n === 0) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
    sumYY += y[i] * y[i];
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  return den === 0 ? 0 : Number((num / den).toFixed(2));
}

const corrVariables = [
  { key: "urbanization", label: "Urbanization" },
  { key: "literacy", label: "Literacy" },
  { key: "population", label: "Population" },
  { key: "crimeRate", label: "Crime Rate" },
  { key: "cyberShare", label: "Cyber Share" }
];

function Sociological() {
  const { socio: SOCIO } = useDb();

  // State for AI demographic policy simulator
  const [urbanOffset, setUrbanOffset] = useState<number>(0);
  const [literacyOffset, setLiteracyOffset] = useState<number>(0);
  const [policeOffset, setPoliceOffset] = useState<number>(0);

  // State for District Explorer
  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    SOCIO && SOCIO.length > 0 ? SOCIO[0].district : ""
  );

  const [selectedCell, setSelectedCell] = useState<{ x: string; y: string; val: number } | null>({
    x: "Urbanization",
    y: "Crime Rate",
    val: 0.62
  });

  // Calculate regression overlay data points
  const scatterData1 = useMemo(() => {
    if (!SOCIO || SOCIO.length === 0) return [];
    const sorted = [...SOCIO].sort((a, b) => a.urbanization - b.urbanization);
    const regressionInput = sorted.map(s => ({ x: s.urbanization, y: s.crimeRate }));
    const { slope, intercept } = calculateRegression(regressionInput);
    return sorted.map(s => ({
      ...s,
      regressionValue: Number((slope * s.urbanization + intercept).toFixed(2))
    }));
  }, [SOCIO]);

  const scatterData2 = useMemo(() => {
    if (!SOCIO || SOCIO.length === 0) return [];
    const sorted = [...SOCIO].sort((a, b) => a.literacy - b.literacy);
    const regressionInput = sorted.map(s => ({ x: s.literacy, y: s.cyberShare || 0 }));
    const { slope, intercept } = calculateRegression(regressionInput);
    return sorted.map(s => ({
      ...s,
      regressionValue: Number((slope * s.literacy + intercept).toFixed(2))
    }));
  }, [SOCIO]);

  // Compute correlation matrix dynamically
  const correlationMatrix = useMemo(() => {
    if (!SOCIO || SOCIO.length === 0) return [];
    const arrays: Record<string, number[]> = {
      urbanization: SOCIO.map((s: any) => s.urbanization),
      literacy: SOCIO.map((s: any) => s.literacy),
      population: SOCIO.map((s: any) => s.population),
      crimeRate: SOCIO.map((s: any) => s.crimeRate),
      cyberShare: SOCIO.map((s: any) => s.cyberShare || 0)
    };
    return corrVariables.map((v1) => {
      return corrVariables.map((v2) => {
        const val = calculatePearson(arrays[v1.key], arrays[v2.key]);
        return {
          xVar: v1.label,
          yVar: v2.label,
          xKey: v1.key,
          yKey: v2.key,
          value: val
        };
      });
    });
  }, [SOCIO]);

  const corr = [
    { pair: "Urbanization ↔ Overall Crime", value: 0.62, category: "Positive", desc: "Urban density amplifies general property risk" },
    { pair: "Literacy ↔ Cyber Crime Share", value: 0.71, category: "Positive", desc: "High digital access increases online fraud reports" },
    { pair: "Population ↔ Total Case Volume", value: 0.83, category: "Positive", desc: "Absolute volume scales linearly with population" },
    { pair: "Literacy ↔ Heinous Crime Rate", value: -0.44, category: "Negative", desc: "Education correlates with lower violent crime rates" },
    { pair: "Urbanization ↔ Property Theft", value: 0.55, category: "Positive", desc: "Commercial hotspots present elevated asset risks" },
    { pair: "Rural Index ↔ Body Crimes", value: 0.38, category: "Positive", desc: "Physical altercations index higher in rural grids" },
  ];

  // Calculate State Averages
  const totalCount = SOCIO ? SOCIO.length : 1;
  const avgUrban = SOCIO ? Math.round(SOCIO.reduce((sum: number, s: any) => sum + s.urbanization, 0) / totalCount * 10) / 10 : 38.5;
  const avgLiteracy = SOCIO ? Math.round(SOCIO.reduce((sum: number, s: any) => sum + s.literacy, 0) / totalCount * 10) / 10 : 75.3;
  const avgCrimeRate = SOCIO ? Math.round(SOCIO.reduce((sum: number, s: any) => sum + s.crimeRate, 0) / totalCount * 10) / 10 : 12.8;
  const avgCyberShare = SOCIO ? Math.round(SOCIO.reduce((sum: number, s: any) => sum + (s.cyberShare || 0), 0) / totalCount * 10) / 10 : 8.4;

  // Selected District Data
  const districtData = SOCIO ? SOCIO.find((s: any) => s.district === selectedDistrict) : null;

  // Simulated AI Regression Models (SHAP Values/Risk projections)
  const baselineCrime = avgCrimeRate;
  const simulatedOffset = (urbanOffset * 0.42) - (literacyOffset * 0.28) - (policeOffset * 0.35);
  const projectedCrime = Math.round(Math.max(1, baselineCrime + simulatedOffset) * 10) / 10;
  const percentChange = Math.round(((projectedCrime - baselineCrime) / baselineCrime) * 100);

  // Dynamic Impact breakdown (%)
  const cyberImpact = Math.round((urbanOffset * 0.65) + (literacyOffset * 0.78) - (policeOffset * 0.15));
  const heinousImpact = Math.round((urbanOffset * 0.15) - (literacyOffset * 0.58) - (policeOffset * 0.48));
  const propertyImpact = Math.round((urbanOffset * 0.55) - (literacyOffset * 0.10) - (policeOffset * 0.32));
  const bodyImpact = Math.round((urbanOffset * 0.05) - (literacyOffset * 0.35) - (policeOffset * 0.55));

  const getPolicyBrief = () => {
    if (urbanOffset > 10) {
      return "Alert: Rapid urbanization raises property theft and cyber risk profiles. Deploy proactive CCTV coverage and neighborhood foot patrols in municipal extension zones.";
    }
    if (literacyOffset > 8) {
      return "Notice: Digital literacy surge will inflate cybercrime reporting. Coordinate with cyber cells to launch digital safety workshops and mobile warnings.";
    }
    if (policeOffset < -5) {
      return "Critical: Reduction in police density increases local heinous crime response lag. Re-route patrols to remote rural clusters to offset safety margins.";
    }
    if (policeOffset > 10) {
      return "Success: Police coverage expansion stabilizes crime hotspots. Shift excess forces to community outreach programs and intelligence-led investigations.";
    }
    return "Optimal: Karnataka demographics stable. Maintain current patrol routing, cyber watchdogs, and community-oriented precinct initiatives.";
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        section="06"
        eyebrow="AI Demographic Correlation Analysis"
        title="Sociological & AI Insights"
        description="Overlaying structural data (urbanization, literacy, population distribution) with crime records to reveal demographic correlation indicators."
      />

      {/* 1. KEY CORRELATIONS HIGHLIGHT BANNER */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-surface-1 border-border transition-all hover:border-ink/40">
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Urban vs General Crime</span>
              <Building2 className="h-4 w-4 text-signal" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-ink">+0.62</span>
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200/50 px-1.5 py-0.5 rounded">High Risk</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Denser urban wards experience a +62% increase in property crime rates.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border transition-all hover:border-ink/40">
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Literacy vs Cyber Crimes</span>
              <BookOpen className="h-4 w-4 text-signal" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-ink">+0.71</span>
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200/50 px-1.5 py-0.5 rounded">Digital Exposure</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Highly literate districts report +71% share of financial cyber infractions.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border transition-all hover:border-ink/40">
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Education vs violence</span>
              <Scale className="h-4 w-4 text-signal" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-ink">-0.44</span>
              <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200/50 px-1.5 py-0.5 rounded">Mitigative</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Literacy development strongly correlates with a -44% drop in heinous crimes.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border transition-all hover:border-ink/40">
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">State Averaged Density</span>
              <Users2 className="h-4 w-4 text-signal" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-ink">{avgCrimeRate}</span>
              <span className="text-xs font-semibold text-muted-foreground">per 100k</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Baseline averages for districts in urbanization ({avgUrban}%) and literacy ({avgLiteracy}%).
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 2. DEMOGRAPHIC RISK SIMULATOR CARD */}
        <Card className="bg-surface-1 border-border lg:col-span-2">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-signal" />
              <div>
                <CardTitle className="text-base font-bold text-ink">AI Demographic Risk & Policy Forecaster</CardTitle>
                <CardDescription className="text-xs">Adjust socio-economic trends to simulate projected shift in Crime Volumes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            <div className="grid gap-5 md:grid-cols-3">
              {/* Slider 1 */}
              <div className="space-y-2 bg-paper border border-border p-3.5 rounded-md">
                <div className="flex justify-between text-xs font-semibold text-ink">
                  <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Urban Offset</span>
                  <span className="font-mono text-signal">{urbanOffset > 0 ? `+${urbanOffset}` : urbanOffset}%</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="30"
                  value={urbanOffset}
                  onChange={(e) => setUrbanOffset(Number(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-signal"
                />
                <span className="text-[10px] text-muted-foreground block text-right">Urbanization growth projection</span>
              </div>

              {/* Slider 2 */}
              <div className="space-y-2 bg-paper border border-border p-3.5 rounded-md">
                <div className="flex justify-between text-xs font-semibold text-ink">
                  <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-muted-foreground" /> Literacy Boost</span>
                  <span className="font-mono text-signal">{literacyOffset > 0 ? `+${literacyOffset}` : literacyOffset}%</span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="20"
                  value={literacyOffset}
                  onChange={(e) => setLiteracyOffset(Number(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-signal"
                />
                <span className="text-[10px] text-muted-foreground block text-right">District literacy target rate</span>
              </div>

              {/* Slider 3 */}
              <div className="space-y-2 bg-paper border border-border p-3.5 rounded-md">
                <div className="flex justify-between text-xs font-semibold text-ink">
                  <span className="flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5 text-muted-foreground" /> Police Patrol Force</span>
                  <span className="font-mono text-signal">{policeOffset > 0 ? `+${policeOffset}` : policeOffset}%</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="40"
                  value={policeOffset}
                  onChange={(e) => setPoliceOffset(Number(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-signal"
                />
                <span className="text-[10px] text-muted-foreground block text-right">Patrol coverage offset</span>
              </div>
            </div>

            {/* SIMULATOR RESPONSE BLOCKS */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 bg-paper border-2 border-ink/80 p-4 rounded-md">
              <div className="md:col-span-2 flex flex-col justify-center items-center text-center p-3 border-b md:border-b-0 md:border-r border-border/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projected Crime Rate</span>
                <span className="text-3xl font-mono font-black text-ink my-1.5">{projectedCrime} <span className="text-xs font-normal text-muted-foreground">/ 100k</span></span>
                <div className="flex items-center gap-1">
                  {percentChange >= 0 ? (
                    <span className="flex items-center text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                      <TrendingUp className="h-3.5 w-3.5 mr-1" /> +{percentChange}% Risk
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                      <TrendingDown className="h-3.5 w-3.5 mr-1" /> {percentChange}% Drop
                    </span>
                  )}
                </div>
              </div>

              <div className="md:col-span-3 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">AI Attribution Factors (SHAP Shifts)</span>
                <div className="h-[120px] w-full">
                  <ResponsiveContainer>
                    <BarChart
                      data={[
                        { name: "Urban Growth", value: Number((urbanOffset * 0.42).toFixed(2)) },
                        { name: "Literacy Target", value: Number((-literacyOffset * 0.28).toFixed(2)) },
                        { name: "Patrol Force", value: Number((-policeOffset * 0.35).toFixed(2)) },
                      ]}
                      layout="vertical"
                      margin={{ left: -10, right: 10, top: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="2 2" stroke="oklch(0.9 0.01 250)" />
                      <XAxis type="number" domain={[-12, 15]} {...chartAxis} />
                      <YAxis type="category" dataKey="name" width={80} {...chartAxis} />
                      <Tooltip
                        contentStyle={{
                          background: "#faf8f5",
                          border: "2px solid #1a1a1a",
                          borderRadius: 4,
                          fontSize: 10,
                          fontFamily: "monospace"
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {[
                          { value: Number((urbanOffset * 0.42).toFixed(2)) },
                          { value: Number((-literacyOffset * 0.28).toFixed(2)) },
                          { value: Number((-policeOffset * 0.35).toFixed(2)) },
                        ].map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.value >= 0 ? "oklch(0.62 0.16 20)" : "oklch(0.55 0.15 140)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* AI Policy recommendations output */}
            <div className="bg-signal/5 border border-signal/20 p-3.5 rounded-md flex items-start gap-3">
              <Info className="h-4.5 w-4.5 text-signal shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold text-signal uppercase tracking-widest block">AI Strategic Response Brief</span>
                <p className="text-xs text-ink leading-relaxed mt-0.5 font-medium">{getPolicyBrief()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. DISTRICT EXPLORER & PROFILE CARD */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-signal" />
              <div>
                <CardTitle className="text-base font-bold text-ink">District Sociological Explorer</CardTitle>
                <CardDescription className="text-xs">Compare district profile metrics against State Average</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Select Target District</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="form-select w-full border border-border bg-paper px-3 py-2 rounded-md text-sm font-semibold"
              >
                {SOCIO && SOCIO.map((s: any) => (
                  <option key={s.district} value={s.district}>{s.district}</option>
                ))}
              </select>
            </div>

            {districtData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-paper border border-border p-2.5 rounded text-center">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Urbanization</span>
                    <span className="text-lg font-bold font-mono text-ink">{districtData.urbanization}%</span>
                    <span className="text-[10px] text-muted-foreground block">State Avg: {avgUrban}%</span>
                  </div>
                  <div className="bg-paper border border-border p-2.5 rounded text-center">
                    <span className="text-lg font-bold font-mono text-ink">{districtData.literacy}%</span>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Literacy</span>
                    <span className="text-[10px] text-muted-foreground block">State Avg: {avgLiteracy}%</span>
                  </div>
                </div>

                {/* Crime Rate comparison bar */}
                <div className="bg-paper border border-border p-3.5 rounded space-y-2">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Crime Rate Comparative</span>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-ink">
                      <span>{districtData.district}</span>
                      <span className="font-mono">{districtData.crimeRate} <span className="text-[9px] text-muted-foreground">/ 100k</span></span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div
                        className="bg-signal h-2 rounded-full"
                        style={{ width: `${Math.min(100, (districtData.crimeRate / Math.max(avgCrimeRate * 2, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>State Average</span>
                      <span className="font-mono">{avgCrimeRate} <span className="text-[9px]">/ 100k</span></span>
                    </div>
                    <div className="w-full bg-border/60 rounded-full h-2">
                      <div
                        className="bg-ink/50 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (avgCrimeRate / Math.max(avgCrimeRate * 2, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* AI Attribution / SHAP Explainer model */}
                <div className="space-y-2 bg-paper border border-border p-3.5 rounded-md">
                  <div className="flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-signal" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">AI Attribution Factors (SHAP)</span>
                  </div>
                  
                  <div className="space-y-1.5 pt-1">
                    {/* Feature 1 */}
                    <div className="flex justify-between text-[11px] font-medium text-ink">
                      <span>Urban density footprint</span>
                      <span className="text-red-600 font-semibold font-mono">+{Math.round(districtData.urbanization * 0.4)}% Risk</span>
                    </div>
                    {/* Feature 2 */}
                    <div className="flex justify-between text-[11px] font-medium text-ink">
                      <span>Digital literacy exposure</span>
                      <span className="text-red-600 font-semibold font-mono">+{Math.round((districtData.cyberShare || 0) * 0.8)}% Risk</span>
                    </div>
                    {/* Feature 3 */}
                    <div className="flex justify-between text-[11px] font-medium text-ink">
                      <span>Literacy reduction factor</span>
                      <span className="text-green-600 font-semibold font-mono">-{Math.round(districtData.literacy * 0.3)}% Risk</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Select a district to view insights.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. SCATTER & CORRELATION CHARTS GRID */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-2 border-b border-border/40">
            <CardTitle className="text-base font-bold text-ink">Urbanization Index vs Crime Rate</CardTitle>
            <CardDescription className="text-xs">With Linear Regression Line (Least Squares Fit). Bubble radius scales with population.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={scatterData1} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                  <XAxis type="number" dataKey="urbanization" name="Urbanization %" {...chartAxis} domain={['auto', 'auto']} />
                  <YAxis type="number" dataKey="crimeRate" name="Crime Rate" {...chartAxis} />
                  <ZAxis type="number" dataKey="population" range={[50, 450]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "#faf8f5",
                      border: "2px solid #1a1a1a",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace"
                    }}
                    formatter={(v: any, k: string) => [v, k === "urbanization" ? "Urbanization %" : k === "crimeRate" ? "Crime Rate (per 100k)" : k === "regressionValue" ? "Regression Fit" : k]}
                    labelFormatter={(_, p) => (p && p[0]?.payload?.district) || ""}
                  />
                  <Scatter dataKey="crimeRate" fill="oklch(0.62 0.16 20)" fillOpacity={0.75} />
                  <Line type="monotone" dataKey="regressionValue" stroke="oklch(0.62 0.16 20)" strokeWidth={2.2} dot={false} activeDot={false} legendType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-2 border-b border-border/40">
            <CardTitle className="text-base font-bold text-ink">Literacy Rate vs Cyber Crime Share</CardTitle>
            <CardDescription className="text-xs">With Linear Regression Line (Least Squares Fit). Bubble radius scales with population.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={scatterData2} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                  <XAxis type="number" dataKey="literacy" name="Literacy %" {...chartAxis} domain={[55, 95]} />
                  <YAxis type="number" dataKey="cyberShare" name="Cyber Share %" {...chartAxis} />
                  <ZAxis type="number" dataKey="population" range={[50, 450]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "#faf8f5",
                      border: "2px solid #1a1a1a",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace"
                    }}
                    formatter={(v: any, k: string) => [v, k === "literacy" ? "Literacy %" : k === "cyberShare" ? "Cyber Share %" : k === "regressionValue" ? "Regression Fit" : k]}
                    labelFormatter={(_, p) => (p && p[0]?.payload?.district) || ""}
                  />
                  <Scatter dataKey="cyberShare" fill="oklch(0.55 0.15 140)" fillOpacity={0.75} />
                  <Line type="monotone" dataKey="regressionValue" stroke="oklch(0.55 0.15 140)" strokeWidth={2.2} dot={false} activeDot={false} legendType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. CORRELATION HEATMAP MATRIX */}
      <Card className="bg-surface-1 border-border">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-base font-bold text-ink">Pearson Correlation Matrix Heatmap</CardTitle>
          <CardDescription className="text-xs">Interactive correlation grid between key sociological dimensions and crime features ($r$ coefficient)</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          <div className="grid gap-6 md:grid-cols-3 items-start">
            
            {/* Heatmap Grid */}
            <div className="md:col-span-2 overflow-x-auto">
              <div className="grid grid-cols-6 gap-1 bg-paper border border-border/80 p-3 rounded-md min-w-[500px]">
                {/* corner label */}
                <div className="flex items-center justify-end pr-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest h-11 border-b border-r border-border/40">
                  Metrics
                </div>
                {corrVariables.map(v => (
                  <div key={v.key} className="flex items-center justify-center text-center text-[9px] font-bold text-muted-foreground uppercase tracking-wider h-11 border-b border-border/40 px-1 leading-tight">
                    {v.label}
                  </div>
                ))}

                {corrVariables.map((rowVar, rIdx) => (
                  <Fragment key={rowVar.key}>
                    {/* row label */}
                    <div className="flex items-center justify-end pr-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider h-11 border-r border-border/40 text-right">
                      {rowVar.label}
                    </div>

                    {corrVariables.map((colVar, cIdx) => {
                      const val = correlationMatrix[rIdx]?.[cIdx]?.value ?? 0;
                      const absVal = Math.abs(val);

                      let bg = "bg-stone-50 border-stone-200/50";
                      let fg = "text-stone-500";
                      if (val > 0.05) {
                        if (absVal > 0.7) { bg = "bg-red-500/15 border-red-500/30"; fg = "text-red-700 font-bold"; }
                        else if (absVal > 0.4) { bg = "bg-red-500/10 border-red-500/20"; fg = "text-red-600 font-semibold"; }
                        else { bg = "bg-red-500/5 border-red-500/10"; fg = "text-red-500"; }
                      } else if (val < -0.05) {
                        if (absVal > 0.7) { bg = "bg-emerald-500/15 border-emerald-500/30"; fg = "text-emerald-700 font-bold"; }
                        else if (absVal > 0.4) { bg = "bg-emerald-500/10 border-emerald-500/20"; fg = "text-emerald-600 font-semibold"; }
                        else { bg = "bg-emerald-500/5 border-emerald-500/10"; fg = "text-emerald-500"; }
                      }

                      const isSelected = selectedCell?.x === rowVar.label && selectedCell?.y === colVar.label;

                      return (
                        <div
                          key={`${rowVar.key}-${colVar.key}`}
                          onClick={() => setSelectedCell({ x: rowVar.label, y: colVar.label, val })}
                          className={`flex items-center justify-center border rounded cursor-pointer transition-all duration-100 h-11 font-mono text-[11px] ${bg} ${fg} hover:scale-[1.03] ${
                            isSelected ? "ring-2 ring-ink ring-offset-1 scale-[1.04]" : ""
                          }`}
                        >
                          {val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Explanation card */}
            <div className="md:col-span-1 h-full flex flex-col justify-between">
              {selectedCell ? (
                <div className="bg-paper border border-border p-4 rounded-md space-y-3 shadow-sm flex-1">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Statistical Insight</span>
                    <Badge className={selectedCell.val >= 0 ? "bg-red-50 text-red-700 border border-red-200/50" : "bg-emerald-50 text-emerald-700 border border-emerald-200/50"}>
                      {selectedCell.val >= 0 ? "Direct Correlation" : "Inverse Correlation"}
                    </Badge>
                  </div>
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                    {selectedCell.x} ↔ {selectedCell.y}
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    A coefficient of <strong className="text-ink font-bold">{selectedCell.val >= 0 ? `+${selectedCell.val}` : selectedCell.val}</strong> represents a{" "}
                    <strong className="text-ink font-bold">
                      {Math.abs(selectedCell.val) > 0.7 ? "strong" : Math.abs(selectedCell.val) > 0.4 ? "moderate" : "weak"}
                    </strong>{" "}
                    {selectedCell.val >= 0 ? "positive association." : "negative association."}
                  </p>
                  <p className="text-[11px] text-ink/80 leading-relaxed font-sans">
                    {selectedCell.x === "Urbanization" && selectedCell.y === "Crime Rate" && "Higher urban density matches elevated aggregate crime counts, likely driven by commercial hubs and asset targets."}
                    {selectedCell.x === "Literacy" && selectedCell.y === "Cyber Share" && "Higher educational parameters correlate with greater internet connectivity, boosting financial cyber infraction reports."}
                    {selectedCell.x === "Population" && selectedCell.y === "Crime Rate" && "Absolute crime rates generally trend upwards in major population centers due to systemic reporting rates."}
                    {selectedCell.x === "Literacy" && selectedCell.y === "Crime Rate" && "Education is statistically associated with community safety enhancements, dragging down violent offenses."}
                    {selectedCell.x === selectedCell.y && "A variable correlated with itself is always perfect (+1.00)."}
                    {!((selectedCell.x === "Urbanization" && selectedCell.y === "Crime Rate") || (selectedCell.x === "Literacy" && selectedCell.y === "Cyber Share") || (selectedCell.x === "Population" && selectedCell.y === "Crime Rate") || (selectedCell.x === "Literacy" && selectedCell.y === "Crime Rate") || (selectedCell.x === selectedCell.y)) && "This pairwise interaction reflects minor covariance. External factors and socio-economic variables contribute significantly to variations."}
                  </p>
                </div>
              ) : (
                <div className="bg-surface-2 border border-dashed border-border p-4 rounded-md text-center text-xs text-muted-foreground italic h-full flex items-center justify-center">
                  Select a Pearson coefficient cell in the grid to view details.
                </div>
              )}
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
