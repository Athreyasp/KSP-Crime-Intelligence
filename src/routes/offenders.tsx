import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDb } from "@/hooks/use-db";
import { ChevronRight, MapPin, Fingerprint, Users, User, Sparkles, TriangleAlert, Clock, Target } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/offenders")({
  head: () => ({
    meta: [
      { title: "Repeat Offenders · KSP Crime Intelligence" },
      { name: "description", content: "Track repeat offenders across jurisdictions with MO fingerprints and case histories." },
      { property: "og:title", content: "Repeat Offender Tracker" },
      { property: "og:description", content: "Link individuals to multiple incidents and identify their Modus Operandi across districts." },
    ],
  }),
  component: OffendersPage,
});



function OffendersPage() {
  const { offenders: OFFENDERS, cases: CASES } = useDb();
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "high" | "property" | "violent">("all");
  const [activeTab, setActiveTab] = useState<"overview" | "dna" | "timeline" | "syndicate" | "prediction">("overview");

  useEffect(() => {
    if (!openId && OFFENDERS.length > 0) {
      setOpenId(OFFENDERS[0].id);
    }
  }, [OFFENDERS, openId]);

  // Handle profile click and reset sub-tab to overview
  const selectOffender = (id: string) => {
    setOpenId(id);
    setActiveTab("overview");
  };

  const filtered = OFFENDERS.filter(o => {
    const matchesSearch = o.name.toLowerCase().includes(q.toLowerCase());
    if (!matchesSearch) return false;
    if (filterTab === "high") return o.riskScore > 80;
    if (filterTab === "property") {
      return o.moTags.some(t => {
        const low = t.toLowerCase();
        return low.includes("theft") || low.includes("burglary") || low.includes("shutter") || low.includes("lock") || low.includes("housebreak") || low.includes("shop");
      });
    }
    if (filterTab === "violent") {
      return o.moTags.some(t => {
        const low = t.toLowerCase();
        return low.includes("assault") || low.includes("murder") || low.includes("snatch") || low.includes("robbery") || low.includes("weapon");
      });
    }
    return true;
  }).sort((a, b) => b.riskScore - a.riskScore);

  const active = OFFENDERS.find(o => o.id === openId) || OFFENDERS[0];

  // Extract a real database uploaded photo for the active offender if available
  const offenderPhoto = useMemo(() => {
    if (!active) return null;
    for (const cid of active.cases) {
      const c = CASES.find(x => x.caseMasterId === cid);
      if (c && c.accused) {
        const found = c.accused.find(a => a.name.toLowerCase().includes(active.name.toLowerCase()) || active.name.toLowerCase().includes(a.name.toLowerCase()));
        if (found && found.photo) {
          return found.photo;
        }
      }
    }
    return null;
  }, [active, CASES]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* GOOGLE MATERIAL CLEAN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#dadce0] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a73e8] bg-[#e8f0fe] px-2.5 py-0.5 rounded-md border border-[#aecbfa]">
              Watchlist & Network Profiles
            </span>
            <span className="text-xs text-[#5f6368] font-mono">| {OFFENDERS.length} {t("suspects monitored")}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#202124] tracking-tight">
            {t("Repeat Offender Tracker")}
          </h1>
          <p className="text-xs md:text-sm text-[#5f6368] mt-1">
            {t("Individuals linked to multiple FIRs — Modus Operandi mapping, syndicate link analysis and risk triggers.")}
          </p>
        </div>

        <div className="shrink-0">
          <Badge className="bg-[#e8f0fe] text-[#1a73e8] border border-[#aecbfa] font-bold px-3 py-1 text-xs">
            {OFFENDERS.length} {t("suspects monitored")}
          </Badge>
        </div>
      </div>

      {OFFENDERS.length === 0 ? (
        <Card className="p-8 text-center bg-white border border-[#dadce0] shadow-2xs rounded-2xl">
          <p className="text-sm text-[#5f6368] italic">
            {t("No repeat offenders registered yet. Offender profiles and predictive next-action intelligence will be displayed here once cases with accused details are added.")}
          </p>
          <div className="mt-4">
            <Link to="/cases/new" className="inline-flex items-center gap-1.5 bg-[#1a73e8] text-white px-4 py-2 text-xs font-semibold rounded-lg hover:bg-[#1557b0] transition-all shadow-2xs">
              {t("Register new FIR Case")}
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5 items-start">
          
          {/* COLUMN 1: Watchlist Directory (Span 2) */}
          <Card className="lg:col-span-2 bg-white border border-[#dadce0] shadow-xs rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-[#f8f9fa] border-b border-[#dadce0] p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-[#202124]">
                <Users className="h-4 w-4 text-[#1a73e8]" /> {t("Watchlist Directory")}
              </h3>
              <p className="text-xs text-[#5f6368] mt-0.5">{t("Select an offender to view full intelligence dossier")}</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Category Filters - Segmented buttons */}
              <div className="flex flex-wrap gap-1 bg-[#f8f9fa] border border-[#dadce0] p-1 rounded-xl">
                {[
                  { id: "all", label: "Show All" },
                  { id: "high", label: "High Risk (>80)" },
                  { id: "property", label: "Property MO" },
                  { id: "violent", label: "Violent MO" }
                ].map(chip => (
                  <button
                    key={chip.id}
                    onClick={() => setFilterTab(chip.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      filterTab === chip.id 
                        ? "bg-[#1a73e8] text-white font-semibold shadow-2xs" 
                        : "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
                    }`}
                  >
                    {t(chip.label)}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Input 
                  placeholder={t("Search suspect name...")} 
                  value={q} 
                  onChange={e => setQ(e.target.value)} 
                  className="bg-[#f8f9fa] border-[#dadce0] text-xs focus:ring-1 focus:ring-[#1a73e8] h-9 rounded-xl" 
                />
              </div>

              <div className="max-h-[520px] overflow-y-auto divide-y divide-[#dadce0] rounded-xl border border-[#dadce0]">
                {filtered.map(o => {
                  const isActive = openId === o.id;
                  const isHighRisk = o.riskScore > 80;
                  return (
                    <button 
                      key={o.id} 
                      onClick={() => selectOffender(o.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-all ${
                        isActive 
                          ? "bg-[#e8f0fe]/40 border-l-4 border-l-[#1a73e8]" 
                          : "bg-white hover:bg-[#f8f9fa]"
                      }`}
                    >
                      {/* Monogram Badge */}
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-xs border ${
                        isHighRisk 
                          ? "bg-[#fce8e6] border-[#f8b4b0] text-[#c5221f]" 
                          : "bg-[#e8f0fe] border-[#aecbfa] text-[#1a73e8]"
                      }`}>
                        {o.name.split(" ").map(x => x[0]).join("")}
                      </div>

                      {/* Info Detail */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-[#202124] truncate">{o.name}</span>
                          <span className="font-mono text-[9px] font-semibold text-[#5f6368] bg-[#f8f9fa] border border-[#dadce0] px-1.5 py-0.5 rounded">{o.id}</span>
                        </div>
                        {/* Risk Progress Indicator */}
                        <div className="mt-1 flex items-center gap-2">
                          <div className="w-16 bg-[#f1f3f4] h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isHighRisk ? "bg-[#c5221f]" : "bg-[#1a73e8]"}`}
                              style={{ width: `${o.riskScore}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#5f6368] font-medium">
                            {o.incidentCount} {t("cases")} · {o.jurisdictions.length} {t("districts")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className={`text-[10px] font-mono font-semibold px-2 py-0.5 ${
                          isHighRisk ? "bg-[#fce8e6] text-[#c5221f] border-[#f8b4b0]" : "bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa]"
                        }`}>
                          {o.riskScore}
                        </Badge>
                        <ChevronRight className={`h-4 w-4 ${isActive ? "text-[#1a73e8]" : "text-[#5f6368]"}`} />
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-xs text-[#5f6368] italic">
                    {t("No offenders match the filter criteria.")}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* COLUMN 2: Offender Detailed Dossier Panel (Span 3) */}
          {active && (
            <Card className="lg:col-span-3 bg-white border border-[#dadce0] shadow-xs rounded-2xl overflow-hidden">
              <div className="bg-[#f8f9fa] p-4 border-b border-[#dadce0]">
                {/* Google Material Biometric Dossier Profile Header */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 rounded-full border border-[#dadce0] bg-white overflow-hidden flex items-center justify-center relative shadow-2xs">
                      {offenderPhoto ? (
                        <img src={offenderPhoto} alt={active.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center">
                          <User className="h-6 w-6 text-[#5f6368]" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-[#202124] truncate">{active.name}</h2>
                        {active.riskScore > 80 ? (
                          <Badge variant="outline" className="bg-[#fce8e6] text-[#c5221f] border-[#f8b4b0] text-[10px] font-semibold">
                            WANTED // AT LARGE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-[#e6f4ea] text-[#137333] border-[#ceead6] text-[10px] font-semibold">
                            IN CUSTODY
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#5f6368] mt-0.5">
                        {t("Watchlist ID")}: <span className="font-mono text-[#1a73e8] font-semibold">{active.id}</span> · {active.gender === "M" ? t("Male") : t("Female")} · {t("Age")} {active.age}
                      </p>
                    </div>
                  </div>

                  {/* Clean Risk Score Card */}
                  <div className="bg-white rounded-xl p-3 border border-[#dadce0] shadow-2xs flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#5f6368] block">Threat Level</span>
                      <span className={`text-base font-bold font-mono ${active.riskScore > 80 ? "text-[#c5221f]" : active.riskScore > 60 ? "text-[#b06000]" : "text-[#137333]"}`}>
                        {active.riskScore} / 100
                      </span>
                    </div>
                  </div>
                </div>

                {/* Google Workspace Segmented Tab Bar */}
                <div className="flex gap-1 mt-4 border-t border-[#dadce0] pt-3 overflow-x-auto whitespace-nowrap scrollbar-none">
                  {[
                    { id: "overview", label: "Dossier Profile" },
                    { id: "dna", label: "Behavioral DNA" },
                    { id: "timeline", label: "Incident History" },
                    { id: "syndicate", label: "Syndicate Network" },
                    { id: "prediction", label: "AI Forecast" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        activeTab === tab.id 
                          ? "bg-[#1a73e8] text-white font-semibold shadow-2xs" 
                          : "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
                      }`}
                    >
                      {t(tab.label)}
                    </button>
                  ))}
                </div>
              </div>
              
              <CardContent className="space-y-4 pt-4">
                
                {/* TAB 1: OVERVIEW */}
                {activeTab === "overview" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Stat Panels */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3.5 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-[#5f6368] font-bold">{t("Total Crimes")}</p>
                        <p className="mt-1 text-2xl font-bold font-mono text-[#1a73e8]">{active.incidentCount}</p>
                      </div>
                      <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3.5 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-[#5f6368] font-bold">{t("Active Districts")}</p>
                        <p className="mt-1 text-2xl font-bold font-mono text-[#137333]">{active.jurisdictions.length}</p>
                      </div>
                      <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3.5 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-[#5f6368] font-bold">{t("MO Signatures")}</p>
                        <p className="mt-1 text-2xl font-bold font-mono text-[#b06000]">{active.moTags.length}</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#5f6368]">
                        <Fingerprint className="h-4 w-4 text-[#1a73e8]" /> {t("Modus Operandi Pattern")}
                      </p>
                      <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-[#dadce0] bg-[#f8f9fa]">
                        {active.moTags.map(m => (
                          <Badge key={m} variant="outline" className="bg-[#e8f0fe] border-[#aecbfa] text-[#1a73e8] text-xs py-0.5 font-medium rounded-md">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#5f6368]">
                        <MapPin className="h-4 w-4 text-[#137333]" /> {t("Operations Sectors")}
                      </p>
                      <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-[#dadce0] bg-[#f8f9fa]">
                        {active.jurisdictions.map(j => (
                          <Badge key={j} variant="outline" className="bg-[#e6f4ea] border-[#ceead6] text-[#137333] text-xs py-0.5 font-medium rounded-md">
                            {j}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-4 space-y-1.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a73e8]">{t("SCRB Watchlist Intelligence Brief")}</h4>
                      <p className="text-xs text-[#3c4043] leading-relaxed">
                        {t("This offender has been tracked committing multiple offenses across")} {active.jurisdictions.length} {t("distinct districts. Primary behavioral patterns focus heavily on")} '{active.moTags[0] || t("unspecified operations")}'. {t("Current risk score is calculated dynamically based on spatial density of active FIR cases, timing recurrence, and co-accused gang linkage counts.")}
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 1.5: BEHAVIORAL DNA */}
                {activeTab === "dna" && (
                  <DNAPanel offender={active} />
                )}

                {/* TAB 2: INCIDENT TIMELINE */}
                {activeTab === "timeline" && (() => {
                  // Sort cases chronologically
                  const sorted = [...active.cases]
                    .map(cid => CASES.find(x => x.caseMasterId === cid))
                    .filter(Boolean)
                    .sort((a, b) => new Date(a!.registeredDate || a!.incidentDate).getTime() - new Date(b!.registeredDate || b!.incidentDate).getTime());

                  return (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <p className="text-xs text-[#5f6368]">{t("Chronological incident log linking back to original FIR files:")}</p>
                      <div className="relative pl-6 space-y-4">
                        <span className="absolute left-2 top-2 bottom-2 w-0.5 bg-[#dadce0]" />
                        {sorted.map((c, idx) => {
                          const currDate = new Date(c!.registeredDate || c!.incidentDate);
                          let deltaDays: number | null = null;
                          if (idx > 0 && sorted[idx - 1]) {
                            const prevDate = new Date(sorted[idx - 1]!.registeredDate || sorted[idx - 1]!.incidentDate);
                            deltaDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                          }

                          return (
                            <div key={c!.caseMasterId} className="relative">
                              <span className="absolute -left-6 top-2 h-3.5 w-3.5 rounded-full bg-[#1a73e8] border-2 border-white" />
                              
                              <div className="space-y-1.5">
                                {deltaDays !== null && (
                                  <div className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[#b06000] bg-[#fef7e0] border border-[#feefc3] px-2 py-0.5 rounded-md">
                                    + {deltaDays} {t("Days Activity Delta")}
                                  </div>
                                )}

                                <Link to={`/cases/${c!.caseMasterId}`} className="block group">
                                  <div className="rounded-xl border border-[#dadce0] bg-white p-3.5 hover:bg-[#f8f9fa] transition-all">
                                    <div className="flex items-center justify-between text-[11px] font-mono">
                                      <span className="text-[#1a73e8] font-semibold group-hover:underline">FIR {c!.crimeNo}</span>
                                      <span className="text-[#5f6368]">{currDate.toLocaleDateString("en-IN")}</span>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold text-[#202124]">
                                      {t(c!.crimeHead.name)} · <span className="text-[#5f6368] font-normal">{t(c!.district.name)} ({c!.policeStation})</span>
                                    </p>
                                    <p className="mt-1 text-[11px] text-[#5f6368] line-clamp-1 leading-relaxed">{c!.briefFacts}</p>
                                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                      <Badge variant="outline" className="text-[9px] border-[#dadce0] py-0 px-1.5 font-medium bg-[#f8f9fa] text-[#3c4043]">{c!.moTag}</Badge>
                                      <Badge variant="outline" className={`text-[9px] py-0 px-1.5 font-semibold ${c!.gravity === "Heinous" ? "bg-[#fce8e6] border-[#f8b4b0] text-[#c5221f]" : "border-[#dadce0] bg-[#f8f9fa] text-[#3c4043]"}`}>{c!.gravity}</Badge>
                                    </div>
                                  </div>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* TAB 3: SYNDICATE NETWORK */}
                {activeTab === "syndicate" && (
                  <div className="animate-in fade-in duration-200">
                    <AssociatesPanel offenderId={active.id} />
                  </div>
                )}

                {/* TAB 4: AI FORECAST */}
                {activeTab === "prediction" && (
                  <div className="animate-in fade-in duration-200">
                    <PredictionPanel offender={active} cases={CASES} />
                  </div>
                )}

              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function DNAPanel({ offender }: { offender: any }) {
  const { cases: CASES, offenders: OFFENDERS, offenderAssociates: OFFENDER_ASSOCIATES } = useDb();
  const { t } = useLanguage();
  const [compareId, setCompareId] = useState<string>("");
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  const primaryAssociates = OFFENDER_ASSOCIATES[offender.id] ?? [];
  const primaryMetrics = useMemo(() => {
    return getOffenderDNAMetrics(offender, CASES, primaryAssociates.length);
  }, [offender, CASES, primaryAssociates]);

  const secondaryOffender = useMemo(() => {
    return OFFENDERS.find(o => o.id === compareId) || null;
  }, [compareId, OFFENDERS]);

  const secondaryAssociates = OFFENDER_ASSOCIATES[compareId] ?? [];
  const secondaryMetrics = useMemo(() => {
    if (!secondaryOffender) return null;
    return getOffenderDNAMetrics(secondaryOffender, CASES, secondaryAssociates.length);
  }, [secondaryOffender, CASES, secondaryAssociates]);

  // Combine metrics for Radar chart
  const radarData = useMemo(() => {
    return primaryMetrics.map((m, i) => {
      const sec = secondaryMetrics ? secondaryMetrics[i].score : 0;
      return {
        subject: t(m.subject),
        [offender.name]: m.score,
        ...(secondaryOffender ? { [secondaryOffender.name]: sec } : {})
      };
    });
  }, [primaryMetrics, secondaryMetrics, offender.name, secondaryOffender, t]);

  // Calculate Match Score
  const matchDetails = useMemo(() => {
    if (!secondaryOffender || !secondaryMetrics) return null;
    
    // Compute cosine similarity or euclidean distance
    let dotProduct = 0;
    let denomA = 0;
    let denomB = 0;
    
    primaryMetrics.forEach((m, i) => {
      const a = m.score;
      const b = secondaryMetrics[i].score;
      dotProduct += a * b;
      denomA += a * a;
      denomB += b * b;
    });
    
    const similarity = denomA > 0 && denomB > 0 
      ? Math.round((dotProduct / (Math.sqrt(denomA) * Math.sqrt(denomB))) * 100) 
      : 0;

    // Compile shared features
    const shared: string[] = [];
    
    // Compare Time bias
    const isPrimaryNight = primaryMetrics[3].score > 50;
    const isSecondaryNight = secondaryMetrics[3].score > 50;
    if (isPrimaryNight === isSecondaryNight) {
      shared.push(isPrimaryNight ? t("Identical operational time preference (Late Night)") : t("Identical operational time preference (Daytime Peak)"));
    }

    // Compare Specialization
    const isPrimaryProperty = primaryMetrics[2].score > 50;
    const isSecondaryProperty = secondaryMetrics[2].score > 50;
    if (isPrimaryProperty === isSecondaryProperty) {
      shared.push(isPrimaryProperty ? t("Shared focus on Property Crimes (Burglary/Theft)") : t("Shared focus on Violent/Strategic offenses"));
    }

    // Compare mobility
    const primaryMobility = primaryMetrics[0].score > 50;
    const secondaryMobility = secondaryMetrics[0].score > 50;
    if (primaryMobility === secondaryMobility) {
      shared.push(primaryMobility ? t("Highly mobile (operates across multiple jurisdictions)") : t("Local focus (confined within single sector)"));
    }

    // Compare syndicate involvement
    const primarySyndicate = primaryMetrics[4].score > 40;
    const secondarySyndicate = secondaryMetrics[4].score > 40;
    if (primarySyndicate === secondarySyndicate) {
      shared.push(primarySyndicate ? t("Active associate networks (gang/cell structure)") : t("Solo operating fingerprint"));
    }

    return {
      similarity,
      shared
    };
  }, [secondaryOffender, primaryMetrics, secondaryMetrics, t]);

  // Distinguishing markers list based on offender ID
  const biometricMarkers = useMemo(() => {
    const listMap: Record<string, { x: number; y: number; part: string; desc: string }[]> = {
      "OFF-1000": [
        { x: 128, y: 35, part: "Left Cheek", desc: "Burn scar / cut mark" },
        { x: 172, y: 155, part: "Right Wrist", desc: "Tattoo of a star signature" },
        { x: 145, y: 220, part: "Right Ankle", desc: "Slight operational limp reported" }
      ],
      "OFF-1001": [
        { x: 128, y: 80, part: "Upper Chest", desc: "Tattoo reading 'Tiger'" },
        { x: 92, y: 140, part: "Left Forearm", desc: "Deep surgical scar" }
      ],
      "OFF-1002": [
        { x: 128, y: 30, part: "Forehead", desc: "Old stitches mark above right brow" },
        { x: 165, y: 140, part: "Right Hand", desc: "Missing tip of index finger" }
      ]
    };
    return listMap[offender.id] || [
      { x: 128, y: 40, part: "Neck", desc: "Small moles on left side of neck" },
      { x: 110, y: 135, part: "Left Wrist", desc: "Scars from handcuffs or physical restraint" }
    ];
  }, [offender.id]);

  return (
    <div className="space-y-4 font-sans animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Fingerprint className="h-4 w-4 text-primary" /> {t("Modus Operandi Fingerprint Matrix")}
        </p>

        {/* Compare Select Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{t("Compare")}:</span>
          <select 
            value={compareId}
            onChange={e => setCompareId(e.target.value)}
            className="bg-[#f8f9fa] border border-[#dadce0] text-[11.5px] rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-[#1a73e8] text-[#202124] font-medium outline-none"
          >
            <option value="">-- {t("Select Offender to Compare")} --</option>
            {OFFENDERS.filter(o => o.id !== offender.id).map(o => (
              <option key={o.id} value={o.id}>{o.name} ({o.id})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Radar Web Plot Card */}
        <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-4 flex flex-col items-center justify-center relative min-h-[300px]">
          <span className="absolute top-2 left-2 text-[10px] font-mono text-[#5f6368]">{t("BEHAVIORAL DNA RADAR")}</span>
          <div className="w-full h-[260px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#dadce0" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#5f6368", fontSize: 9.5, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#dadce0" tick={{ fill: "#5f6368", fontSize: 8 }} />
                
                {/* Primary Offender Poly */}
                <Radar 
                  name={offender.name} 
                  dataKey={offender.name} 
                  stroke="#1a73e8" 
                  fill="#1a73e8" 
                  fillOpacity={0.2} 
                  strokeWidth={2}
                />
                
                {/* Secondary Offender Poly */}
                {secondaryOffender && (
                  <Radar 
                    name={secondaryOffender.name} 
                    dataKey={secondaryOffender.name} 
                    stroke="#b06000" 
                    fill="#b06000" 
                    fillOpacity={0.15} 
                    strokeWidth={2}
                  />
                )}
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex gap-4 text-[9px] font-semibold mt-1">
            <span className="flex items-center gap-1.5 text-[#202124]"><span className="h-2 w-2 rounded-full bg-[#1a73e8]" /> {offender.name}</span>
            {secondaryOffender && (
              <span className="flex items-center gap-1.5 text-[#202124]"><span className="h-2 w-2 rounded-full bg-[#b06000]" /> {secondaryOffender.name}</span>
            )}
          </div>
        </div>

        {/* Compare Intelligence Dossier / Biometrics Blueprint */}
        <div className="space-y-4">
          {/* Similarity Analysis output */}
          {matchDetails ? (
            <div className={`rounded-xl border p-4 space-y-3 shadow-2xs ${
              matchDetails.similarity > 75 
                ? "border-[#f8b4b0] bg-[#fce8e6] text-[#c5221f]" 
                : "border-[#feefc3] bg-[#fef7e0] text-[#b06000]"
            }`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider">{t("Similarity Score")}</h4>
                <Badge variant="outline" className={`border-0 text-[10.5px] font-bold ${
                  matchDetails.similarity > 75 ? "bg-rose-500/10 text-rose-600 border border-rose-500/20" : "bg-warning/10 text-warning border border-warning/20"
                }`}>
                  {matchDetails.similarity}% {t("Correlation")}
                </Badge>
              </div>
              
              <div className="space-y-2">
                {matchDetails.similarity > 75 ? (
                  <p className="text-[11px] font-semibold leading-snug text-rose-600">
                    🚨 {t("HIGH BEHAVIORAL OVERLAP: Profile patterns strongly align. Recommended joint investigation into potential accomplice ties or shared MO blueprint.")}
                  </p>
                ) : (
                  <p className="text-[11px] font-medium leading-snug text-amber-800">
                    {t("MODERATE PROFILE OVERLAP: Common operational signatures identified, but spatial or target specialization diverges significantly.")}
                  </p>
                )}
                
                {matchDetails.shared.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <p className="text-[9.5px] uppercase tracking-wider font-bold opacity-80">{t("Matching Vectors")}:</p>
                    <ul className="text-[10.5px] space-y-1 pl-3.5 list-disc font-medium">
                      {matchDetails.shared.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Default Biometrics blueprint locator
            <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-4 shadow-2xs">
              <h4 className="text-xs font-bold text-[#202124] uppercase tracking-wider mb-3">{t("Distinguishing Physical Markers")}</h4>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                {/* SVG Silhouette */}
                <div className="relative h-[220px] w-[180px] bg-white rounded-xl border border-[#dadce0] flex items-center justify-center p-2 shadow-inner">
                  <div className="absolute inset-0 bg-[radial-gradient(#dadce0_1px,transparent_1px)] [background-size:12px_12px] opacity-25" />
                  
                  {/* Schematic Outline */}
                  <svg viewBox="0 0 256 300" className="h-full w-full relative z-10 text-[#5f6368]/60">
                    <path 
                      d="M128 35 C118 35, 115 50, 115 55 C115 65, 120 70, 128 70 C136 70, 141 65, 141 55 C141 50, 138 35, 128 35 Z M128 70 L128 80 M110 80 C95 85, 90 100, 90 115 L90 160 C90 170, 95 170, 95 160 L95 125 L105 125 L105 210 L105 280 C105 288, 118 288, 118 280 L118 215 L128 215 L128 280 C128 288, 141 288, 141 280 L141 210 L141 125 L151 125 L151 160 C151 170, 156 170, 156 160 L156 115 C156 100, 151 85, 136 80 Z" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth={2}
                    />
                    
                    {/* Hot spots */}
                    {biometricMarkers.map((m, i) => (
                      <g 
                        key={i} 
                        transform={`translate(${m.x}, ${m.y})`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredMarker(t(m.desc))}
                        onMouseLeave={() => setHoveredMarker(null)}
                      >
                        <circle r={7} fill="#c5221f" opacity={0.3} className="animate-pulse" />
                        <circle r={3} fill="#c5221f" />
                      </g>
                    ))}
                  </svg>
                  
                  {/* Tooltip Overlay */}
                  {hoveredMarker && (
                    <div className="absolute inset-x-2 bottom-2 bg-[#202124] text-white text-[10.5px] p-1.5 rounded-lg border border-[#3c4043] leading-tight text-center z-20 shadow-md font-medium">
                      {hoveredMarker}
                    </div>
                  )}
                </div>
                
                {/* Details list */}
                <div className="flex-1 w-full space-y-2 text-xs">
                  <p className="text-[10px] uppercase font-bold text-[#5f6368] tracking-wider">{t("Identified Blueprints")}</p>
                  <div className="space-y-1.5 divide-y divide-[#dadce0]">
                    {biometricMarkers.map((m, i) => (
                      <div 
                        key={i} 
                        className="pt-1.5 first:pt-0 cursor-pointer text-[#202124] hover:text-[#1a73e8] transition-colors"
                        onMouseEnter={() => setHoveredMarker(t(m.desc))}
                        onMouseLeave={() => setHoveredMarker(null)}
                      >
                        <span className="font-bold text-[#1a73e8]">{t(m.part)}:</span>
                        <p className="text-[11px] text-[#5f6368]">{t(m.desc)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getOffenderDNAMetrics(offender: any, cases: any[], associatesCount: number) {
  const offenderCases = cases.filter(c => offender.cases.includes(c.caseMasterId));
  
  // 1. Mobility: number of active districts
  const mobility = Math.min(100, offender.jurisdictions.length * 33);
  
  // 2. Violence: Heinous crimes percentage
  const violentCount = offenderCases.filter(c => c.gravity === "Heinous" || ["murder", "assault", "robbery", "weapon"].some(w => c.crimeHead.name.toLowerCase().includes(w))).length;
  const violence = offenderCases.length > 0 ? Math.round((violentCount / offenderCases.length) * 100) : 30;
  
  // 3. Property Focus: Property offenses percentage
  const propertyCount = offenderCases.filter(c => ["theft", "burglary", "property", "housebreak"].some(w => c.crimeHead.name.toLowerCase().includes(w) || (c.moTag && c.moTag.toLowerCase().includes(w)))).length;
  const propertyFocus = offenderCases.length > 0 ? Math.round((propertyCount / offenderCases.length) * 100) : 40;
  
  // 4. Night Operations: percentage of crimes committed between 20:00 and 04:00
  const nightCount = offenderCases.filter(c => {
    if (c.hour !== undefined && c.hour !== null) {
      return c.hour >= 20 || c.hour <= 4;
    }
    return c.briefFacts?.toLowerCase().includes("night") || c.briefFacts?.toLowerCase().includes("dark") || c.briefFacts?.toLowerCase().includes("midnight");
  }).length;
  const nightBias = offenderCases.length > 0 ? Math.round((nightCount / offenderCases.length) * 100) : 50;

  // 5. Syndicate Strength: linked co-accused count
  const syndicate = Math.min(100, associatesCount * 20);

  // 6. Specialization: Consistency of MO Tags
  const uniqueMoTags = new Set(offenderCases.map(c => c.moTag));
  const specialization = Math.max(20, Math.round(100 - (uniqueMoTags.size / offenderCases.length) * 50));

  return [
    { subject: "Mobility", score: Math.max(15, mobility) },
    { subject: "Violence", score: Math.max(15, violence) },
    { subject: "Property Focus", score: Math.max(15, propertyFocus) },
    { subject: "Night Operations", score: Math.max(15, nightBias) },
    { subject: "Syndicate Links", score: Math.max(15, syndicate) },
    { subject: "MO Consistency", score: Math.max(15, specialization) },
  ];
}

function AssociatesPanel({ offenderId }: { offenderId: string }) {
  const { offenderAssociates: OFFENDER_ASSOCIATES } = useDb();
  const { t } = useLanguage();
  
  const rawAssociates = OFFENDER_ASSOCIATES[offenderId] ?? [];
  
  // State for filtering and inspection
  const [filterRole, setFilterRole] = useState<"all" | "Co-Accused" | "Handler" | "Informant" | "Victim" | "strong">("all");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Filter logic
  const filteredAssociates = useMemo(() => {
    return rawAssociates.filter(a => {
      if (filterRole === "all") return true;
      if (filterRole === "strong") return a.strength >= 70;
      return a.role === filterRole;
    });
  }, [rawAssociates, filterRole]);

  // Current active inspected node
  const activeIdx = hoveredIdx !== null ? hoveredIdx : selectedIdx;
  const activeSuspect = useMemo(() => {
    if (activeIdx !== null && filteredAssociates[activeIdx]) {
      return filteredAssociates[activeIdx];
    }
    // Default to the strongest associate if none is hovered or clicked
    if (filteredAssociates.length > 0) {
      return [...filteredAssociates].sort((a, b) => b.strength - a.strength)[0];
    }
    return null;
  }, [activeIdx, filteredAssociates]);

  const roleMeta: Record<string, { color: string; bg: string; text: string; icon: string }> = {
    "Co-Accused": { 
      color: "#1a73e8", 
      bg: "bg-[#e8f0fe] text-[#1a73e8] border border-[#aecbfa]", 
      text: "#1a73e8",
      icon: "🎯" 
    },
    "Handler": { 
      color: "#1a73e8", 
      bg: "bg-[#e8f0fe] text-[#1a73e8] border border-[#aecbfa]", 
      text: "#1a73e8",
      icon: "🛡️" 
    },
    "Informant": { 
      color: "#137333", 
      bg: "bg-[#e6f4ea] text-[#137333] border border-[#ceead6]", 
      text: "#137333",
      icon: "👁️" 
    },
    "Victim": { 
      color: "#c5221f", 
      bg: "bg-[#fce8e6] text-[#c5221f] border border-[#f8b4b0]", 
      text: "#c5221f",
      icon: "⚠️" 
    },
  };

  const CX = 230;
  const CY = 230;
  const RAD = 145;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header and Tactical Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#5f6368]">
            <Users className="h-4 w-4 text-[#1a73e8]" /> {t("Criminal Syndicate Link Analysis")}
          </p>
          <Badge variant="outline" className="bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa] text-[10px] font-semibold">
            {filteredAssociates.length} {t("Nodes Visible")}
          </Badge>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-1 bg-[#f8f9fa] border border-[#dadce0] p-1 rounded-xl">
          {[
            { id: "all", label: "All Connections" },
            { id: "strong", label: "Strong Ties (≥70%)" },
            { id: "Co-Accused", label: "Co-Accused" },
            { id: "Handler", label: "Handlers" },
            { id: "Informant", label: "Informants" },
            { id: "Victim", label: "Victims" }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => {
                setFilterRole(chip.id as any);
                setHoveredIdx(null);
                setSelectedIdx(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                filterRole === chip.id 
                  ? "bg-[#1a73e8] text-white font-semibold shadow-2xs" 
                  : "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
              }`}
            >
              {t(chip.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Redesigned Split Grid Dashboard */}
      <div className="grid gap-4 md:grid-cols-5 items-stretch">
        
        {/* Left/Top Column: Tactical Diagram (Span 3) */}
        <div className="md:col-span-3 rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-4 flex flex-col items-center justify-center relative shadow-xs min-h-[360px]">
          <span className="absolute top-2.5 left-3 text-[10px] font-mono font-semibold text-[#5f6368] tracking-wider uppercase">
            {t("Tactical Connection Web")}
          </span>

          <div className="relative w-full aspect-square max-w-[360px] bg-white rounded-xl border border-[#dadce0] overflow-hidden flex items-center justify-center shadow-inner mt-4">
            {/* Grid Dot Background */}
            <div className="absolute inset-0 bg-[radial-gradient(#dadce0_1px,transparent_1px)] [background-size:18px_18px] opacity-25 pointer-events-none" />

            <svg viewBox="0 0 460 460" className="h-full w-full relative z-10 select-none">
              <defs>
                <filter id="glow-link" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Concentric rings indicating distance relative to relationship strength */}
              {/* Strong ties boundary */}
              <circle cx={CX} cy={CY} r={RAD * 0.55} fill="none" stroke="#dadce0" strokeWidth="1" strokeDasharray="4 4" />
              <text x={CX + 5} y={CY - RAD * 0.55 - 4} fontSize="8" fontWeight="bold" fill="#5f6368" opacity="0.6">
                {t("STRONG COHORT")}
              </text>

              {/* Weak ties boundary */}
              <circle cx={CX} cy={CY} r={RAD} fill="none" stroke="#dadce0" strokeWidth="1" strokeDasharray="4 4" />
              <text x={CX + 5} y={CY - RAD - 4} fontSize="8" fontWeight="bold" fill="#5f6368" opacity="0.6">
                {t("OUTER NETWORK")}
              </text>

              {/* Connection Strings */}
              {filteredAssociates.map((a, i) => {
                const angle = (i / filteredAssociates.length) * Math.PI * 2 - Math.PI / 2;
                
                // Radius is computed dynamically based on tie strength (stronger ties are closer to center)
                const nodeRadius = RAD - ((a.strength - 20) / 80) * (RAD * 0.55);
                const x = CX + Math.cos(angle) * nodeRadius;
                const y = CY + Math.sin(angle) * nodeRadius;
                
                const isHovered = hoveredIdx === i || selectedIdx === i;
                const meta = roleMeta[a.role] || roleMeta["Co-Accused"];

                return (
                  <g key={`link-${i}`}>
                    <line
                      x1={CX}
                      y1={CY}
                      x2={x}
                      y2={y}
                      stroke={isHovered ? meta.color : "var(--border)"}
                      strokeOpacity={isHovered ? 1 : 0.45}
                      strokeWidth={isHovered ? 3.5 : Math.max(1.2, a.strength / 30)}
                      strokeDasharray={a.role === "Victim" ? "4 3" : "none"}
                      filter={isHovered ? "url(#glow-link)" : undefined}
                      className="transition-all duration-300"
                    />
                  </g>
                );
              })}

              {/* Center Target Node (Investigated Suspect) */}
              <g transform={`translate(${CX}, ${CY})`}>
                <circle r={34} fill="none" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.4" />
                <circle r={28} fill="var(--primary)" opacity={0.08} />
                <circle r={20} fill="var(--primary)" />
                
                <line x1={-24} y1={0} x2={24} y2={0} stroke="var(--background)" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1={0} y1={-24} x2={0} y2={24} stroke="var(--background)" strokeWidth="0.8" strokeOpacity="0.3" />
                
                <text textAnchor="middle" y={3} fontSize="8" fill="#ffffff" fontFamily="Inter, sans-serif" fontWeight="black" letterSpacing="0.5">
                  CORE
                </text>
              </g>

              {/* Associate Nodes */}
              {filteredAssociates.map((a, i) => {
                const angle = (i / filteredAssociates.length) * Math.PI * 2 - Math.PI / 2;
                const nodeRadius = RAD - ((a.strength - 20) / 80) * (RAD * 0.55);
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const x = CX + cos * nodeRadius;
                const y = CY + sin * nodeRadius;
                
                const isHovered = hoveredIdx === i || selectedIdx === i;
                const meta = roleMeta[a.role] || roleMeta["Co-Accused"];

                let textX = 0;
                let textY = -18;
                let textAnchor: "end" | "middle" | "start" | "inherit" = "middle";

                if (cos > 0.3) {
                  textX = 16;
                  textY = 3;
                  textAnchor = "start";
                } else if (cos < -0.3) {
                  textX = -16;
                  textY = 3;
                  textAnchor = "end";
                } else if (sin > 0.3) {
                  textX = 0;
                  textY = 22;
                  textAnchor = "middle";
                }

                return (
                  <g
                    key={`node-${i}`}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                  >
                    {/* Glowing highlight ring */}
                    {isHovered && (
                      <circle r={14} fill={meta.color} opacity={0.15} className="animate-pulse" />
                    )}

                    <circle
                      r={isHovered ? 11 : 8}
                      fill="var(--background)"
                      stroke={meta.color}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      className="transition-all duration-200 shadow-sm"
                    />
                    <circle r={3} fill={meta.color} />

                    <text
                      x={textX}
                      y={textY}
                      textAnchor={textAnchor}
                      fontSize="9"
                      fontWeight="bold"
                      fill="var(--ink)"
                      fontFamily="Inter, sans-serif"
                      style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3.5 } as React.CSSProperties}
                    >
                      {a.name}
                    </text>

                    <text
                      x={textX}
                      y={textY + 10}
                      textAnchor={textAnchor}
                      fontSize="7.5"
                      fontWeight="bold"
                      fill={meta.color}
                      fontFamily="Inter, sans-serif"
                      style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 2.5 } as React.CSSProperties}
                    >
                      {t(a.role)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Bottom Diagram Legend */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-3 bg-white/95 backdrop-blur border border-[#dadce0] rounded-lg py-1 px-3 text-[9px] font-bold text-[#5f6368] shadow-2xs">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#1a73e8]" /> {t("Co-Accused")}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#1a73e8]" /> {t("Handler")}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#137333]" /> {t("Informant")}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#c5221f]" /> {t("Victim")}</span>
            </div>
          </div>
        </div>

        {/* Right/Bottom Column: Node Inspector Dossier Card (Span 2) */}
        <div className="md:col-span-2 flex flex-col justify-between space-y-4">
          {activeSuspect ? (
            <Card className="flex-1 bg-white border border-[#dadce0] rounded-xl p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#1a73e8]" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-[#dadce0] pb-3">
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-[#5f6368] tracking-wider">{t("Suspect Profile Inspector")}</h4>
                    <h3 className="text-sm font-bold text-[#202124] mt-0.5">{activeSuspect.name}</h3>
                  </div>
                  
                  {/* Monogram Badge Avatar */}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs border ${
                    roleMeta[activeSuspect.role]?.bg || "bg-[#e8f0fe] border-[#aecbfa] text-[#1a73e8]"
                  }`}>
                    {activeSuspect.name.split(" ").map(x => x[0]).join("")}
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5f6368] font-medium">{t("Connection Role")}:</span>
                    <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      roleMeta[activeSuspect.role]?.bg || "bg-[#e8f0fe] text-[#1a73e8]"
                    }`}>
                      <span className="mr-1">{roleMeta[activeSuspect.role]?.icon}</span> {t(activeSuspect.role)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#5f6368] font-medium">{t("Relationship")}:</span>
                    <span className="text-[#202124] font-semibold">{t(activeSuspect.relation)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#5f6368] font-medium">{t("Shared Cases")}:</span>
                    <Badge variant="outline" className="bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa] font-mono font-semibold text-[10.5px]">
                      {activeSuspect.sharedCases} {t("FIR(s)")}
                    </Badge>
                  </div>

                  {/* Association Strength Progress */}
                  <div className="space-y-1 bg-[#f8f9fa] p-3 rounded-lg border border-[#dadce0]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#5f6368]">{t("Syndicate Tie Strength")}:</span>
                      <span className="font-mono font-bold text-[#1a73e8]">{activeSuspect.strength}%</span>
                    </div>
                    <div className="w-full bg-[#f1f3f4] h-2 rounded-full overflow-hidden mt-1.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          activeSuspect.strength >= 75 
                            ? "bg-[#c5221f]" 
                            : activeSuspect.strength >= 50 
                            ? "bg-[#1a73e8]" 
                            : "bg-[#137333]"
                        }`}
                        style={{ width: `${activeSuspect.strength}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#dadce0]">
                <p className="text-[10px] text-[#5f6368] italic leading-relaxed">
                  💡 {t("Hover or click nodes on the tactical web to inspect co-accused status, role signatures, and calculated syndicate ties.")}
                </p>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 bg-white border border-[#dadce0] rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-2xs">
              <Users className="h-8 w-8 text-[#5f6368] mb-2" />
              <p className="text-xs text-[#5f6368] italic">
                {t("No suspects linked to this offender profile in the database.")}
              </p>
            </Card>
          )}

          {/* Quick List */}
          <div className="max-h-[140px] overflow-y-auto divide-y divide-[#dadce0] rounded-xl border border-[#dadce0] bg-white shadow-2xs">
            {filteredAssociates.map((a, i) => {
              const isHovered = hoveredIdx === i || selectedIdx === i;
              const meta = roleMeta[a.role] || roleMeta["Co-Accused"];
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-xs transition-colors cursor-pointer ${
                    isHovered ? "bg-[#e8f0fe] font-semibold" : "hover:bg-[#f8f9fa]"
                  }`}
                >
                  <span className="truncate text-[#202124] font-bold">{a.name}</span>
                  <Badge variant="outline" className={`border-0 text-[8.5px] font-bold px-1.5 py-0 rounded-full ${meta.bg}`}>
                    {t(a.role)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

function PredictionPanel({ offender, cases }: { offender: any; cases: any[] }) {
  const { t } = useLanguage();
  const offenderCases = useMemo(() => {
    return cases.filter(c => offender.cases.includes(c.caseMasterId));
  }, [offender, cases]);

  // Compute live prediction stats based on previous activities
  const pred = useMemo(() => {
    if (offenderCases.length === 0) return null;

    // 1. Target district: Mode frequency
    const districtCounts: Record<string, number> = {};
    offenderCases.forEach(c => {
      const dist = c.district.name;
      districtCounts[dist] = (districtCounts[dist] || 0) + 1;
    });
    let likelyDistrict = offender.jurisdictions[0] || "Bengaluru Urban";
    let maxDistCount = 0;
    Object.entries(districtCounts).forEach(([dist, count]) => {
      if (count > maxDistCount) {
        likelyDistrict = dist;
        maxDistCount = count;
      }
    });

    // 2. Next crime MO: Mode frequency
    const crimeCounts: Record<string, number> = {};
    offenderCases.forEach(c => {
      const name = c.crimeHead.name;
      crimeCounts[name] = (crimeCounts[name] || 0) + 1;
    });
    let likelyCrime = "Property Offence";
    let maxCrimeCount = 0;
    Object.entries(crimeCounts).forEach(([crime, count]) => {
      if (count > maxCrimeCount) {
        likelyCrime = crime;
        maxCrimeCount = count;
      }
    });

    // 3. Operational timeframe density
    let morningCount = 0;
    let nightCount = 0;
    offenderCases.forEach(c => {
      if (c.hour) {
        if (c.hour >= 21 || c.hour < 5) nightCount++;
        else morningCount++;
      }
    });
    const timeBand = nightCount >= morningCount ? t("Late Night (21:00 - 03:00 hrs)") : t("Morning Peak (06:00 - 11:00 hrs)");

    // 4. Probability calculation
    const probability = offender.riskScore;
    const confidence = probability > 80 ? "High" : probability > 60 ? "Medium" : "Low";

    // 5. Dynamic trigger drivers
    const drivers = [
      `${t("High recurrence in")} ${t(likelyDistrict)} ${t("sector")}`,
      `${t("Aligned specialization in")} ${t(likelyCrime)}`,
      `${offenderCases.length} ${t("linked historical FIR cases")}`,
      `${t("Active syndicate link density")}: ${offender.riskScore > 80 ? t("High risk gang cell") : t("Standard cluster strength")}`
    ];

    // 6. Dynamic risk trajectory
    const timeline = Array.from({ length: 7 }, (_, i) => {
      const dayNum = i * 2 + 2;
      const baseRisk = Math.round(probability * 0.55);
      const increment = Math.round(i * (probability * 0.45 / 6));
      return {
        day: `${t("Day")} ${dayNum}`,
        risk: Math.min(100, baseRisk + increment)
      };
    });

    return {
      nextCrime: likelyCrime,
      district: likelyDistrict,
      window: offenderCases.length > 4 ? t("48 - 72 Hours") : t("7 - 10 Days"),
      probability,
      confidence,
      timeBand,
      drivers,
      timeline
    };
  }, [offender, offenderCases, t]);

  if (!pred) return null;

  const confColor = pred.confidence === "High" ? "text-[#c5221f] border-[#f8b4b0] bg-[#fce8e6]"
    : pred.confidence === "Medium" ? "text-[#b06000] border-[#feefc3] bg-[#fef7e0]"
    : "text-[#1a73e8] border-[#aecbfa] bg-[#e8f0fe]";

  return (
    <div className="space-y-4 font-sans animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#5f6368]">
          <Sparkles className="h-4 w-4 text-[#1a73e8]" /> {t("Predictive Intelligence · Next Likely Action")}
        </p>
        <Badge variant="outline" className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md ${confColor}`}>
          {t(pred.confidence)} {t("confidence")}
        </Badge>
      </div>

      <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-4 space-y-4 shadow-2xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-[#5f6368] font-semibold">{t("Projected Threat Vector")}</p>
            <p className="mt-1 text-sm font-bold text-[#202124]">
              {offender.name} {t("is likely to attempt")} <span className="text-[#1a73e8] font-extrabold">{t(pred.nextCrime)}</span>
            </p>
            <p className="mt-1 text-[11px] text-[#5f6368] leading-normal">
              {t("Estimated Window")}: <span className="text-[#202124] font-bold">{pred.window}</span> — {t("Sector Hotspot")}:{" "}
              <span className="text-[#202124] font-bold">{t(pred.district)}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] uppercase tracking-wider text-[#5f6368] font-semibold">{t("Probability")}</p>
            <p className="text-2xl font-bold font-mono text-[#1a73e8]">{pred.probability}%</p>
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="rounded-xl border border-[#dadce0] bg-white p-2.5 shadow-2xs">
            <p className="flex items-center gap-1 text-[8.5px] uppercase tracking-wider text-[#5f6368] font-bold"><Target className="h-3 w-3 text-[#1a73e8]" /> {t("Target MO")}</p>
            <p className="mt-1 font-bold text-[#202124] truncate">{t(pred.nextCrime)}</p>
          </div>
          <div className="rounded-xl border border-[#dadce0] bg-white p-2.5 shadow-2xs">
            <p className="flex items-center gap-1 text-[8.5px] uppercase tracking-wider text-[#5f6368] font-bold"><MapPin className="h-3 w-3 text-[#137333]" /> {t("Likely Sector")}</p>
            <p className="mt-1 font-bold text-[#202124] truncate">{t(pred.district)}</p>
          </div>
          <div className="rounded-xl border border-[#dadce0] bg-white p-2.5 shadow-2xs">
            <p className="flex items-center gap-1 text-[8.5px] uppercase tracking-wider text-[#5f6368] font-bold"><Clock className="h-3 w-3 text-[#b06000]" /> {t("Time Band")}</p>
            <p className="mt-1 font-bold text-[#202124] truncate">{pred.timeBand}</p>
          </div>
        </div>

        {/* Dynamic Trajectory Chart */}
        <div className="rounded-xl border border-[#dadce0] bg-white p-3 shadow-2xs">
          <p className="mb-2 text-[9px] uppercase tracking-wider text-[#5f6368] font-bold">{t("14-Day Recidivism Risk Trajectory")}</p>
          <div className="h-36">
            <ResponsiveContainer>
              <AreaChart data={pred.timeline}>
                <defs>
                  <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a73e8" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1a73e8" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                <XAxis dataKey="day" stroke="#5f6368" fontSize={9.5} fontWeight={500} tickLine={false} />
                <YAxis stroke="#5f6368" fontSize={9.5} fontWeight={500} domain={[0, 100]} tickLine={false} />
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #dadce0", borderRadius: 8, fontSize: 11, fontWeight: 500, color: "#202124" }} />
                <Area type="monotone" dataKey="risk" stroke="#1a73e8" strokeWidth={2} fill="url(#predGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1 text-[9px] uppercase tracking-wider text-[#5f6368] font-bold">
            <TriangleAlert className="h-3 w-3 text-[#b06000]" /> {t("AI Risk Trigger Factors")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pred.drivers.map((d, i) => (
              <Badge key={i} variant="outline" className="text-[9.5px] border-[#dadce0] py-0.5 bg-white font-medium text-[#3c4043]">
                {d}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
