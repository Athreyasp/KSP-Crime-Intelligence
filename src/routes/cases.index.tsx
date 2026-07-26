import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DISTRICTS, CRIME_HEADS, CASE_STATUS, GRAVITY, CASE_CATEGORY } from "@/data/mock";
import { useDb } from "@/hooks/use-db";
import { PageHeader } from "@/components/page-header";
import {
  Folder, FolderOpen, Search, Filter, CheckCircle2, Clock, AlertTriangle, ShieldAlert,
  LayoutGrid, List, Plus, RotateCcw, ArrowRight, Sparkles
} from "lucide-react";
import { toast } from "sonner";

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

  // DRAFT filter states (modified in UI controls)
  const [draftQ, setDraftQ] = useState("");
  const [draftDistrict, setDraftDistrict] = useState<string>("all");
  const [draftHead, setDraftHead] = useState<string>("all");
  const [draftStatus, setDraftStatus] = useState<string>("all");
  const [draftGravity, setDraftGravity] = useState<string>("all");
  const [draftCategory, setDraftCategory] = useState<string>("all");

  // APPLIED filter states (updated ONLY when user clicks "Apply Filters")
  const [appliedFilters, setAppliedFilters] = useState({
    q: "",
    district: "all",
    head: "all",
    status: "all",
    gravity: "all",
    category: "all"
  });

  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      appliedFilters.q.trim() ||
      appliedFilters.district !== "all" ||
      appliedFilters.head !== "all" ||
      appliedFilters.status !== "all" ||
      appliedFilters.gravity !== "all" ||
      appliedFilters.category !== "all"
    );
  }, [appliedFilters]);

  // Handle Apply Filters Action
  const handleApplyFilters = () => {
    setAppliedFilters({
      q: draftQ,
      district: draftDistrict,
      head: draftHead,
      status: draftStatus,
      gravity: draftGravity,
      category: draftCategory
    });
    const distText = draftDistrict !== "all" ? ` for ${draftDistrict}` : "";
    toast.success(`Filters applied successfully${distText}! Showing matching records.`);
  };

  // Handle Reset Filters Action
  const handleResetFilters = () => {
    setDraftQ("");
    setDraftDistrict("all");
    setDraftHead("all");
    setDraftStatus("all");
    setDraftGravity("all");
    setDraftCategory("all");
    setAppliedFilters({
      q: "",
      district: "all",
      head: "all",
      status: "all",
      gravity: "all",
      category: "all"
    });
    toast.info("Filters reset to default.");
  };

  // STRICTLY filter cases: ONLY matching cases are returned
  const matchingCases = useMemo(() => {
    const query = appliedFilters.q.trim().toLowerCase();

    return allCases.filter(c => {
      const matchDistrict = appliedFilters.district === "all" || 
        c.district.name.trim().toLowerCase() === appliedFilters.district.trim().toLowerCase();

      const matchHead = appliedFilters.head === "all" || 
        c.crimeHead.name.trim().toLowerCase() === appliedFilters.head.trim().toLowerCase();

      const matchStatus = appliedFilters.status === "all" || 
        c.status.trim().toLowerCase() === appliedFilters.status.trim().toLowerCase();

      const matchGravity = appliedFilters.gravity === "all" || 
        c.gravity.trim().toLowerCase() === appliedFilters.gravity.trim().toLowerCase();

      const matchCategory = appliedFilters.category === "all" || 
        c.category.trim().toLowerCase() === appliedFilters.category.trim().toLowerCase();

      const matchQuery = !query || (
        c.crimeNo.toLowerCase().includes(query) ||
        c.complainant.name.toLowerCase().includes(query) ||
        c.policeStation.toLowerCase().includes(query) ||
        c.briefFacts.toLowerCase().includes(query) ||
        c.actSections.some(sec => sec.toLowerCase().includes(query)) ||
        c.accused.some(a => a.name.toLowerCase().includes(query))
      );

      return matchDistrict && matchHead && matchStatus && matchGravity && matchCategory && matchQuery;
    });
  }, [allCases, appliedFilters]);

  // Aggregate stats directly from database
  const heinousCount = useMemo(() => allCases.filter(c => c.gravity === "Heinous").length, [allCases]);
  const activeCount = useMemo(() => allCases.filter(c => c.status === "Under Investigation").length, [allCases]);
  const chargeSheetedCount = useMemo(() => allCases.filter(c => c.status === "Charge Sheeted").length, [allCases]);
  const totalArrests = useMemo(() => allCases.reduce((acc, c) => acc + c.accused.filter(a => a.arrestId || a.arrested).length, 0), [allCases]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Header */}
      <PageHeader
        section="§ 07"
        eyebrow="Karnataka State Police · Crime Records"
        title="Case File Repository"
        description="Browse state FIR records. Select district or category filters and click Apply Filters to view matching folders."
        actions={
          <Link to="/cases/new">
            <Button size="sm" className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold flex items-center gap-1.5 rounded-full px-4 shadow-sm">
              <Plus className="h-4 w-4" /> Register New FIR
            </Button>
          </Link>
        }
      />

      {/* Minimalist Metric Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard label="Total FIR Files" value={allCases.length} icon={<Folder className="h-4 w-4 text-[#2563eb]" />} />
        <MetricCard label="Heinous Offences" value={heinousCount} highlightRed icon={<AlertTriangle className="h-4 w-4 text-[#ef4444]" />} />
        <MetricCard label="Under Investigation" value={activeCount} icon={<Clock className="h-4 w-4 text-[#f59e0b]" />} />
        <MetricCard label="Charge Sheeted" value={chargeSheetedCount} icon={<CheckCircle2 className="h-4 w-4 text-[#10b981]" />} />
        <MetricCard label="Custody Arrests" value={totalArrests} icon={<ShieldAlert className="h-4 w-4 text-[#2563eb]" />} />
      </div>

      {/* Minimalist Soothing Filter Bar */}
      <Card className="bg-white border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
        <CardContent className="p-4 space-y-4">
          
          {/* Top Row: Search Input & View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#94a3b8]" />
              <Input
                placeholder="Search Crime No., Complainant, Accused, or Station..."
                value={draftQ}
                onChange={e => setDraftQ(e.target.value)}
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
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Folder Grid
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={`h-8 px-3 text-xs font-semibold rounded-lg ${viewMode === "table" ? "bg-[#2563eb] text-white" : "text-[#64748b]"}`}
              >
                <List className="mr-1.5 h-3.5 w-3.5" /> Table List
              </Button>
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MinimalSelect
              label="District"
              defaultLabel="All Districts"
              value={draftDistrict}
              onChange={setDraftDistrict}
              options={["all", ...DISTRICTS.map(d => d.name)]}
            />

            <MinimalSelect
              label="Major Crime Head"
              defaultLabel="All Major Crime Heads"
              value={draftHead}
              onChange={setDraftHead}
              options={["all", ...CRIME_HEADS.map(c => c.name)]}
            />

            <MinimalSelect
              label="Status"
              defaultLabel="All Statuses"
              value={draftStatus}
              onChange={setDraftStatus}
              options={["all", ...CASE_STATUS]}
            />

            <MinimalSelect
              label="Gravity"
              defaultLabel="All Gravities"
              value={draftGravity}
              onChange={setDraftGravity}
              options={["all", ...GRAVITY]}
            />

            <MinimalSelect
              label="Category"
              defaultLabel="All Categories"
              value={draftCategory}
              onChange={setDraftCategory}
              options={["all", ...CASE_CATEGORY]}
            />
          </div>

          {/* Action Row: APPLY FILTERS Button & Reset */}
          <div className="flex items-center justify-between pt-2 border-t border-[#f1f5f9]">
            <div className="text-xs text-[#64748b]">
              Showing <strong className="text-[#0f172a] font-bold">{matchingCases.length}</strong> matching files (Total database: {allCases.length})
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-3 text-xs font-semibold text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>

              <Button
                type="button"
                onClick={handleApplyFilters}
                size="sm"
                className="h-9 px-5 text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-full shadow-sm flex items-center gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" /> Apply Filters
              </Button>
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
                <span>ACTIVE FILTER: Showing {matchingCases.length} matching folder(s) for {appliedFilters.district !== "all" ? appliedFilters.district : "selected criteria"}</span>
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
                <h3 className="mt-3 text-base font-bold text-[#0f172a]">No Cases Found for Selected Filter</h3>
                <p className="mt-1 text-xs text-[#64748b]">No FIR case files match the current district or status criteria.</p>
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
                    <th className="px-4 py-3">Crime No.</th>
                    <th className="px-4 py-3">District & Police Station</th>
                    <th className="px-4 py-3">Crime Head</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Action</th>
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
                        <div className="font-bold text-[#0f172a]">{c.district.name}</div>
                        <div className="text-[11px] text-[#64748b]">{c.policeStation}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0f172a]">
                        {c.crimeHead.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748b] font-mono text-[11px]">
                        {new Date(c.registeredDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to="/cases/$caseId" params={{ caseId: String(c.caseMasterId) }}>
                          <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-[#2563eb] hover:bg-[#eff6ff] rounded-full">
                            View File <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
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
  return (
    <div className="group flex flex-col rounded-2xl border border-[#e2e8f0] bg-white p-4 space-y-3 shadow-sm hover:border-[#2563eb] hover:shadow transition-all duration-200">
      {/* Top Header: Soft Folder icon + FIR Badge + Soft Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#eff6ff] text-[#2563eb]">
            <Folder className="h-4 w-4" />
          </div>
          <span className="font-mono text-xs font-bold text-[#1e293b]">
            FIR #{c.crimeNo}
          </span>
        </div>

        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
          {c.status}
        </span>
      </div>

      {/* Main Title & Location Subtitle */}
      <div>
        <h3 className="font-display text-base font-bold text-[#0f172a] group-hover:text-[#2563eb] transition-colors line-clamp-1">
          {c.crimeHead.name}
        </h3>
        <p className="text-xs text-[#64748b] mt-0.5">
          {c.policeStation}, {c.district.name} District · {new Date(c.registeredDate).toLocaleDateString("en-IN")}
        </p>
      </div>

      {/* Minimal Footer Row */}
      <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#64748b]">
          Category: <strong className="text-[#334155]">{c.category}</strong>
        </span>

        <Link to="/cases/$caseId" params={{ caseId: String(c.caseMasterId) }}>
          <Button size="sm" variant="ghost" className="h-8 px-3 text-xs font-bold text-[#2563eb] hover:bg-[#eff6ff] rounded-full flex items-center gap-1">
            View File <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlightRed, icon }: { label: string; value: number; highlightRed?: boolean; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between text-[#64748b]">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <p className={`mt-1 font-display text-2xl font-extrabold ${highlightRed ? "text-[#ef4444]" : "text-[#0f172a]"}`}>
        {value}
      </p>
    </div>
  );
}

function MinimalSelect({ label, defaultLabel, value, onChange, options }: { label: string; defaultLabel: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase font-bold text-[#64748b]">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#0f172a] font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
      >
        {options.map(o => (
          <option key={o} value={o}>
            {o === "all" ? defaultLabel : o}
          </option>
        ))}
      </select>
    </div>
  );
}
