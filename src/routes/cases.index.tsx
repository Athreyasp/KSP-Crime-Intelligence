import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DISTRICTS, CRIME_HEADS, CASE_STATUS } from "@/data/mock";
import { useDb } from "@/hooks/use-db";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Case Explorer · KSP Crime Intelligence" },
      { name: "description", content: "Filterable FIR case explorer with district, category, gravity and status drill-down." },
      { property: "og:title", content: "FIR Case Explorer" },
      { property: "og:description", content: "Browse and filter Karnataka FIRs with full case detail." },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const { cases: allCases } = useDb();
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState<string>("all");
  const [head, setHead] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const rows = useMemo(() => allCases.filter(c =>
    (district === "all" || c.district.name === district) &&
    (head === "all" || c.crimeHead.name === head) &&
    (status === "all" || c.status === status) &&
    (q === "" || c.crimeNo.includes(q) || c.complainant.name.toLowerCase().includes(q.toLowerCase()))
  ).slice(0, 60), [allCases, q, district, head, status]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        section="§ 07"
        eyebrow="FIR Corpus"
        title="Case Explorer"
        description="Browse the state FIR corpus. Filter by district, crime head or status, then open a row for full case detail."
        actions={<Badge variant="outline" className="border-border">{rows.length} of {allCases.length}</Badge>}
      />

      <Card className="bg-surface-1 border-border">
        <CardHeader className="pb-2">
          <div className="grid gap-2 md:grid-cols-4">
            <Input placeholder="Search crime no. / complainant…" value={q} onChange={e => setQ(e.target.value)} className="bg-surface-2 border-border" />
            <Select label="District" value={district} onChange={setDistrict} options={["all", ...DISTRICTS.map(d => d.name)]} />
            <Select label="Crime Head" value={head} onChange={setHead} options={["all", ...CRIME_HEADS.map(c => c.name)]} />
            <Select label="Status" value={status} onChange={setStatus} options={["all", ...CASE_STATUS]} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2">Crime No.</th>
                  <th className="text-left px-4 py-2">District / PS</th>
                  <th className="text-left px-4 py-2">Head</th>
                  <th className="text-left px-4 py-2">Gravity</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Registered</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.caseMasterId} className="border-b border-border/60 hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <Link to="/cases/$caseId" params={{ caseId: String(c.caseMasterId) }} className="font-mono text-xs text-primary hover:underline">
                        {c.crimeNo.slice(0, 12)}…
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{c.district.name}</div>
                      <div className="text-[11px] text-muted-foreground">{c.policeStation}</div>
                    </td>
                    <td className="px-4 py-2.5">{c.crimeHead.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={c.gravity === "Heinous" ? "border-alert/40 text-alert" : ""}>{c.gravity}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{c.status}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(c.registeredDate).toLocaleDateString("en-IN")}</td>
                    <td className="pr-3">
                      <Link to="/cases/$caseId" params={{ caseId: String(c.caseMasterId) }}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map(o => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
