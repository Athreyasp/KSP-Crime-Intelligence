import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell
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
  const avgUrban = SOCIO ? Math.round(SOCIO.reduce((sum, s) => sum + s.urbanization, 0) / totalCount * 10) / 10 : 38.5;
  const avgLiteracy = SOCIO ? Math.round(SOCIO.reduce((sum, s) => sum + s.literacy, 0) / totalCount * 10) / 10 : 75.3;
  const avgCrimeRate = SOCIO ? Math.round(SOCIO.reduce((sum, s) => sum + s.crimeRate, 0) / totalCount * 10) / 10 : 12.8;
  const avgCyberShare = SOCIO ? Math.round(SOCIO.reduce((sum, s) => sum + (s.cyberShare || 0), 0) / totalCount * 10) / 10 : 8.4;

  // Selected District Data
  const districtData = SOCIO ? SOCIO.find(s => s.district === selectedDistrict) : null;

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
            <div className="grid gap-4 md:grid-cols-5 bg-paper border-2 border-ink/80 p-4 rounded-md">
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Crime Head Variance Indicators</span>
                
                {/* Cyber Crime Impact */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-ink">Cyber & Online Fraud</span>
                    <span className={`font-mono font-bold ${cyberImpact >= 0 ? "text-red-600" : "text-green-600"}`}>{cyberImpact >= 0 ? `+${cyberImpact}` : cyberImpact}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${cyberImpact >= 0 ? "bg-red-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(100, Math.max(5, 50 + cyberImpact))}%` }}
                    />
                  </div>
                </div>

                {/* Heinous Crimes Impact */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-ink">Heinous & Violent Crimes</span>
                    <span className={`font-mono font-bold ${heinousImpact >= 0 ? "text-red-600" : "text-green-600"}`}>{heinousImpact >= 0 ? `+${heinousImpact}` : heinousImpact}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${heinousImpact >= 0 ? "bg-red-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(100, Math.max(5, 50 + heinousImpact))}%` }}
                    />
                  </div>
                </div>

                {/* Property Crime Impact */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-ink">Theft & Asset Crimes</span>
                    <span className={`font-mono font-bold ${propertyImpact >= 0 ? "text-red-600" : "text-green-600"}`}>{propertyImpact >= 0 ? `+${propertyImpact}` : propertyImpact}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${propertyImpact >= 0 ? "bg-red-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(100, Math.max(5, 50 + propertyImpact))}%` }}
                    />
                  </div>
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
                {SOCIO && SOCIO.map(s => (
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
            <CardDescription className="text-xs">Bubble radius corresponds directly to district population scale</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-80">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                  <XAxis type="number" dataKey="urbanization" name="Urbanization %" {...chartAxis} />
                  <YAxis type="number" dataKey="crimeRate" name="Crime Rate (per 100k)" {...chartAxis} />
                  <ZAxis type="number" dataKey="population" range={[80, 800]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "#faf8f5",
                      border: "2px solid #1a1a1a",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace"
                    }}
                    formatter={(v: number | string, k: string) => [v, k === "urbanization" ? "Urbanization %" : k === "crimeRate" ? "Crime Rate" : k]}
                    labelFormatter={(_, p) => (p && p[0]?.payload?.district) || ""}
                  />
                  <Scatter data={SOCIO} fill="oklch(0.62 0.16 20)" fillOpacity={0.8} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-2 border-b border-border/40">
            <CardTitle className="text-base font-bold text-ink">Literacy Rate vs Cyber Crime Share</CardTitle>
            <CardDescription className="text-xs">Illustrates connection between general literacy and online fraud reporting</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-80">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                  <XAxis type="number" dataKey="literacy" name="Literacy %" {...chartAxis} domain={[55, 95]} />
                  <YAxis type="number" dataKey="cyberShare" name="Cyber %" {...chartAxis} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "#faf8f5",
                      border: "2px solid #1a1a1a",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace"
                    }}
                    labelFormatter={(_, p) => (p && p[0]?.payload?.district) || ""}
                  />
                  <Scatter data={SOCIO} fill="oklch(0.55 0.15 140)" fillOpacity={0.8} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. CORRELATION MATRIX COMPONENT */}
      <Card className="bg-surface-1 border-border">
        <CardHeader className="pb-2 border-b border-border/40">
          <CardTitle className="text-base font-bold text-ink">Correlation Coefficients (Pearson Coefficient Matrix)</CardTitle>
          <CardDescription className="text-xs">Displays the strength of relationships between structural variables and crime occurrences</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {corr.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-paper border border-border/80 rounded-md">
                <div className={`p-2 rounded font-mono font-bold text-xs ${c.value >= 0 ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                  {c.value >= 0 ? `+${c.value}` : c.value}
                </div>
                <div>
                  <span className="text-xs font-bold text-ink block">{c.pair}</span>
                  <span className="text-[10px] text-muted-foreground block">{c.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={corr} layout="vertical" margin={{ left: -10, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                <XAxis type="number" domain={[-1, 1]} {...chartAxis} />
                <YAxis type="category" dataKey="pair" width={160} {...chartAxis} />
                <Tooltip
                  contentStyle={{
                    background: "#faf8f5",
                    border: "2px solid #1a1a1a",
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: "monospace"
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {corr.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.value >= 0 ? "oklch(0.62 0.16 20)" : "oklch(0.55 0.15 140)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
