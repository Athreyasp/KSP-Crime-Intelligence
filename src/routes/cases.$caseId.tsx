import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStoredCases } from "@/lib/db";
import {
  ArrowLeft, MapPin, Calendar, Gavel, User, Users, Shield, ShieldAlert,
  Landmark, Clock, FileText, Scale, Printer, Download, CheckCircle2, AlertTriangle, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cases/$caseId")({
  head: ({ params }: { params: { caseId: string } }) => ({
    meta: [
      { title: `FIR #${params.caseId} Dossier · Google Material Police Intelligence` },
      { name: "description", content: `Official Police FIR Form No. 1 master dossier breakdown for case ${params.caseId}.` },
    ],
  }),
  loader: ({ params }: { params: { caseId: string } }) => {
    const c = getStoredCases().find(x => x.caseMasterId === Number(params.caseId));
    if (!c) throw notFound();
    return { case: c };
  },
  component: CaseDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md py-16 text-center">
      <h2 className="font-display text-2xl font-bold text-[#202124]">FIR Case Record Not Found</h2>
      <p className="mt-2 text-sm text-[#5f6368]">The specified FIR case master ID does not exist in the police database.</p>
      <Link to="/cases" className="mt-4 inline-block rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-semibold text-white">
        ← Return to Case Explorer
      </Link>
    </div>
  ),
});

function CaseDetail() {
  const { caseId } = Route.useParams();
  const cases = getStoredCases();
  const c = cases.find(x => x.caseMasterId === Number(caseId)) || cases[0];
  const [activeTab, setActiveTab] = useState<"overview" | "complainant" | "victims" | "accused" | "acts">("overview");

  if (!c) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="font-display text-2xl font-bold text-[#202124]">No Case Records Available</h2>
        <Link to="/cases/new" className="mt-4 inline-block rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-semibold text-white">
          Register New FIR Case
        </Link>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    toast.success(`Exporting FIR #${c.crimeNo} official dossier PDF...`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link to="/cases" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0b57d0] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Case Folder Explorer
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs font-semibold border-[#dadce0] rounded-full">
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print FIR Copy
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPDF} className="h-8 text-xs font-semibold border-[#dadce0] rounded-full">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Google Material Official Police Dossier Header Card */}
      <div className="relative rounded-2xl border border-[#dadce0] bg-white p-6 shadow-sm overflow-hidden space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5f6368]">
              <Shield className="h-4 w-4 text-[#0b57d0]" />
              <span>Karnataka State Police · Police Form No. 1</span>
              <span>·</span>
              <span className="font-mono text-[#0b57d0]">Restricted Law Enforcement Dossier</span>
            </div>

            <h1 className="font-display text-2xl md:text-3xl font-extrabold text-[#202124] flex items-center gap-3">
              <span>{c.crimeHead.name}</span>
              <span className="font-mono text-xs px-3 py-1 rounded-full bg-[#e8f0fe] text-[#0b57d0] font-bold">
                {c.category}
              </span>
            </h1>

            <p className="font-mono text-sm text-[#5f6368] font-bold tracking-wider flex items-center gap-2">
              <span>Crime No: <strong className="text-[#202124]">{c.crimeNo}</strong></span>
              <span>·</span>
              <span className="font-sans font-normal text-[#5f6368]">{c.policeStation}, {c.district.name} District</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {c.gravity === "Heinous" ? (
              <span className="bg-[#fce8e6] text-[#d93025] text-xs px-3 py-1 font-bold rounded-full">
                HEINOUS OFFENCE
              </span>
            ) : (
              <span className="bg-[#f1f3f4] text-[#5f6368] text-xs px-3 py-1 font-bold rounded-full">
                NON-HEINOUS
              </span>
            )}
            <span className="bg-[#e8f0fe] text-[#0b57d0] text-xs px-3 py-1 font-bold rounded-full">
              Status: {c.status}
            </span>
          </div>
        </div>

        {/* Quick Metadata Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#f1f3f4] text-xs">
          <div className="bg-[#f8f9fa] p-3 rounded-xl border border-[#f1f3f4]">
            <span className="text-[10px] uppercase font-bold text-[#5f6368]">Registered Date</span>
            <p className="font-mono font-bold text-[#202124] mt-0.5">{new Date(c.registeredDate).toLocaleDateString("en-IN")}</p>
          </div>
          <div className="bg-[#f8f9fa] p-3 rounded-xl border border-[#f1f3f4]">
            <span className="text-[10px] uppercase font-bold text-[#5f6368]">Investigating Officer</span>
            <p className="font-bold text-[#202124] mt-0.5 truncate">{c.registeringOfficer || "PI Ramesh Kumar"}</p>
          </div>
          <div className="bg-[#f8f9fa] p-3 rounded-xl border border-[#f1f3f4]">
            <span className="text-[10px] uppercase font-bold text-[#5f6368]">Hearing Court</span>
            <p className="font-bold text-[#202124] mt-0.5 truncate">{c.courtName || "JMFC Court"}</p>
          </div>
          <div className="bg-[#f8f9fa] p-3 rounded-xl border border-[#f1f3f4]">
            <span className="text-[10px] uppercase font-bold text-[#5f6368]">Coordinates</span>
            <p className="font-mono font-bold text-[#202124] mt-0.5">{c.latitude.toFixed(4)}° N, {c.longitude.toFixed(4)}° E</p>
          </div>
        </div>
      </div>

      {/* Google Material Section Navigation Pills */}
      <div className="flex border border-[#dadce0] bg-[#f8f9fa] rounded-2xl p-1.5 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "overview" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
          }`}
        >
          <FileText className="h-4 w-4" /> 1. Master Case Particulars
        </button>

        <button
          onClick={() => setActiveTab("complainant")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "complainant" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
          }`}
        >
          <User className="h-4 w-4" /> 2. Complainant Statement
        </button>

        <button
          onClick={() => setActiveTab("victims")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "victims" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
          }`}
        >
          <Users className="h-4 w-4" /> 3. Victim Profile ({c.victims.length})
        </button>

        <button
          onClick={() => setActiveTab("accused")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "accused" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
          }`}
        >
          <ShieldAlert className="h-4 w-4" /> 4. Accused & Arrest Warrants ({c.accused.length})
        </button>

        <button
          onClick={() => setActiveTab("acts")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "acts" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
          }`}
        >
          <Scale className="h-4 w-4" /> 5. Legal Acts & Sections ({c.actSections.length})
        </button>
      </div>

      {/* TAB CONTENT 1: MASTER OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 bg-white border-[#dadce0] rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#f1f3f4] pb-3">
              <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0b57d0]" /> Brief Facts Narrative (BriefFacts)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="rounded-2xl bg-[#f8f9fa] p-4 border border-[#f1f3f4]">
                <p className="text-sm leading-relaxed text-[#202124] font-normal">
                  "{c.briefFacts}"
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-[#f1f3f4]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#5f6368]">Modus Operandi Tag</span>
                  <p className="font-bold text-[#202124] mt-0.5">{c.moTag || "Standard Incident Pattern"}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#5f6368]">Incident Time Window</span>
                  <p className="font-bold text-[#202124] mt-0.5">Hour {c.hour}:00 ({String(c.hour).padStart(2, "0")}:00 HRS)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#f1f3f4] pb-3">
              <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
                <Landmark className="h-4 w-4 text-[#5f6368]" /> Station & Court Authority
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-xs">
              <DetailRow label="Police Station Unit" value={c.policeStation} />
              <DetailRow label="District Jurisdiction" value={`${c.district.name} District`} />
              <DetailRow label="Investigating Officer" value={c.registeringOfficer || "PI Ramesh Kumar (KGID: 29013)"} />
              <DetailRow label="Hearing Court" value={c.courtName || "JMFC Court"} />
              <DetailRow label="Info Received PS Date" value={c.infoReceivedPSDate ? new Date(c.infoReceivedPSDate).toLocaleString("en-IN") : "Recorded on Station Diary"} />
              <DetailRow label="Incident Occurred From" value={new Date(c.incidentDate).toLocaleString("en-IN")} />
              <DetailRow label="Incident Occurred To" value={c.incidentToDate ? new Date(c.incidentToDate).toLocaleString("en-IN") : new Date(c.registeredDate).toLocaleString("en-IN")} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT 2: COMPLAINANT STATEMENT */}
      {activeTab === "complainant" && (
        <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm">
          <CardHeader className="border-b border-[#f1f3f4] pb-3">
            <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
              <User className="h-4.5 w-4.5 text-[#0b57d0]" /> Complainant Statement (ComplainantDetails)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <DetailBox label="Complainant Full Name" value={c.complainant.name} />
            <DetailBox label="Age" value={`${c.complainant.age} Years`} />
            <DetailBox label="Gender" value={c.complainant.gender === "M" ? "Male (M)" : c.complainant.gender === "F" ? "Female (F)" : "Transgender (T)"} />
            <DetailBox label="Occupation" value={c.complainant.occupation} />
            <DetailBox label="Religion" value={c.complainant.religion || "Hindu"} />
            <DetailBox label="Caste" value={c.complainant.caste || "General"} />
            <DetailBox label="Contact Phone" value={c.complainant.phone || "+91 98765 43210"} />
            <DetailBox label="Relation to Incident" value={c.complainant.relation || "Self (Victim)"} />
            <DetailBox label="Residential Address" value={c.complainant.address || `${c.policeStation} Jurisdiction, ${c.district.name}`} fullWidth />
          </CardContent>
        </Card>
      )}

      {/* TAB CONTENT 3: VICTIM PROFILE */}
      {activeTab === "victims" && (
        <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm">
          <CardHeader className="border-b border-[#f1f3f4] pb-3 flex items-center justify-between">
            <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-[#0b57d0]" /> Victim Particulars ({c.victims.length})
            </CardTitle>
            <span className="text-xs font-semibold text-[#5f6368]">Victim Database Records</span>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {c.victims.map((v: any, idx: number) => (
              <div key={idx} className="flex flex-wrap items-center justify-between p-4 bg-[#f8f9fa] border border-[#f1f3f4] rounded-2xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#202124]">Victim #{idx + 1}: {v.name}</span>
                    {v.isPolice && (
                      <span className="bg-[#e8f0fe] text-[#0b57d0] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        On-Duty Police Officer
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5f6368]">
                    Age: <strong>{v.age} Years</strong> · Gender: <strong>{v.gender === "M" ? "Male" : v.gender === "F" ? "Female" : "Transgender"}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#5f6368]">Injury Status:</span>
                  <span className="bg-white border border-[#dadce0] text-[#202124] font-bold text-xs px-3 py-1 rounded-full">
                    {v.injuryStatus || "Uninjured"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TAB CONTENT 4: ACCUSED & ARREST WARRANTS */}
      {activeTab === "accused" && (
        <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm">
          <CardHeader className="border-b border-[#f1f3f4] pb-3 flex items-center justify-between">
            <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-[#0b57d0]" /> Accused Offender Records ({c.accused.length})
            </CardTitle>
            <span className="text-xs font-semibold text-[#5f6368]">Accused & ArrestSurrender</span>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {c.accused.map((a: any, idx: number) => {
              const isArrested = Boolean(a.arrestId || a.arrested);
              return (
                <div key={a.id || idx} className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f3f4] pb-2.5">
                    <div>
                      <h4 className="font-bold text-sm text-[#202124]">
                        Accused #{idx + 1}: {a.name} <span className="font-mono text-xs text-[#5f6368]">({a.id || `A${idx + 1}`})</span>
                      </h4>
                      <p className="text-xs text-[#5f6368] mt-0.5">
                        Age: <strong>{a.age} Years</strong> · Gender: <strong>{a.gender}</strong>
                      </p>
                    </div>

                    <div>
                      {isArrested ? (
                        <span className="bg-[#e6f4ea] text-[#188038] font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Arrested / In Custody
                        </span>
                      ) : (
                        <span className="bg-[#fef7e0] text-[#e37400] font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Wanted / At Large
                        </span>
                      )}
                    </div>
                  </div>

                  {isArrested && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-white p-3 rounded-xl border border-[#f1f3f4]">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#5f6368]">Arrest Warrant ID</span>
                        <p className="font-mono font-bold text-[#202124] mt-0.5">{a.arrestId || `ARR-${Math.floor(1000 + Math.random() * 9000)}`}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#5f6368]">Arrest Date</span>
                        <p className="font-semibold text-[#202124] mt-0.5">{a.arrestDate ? new Date(a.arrestDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#5f6368]">Arrest District</span>
                        <p className="font-semibold text-[#202124] mt-0.5">{a.arrestDistrict || `${c.district.name}`}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#5f6368]">Produced Court</span>
                        <p className="font-semibold text-[#202124] mt-0.5">{a.courtName || c.courtName || "JMFC Court"}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* TAB CONTENT 5: LEGAL ACTS & SECTIONS */}
      {activeTab === "acts" && (
        <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm">
          <CardHeader className="border-b border-[#f1f3f4] pb-3">
            <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
              <Scale className="h-4.5 w-4.5 text-[#0b57d0]" /> Associated Acts & Legal Sections (ActSectionAssociation)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {c.actSections.map((act: string, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl border border-[#dadce0] bg-[#f8f9fa] flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#e8f0fe] text-[#0b57d0] font-mono text-xs font-bold shrink-0">
                    §
                  </div>
                  <div>
                    <h4 className="font-mono text-sm font-bold text-[#202124]">{act}</h4>
                    <p className="text-xs text-[#5f6368] mt-1">
                      Statutory legal section registered under Bharatiya Nyaya Sanhita (BNS) / Indian Penal Code (IPC) for {c.crimeHead.name}.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-1.5 last:border-0 last:pb-0">
      <span className="text-[#5f6368] font-medium">{label}:</span>
      <span className="font-bold text-[#202124] text-right">{value}</span>
    </div>
  );
}

function DetailBox({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={`p-3.5 rounded-xl border border-[#dadce0] bg-[#f8f9fa] ${fullWidth ? "md:col-span-3" : ""}`}>
      <span className="text-[10px] uppercase font-bold text-[#5f6368]">{label}</span>
      <p className="text-xs font-bold text-[#202124] mt-1">{value}</p>
    </div>
  );
}
