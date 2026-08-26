import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DISTRICTS, CRIME_HEADS, CASE_STATUS, GRAVITY, CASE_CATEGORY } from "@/data/mock";
import { useDb } from "@/hooks/use-db";
import { useLanguage } from "@/hooks/use-language";
import { PageHeader } from "@/components/page-header";
import {
  Folder, FolderOpen, Search, Filter, CheckCircle2, Clock, AlertTriangle, ShieldAlert,
  LayoutGrid, List, Plus, RotateCcw, ArrowRight, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Case File Explorer · Karnataka State Police" },
      { name: "description", content: "Minimalist, precise case folder explorer for Karnataka Police First Information Reports (FIRs)." },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const { cases: allCases } = useDb();
  const { t, language } = useLanguage();

  // Parse URL search parameters on mount
  const params = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const initialStatus = params.get("status") || "all";
  const initialGravity = params.get("gravity") || "all";
  const initialDistrict = params.get("district") || "all";
  const initialQ = params.get("q") || "";

  // Filter states (reactive and instant)
  const [q, setQ] = useState(initialQ);
  const [district, setDistrict] = useState<string>(initialDistrict);
  const [head, setHead] = useState<string>("all");
  const [status, setStatus] = useState<string>(initialStatus);
  const [gravity, setGravity] = useState<string>(initialGravity);
  const [category, setCategory] = useState<string>("all");

  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      q.trim() ||
      district !== "all" ||
      head !== "all" ||
      status !== "all" ||
      gravity !== "all" ||
      category !== "all"
    );
  }, [q, district, head, status, gravity, category]);

  // Handle Reset Filters Action
  const handleResetFilters = () => {
    setQ("");
    setDistrict("all");
    setHead("all");
    setStatus("all");
    setGravity("all");
    setCategory("all");
    toast.info("Filters reset to default.");
  };

  // STRICTLY filter cases: ONLY matching cases are returned instantly
  const matchingCases = useMemo(() => {
    const query = q.trim().toLowerCase();

    return allCases.filter(c => {
      if (!c) return false;

      const matchDistrict = district === "all" || 
        (c.district && c.district.name && c.district.name.trim().toLowerCase() === district.trim().toLowerCase());

      const matchHead = head === "all" || 
        (c.crimeHead && c.crimeHead.name && c.crimeHead.name.trim().toLowerCase() === head.trim().toLowerCase());

      const matchStatus = status === "all" || 
        (c.status && c.status.trim().toLowerCase() === status.trim().toLowerCase());

      const matchGravity = gravity === "all" || 
        (c.gravity && c.gravity.trim().toLowerCase() === gravity.trim().toLowerCase());

      const matchCategory = category === "all" || 
        (c.category && c.category.trim().toLowerCase() === category.trim().toLowerCase());

      const matchQuery = !query || (
        (c.crimeNo && c.crimeNo.toLowerCase().includes(query)) ||
        (c.complainant && c.complainant.name && c.complainant.name.toLowerCase().includes(query)) ||
        (c.policeStation && c.policeStation.toLowerCase().includes(query)) ||
        (c.briefFacts && c.briefFacts.toLowerCase().includes(query)) ||
        (c.actSections && c.actSections.some(sec => sec && sec.toLowerCase().includes(query))) ||
        (c.accused && c.accused.some(a => a && a.name && a.name.toLowerCase().includes(query)))
      );

      return matchDistrict && matchHead && matchStatus && matchGravity && matchCategory && matchQuery;
    });
  }, [allCases, q, district, head, status, gravity, category]);

  // Aggregate stats directly from database
  const heinousCount = useMemo(() => allCases.filter(c => c.gravity === "Heinous").length, [allCases]);
  const activeCount = useMemo(() => allCases.filter(c => c.status === "Under Investigation").length, [allCases]);
  const chargeSheetedCount = useMemo(() => allCases.filter(c => c.status === "Charge Sheeted").length, [allCases]);
  const totalArrests = useMemo(() => allCases.reduce((acc, c) => acc + c.accused.filter(a => a.arrestId).length, 0), [allCases]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Header */}
      <PageHeader
        section="07"
        eyebrow={t("Karnataka State Police · Crime Records")}
        title={t("Case File Repository")}
        description={t("Browse state FIR records. Select district or category filters and click Apply Filters to view matching folders.")}
        actions={
          <Link to="/cases/new">
            <Button size="sm" className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold flex items-center gap-1.5 rounded-full px-4 shadow-sm">
              <Plus className="h-4 w-4" /> {t("Register New FIR")}
            </Button>
          </Link>
        }
      />

      {/* Minimalist Metric Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard label={t("Total FIR Files")} value={allCases.length} icon={<Folder className="h-4 w-4 text-[#2563eb]" />} />
        <MetricCard label={t("Heinous Offences")} value={heinousCount} highlightRed icon={<AlertTriangle className="h-4 w-4 text-[#ef4444]" />} />
        <MetricCard label={t("Under Investigation")} value={activeCount} icon={<Clock className="h-4 w-4 text-[#f59e0b]" />} />
        <MetricCard label={t("Charge Sheeted")} value={chargeSheetedCount} icon={<CheckCircle2 className="h-4 w-4 text-[#10b981]" />} />
        <MetricCard label={t("Custody Arrests")} value={totalArrests} icon={<ShieldAlert className="h-4 w-4 text-[#2563eb]" />} />
      </div>

      {/* Minimalist Soothing Filter Bar */}
      <Card className="bg-white border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
        <CardContent className="p-4 space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#94a3b8]" />
              <Input
                placeholder={t("Search Crime No., Complainant, Accused, or Station...")}
                value={q}
                onChange={e => setQ(e.target.value)}
                className="pl-10 bg-[#f8fafc] border-[#e2e8f0] focus:bg-white focus:ring-2 focus:ring-[#2563eb] rounded-xl text-sm"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0]">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={`h-8 px-3 text-xs font-semibold rounded-lg ${viewMode === "grid" ? "bg-[#2563eb] text-white" : "text-[#64748b]"}`}
              >
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> {t("Folder Grid")}
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={`h-8 px-3 text-xs font-semibold rounded-lg ${viewMode === "table" ? "bg-[#2563eb] text-white" : "text-[#64748b]"}`}
              >
                <List className="mr-1.5 h-3.5 w-3.5" /> {t("Table List")}
              </Button>
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MinimalSelect
              label="District"
              defaultLabel="All Districts"
              value={district}
              onChange={setDistrict}
              options={["all", ...DISTRICTS.map(d => d.name)]}
            />

            <MinimalSelect
              label="Major Crime Head"
              defaultLabel="All Major Crime Heads"
              value={head}
              onChange={setHead}
              options={["all", ...CRIME_HEADS.map(c => c.name)]}
            />

            <MinimalSelect
              label="Status"
              defaultLabel="All Statuses"
              value={status}
              onChange={setStatus}
              options={["all", ...CASE_STATUS]}
            />

            <MinimalSelect
              label="Gravity"
              defaultLabel="All Gravities"
              value={gravity}
              onChange={setGravity}
              options={["all", ...GRAVITY]}
            />

            <MinimalSelect
              label="Category"
              defaultLabel="All Categories"
              value={category}
              onChange={setCategory}
              options={["all", ...CASE_CATEGORY]}
            />
          </div>

          {/* Action Row: APPLY FILTERS Button & Reset */}
          <div className="flex items-center justify-between pt-2 border-t border-[#f1f5f9]">
            <div className="text-xs text-[#64748b]">
              {t("Showing")} <strong className="text-[#0f172a] font-bold">{matchingCases.length}</strong> {t("matching files (Total database:")} {allCases.length})
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  type="button"
                  onClick={handleResetFilters}
                  size="sm"
                  className="h-9 px-4 text-xs font-semibold bg-[#fee2e2] hover:bg-[#fcd3d3] text-[#ef4444] rounded-full flex items-center gap-1.5 shadow-sm transition-all duration-150"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> {t("Clear Filters")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FILTERED MATCHING RESULTS SECTION */}
      {viewMode === "grid" && (
        <div className="space-y-4">
          {hasActiveFilters && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe] text-[#1e40af] text-xs font-bold">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#2563eb]" />
                <span>{t("ACTIVE FILTER: Showing")} {matchingCases.length} {t("matching folder(s) for")} {district !== "all" ? t(district) : t("selected criteria")}</span>
              </span>
            </div>
          )}

          {/* Grid of ONLY matching cases */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matchingCases.map(c => (
              <SimpleFolderCard key={c.caseMasterId} c={c} />
            ))}

            {matchingCases.length === 0 && (
              <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc]">
                <FolderOpen className="mx-auto h-12 w-12 text-[#94a3b8]" />
                <h3 className="mt-3 text-base font-bold text-[#0f172a]">{t("No Cases Found for Selected Filter")}</h3>
                <p className="mt-1 text-xs text-[#64748b]">{t("No FIR case files match the current district or status criteria.")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: CLEAN TABLE LIST */}
      {viewMode === "table" && (
        <Card className="bg-white border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#f8fafc] text-[#64748b] font-bold border-b border-[#e2e8f0] uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">{t("Crime No.")}</th>
                    <th className="px-4 py-3">{t("District & Police Station")}</th>
                    <th className="px-4 py-3">{t("Crime Head")}</th>
                    <th className="px-4 py-3">{t("Photos")}</th>
                    <th className="px-4 py-3">{t("Status")}</th>
                    <th className="px-4 py-3">{t("Date")}</th>
                    <th className="px-4 py-3 text-right">{t("Action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {matchingCases.map(c => (
                    <tr key={c.caseMasterId} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#2563eb]">
                        <Link to="/cases/$caseId" params={{ caseId: String(c.caseMasterId) }} className="hover:underline">
                          {c.crimeNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#0f172a]">{t(c.district.name)}</div>
                        <div className="text-[11px] text-[#64748b]">{t(c.policeStation)}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0f172a]">
                        {t(c.crimeHead.name)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {c.officerPhoto ? (
                            <img src={c.officerPhoto} title={`IO: ${c.registeringOfficer}`} className="h-5 w-5 rounded-full border border-[#e2e8f0] object-cover shrink-0" />
                          ) : (
                            <div title="IO" className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[7px] font-bold text-gray-500 shrink-0">IO</div>
                          )}
                          {c.accused?.[0]?.photo && (
                            <img src={c.accused[0].photo} title={`Accused: ${c.accused[0].name}`} className="h-5 w-5 rounded-full border border-[#e2e8f0] object-cover shrink-0" />
                          )}
                          {c.victims?.[0]?.photo && (
                            <img src={c.victims[0].photo} title={`Victim: ${c.victims[0].name}`} className="h-5 w-5 rounded-full border border-[#e2e8f0] object-cover shrink-0" />
                          )}
                        </div>
                      </td>
                       <td className="px-4 py-3">
                        <span className={cn(
                          "text-[10px] font-semibold px-2.5 py-0.5 rounded-full inline-block",
                          c.status === "Charge Sheeted" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-[#f1f5f9] text-[#475569]"
                        )}>
                          {t(c.status)}
                        </span>
                        {c.status === "Charge Sheeted" && c.chargesheetNo && (
                          <div className="text-[9px] font-mono text-emerald-600 mt-1 font-bold">
                            {c.chargesheetNo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#64748b] font-mono text-[11px]">
                        {new Date(c.registeredDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to="/cases/$caseId" params={{ caseId: String(c.caseMasterId) }}>
                          <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-[#2563eb] hover:bg-[#eff6ff] rounded-full">
                            {t("View File")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {matchingCases.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground bg-[#f8fafc]">
                        <FolderOpen className="mx-auto h-12 w-12 text-[#94a3b8]" />
                        <h3 className="mt-3 text-base font-bold text-[#0f172a]">{t("No Cases Found for Selected Filter")}</h3>
                        <p className="mt-1 text-xs text-[#64748b]">{t("No FIR case files match the current district or status criteria.")}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

{/* ULTRA-SIMPLE & SOOTHING MINIMALIST FOLDER CARD */}
function SimpleFolderCard({ c }: { c: any }) {
  const { t } = useLanguage();
  return (
    <div className="group relative pt-4 flex flex-col transition-all duration-200">
      {/* Folder Tab Header */}
      <div className="absolute top-0 left-4 h-4.5 px-3 bg-[#f8fafc] group-hover:bg-[#eff6ff] border-t border-x border-[#e2e8f0] group-hover:border-[#2563eb] rounded-t-lg text-[8px] font-mono font-bold text-muted-foreground/80 group-hover:text-[#2563eb] flex items-center justify-center transition-colors duration-200">
        {t("FILE INDEX")} // {t(c.category)}
      </div>

      {/* Folder Main Body */}
      <div className="flex flex-col rounded-2xl rounded-tl-none border border-[#e2e8f0] group-hover:border-[#2563eb] bg-white p-4 space-y-3 shadow-sm group-hover:shadow transition-all duration-200">
        {/* Top Header: Soft Folder icon + FIR Badge + Soft Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#eff6ff] text-[#2563eb]">
              <Folder className="h-4 w-4" />
            </div>
            <span className="font-mono text-xs font-bold text-[#1e293b]">
              {t("FIR")} #{c.crimeNo}
            </span>
          </div>

          <span className={cn(
            "text-[11px] font-semibold px-2.5 py-0.5 rounded-full",
            c.status === "Charge Sheeted" 
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
              : "bg-[#f1f5f9] text-[#475569]"
          )}>
            {t(c.status)}
          </span>
        </div>

        {/* Main Title & Location Subtitle */}
        <div>
          <h3 className="font-display text-base font-bold text-[#0f172a] group-hover:text-[#2563eb] transition-colors line-clamp-1">
            {t(c.crimeHead.name)}
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            {t(c.policeStation)}, {t(c.district.name)} {t("District")} · {new Date(c.registeredDate).toLocaleDateString("en-IN")}
          </p>
          {c.status === "Charge Sheeted" && c.chargesheetNo && (
            <p className="text-[10px] font-mono text-emerald-600 bg-emerald-50/50 border border-emerald-200/50 rounded px-1.5 py-0.5 mt-1.5 inline-block font-bold">
              📄 CS ID: {c.chargesheetNo}
            </p>
          )}
        </div>

        {/* Roster Photo Preview Row */}
        <div className="flex items-center gap-1 pt-1 border-t border-[#f1f5f9]">
          <span className="text-[10px] text-[#64748b] font-medium mr-1.5">{t("Roster:")}</span>
          {c.officerPhoto ? (
            <img src={c.officerPhoto} title={`IO: ${c.registeringOfficer}`} className="h-5 w-5 rounded-full border border-[#e2e8f0] object-cover shrink-0" />
          ) : (
            <div title="IO" className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[7px] font-bold text-gray-500 shrink-0">IO</div>
          )}
          {c.accused?.[0]?.photo && (
            <img src={c.accused[0].photo} title={`Accused: ${c.accused[0].name}`} className="h-5 w-5 rounded-full border border-[#e2e8f0] object-cover shrink-0" />
          )}
          {c.victims?.[0]?.photo && (
            <img src={c.victims[0].photo} title={`Victim: ${c.victims[0].name}`} className="h-5 w-5 rounded-full border border-[#e2e8f0] object-cover shrink-0" />
          )}
        </div>

        {/* Minimal Footer Row */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#64748b]">
            {t("Category:")} <strong className="text-[#334155]">{t(c.category)}</strong>
          </span>

          <Link to="/cases/$caseId" params={{ caseId: String(c.caseMasterId) }}>
            <Button size="sm" variant="ghost" className="h-8 px-3 text-xs font-bold text-[#2563eb] hover:bg-[#eff6ff] rounded-full flex items-center gap-1">
              {t("View File")} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlightRed, icon }: { label: string; value: number; highlightRed?: boolean; icon: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between text-[#64748b]">
        <span className="text-[10px] font-bold uppercase tracking-wider">{t(label)}</span>
        {icon}
      </div>
      <p className={`mt-1 font-display text-2xl font-extrabold ${highlightRed ? "text-[#ef4444]" : "text-[#0f172a]"}`}>
        {value}
      </p>
    </div>
  );
}

function MinimalSelect({ label, defaultLabel, value, onChange, options }: { label: string; defaultLabel: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase font-bold text-[#64748b]">{t(label)}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#0f172a] font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
      >
        {options.map(o => (
          <option key={o} value={o}>
            {o === "all" ? t(defaultLabel) : t(o)}
          </option>
        ))}
      </select>
    </div>
  );
}
