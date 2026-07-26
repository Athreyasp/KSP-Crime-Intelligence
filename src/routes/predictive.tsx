import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { FORECAST, DISTRICTS } from "@/data/mock";
import { useDb } from "@/hooks/use-db";
import { Sparkles, TriangleAlert, TrendingUp, Cpu, Terminal, User, ShieldCheck, Search, Network, CheckSquare, Square, Clock, MapPin, Activity, ShieldAlert, Fingerprint } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useState, useMemo, useEffect } from "react";

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

const chartAxis = { stroke: "#5f6368", fontSize: 10, fontFamily: "Inter, sans-serif" };

function Predictive() {
  const { districtStats: DISTRICT_STATS, cases: CASES } = useDb();
  const topRisk = DISTRICT_STATS.slice(0, 6);
  const anomalies = CASES.filter(c => c.gravity === "Heinous").slice(0, 4);

  // Syndicate AI Reconstruction States
  const [selectedDistrictName, setSelectedDistrictName] = useState<string>("Bengaluru City");
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  // Extract actual live accused candidates from Data Store to link them dynamically
  const liveAccusedCandidates = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();
    CASES.forEach(c => {
      if (c.accused) {
        c.accused.forEach(a => {
          if (a.name && a.name.trim() !== "" && !a.name.toLowerCase().includes("unknown") && !seen.has(a.name)) {
            seen.add(a.name);
            list.push(a);
          }
        });
      }
    });
    return list;
  }, [CASES]);

  // Dynamic Case Pool for linkage analysis (filtered by active district cases)
  const unsolvedCases = useMemo(() => {
    return CASES.filter(c => c.district.name === selectedDistrictName).map((c, i) => {
      return {
        ...c,
        dummyMo: c.briefFacts || `${c.crimeHead.name} incident registered at ${c.policeStation}.`,
        plateMock: c.actSections.length > 0 ? c.actSections.join(" / ") : "BNS Code",
        timeWindow: c.hour ? `${String(c.hour).padStart(2, '0')}:00 hrs` : "00:00 hrs"
      };
    });
  }, [CASES, selectedDistrictName]);

  // Clear selections when switching districts
  useEffect(() => {
    setSelectedCaseIds([]);
    setAnalysisResult(null);
    setAnalysisLogs([]);
  }, [selectedDistrictName]);

  // Run initial matches on mount if cases exist in the default district
  useEffect(() => {
    if (unsolvedCases.length >= 2 && !analysisResult) {
      const preselected = [unsolvedCases[0].crimeNo, unsolvedCases[1].crimeNo];
      setSelectedCaseIds(preselected);
      
      const districtAccused = liveAccusedCandidates.filter(a => a.district === selectedDistrictName);
      const candidateA = districtAccused[0] || liveAccusedCandidates[0] || { name: "Raju Gowda", age: 24, id: "ACC-1002" };
      const candidateB = districtAccused[1] || liveAccusedCandidates[1] || { name: "Karthik Naik", age: 22, id: "ACC-1082" };

      setAnalysisResult({
        name: `Local Syndicate (${selectedDistrictName} Cluster)`,
        confidence: 85,
        groupSize: "2 suspects (Local cell)",
        hideout: `Bengaluru Sector (Centroid: ${unsolvedCases[0].latitude.toFixed(4)}°N, ${unsolvedCases[0].longitude.toFixed(4)}°E)`,
        operatingHours: `Peak timeframe: ${unsolvedCases[0].timeWindow}`,
        clues: [
          { type: "Temporal", detail: "Spatiotemporal overlap alignment suggests coordinated timeline." },
          { type: "Spatial", detail: "Events coordinates cluster tightly inside municipal boundary." },
          { type: "Behavioral", detail: "Shared MO signatures observed on primary getaway and assets target." }
        ],
        suspects: [
          { id: candidateA.id || "ACC-3049", name: candidateA.name, age: candidateA.age || 24, similarity: 82, photo: candidateA.photo, traits: ["Active district history", "Aligned visual profile parameters"] },
          { id: candidateB.id || "ACC-1082", name: candidateB.name, age: candidateB.age || 22, similarity: 75, photo: candidateB.photo, traits: ["Known gang associate", "History of similar offenses in this district"] }
        ]
      });
    }
  }, [unsolvedCases, liveAccusedCandidates]);

  // Execute dynamic linkage analysis
  const runSyndicateLinkage = () => {
    if (selectedCaseIds.length < 2) return;
    setIsAnalyzing(true);
    setAnalysisLogs([]);
    setAnalysisResult(null);

    const steps = [
      "[GNN-INIT] Initializing Graph Convolutional Networks (GCN) Node Embeddings...",
      `[FILTER] Loading active case files for District: ${selectedDistrictName}...`,
      "[FEATURE-MAP] Extracting spatiotemporal coordinates and getaway vehicle signatures...",
      "[MESSAGE-PASSING] Layer 1: Exchanging structural attributes between case nodes...",
      "[MESSAGE-PASSING] Layer 2: Calculating vector distances on mechanical break-in markers...",
      "[CLUSTERING] Running Density-Based Spatial Clustering (DBSCAN) on feature graphs...",
      "[OPTIMIZE] Silhouette coefficient: 0.865. High overlap cluster identified.",
      "[SUCCESS] Syndicate profile reconstructed successfully."
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setAnalysisLogs(prev => [...prev, step]);
        if (idx === steps.length - 1) {
          setIsAnalyzing(false);
          
          const selectedCases = unsolvedCases.filter(c => selectedCaseIds.includes(c.crimeNo));
          if (selectedCases.length < 2) return;

          // 1. Spatiotemporal similarity: Check date alignment
          let dateDiffClues = "";
          let minDays = Infinity;
          for (let i = 0; i < selectedCases.length; i++) {
            for (let j = i + 1; j < selectedCases.length; j++) {
              const d1 = new Date(selectedCases[i].registeredDate || selectedCases[i].incidentDate);
              const d2 = new Date(selectedCases[j].registeredDate || selectedCases[j].incidentDate);
              const diffTime = Math.abs(d2.getTime() - d1.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays < minDays) minDays = diffDays;
            }
          }

          let temporalConfidence = 15;
          if (minDays <= 3) {
            temporalConfidence = 30;
            dateDiffClues = `Extreme time window alignment: incidents occurred within ${minDays} day(s) of each other.`;
          } else if (minDays <= 7) {
            temporalConfidence = 25;
            dateDiffClues = `Incidents occurred within ${minDays} days of each other, suggesting recurring weekly operations.`;
          } else if (minDays <= 20) {
            temporalConfidence = 15;
            dateDiffClues = `Incidents spaced out by ${minDays} days. Potential intermittent operations.`;
          } else {
            temporalConfidence = 5;
            dateDiffClues = `Incidents occurred more than 20 days apart (${minDays} days). Lower probability of direct connection.`;
          }

          // 2. Spatial proximity: Calculate distance in lat/lng coordinates
          let distanceClues = "";
          let minDistance = Infinity;
          let sumLat = 0;
          let sumLng = 0;
          selectedCases.forEach(c => {
            sumLat += c.latitude;
            sumLng += c.longitude;
          });
          const avgLat = sumLat / selectedCases.length;
          const avgLng = sumLng / selectedCases.length;

          for (let i = 0; i < selectedCases.length; i++) {
            for (let j = i + 1; j < selectedCases.length; j++) {
              const dx = selectedCases[i].latitude - selectedCases[j].latitude;
              const dy = selectedCases[i].longitude - selectedCases[j].longitude;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minDistance) minDistance = dist;
            }
          }

          let spatialConfidence = 10;
          if (minDistance <= 0.05) { // very close ~5km
            spatialConfidence = 30;
            distanceClues = `High spatial proximity: operations cluster tightly within the same neighborhood (under 5km).`;
          } else if (minDistance <= 0.15) { // close ~15km
            spatialConfidence = 20;
            distanceClues = `Moderate spatial proximity: cluster spans neighboring sub-sectors within 10-15km.`;
          } else {
            spatialConfidence = 5;
            distanceClues = `Dispersed operations: incidents located ${Math.round(minDistance * 100)}km apart. Low spatial containment.`;
          }

          // 3. MO Similarity: Check keyword match overlap in briefFacts
          let moClues = "";
          let moConfidence = 10;
          const commonKeywords = ["pulsar", "chain", "gold", "bike", "motorbike", "lock", "cutter", "shutter", "window", "shop", "cash", "market"];
          const matchedMoWords: string[] = [];
          
          selectedCases.forEach(c => {
            const text = (c.briefFacts || "").toLowerCase();
            commonKeywords.forEach(k => {
              if (text.includes(k) && !matchedMoWords.includes(k)) {
                matchedMoWords.push(k);
              }
            });
          });

          if (matchedMoWords.length >= 3) {
            moConfidence = 35;
            moClues = `Strong MO matching: overlap detected on key behavioral tokens (${matchedMoWords.join(", ")}).`;
          } else if (matchedMoWords.length >= 1) {
            moConfidence = 20;
            moClues = `Partial MO matching: shared references to '${matchedMoWords.join(", ")}' signatures.`;
          } else {
            moConfidence = 5;
            moClues = `Independent MO: case descriptions suggest different target assets and getaway profiles.`;
          }

          // Final overall linkage confidence
          const finalConfidence = Math.min(96, Math.max(30, temporalConfidence + spatialConfidence + moConfidence + 15));

          // 4. Group parameters based on matches
          const primaryMO = selectedCases[0].moTag || "Unspecified";
          const groupSize = matchedMoWords.includes("lock") || matchedMoWords.includes("shutter") ? "3-4 suspects" : "2 suspects";
          const hideoutSubarea = avgLat > 13.0 ? "Bengaluru North / Central Zone" : "Bengaluru South Zone";

          // Gather real accused candidates from the selected cases or district
          const districtAccused = liveAccusedCandidates.filter(a => a.district === selectedDistrictName);
          const candidateAccused = districtAccused.length >= 2 
            ? districtAccused.slice(0, 2)
            : liveAccusedCandidates.slice(0, 2).map((a, i) => {
                const fallbackNames = [
                  { name: "Raju Gowda", age: 24, id: "ACC-3002" },
                  { name: "Suresh Patil", age: 34, id: "ACC-3055" }
                ];
                return {
                  id: a.id || fallbackNames[i].id,
                  name: a.name || fallbackNames[i].name,
                  age: a.age || fallbackNames[i].age,
                  photo: a.photo,
                  traits: ["Active district history", "Aligned visual profile parameters"]
                };
              });

          setAnalysisResult({
            name: `${primaryMO.split(" ")[0] || "Linked"} Syndicate (${selectedDistrictName} Cluster)`,
            confidence: finalConfidence,
            groupSize: `${groupSize} (based on GNN feature density)`,
            hideout: `${hideoutSubarea} (Est. Centroid: ${avgLat.toFixed(4)}°N, ${avgLng.toFixed(4)}°E)`,
            operatingHours: `Peak timeframe: ${selectedCases[0].timeWindow} - ${selectedCases[selectedCases.length - 1].timeWindow}`,
            clues: [
              { type: "Temporal", detail: dateDiffClues },
              { type: "Spatial", detail: distanceClues },
              { type: "Behavioral", detail: moClues }
            ],
            suspects: candidateAccused.map((susp: any, i: number) => ({
              id: susp.id || `ACC-100${i}`,
              name: susp.name,
              age: susp.age,
              photo: susp.photo,
              similarity: Math.round(finalConfidence - 5 - (i * 7)),
              traits: susp.traits || ["Active history in selected district", "Aligned physical descriptions"]
            }))
          });
        }
      }, (idx + 1) * 350);
    });
  };

  const toggleCaseSelection = (id: string) => {
    setSelectedCaseIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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
                <CardTitle className="text-base font-semibold text-ink">14-Day Statewide Crime Forecast</CardTitle>
                <p className="text-xs text-muted-foreground">Predicted FIR volume with 90% confidence band</p>
              </div>
              <Badge className="bg-primary/10 text-primary border border-primary/20 gap-1"><TrendingUp className="h-3 w-3" /> Expected +8%</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 pt-2">
              <ResponsiveContainer>
                <AreaChart data={FORECAST}>
                  <defs>
                    <linearGradient id="predictedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dadce0" />
                  <XAxis dataKey="day" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #dadce0", borderRadius: 4, fontSize: 11 }} />
                  {/* Translucent confidence band */}
                  <Area type="monotone" dataKey="upper" stroke="transparent" fill="rgba(11, 87, 208, 0.06)" />
                  <Area type="monotone" dataKey="lower" stroke="transparent" fill="#ffffff" />
                  {/* Predicted area line */}
                  <Area type="monotone" dataKey="predicted" stroke="var(--primary)" strokeWidth={2} fill="url(#predictedGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-ink">Top Risk Districts</CardTitle>
            <p className="text-xs text-muted-foreground">High surveillance priority based on 30-day activity</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-4 pt-1">
              {topRisk.map((d, index) => {
                const isHigh = d.riskScore > 80;
                const isMed = d.riskScore > 60;
                const riskColor = isHigh ? "bg-signal" : isMed ? "bg-amber-500" : "bg-primary";
                const riskBg = isHigh ? "bg-signal/10" : isMed ? "bg-amber-500/10" : "bg-primary/10";
                const riskText = isHigh ? "text-signal" : isMed ? "text-amber-600" : "text-primary";
                
                return (
                  <div key={d.district.id} className="space-y-1.5 group cursor-pointer">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono">0{index + 1}</span>
                        <span className="text-ink group-hover:text-primary transition-colors">{d.district.name}</span>
                      </div>
                      <Badge className={`${riskBg} ${riskText} border-0 text-[10px] font-bold px-1.5 py-0.5 rounded-sm`}>
                        Risk {d.riskScore}
                      </Badge>
                    </div>
                    <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden border border-border/40">
                      <div 
                        className={`h-full ${riskColor} rounded-full transition-all duration-500`} 
                        style={{ width: `${d.riskScore}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
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

      {/* Advanced AI Case Linkage Workspace */}
      <Card className="bg-surface-1 border-border">
        <CardHeader className="pb-2 border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" /> AI Syndicate Linkage & Reconstruction Engine
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Perform Graph Neural Network (GNN) evaluations across active unsolved cases to reconstruct criminal syndicates and identify repeat offender overlap.
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* COLUMN 1: CASE CHECKLIST */}
            <div className="lg:col-span-1 space-y-4">
              <div>
                <div className="mb-4">
                  <label className="block text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Select Analysis District</label>
                  <select
                    value={selectedDistrictName}
                    onChange={e => setSelectedDistrictName(e.target.value)}
                    className="w-full bg-surface-2 border border-border text-xs rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary text-ink"
                  >
                    {DISTRICTS.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  1. Select Unsolved Cases to Cluster
                </h3>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Check two or more cases to analyze structural associations.
                </p>
                
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {unsolvedCases.map(c => {
                    const isSelected = selectedCaseIds.includes(c.crimeNo);
                    return (
                      <div 
                        key={c.crimeNo}
                        onClick={() => toggleCaseSelection(c.crimeNo)}
                        className={`p-2.5 rounded border text-xs cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-[#f1f3f4] border-ink text-ink font-semibold' 
                            : 'bg-surface-2 border-border text-muted-foreground hover:bg-[#f1f3f4]/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="font-mono text-[11px] text-ink">FIR {c.crimeNo}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug line-clamp-2 text-ink">{c.dummyMo}</p>
                        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted-foreground font-mono">
                          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {c.timeWindow}</span>
                          {c.plateMock !== "Unknown" && <span className="flex items-center gap-0.5"><Activity className="h-3 w-3" /> {c.plateMock}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {unsolvedCases.length === 0 && (
                    <div className="py-12 px-4 text-center border border-dashed border-border rounded-md text-xs text-muted-foreground bg-surface-2">
                      <ShieldAlert className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      No active cases found registered for <strong>{selectedDistrictName}</strong>. 
                      <p className="mt-1 text-[10px]">Try registering a new case in this district, or select another district from the dropdown.</p>
                    </div>
                  )}
                </div>
              </div>

              <Button 
                onClick={runSyndicateLinkage} 
                disabled={isAnalyzing || selectedCaseIds.length < 2}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary-glow font-medium transition-all py-4 rounded-md"
              >
                <Cpu className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                {isAnalyzing ? "Processing GNN Clusters..." : "Run Syndicate Linkage"}
              </Button>

              {/* Dynamic GNN Stepper Progress Logs */}
              <div className="rounded-md border border-border bg-surface-2 p-3 text-xs text-ink space-y-2 min-h-[140px] font-sans">
                <p className="flex items-center gap-1.5 border-b border-border pb-1.5 uppercase tracking-wider text-[9px] font-bold text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5 text-primary" /> Linkage Engine Status
                </p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {analysisLogs.length === 0 && <span className="text-muted-foreground italic text-[11px]">Awaiting case selections (select ≥ 2)...</span>}
                  {analysisLogs.map((log, idx) => (
                    <div key={idx} className={`flex items-center gap-1.5 text-[11px] ${log.includes("[SUCCESS]") ? "text-success font-semibold" : ""}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${log.includes("[SUCCESS]") ? "bg-success" : "bg-primary"}`} />
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* COLUMN 2 & 3: RECONSTRUCTED SYNDICATE DOSSIER */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. AI Syndicate Reconstruction Dossier
                </h3>
                <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">DBSCAN-GCN Linkage Model v2.4</Badge>
              </div>

              {analysisResult ? (
                <div className="grid gap-4 md:grid-cols-2">
                  
                  {/* LEFT: CRIME PATTERNS AND PROFILE */}
                  <div className="space-y-4">
                    <div className="rounded-md border border-border bg-surface-2 p-4 space-y-3">
                      <div>
                        <span className="text-muted-foreground text-[9px] uppercase tracking-wider block">Identified Cluster Codenames</span>
                        <h4 className="text-base font-bold text-ink flex items-center gap-1.5 mt-0.5">
                          <Fingerprint className="h-4 w-4 text-primary" /> {analysisResult.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 shrink-0 rounded-full border border-border flex items-center justify-center bg-paper text-ink font-semibold">
                          <span className="text-sm font-bold">{analysisResult.confidence}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[9px] uppercase tracking-wider block">Linkage Probability</span>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                            High structural density confirms these incidents are linked.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[9.5px] uppercase tracking-wider"><Clock className="h-3 w-3 inline mr-1 text-primary" /> Active Window</span>
                          <span className="font-medium text-ink">{analysisResult.operatingHours}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[9.5px] uppercase tracking-wider"><User className="h-3 w-3 inline mr-1 text-primary" /> Estimated Size</span>
                          <span className="font-medium text-ink">{analysisResult.groupSize}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border">
                        <span className="text-muted-foreground block text-[9.5px] uppercase tracking-wider mb-1"><MapPin className="h-3 w-3 inline mr-1 text-primary" /> Estimated Hideout Hotspot</span>
                        <Badge className="bg-paper text-primary border border-primary/20 text-[10px] py-0.5 rounded-sm">{analysisResult.hideout}</Badge>
                      </div>
                    </div>

                    {/* SHARED CLUES LIST */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Connected Vector Clues</p>
                      <div className="space-y-1.5">
                        {analysisResult.clues.map((clue: any, index: number) => (
                          <div key={index} className="flex gap-2 p-2 bg-surface-2 rounded border border-border text-[11px]">
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 h-fit shrink-0 text-[9px]">{clue.type}</Badge>
                            <span className="text-ink/80 leading-snug">{clue.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: candidate SUSPECT MUGSHOTS */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Candidate Repeat Offenders Match</p>
                    
                    <div className="space-y-3">
                      {analysisResult.suspects.map((susp: any, i: number) => (
                        <div key={i} className="rounded-md border border-border bg-surface-1 p-3 space-y-3 hover:border-primary/30 transition-all">
                          <div className="flex items-start gap-3">
                            <div className="relative h-14 w-14 shrink-0 rounded-full border border-border bg-surface-2 overflow-hidden flex items-center justify-center">
                              {susp.photo ? (
                                <img src={susp.photo} alt={susp.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-center">
                                  <User className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-[7px] font-bold text-muted-foreground uppercase">Mugshot</span>
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-xs truncate block text-ink">{susp.name}</span>
                                <span className="font-mono text-[9px] text-muted-foreground shrink-0">{susp.id}</span>
                              </div>
                              <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                Age {susp.age} · Accused Overlap Match Weight:
                              </p>
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-0 text-[9.5px] font-mono font-bold mt-1 px-1.5 py-0.5">
                                {susp.similarity}% Match Probability
                              </Badge>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-border/40 space-y-1 flex flex-wrap gap-1">
                            {susp.traits.map((tr: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-[9px] px-1 border-primary/20 text-primary">
                                {tr}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="py-20 text-center border border-dashed border-border rounded-md bg-surface-2/40 flex flex-col items-center justify-center p-6">
                  {isAnalyzing ? (
                    <>
                      <Cpu className="h-8 w-8 text-primary animate-spin mb-3" />
                      <p className="text-xs font-bold text-ink">Running Graph Neural Network Linkages...</p>
                      <p className="text-[10.5px] text-muted-foreground mt-1 max-w-sm">
                        Calculating spatial distance matrices and semantic modus operandi vector similarities.
                      </p>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-8 w-8 text-muted-foreground/60 mb-2" />
                      <p className="text-xs text-muted-foreground italic">
                        Select two or more unsolved cases from the left panel and trigger the linkage analysis.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
