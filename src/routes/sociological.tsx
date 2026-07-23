import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LabelList,
} from "recharts";
import { useDb } from "@/hooks/use-db";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/sociological")({
  head: () => ({
    meta: [
      { title: "Sociological Insights · KSP" },
      { name: "description", content: "Overlay crime data with urbanization, literacy and population patterns to reveal the 'why' behind the 'where'." },
      { property: "og:title", content: "Sociological & Correlation Analysis" },
      { property: "og:description", content: "Socio-economic correlation dashboards for evidence-based policing." },
    ],
  }),
  component: Sociological,
});

const chartAxis = { stroke: "oklch(0.68 0.02 250)", fontSize: 11 };

function Sociological() {
  const { socio: SOCIO } = useDb();
  const corr = [
    { pair: "Urbanization ↔ Crime Rate",  value: 0.62 },
    { pair: "Literacy ↔ Cyber Share",     value: 0.71 },
    { pair: "Population ↔ FIR Volume",    value: 0.83 },
    { pair: "Literacy ↔ Heinous Rate",    value: -0.44 },
    { pair: "Urbanization ↔ Property",    value: 0.55 },
    { pair: "Rural Index ↔ Body Crime",   value: 0.38 },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        section="§ 06"
        eyebrow="Correlation Analysis"
        title="Sociological & AI Insights"
        description="Correlating crime with urbanization, literacy and population distribution across Karnataka."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Urbanization vs Crime Rate</CardTitle>
            <p className="text-xs text-muted-foreground">Bubble size = population</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.03 250)" />
                  <XAxis type="number" dataKey="urbanization" name="Urbanization %" {...chartAxis} />
                  <YAxis type="number" dataKey="crimeRate" name="Crime Rate" {...chartAxis} />
                  <ZAxis type="number" dataKey="population" range={[60, 500]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "oklch(0.2 0.025 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number | string, k: string) => [v, k]}
                    labelFormatter={(_, p) => (p && p[0]?.payload?.district) || ""} />
                  <Scatter data={SOCIO} fill="oklch(0.78 0.14 195)" fillOpacity={0.75} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Literacy vs Cyber Crime Share</CardTitle>
            <p className="text-xs text-muted-foreground">Higher literacy correlates with higher cyber-crime reporting</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.03 250)" />
                  <XAxis type="number" dataKey="literacy" name="Literacy %" {...chartAxis} domain={[55, 95]} />
                  <YAxis type="number" dataKey="cyberShare" name="Cyber %" {...chartAxis} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "oklch(0.2 0.025 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(_, p) => (p && p[0]?.payload?.district) || ""} />
                  <Scatter data={SOCIO} fill="oklch(0.72 0.16 160)" fillOpacity={0.75} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-surface-1 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Correlation Matrix</CardTitle>
          <p className="text-xs text-muted-foreground">Pearson coefficient across socio-economic and crime indicators</p>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={corr} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.03 250)" />
                <XAxis type="number" domain={[-1, 1]} {...chartAxis} />
                <YAxis type="category" dataKey="pair" width={200} {...chartAxis} />
                <Tooltip contentStyle={{ background: "oklch(0.2 0.025 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" fill="oklch(0.85 0.01 250)" fontSize={11} />
                  {corr.map((c, i) => (
                    <Bar key={i} dataKey="value" fill={c.value >= 0 ? "oklch(0.78 0.14 195)" : "oklch(0.72 0.18 30)"} />
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
