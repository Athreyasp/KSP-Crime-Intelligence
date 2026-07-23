import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { FORECAST } from "@/data/mock";
import { useDb } from "@/hooks/use-db";
import { Sparkles, TriangleAlert, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";

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

const chartAxis = { stroke: "oklch(0.68 0.02 250)", fontSize: 11 };

function Predictive() {
  const { districtStats: DISTRICT_STATS, cases: CASES } = useDb();
  const topRisk = DISTRICT_STATS.slice(0, 6);
  const anomalies = CASES.filter(c => c.gravity === "Heinous").slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        section="§ 05"
        eyebrow="AI/ML Powered · Model v2.4"
        title="Predictive Intelligence Dashboard"
        description="Forward-looking risk scoring, anomaly detection and crime forecasting."
        actions={<Badge className="bg-primary/15 text-primary border border-primary/40 gap-1"><Sparkles className="h-3 w-3" /> Live model</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-surface-1 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">14-Day Statewide Crime Forecast</CardTitle>
                <p className="text-xs text-muted-foreground">Predicted FIR volume with 90% confidence band</p>
              </div>
              <Badge className="bg-primary/15 text-primary border border-primary/40 gap-1"><TrendingUp className="h-3 w-3" /> Expected +8%</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer>
                <AreaChart data={FORECAST}>
                  <defs>
                    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.78 0.14 195)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="oklch(0.78 0.14 195)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.03 250)" />
                  <XAxis dataKey="day" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={{ background: "oklch(0.2 0.025 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#band)" />
                  <Area type="monotone" dataKey="lower" stroke="transparent" fill="oklch(0.16 0.02 250)" />
                  <Area type="monotone" dataKey="predicted" stroke="oklch(0.78 0.14 195)" strokeWidth={2.5} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">Top Risk Districts</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <RadialBarChart innerRadius="20%" outerRadius="100%" data={topRisk.map(d => ({ name: d.district.name, value: d.riskScore, fill: d.riskScore > 80 ? "oklch(0.68 0.22 28)" : d.riskScore > 60 ? "oklch(0.78 0.16 70)" : "oklch(0.78 0.14 195)" }))} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={4} />
                  <Tooltip contentStyle={{ background: "oklch(0.2 0.025 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, fontSize: 11 }} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              {topRisk.slice(0, 3).map(d => (
                <div key={d.district.id} className="flex items-center justify-between text-xs">
                  <span>{d.district.name}</span>
                  <span className="font-mono">{d.riskScore}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-surface-1 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-alert" /> Anomaly Detection</CardTitle>
          <p className="text-xs text-muted-foreground">Cases deviating from standard behavioural patterns · flagged for investigator review</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {anomalies.map(c => (
              <div key={c.caseMasterId} className="rounded-md border border-alert/30 bg-alert/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">FIR {c.crimeNo}</span>
                  <Badge className="bg-alert text-alert-foreground">Anomaly · 0.87</Badge>
                </div>
                <p className="mt-2 text-sm font-medium">{c.crimeHead.name} — {c.district.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.briefFacts}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">MO deviation</Badge>
                  <Badge variant="outline" className="text-[10px]">Time pattern break</Badge>
                  <Badge variant="outline" className="text-[10px]">Cross-district link</Badge>
                </div>
              </div>
            ))}
            {anomalies.length === 0 && (
              <div className="col-span-full py-6 text-center text-xs text-muted-foreground italic">
                No anomalous or heinous patterns identified in the current records database.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
