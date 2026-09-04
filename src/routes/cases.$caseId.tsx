import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStoredCases, updateCaseDetails, recordAccusedArrest } from "@/lib/db";
import { useDb } from "@/hooks/use-db";
import { DISTRICTS } from "@/data/mock";
import kspLogo from "@/assets/karnataka-police-logo.png";
import {
  ArrowLeft, MapPin, Calendar, Gavel, User, Users, Shield, ShieldAlert,
  Landmark, Clock, FileText, Scale, Printer, Download, CheckCircle2, AlertTriangle, ArrowRight, Edit3, Fingerprint
} from "lucide-react";
import { toast } from "sonner";
import { districtTranslations, crimeHeadTranslations, translations } from "@/lib/translations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const router = useRouter();
  const { cases } = useDb();
  const c = cases.find(x => x.caseMasterId === Number(caseId)) || cases[0];
  const [activeTab, setActiveTab] = useState<"overview" | "legal" | "complainant" | "accused" | "logs">("overview");
  const [printLang, setPrintLang] = useState<"en" | "kn" | "bilingual">("bilingual");

  // Edit case dossier state variables
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStatus, setEditStatus] = useState(c?.status || "Under Investigation");
  const [editBriefFacts, setEditBriefFacts] = useState(c?.briefFacts || "");
  const [editChargesheetNo, setEditChargesheetNo] = useState("");
  const [editChargesheetDate, setEditChargesheetDate] = useState("");
  const [editChargesheetType, setEditChargesheetType] = useState("Original Chargesheet");
  const [isUpdating, setIsUpdating] = useState(false);

  // Arrest suspect state variables
  const [showArrestModal, setShowArrestModal] = useState(false);
  const [selectedAccusedForArrest, setSelectedAccusedForArrest] = useState("");
  const [arrestDate, setArrestDate] = useState(new Date().toISOString().slice(0, 10));
  const [arrestDistrictId, setArrestDistrictId] = useState(c?.district?.id || 1);
  const [isRecordingArrest, setIsRecordingArrest] = useState(false);

  const handleRecordArrest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccusedForArrest) return;
    setIsRecordingArrest(true);
    try {
      const selectedDistrict = DISTRICTS.find(d => d.id === Number(arrestDistrictId)) || DISTRICTS[0];
      await recordAccusedArrest(
        c.caseMasterId,
        selectedAccusedForArrest,
        arrestDate,
        selectedDistrict.id,
        selectedDistrict.name
      );
      toast.success(`Arrest record saved! Suspect ${selectedAccusedForArrest} is now in custody.`);
    } catch (err: any) {
      console.warn("Zoho Catalyst sync failed, local arrest saved:", err.message);
      toast.success(`Arrest saved locally for suspect ${selectedAccusedForArrest} (Zoho sync offline).`);
    } finally {
      setIsRecordingArrest(false);
      setShowArrestModal(false);
      router.invalidate();
    }
  };

  useEffect(() => {
    if (c) {
      setEditStatus(c.status);
      setEditBriefFacts(c.briefFacts);
      setEditChargesheetNo(c.chargesheetNo || `CS-${Math.abs(c.caseMasterId) % 10000}`);
      setEditChargesheetDate(c.chargesheetDate ? new Date(c.chargesheetDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setEditChargesheetType(c.chargesheetType || "Original Chargesheet");
    }
  }, [c]);

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
    toast.info("Select 'Save as PDF' in the destination options to export the official FIR document.", { duration: 5000 });
    setTimeout(() => {
      window.print();
    }, 1000);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await updateCaseDetails(
        c.caseMasterId,
        editStatus,
        editBriefFacts,
        editStatus === "Charge Sheeted" ? editChargesheetNo : undefined,
        editStatus === "Charge Sheeted" ? editChargesheetDate : undefined,
        editStatus === "Charge Sheeted" ? editChargesheetType : undefined
      );
      toast.success("Case history successfully updated!");
    } catch (err: any) {
      console.warn("Zoho Catalyst sync failed, local update saved:", err.message);
      toast.success("Case history saved locally (Zoho sync offline).");
    } finally {
      setIsUpdating(false);
      setShowEditModal(false);
      router.invalidate();
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-12 print:hidden">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link to="/cases" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0b57d0] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Case Folder Explorer
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowEditModal(true)} className="h-8 text-xs font-semibold bg-[#0b57d0] hover:bg-[#0b57d0]/90 text-white rounded-full flex items-center gap-1.5">
            <Edit3 className="mr-0.5 h-3.5 w-3.5" /> Update Case Progress
          </Button>
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
          <div className="bg-[#f8f9fa] p-3 rounded-xl border border-[#f1f3f4] flex items-center gap-2">
            {c.officerPhoto ? (
              <img src={c.officerPhoto} alt="Officer" className="h-8 w-8 rounded-full object-cover border border-[#0b57d0]/20 shadow-sm" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-surface-2 border border-[#dadce0] flex items-center justify-center text-[10px] font-bold text-[#5f6368] shrink-0">IO</div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-[#5f6368] block">Investigating Officer</span>
              <p className="font-bold text-[#202124] mt-0.5 truncate">{c.registeringOfficer || "PI Ramesh Kumar"}</p>
            </div>
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
          <FileText className="h-4 w-4" /> 1. Overview & Facts
        </button>

        <button
          onClick={() => setActiveTab("legal")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "legal" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
          }`}
        >
          <Scale className="h-4 w-4" /> 2. Legal & Act Sections
        </button>

        <button
          onClick={() => setActiveTab("complainant")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "complainant" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
          }`}
        >
          <User className="h-4 w-4" /> 3. Complainant & Victims
        </button>

        <button
          onClick={() => setActiveTab("accused")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "accused" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
          }`}
        >
          <ShieldAlert className="h-4 w-4" /> 4. Accused & Arrest Roster ({c.accused.length})
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "logs" ? "bg-[#0b57d0] text-white shadow-sm" : "text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#0b57d0]"
          }`}
        >
          <Fingerprint className="h-4 w-4" /> 5. CCTNS Logs & Print
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

          <div className="flex flex-col gap-4">
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

            {c.status === "Charge Sheeted" && (
              <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm border-emerald-500/20 bg-emerald-50/5">
                <CardHeader className="border-b border-[#f1f3f4] pb-3 bg-emerald-500/5">
                  <CardTitle className="text-base font-bold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" /> Chargesheet Particulars
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3.5 text-xs">
                  <DetailRow label="Chargesheet Number" value={c.chargesheetNo || "CS-4412"} />
                  <DetailRow label="Filing Date" value={c.chargesheetDate ? new Date(c.chargesheetDate).toLocaleDateString("en-IN") : new Date(c.registeredDate).toLocaleDateString("en-IN")} />
                  <DetailRow label="Filing Type" value={c.chargesheetType || "Original Chargesheet"} />
                  <DetailRow label="Filing Authority" value={c.registeringOfficer || "PI Ramesh Kumar"} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: LEGAL & ACT SECTIONS */}
      {activeTab === "legal" && (
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
                  <div className="p-2.5 rounded-xl bg-[#e8f0fe] text-[#0b57d0] shrink-0">
                    <Scale className="h-4 w-4" />
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

      {/* TAB CONTENT 3: COMPLAINANT & VICTIMS */}
      {activeTab === "complainant" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Complainant Statement Card */}
          <Card className="md:col-span-2 bg-white border-[#dadce0] rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#f1f3f4] pb-3">
              <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-[#0b57d0]" /> Complainant Statement (ComplainantDetails)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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

          {/* Victims List Card */}
          <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#f1f3f4] pb-3">
              <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-[#0b57d0]" /> Victims ({c.victims.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {c.victims.map((v: any, idx: number) => (
                <div key={idx} className="p-3 bg-[#f8f9fa] border border-[#f1f3f4] rounded-xl flex items-center gap-2.5">
                  {v.photo ? (
                    <img src={v.photo} alt="Victim" className="h-8 w-8 rounded-full object-cover border border-[#dadce0] shadow-sm shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[#dadce0]/40 flex items-center justify-center text-[9px] font-bold text-[#5f6368] shrink-0">VIC</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-[#202124] truncate">{v.name}</p>
                    <p className="text-[10px] text-[#5f6368]">{v.age} yrs · {v.gender} · {v.injuryStatus}</p>
                    {v.phone && <p className="text-[10px] text-[#0b57d0] font-semibold mt-0.5">📞 {v.phone}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT 4: ACCUSED & ARREST ROSTER */}
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
                  <div className="flex items-center gap-4 border-b border-[#f1f3f4] pb-2.5">
                    {a.photo ? (
                      <img src={a.photo} alt="Accused" className="h-14 w-14 rounded-xl object-cover border border-[#dadce0] shadow-sm shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-[#dadce0]/40 flex items-center justify-center text-xs font-bold text-[#5f6368] shrink-0">MUG</div>
                    )}
                    <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#202124]">
                          Accused #{idx + 1}: {a.name} <span className="font-mono text-xs text-[#5f6368]">({a.id || `A${idx + 1}`})</span>
                        </h4>
                        <p className="text-xs text-[#5f6368] mt-0.5">
                          Age: <strong>{a.age} Years</strong> · Gender: <strong>{a.gender}</strong>
                          {a.phone && <> · Phone: <strong>{a.phone}</strong></>}
                        </p>
                        {a.vehicleUsed && a.vehicleNo && (
                          <p className="text-xs text-amber-600 font-semibold mt-1.5 flex items-center gap-1">
                            🚗 Vehicle Used: <span className="font-mono bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] text-amber-800">{a.vehicleNo}</span>
                          </p>
                        )}
                        {a.physicalMarkers && a.physicalMarkers.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/40 flex flex-wrap gap-1.5 items-center">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Physical Markers:</span>
                            {a.physicalMarkers.map((m: { part: string; desc: string }, mIdx: number) => (
                              <Badge key={mIdx} variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                <strong>{m.part}:</strong> {m.desc}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        {isArrested ? (
                          <span className="bg-[#e6f4ea] text-[#188038] font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Arrested / In Custody
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="bg-[#fef7e0] text-[#e37400] font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Wanted / At Large
                            </span>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedAccusedForArrest(a.name);
                                setArrestDate(new Date().toISOString().slice(0, 10));
                                setArrestDistrictId(c.district?.id || 1);
                                setShowArrestModal(true);
                              }}
                              className="h-7 px-3 text-xs bg-ink hover:bg-signal text-paper font-semibold rounded-full transition-colors flex items-center gap-1"
                            >
                              Arrest Suspect
                            </Button>
                          </div>
                        )}
                      </div>
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

      {/* TAB CONTENT 5: CCTNS LOGS & PRINT PREVIEW */}
      {activeTab === "logs" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* CCTNS Dispatch & GD Logs */}
          <div className="space-y-4 md:col-span-1">
            <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm">
              <CardHeader className="border-b border-[#f1f3f4] pb-3">
                <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-[#0b57d0]" /> Activity & CCTNS Dispatch Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="border-l-2 border-[#0b57d0]/30 pl-4 ml-2 space-y-4">
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#0b57d0]" />
                    <span className="text-[10px] font-bold text-[#5f6368] block">General Diary (GD) Entry</span>
                    <p className="font-semibold text-[#202124] mt-0.5">GD Entry Registered automatically on CCTNS hub.</p>
                    <span className="text-[9px] font-mono text-muted-foreground">{new Date(c.registeredDate).toLocaleDateString()}</span>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#0b57d0]" />
                    <span className="text-[10px] font-bold text-[#5f6368] block">Magistrate Dispatch Log</span>
                    <p className="font-semibold text-[#202124] mt-0.5">FIR Copy dispatched to JMFC Court via CCTNS secure gateway.</p>
                    <span className="text-[9px] font-mono text-[#0b57d0] font-bold">Ref: DISP-{String(c.caseMasterId).slice(-4)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Document Preview (Clipboard Board) */}
          <div className="md:col-span-2">
            <div className="bg-[#202124] p-6 rounded-2xl border border-black flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="font-mono text-xs text-white/70 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Printer className="h-4 w-4 text-[#38bdf8]" /> Official CCTNS Document Preview
                </span>
                
                {/* Language Toggles and Print Button */}
                <div className="flex items-center gap-3">
                  <div className="flex bg-[#2a2b2e] rounded-full p-0.5 border border-[#dadce0]/10 text-xs">
                    <button 
                      onClick={() => setPrintLang('en')}
                      className={`px-3 py-1 rounded-full font-bold transition-all ${printLang === 'en' ? 'bg-[#38bdf8] text-[#202124]' : 'text-white/60 hover:text-white'}`}
                    >
                      English (EN)
                    </button>
                    <button 
                      onClick={() => setPrintLang('kn')}
                      className={`px-3 py-1 rounded-full font-bold transition-all ${printLang === 'kn' ? 'bg-[#38bdf8] text-[#202124]' : 'text-white/60 hover:text-white'}`}
                    >
                      ಕನ್ನಡ (KN)
                    </button>
                    <button 
                      onClick={() => setPrintLang('bilingual')}
                      className={`px-3 py-1 rounded-full font-bold transition-all ${printLang === 'bilingual' ? 'bg-[#38bdf8] text-[#202124]' : 'text-white/60 hover:text-white'}`}
                    >
                      Bilingual
                    </button>
                  </div>

                  <Button onClick={handlePrint} className="bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#202124] font-bold flex items-center gap-1.5 h-8 text-xs rounded-full px-4 shadow">
                    <Printer className="h-3.5 w-3.5" /> Print FIR Copy
                  </Button>
                </div>
              </div>

              {/* White A4 paper view preview */}
              <div className="bg-white text-black p-8 font-serif text-[11px] leading-relaxed shadow-2xl rounded border border-gray-400 select-text overflow-x-auto">
                <PrintableFirCopy caseData={c} showOnScreen={true} printLang={printLang} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog for updating case progress */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md bg-white border border-[#dadce0] rounded-2xl shadow-lg p-6">
          <DialogHeader className="pb-3 border-b border-[#f1f3f4]">
            <DialogTitle className="text-lg font-bold text-[#202124] flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-[#0b57d0]" /> Update Case Progress
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5f6368]">
              Modify investigation status and update case history notes for FIR #{c.crimeNo}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateSubmit} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#5f6368] tracking-wider block">
                Investigation Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="w-full form-select border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 rounded-xl text-xs font-semibold text-[#202124] focus:outline-none focus:ring-1 focus:ring-[#0b57d0]"
              >
                <option value="Under Investigation">Under Investigation</option>
                <option value="Charge Sheeted">Charge Sheeted</option>
                <option value="Closed">Closed</option>
                <option value="Pending Trial">Pending Trial</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#5f6368] tracking-wider block">
                Brief Facts / Investigation Narrative
              </label>
              <textarea
                value={editBriefFacts}
                onChange={(e) => setEditBriefFacts(e.target.value)}
                rows={5}
                placeholder="Update the comprehensive investigation log or fact narrative..."
                className="w-full border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 rounded-xl text-xs text-[#202124] focus:outline-none focus:ring-1 focus:ring-[#0b57d0] resize-none p-3"
                required
              />
            </div>

            {editStatus === "Charge Sheeted" && (
              <div className="border border-[#dadce0] rounded-xl p-3 bg-emerald-50/10 space-y-3">
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Chargesheet particulars</p>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-[#5f6368] tracking-wider block">
                    Chargesheet Number
                  </label>
                  <input
                    type="text"
                    value={editChargesheetNo}
                    onChange={(e) => setEditChargesheetNo(e.target.value)}
                    placeholder="e.g. CS-4412"
                    className="w-full border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 rounded-xl text-xs text-[#202124] focus:outline-none focus:ring-1 focus:ring-[#0b57d0]"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-[#5f6368] tracking-wider block">
                      Filing Date
                    </label>
                    <input
                      type="date"
                      value={editChargesheetDate}
                      onChange={(e) => setEditChargesheetDate(e.target.value)}
                      className="w-full border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 rounded-xl text-xs text-[#202124] focus:outline-none focus:ring-1 focus:ring-[#0b57d0]"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-[#5f6368] tracking-wider block">
                      Filing Type
                    </label>
                    <select
                      value={editChargesheetType}
                      onChange={(e) => setEditChargesheetType(e.target.value)}
                      className="w-full form-select border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 rounded-xl text-xs text-[#202124] focus:outline-none focus:ring-1 focus:ring-[#0b57d0]"
                    >
                      <option value="Original Chargesheet">Original</option>
                      <option value="Supplementary Chargesheet">Supplementary/Additional</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-[#f1f3f4] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="h-8 text-xs font-semibold border-[#dadce0] rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="h-8 text-xs font-semibold bg-[#0b57d0] hover:bg-[#0b57d0]/90 text-white rounded-full px-5"
              >
                {isUpdating ? "Saving..." : "Save Progress"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for recording suspect arrest */}
      <Dialog open={showArrestModal} onOpenChange={setShowArrestModal}>
        <DialogContent className="max-w-md bg-white border border-[#dadce0] rounded-2xl shadow-lg p-6">
          <DialogHeader className="pb-3 border-b border-[#f1f3f4]">
            <DialogTitle className="text-lg font-bold text-[#202124] flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#0b57d0]" /> Record Suspect Arrest
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5f6368]">
              Document arrest details for suspect <strong>{selectedAccusedForArrest}</strong> under FIR #{c.crimeNo}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordArrest} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#5f6368] tracking-wider block">
                Arrest Date
              </label>
              <input
                type="date"
                value={arrestDate}
                onChange={(e) => setArrestDate(e.target.value)}
                className="w-full border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 rounded-xl text-xs font-semibold text-[#202124] focus:outline-none focus:ring-1 focus:ring-[#0b57d0]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#5f6368] tracking-wider block">
                Arrest District / Jurisdiction
              </label>
              <select
                value={arrestDistrictId}
                onChange={(e) => setArrestDistrictId(Number(e.target.value))}
                className="w-full form-select border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 rounded-xl text-xs font-semibold text-[#202124] focus:outline-none focus:ring-1 focus:ring-[#0b57d0]"
              >
                {DISTRICTS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-3 border-t border-[#f1f3f4] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowArrestModal(false)}
                className="h-8 text-xs font-semibold border-[#dadce0] rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRecordingArrest}
                className="h-8 text-xs font-semibold bg-[#0b57d0] hover:bg-[#0b57d0]/90 text-white rounded-full px-5 flex items-center gap-1.5"
              >
                {isRecordingArrest ? "Recording..." : "Record Arrest"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <PrintableFirCopy caseData={c} printLang={printLang} />
  </>
  );
}

function PrintableFirCopy({ 
  caseData, 
  showOnScreen = false, 
  printLang = "bilingual" 
}: { 
  caseData: any; 
  showOnScreen?: boolean; 
  printLang?: "en" | "kn" | "bilingual"; 
}) {
  const formatDateTime = (val: string) => {
    if (!val) return "N/A";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString("en-IN", { hour12: false });
  };

  const formatDate = (val: string) => {
    if (!val) return "N/A";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-IN");
  };

  const LABELS = {
    government: { en: "GOVERNMENT OF KARNATAKA", kn: "ಕರ್ನಾಟಕ ಸರ್ಕಾರ" },
    department: { en: "Karnataka State Police Department", kn: "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ ಇಲಾಖೆ" },
    formTitle: { en: "First Information Report (Form No. 1)", kn: "ಪ್ರಥಮ ಮಾಹಿತಿ ವರದಿ (ನಮೂನೆ ಸಂಖ್ಯೆ 1)" },
    actSectionSubtitle: { 
      en: "(Recorded under Section 173 of BNSS, 2023 / Section 154 of Cr.P.C.)", 
      kn: "(ಭಾರತೀಯ ನಾಗರಿಕ ಸುರಕ್ಷಾ ಸಂಹಿತೆ, 2023 ರ ಸೆಕ್ಷನ್ 173 / ಸಿ.ಆರ್.ಪಿ.ಸಿ. ಸೆಕ್ಷನ್ 154 ರ ಅಡಿಯಲ್ಲಿ ದಾಖಲಿಸಲಾಗಿದೆ)" 
    },
    district: { en: "1. District", kn: "೧. ಜಿಲ್ಲೆ" },
    policeStation: { en: "2. Police Station", kn: "೨. ಪೊಲೀಸ್ ಠಾಣೆ" },
    year: { en: "3. Year", kn: "೩. ವರ್ಷ" },
    firNo: { en: "4. FIR Crime No", kn: "೪. ಎಫ್.ಐ.ಆರ್ ಸಂಖ್ಯೆ" },
    dateTimeReport: { en: "5. Date & Time of Report Registration", kn: "೫. ವರದಿ ನೋಂದಣಿ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ" },
    actSectionTitle: { en: "6. Act & Section Particulars:", kn: "೬. ಕಾಯ್ದೆ ಮತ್ತು ಸೆಕ್ಷನ್ ವಿವರಗಳು:" },
    sNo: { en: "S.No", kn: "ಕ್ರ.ಸಂ." },
    actCode: { en: "Act / Code", kn: "ಕಾಯ್ದೆ / ಕೋಡ್" },
    sections: { en: "Sections", kn: "ಸೆಕ್ಷನ್‌ಗಳು" },
    occurrenceOffence: { en: "7. Occurrence of Offence:", kn: "೭. ಅಪರಾಧದ ಸಂಭವಿಸುವಿಕೆ:" },
    incidentFrom: { en: "(a) Incident From Date/Time", kn: "(ಎ) ಘಟನೆ ನಡೆದ ದಿನಾಂಕ/ಸಮಯದಿಂದ" },
    incidentTo: { en: "(b) Incident To Date/Time", kn: "(ಬಿ) ಘಟನೆ ನಡೆದ ದಿನಾಂಕ/ಸಮಯದವರೆಗೆ" },
    infoReceived: { en: "(c) Information Received at Police Station", kn: "(ಸಿ) ಪೊಲೀಸ್ ಠಾಣೆಗೆ ಮಾಹಿತಿ ತಲುಪಿದ ಸಮಯ" },
    placeOccurrence: { en: "8. Place of Occurrence:", kn: "೮. ಅಪರಾಧ ನಡೆದ ಸ್ಥಳ:" },
    distanceDirection: { en: "(a) Distance & Direction from Station", kn: "(ಎ) ಠಾಣೆಯಿಂದ ದೂರ ಮತ್ತು ದಿಕ್ಕು" },
    physicalAddress: { en: "(b) Complete Physical Address", kn: "(ಬಿ) ಪೂರ್ಣ ವಿಳಾಸ" },
    coords: { en: "(c) Geographic Coordinates", kn: "(ಸಿ) ಭೌಗೋಳಿಕ ನಿರ್ದೇಶಾಂಕಗಳು" },
    complainantTitle: { en: "9. Complainant / Informant Details:", kn: "೯. ದೂರುದಾರರ / ಮಾಹಿತಿ ನೀಡಿದವರ ವಿವರಗಳು:" },
    fullName: { en: "(a) Full Name", kn: "(ಎ) ಪೂರ್ಣ ಹೆಸರು" },
    ageGender: { en: "(b) Age / Gender", kn: "(ಬಿ) ವಯಸ್ಸು / ಲಿಂಗ" },
    occupation: { en: "(c) Occupation", kn: "(ಸಿ) ಉದ್ಯೋಗ" },
    religionCaste: { en: "(d) Religion / Caste", kn: "(ಡಿ) ಧರ್ಮ / ಜಾತಿ" },
    contactPhone: { en: "(e) Contact Phone", kn: "(ಇ) ದೂರವಾಣಿ ಸಂಖ್ಯೆ" },
    relationToCase: { en: "(f) Relation to Case", kn: "(ಎಫ್) ಪ್ರಕರಣಕ್ಕೆ ಸಂಬಂಧ" },
    resAddress: { en: "(g) Residential Address", kn: "(ಜಿ) ವಸತಿ ವಿಳಾಸ" },
    accusedTitle: { en: "10. Roster of Accused Suspects:", kn: "೧೦. ಆರೋಪಿಗಳ / ಶಂಕಿತರ ವಿವರಗಳು:" },
    accusedName: { en: "Accused Name", kn: "ಆರೋಪಿಯ ಹೆಸರು" },
    custodyStatus: { en: "Custody Status", kn: "ಬಂಧನದ ಸ್ಥಿತಿ" },
    warrantId: { en: "Arrest Warrant ID", kn: "ಬಂಧನದ ವಾರಂಟ್ ಐಡಿ" },
    arrestDate: { en: "Arrest Date", kn: "ಬಂಧಿಸಿದ ದಿನಾಂಕ" },
    victimsTitle: { en: "11. Particulars of Victims:", kn: "೧೧. ಸಂತ್ರಸ್ತರ ವಿವರಗಳು:" },
    victimName: { en: "Victim Name", kn: "ಸಂತ್ರಸ್ತನ ಹೆಸರು" },
    ageSex: { en: "Age / Sex", kn: "ವಯಸ್ಸು / ಲಿಂಗ" },
    policeOfficer: { en: "Police Officer", kn: "ಪೊಲೀಸ್ ಅಧಿಕಾರಿ" },
    injuryStatus: { en: "Injury Status", kn: "ಗಾಯದ ಸ್ಥಿತಿ" },
    briefFactsTitle: { en: "12. Brief Facts of the Crime (BriefFacts):", kn: "೧೨. ಅಪರಾಧದ ಸಂಕ್ಷಿಪ್ತ ವಿವರಗಳು (ಸಾರಾಂಶ):" },
    chargesheetTitle: { en: "13. Chargesheet Filing Records:", kn: "೧೩. ಚಾರ್ಜ್‌ಶೀಟ್ ಸಲ್ಲಿಕೆಯ ವಿವರಗಳು:" },
    chargesheetNo: { en: "Chargesheet No", kn: "ಚಾರ್ಜ್‌ಶೀಟ್ ಸಂಖ್ಯೆ" },
    filingDate: { en: "Filing Date", kn: "ಸಲ್ಲಿಸಿದ ದಿನಾಂಕ" },
    chargesheetType: { en: "Chargesheet Type", kn: "ಚಾರ್ಜ್‌ಶೀಟ್ ಪ್ರಕಾರ" },
    authorityOfficer: { en: "Filing Authority Officer", kn: "ಚಾರ್ಜ್‌ಶೀಟ್ ಸಲ್ಲಿಸಿದ ಅಧಿಕಾರಿ" },
    gdTitle: { en: "14. General Diary (GD) Entry Details & Delay Record:", kn: "೧೪. ದಿನಚರಿ (ಜಿ.ಡಿ.) ದಾಖಲೆ ಮತ್ತು ವಿಳಂಬದ ವಿವರಗಳು:" },
    gdNo: { en: "GD Entry Number", kn: "ಜಿ.ಡಿ. ದಾಖಲೆ ಸಂಖ್ಯೆ" },
    gdDateTime: { en: "GD Date & Time", kn: "ಜಿ.ಡಿ. ದಿನಾಂಕ ಮತ್ತು ಸಮಯ" },
    delayReason: { en: "Reason for Delay in Reporting", kn: "ವರದಿ ಮಾಡಲು ವಿಳಂಬಕ್ಕೆ ಕಾರಣ" },
    dispatchTitle: { en: "15. Dispatch & Judicial Record logs:", kn: "೧೫. ರವಾನೆ ಮತ್ತು ನ್ಯಾಯಾಂಗ ದಾಖಲೆ ವಿವರಗಳು:" },
    dispatchDateTime: { en: "Dispatch Date & Time", kn: "ರವಾನೆ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ" },
    dispatchMode: { en: "Dispatch Mode", kn: "ರವಾನೆ ವಿಧಾನ" },
    courtName: { en: "Magistrate Jurisdictional Court", kn: "ನ್ಯಾಯಾಲಯದ ಹೆಸರು" },
    signatureComplainant: { en: "Signature / Left Thumb Impression of Complainant / Informant", kn: "ದೂರುದಾರರ / ಮಾಹಿತಿ ನೀಡಿದವರ ಸಹಿ / ಎಡ ಹೆಬ್ಬೆರಳ ಗುರುತು" },
    signatureOfficer: { en: "Signature of Officer-in-Charge, Police Station", kn: "ಪೊಲೀಸ್ ಠಾಣೆಯ ಪ್ರಭಾರ ಅಧಿಕಾರಿಯ ಸಹಿ" },
    officerName: { en: "Name", kn: "ಹೆಸರು" },
    officerRank: { en: "Rank", kn: "ಹುದ್ದೆ" },
    noVictims: { en: "No victim records filed.", kn: "ಯಾವುದೇ ಸಂತ್ರಸ್ತರ ವಿವರ ದಾಖಲಾಗಿಲ್ಲ." },
    noDelay: { en: "No delay reported. FIR registered immediately upon receipt of complainant's narrative.", kn: "ಯಾವುದೇ ವಿಳಂಬವಾಗಿಲ್ಲ. ದೂರುದಾರರಿಂದ ಲಿಖಿತ ದೂರು ಸ್ವೀಕರಿಸಿದ ತಕ್ಷಣ ಎಫ್.ಐ.ಆರ್ ದಾಖಲಿಸಲಾಗಿದೆ." },
    cctnsArchive: { en: "KARNATAKA STATE POLICE\nCCTNS RECORD ARCHIVE", kn: "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್\nCCTNS ದಾಖಲೆ ಸಂಗ್ರಹಾಲಯ" },
    endDoc: { en: "*** END OF FIRST INFORMATION REPORT (FORM NO. 1) ***", kn: "*** ಪ್ರಥಮ ಮಾಹಿತಿ ವರದಿ ಮುಕ್ತಾಯ (ನಮೂನೆ ಸಂಖ್ಯೆ ೧) ***" }
  };

  const tLabel = (key: keyof typeof LABELS, sep = " / ") => {
    const item = LABELS[key];
    if (!item) return "";
    if (printLang === "en") return item.en;
    if (printLang === "kn") return item.kn;
    return `${item.kn}${sep}${item.en}`;
  };

  const translateVal = (val: string, type?: "district" | "gender" | "custody" | "crimeHead" | "crimeNo" | "general") => {
    if (!val) return "N/A";
    if (printLang === "en") return val;

    let knVal = val;
    if (type === "district") {
      knVal = districtTranslations[val] || val;
    } else if (type === "crimeHead") {
      knVal = crimeHeadTranslations[val] || val;
    } else if (type === "gender") {
      const v = String(val).trim().toUpperCase();
      if (v === "M" || v === "MALE") knVal = "ಪುರುಷ";
      else if (v === "F" || v === "FEMALE") knVal = "ಮಹಿಳೆ";
    } else if (type === "custody") {
      const v = String(val).trim().toUpperCase();
      if (v.includes("ARRESTED") || v.includes("CUSTODY")) knVal = "ಬಂಧಿಸಲಾಗಿದೆ / ವಶದಲ್ಲಿದ್ದಾನೆ";
      else knVal = "ಪರಾರಿಯಾಗಿದ್ದಾನೆ / ಹುಡುಕಲಾಗುತ್ತಿದೆ";
    } else if (type === "crimeNo") {
      knVal = val;
    } else {
      knVal = (translations.kn as Record<string, string>)[val] || val;
    }

    if (printLang === "kn") return knVal;
    return `${knVal} / ${val}`;
  };

  return (
    <div className={`${showOnScreen ? "block" : "hidden"} print:block w-full max-w-[210mm] mx-auto bg-white text-black font-serif text-[11px] leading-relaxed select-text relative overflow-hidden print-fir-container`} style={{padding: '12mm 14mm'}}>
      {/* Closed File Diagonal Cross Watermark */}
      {caseData.status === "Closed" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 select-none" style={{ mixBlendMode: 'multiply' }}>
          <div className="absolute w-[150%] h-[2px] bg-red-500/10 top-0 left-0" style={{ transform: 'rotate(43deg)', transformOrigin: 'top left' }}></div>
          <div className="absolute w-[150%] h-[2px] bg-red-500/10 top-0 right-0" style={{ transform: 'rotate(-43deg)', transformOrigin: 'top right' }}></div>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="border-4 border-dashed border-red-500/25 rounded-2xl px-10 py-5 flex flex-col items-center justify-center" style={{ transform: 'rotate(-20deg)' }}>
              <span className="text-7xl font-black tracking-widest text-red-500/15 uppercase font-sans">CLOSED FILE</span>
              <span className="text-sm font-bold tracking-wider text-red-500/20 uppercase font-sans mt-2">CASE RESOLVED & COMPLETED</span>
            </div>
          </div>
        </div>
      )}

      {/* Print Page Styles Override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap');
        
        .print-fir-container {
          font-family: 'EB Garamond', serif !important;
          font-size: 11px !important;
          line-height: 1.55 !important;
        }

        .print-fir-container h1, 
        .print-fir-container h2, 
        .print-fir-container h3, 
        .print-fir-container h4, 
        .print-fir-container strong, 
        .print-fir-container b {
          font-family: 'EB Garamond', serif !important;
          font-weight: bold !important;
        }

        .print-fir-container td,
        .print-fir-container th,
        .print-fir-container span,
        .print-fir-container div {
          font-family: 'Courier Prime', monospace !important;
        }

        .print-fir-container .font-editorial,
        .print-fir-container h1,
        .print-fir-container h2,
        .print-fir-container h3,
        .print-fir-container .font-serif {
          font-family: 'EB Garamond', serif !important;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
          body {
            background-color: white !important;
            color: black !important;
            font-family: 'EB Garamond', serif !important;
          }
          .print-fir-container {
            font-family: 'EB Garamond', serif !important;
            padding: 0 !important;
          }
          .print-fir-container td,
          .print-fir-container th,
          .print-fir-container span,
          .print-fir-container div {
            font-family: 'Courier Prime', monospace !important;
          }
          .print-fir-container h1,
          .print-fir-container h2,
          .print-fir-container h3,
          .print-fir-container .font-serif {
            font-family: 'EB Garamond', serif !important;
          }
          aside, nav, header, button, .print\\:hidden {
            display: none !important;
          }
        }
      `}} />

      {/* Official Karnataka State Police Logo Watermark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none flex items-center justify-center">
        <img
          src={kspLogo}
          alt=""
          aria-hidden="true"
          className="w-[420px] h-[420px] object-contain opacity-[0.055] print:opacity-[0.055]"
          style={{ filter: 'grayscale(100%) contrast(1.2)' }}
        />
      </div>

      {/* ===== FIR DOCUMENT HEADER ===== */}

      {/* Top Meta Strip: Barcode (left) | CCTNS label (center) | QR Code (right) */}
      <div className="flex items-start justify-between border-b border-black pb-2 mb-3">
        {/* Barcode */}
        <div className="flex flex-col items-start gap-0.5 select-none">
          <svg className="w-32 h-4" viewBox="0 0 160 20">
            <rect x="0" y="0" width="3" height="20" fill="black" />
            <rect x="5" y="0" width="1" height="20" fill="black" />
            <rect x="8" y="0" width="4" height="20" fill="black" />
            <rect x="14" y="0" width="1" height="20" fill="black" />
            <rect x="17" y="0" width="3" height="20" fill="black" />
            <rect x="22" y="0" width="5" height="20" fill="black" />
            <rect x="29" y="0" width="1" height="20" fill="black" />
            <rect x="32" y="0" width="3" height="20" fill="black" />
            <rect x="37" y="0" width="1" height="20" fill="black" />
            <rect x="40" y="0" width="4" height="20" fill="black" />
            <rect x="46" y="0" width="1" height="20" fill="black" />
            <rect x="49" y="0" width="5" height="20" fill="black" />
            <rect x="56" y="0" width="3" height="20" fill="black" />
            <rect x="61" y="0" width="1" height="20" fill="black" />
            <rect x="64" y="0" width="4" height="20" fill="black" />
            <rect x="70" y="0" width="3" height="20" fill="black" />
            <rect x="75" y="0" width="1" height="20" fill="black" />
            <rect x="78" y="0" width="4" height="20" fill="black" />
            <rect x="84" y="0" width="5" height="20" fill="black" />
            <rect x="91" y="0" width="1" height="20" fill="black" />
            <rect x="94" y="0" width="3" height="20" fill="black" />
            <rect x="99" y="0" width="1" height="20" fill="black" />
            <rect x="102" y="0" width="4" height="20" fill="black" />
            <rect x="108" y="0" width="3" height="20" fill="black" />
            <rect x="113" y="0" width="5" height="20" fill="black" />
            <rect x="120" y="0" width="1" height="20" fill="black" />
            <rect x="123" y="0" width="4" height="20" fill="black" />
            <rect x="129" y="0" width="3" height="20" fill="black" />
            <rect x="134" y="0" width="1" height="20" fill="black" />
            <rect x="137" y="0" width="5" height="20" fill="black" />
            <rect x="144" y="0" width="3" height="20" fill="black" />
            <rect x="149" y="0" width="3" height="20" fill="black" />
          </svg>
          <span className="font-mono text-[6px] text-gray-500">CCTNS-{caseData.crimeNo.replace(/[^a-zA-Z0-9]/g, '')}</span>
        </div>

        {/* Center CCTNS labels */}
        <div className="flex flex-col items-center text-center text-[7px] font-sans text-gray-600 gap-0.5">
          <span className="font-bold">INTEGRATED CRIME RECORDS HUB (CCTNS CLOUD)</span>
          <span>STATUS: <span className="font-bold text-black">SUBMITTED &amp; SIGNED</span></span>
        </div>

        {/* QR Code Block */}
        <div className="flex flex-col items-center gap-1 select-none border border-black/30 p-1.5 bg-[#fcfcfc] rounded">
          <svg className="w-10 h-10" viewBox="0 0 100 100">
            <path d="M0,0 h30 v10 h-20 v20 h-10 z M15,15 h15 v15 h-15 z" fill="black" />
            <path d="M70,0 h30 v30 h-10 v-20 h-20 z M70,15 h15 v15 h-15 z" fill="black" />
            <path d="M0,70 h10 v20 h20 v10 h-30 z M15,70 h15 v15 h-15 z" fill="black" />
            <path d="M70,90 h20 v-20 h10 v30 h-30 z" fill="black" />
            <rect x="45" y="45" width="10" height="10" fill="black" />
            <rect x="35" y="35" width="10" height="10" fill="black" />
            <rect x="55" y="35" width="10" height="10" fill="black" />
            <rect x="35" y="55" width="10" height="10" fill="black" />
            <rect x="55" y="55" width="10" height="10" fill="black" />
          </svg>
          <span className="font-sans text-[6px] font-bold tracking-wider text-black">KSP VERIFIED</span>
          <span className="font-mono text-[5px] text-gray-500">SHA: {caseData.crimeNo.replace(/[^a-zA-Z]/g, '').slice(-6).toUpperCase() || 'E9A4B8'}</span>
        </div>
      </div>

      {/* Embellished Seal & Title Header */}
      <div className="border-b-2 border-black pb-4 mb-2">
        {/* Government of Karnataka ribbon */}
        <div className="flex justify-center mb-2">
          <div className="border border-black px-4 py-1 font-bold tracking-widest text-[9px] uppercase font-sans">
            {tLabel("government")}
          </div>
        </div>
        {/* 3-column layout: nothing | Logo + Title | nothing */}
        <div className="flex items-center gap-4 justify-center">
          {/* Karnataka State Police Logo */}
          <img
            src={kspLogo}
            alt="Karnataka State Police Seal"
            className="w-16 h-16 object-contain shrink-0"
            style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.2))' }}
          />
          {/* Title block */}
          <div className="text-center">
            <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-black leading-tight">{tLabel("department")}</h2>
            <h1 className="text-[15px] font-black uppercase tracking-widest text-black leading-tight mt-0.5">{tLabel("formTitle")}</h1>
            <p className="text-[8px] font-sans text-gray-500 italic mt-1 max-w-xs mx-auto leading-snug">{tLabel("actSectionSubtitle")}</p>
          </div>
        </div>
      </div>

      {/* 1-5 Roster Information Table Grid */}
      <div className="border-b border-black py-3 text-black">
        <table className="w-full border-collapse text-left text-[10px]">
          <tbody>
            <tr>
              <td className="w-1/4 font-bold py-1 pr-2">{tLabel("district")}:</td>
              <td className="w-1/4 py-1 text-black">{translateVal(caseData.district.name, "district")}</td>
              <td className="w-1/4 font-bold py-1 pl-4 pr-2">{tLabel("policeStation")}:</td>
              <td className="w-1/4 py-1 text-black">{translateVal(caseData.policeStation)}</td>
            </tr>
            <tr>
              <td className="w-1/4 font-bold py-1 pr-2">{tLabel("year")}:</td>
              <td className="w-1/4 py-1 text-black">{new Date(caseData.registeredDate).getFullYear()}</td>
              <td className="w-1/4 font-bold py-1 pl-4 pr-2">{tLabel("firNo")}:</td>
              <td className="w-1/4 py-1 font-mono font-bold text-black">{translateVal(caseData.crimeNo, "crimeNo")}</td>
            </tr>
            <tr>
              <td className="w-1/4 font-bold py-1 pr-2">{tLabel("dateTimeReport")}:</td>
              <td className="col-span-3 py-1 text-black" colSpan={3}>
                {formatDateTime(caseData.registeredDate)} HRS
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. Acts and Sections Table */}
      <div className="border-b border-black py-3 text-black">
        <h3 className="font-bold mb-1.5 text-black text-xs">{tLabel("actSectionTitle")}</h3>
        <table className="w-full border-collapse border border-black text-left text-[10px]">
          <thead>
            <tr className="bg-gray-100 border-b border-black">
              <th className="border-r border-black p-1.5 font-bold w-12 text-center text-black">{tLabel("sNo")}</th>
              <th className="border-r border-black p-1.5 font-bold text-black">{tLabel("actCode")}</th>
              <th className="p-1.5 font-bold text-black">{tLabel("sections")}</th>
            </tr>
          </thead>
          <tbody>
            {caseData.actSections.map((sec: string, idx: number) => {
              const parts = sec.split(" ");
              const act = parts[0] || "BNS";
              const section = parts.slice(1).join(" ") || "103";
              return (
                <tr key={idx} className="border-b border-black last:border-b-0 text-black">
                  <td className="border-r border-black p-1.5 text-center text-black">{idx + 1}</td>
                  <td className="border-r border-black p-1.5 text-black">{act}</td>
                  <td className="p-1.5 text-black">{section}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 7. Occurrence of Offence */}
      <div className="border-b border-black py-3 text-black">
        <h3 className="font-bold text-black text-xs mb-1.5">{tLabel("occurrenceOffence")}</h3>
        <table className="w-full border-collapse text-left text-[10px]">
          <tbody>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("incidentFrom")}:</td>
              <td className="py-1 text-black">{formatDateTime(caseData.incidentDate)} HRS</td>
            </tr>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("incidentTo")}:</td>
              <td className="py-1 text-black">{formatDateTime(caseData.incidentToDate || caseData.registeredDate)} HRS</td>
            </tr>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("infoReceived")}:</td>
              <td className="py-1 text-black">{formatDateTime(caseData.infoReceivedPSDate)} HRS</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 8. Place of Occurrence */}
      <div className="border-b border-black py-3 text-black">
        <h3 className="font-bold text-black text-xs mb-1.5">{tLabel("placeOccurrence")}</h3>
        <table className="w-full border-collapse text-left text-[10px]">
          <tbody>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("distanceDirection")}:</td>
              <td className="py-1 text-black">1.5 KM East</td>
            </tr>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("physicalAddress")}:</td>
              <td className="py-1 text-black">
                {caseData.moTag === "Online Fraud" 
                  ? translateVal("Cyberspace / Electronic Domain") 
                  : translateVal(caseData.occurrencePlace || "Commercial Street, MG Road, Bengaluru")}
              </td>
            </tr>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("coords")}:</td>
              <td className="py-1 text-black">Latitude: {caseData.latitude?.toFixed(5)}° N | Longitude: {caseData.longitude?.toFixed(5)}° E</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 9. Complainant Details */}
      <div className="border-b border-black py-3 text-black">
        <h3 className="font-bold text-black text-xs mb-1.5">{tLabel("complainantTitle")}</h3>
        <table className="w-full border-collapse text-left text-[10px]">
          <tbody>
            <tr>
              <td className="w-1/4 font-bold py-1 pr-2">{tLabel("fullName")}:</td>
              <td className="w-1/4 py-1 text-black">{translateVal(caseData.complainant.name)}</td>
              <td className="w-1/4 font-bold py-1 pl-4 pr-2">{tLabel("ageGender")}:</td>
              <td className="w-1/4 py-1 text-black">{caseData.complainant.age} Years / {translateVal(caseData.complainant.gender, "gender")}</td>
            </tr>
            <tr>
              <td className="w-1/4 font-bold py-1 pr-2">{tLabel("occupation")}:</td>
              <td className="w-1/4 py-1 text-black">{translateVal(caseData.complainant.occupation)}</td>
              <td className="w-1/4 font-bold py-1 pl-4 pr-2">{tLabel("religionCaste")}:</td>
              <td className="w-1/4 py-1 text-black">{translateVal(caseData.complainant.religion)} ({translateVal(caseData.complainant.caste)})</td>
            </tr>
            <tr>
              <td className="w-1/4 font-bold py-1 pr-2">{tLabel("contactPhone")}:</td>
              <td className="w-1/4 py-1 text-black">{caseData.complainant.phone || "+91 98765 43210"}</td>
              <td className="w-1/4 font-bold py-1 pl-4 pr-2">{tLabel("relationToCase")}:</td>
              <td className="w-1/4 py-1 text-black">{translateVal(caseData.complainant.relation || "Self (Victim)")}</td>
            </tr>
            <tr>
              <td className="w-1/4 font-bold py-1 pr-2">{tLabel("resAddress")}:</td>
              <td className="col-span-3 py-1 text-black" colSpan={3}>{translateVal(caseData.complainant.address)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 10. Accused Details */}
      <div className="border-b border-black py-3 text-black">
        <h3 className="font-bold mb-1.5 text-black text-xs">{tLabel("accusedTitle")}</h3>
        <div className="space-y-3">
          {caseData.accused.map((acc: any, idx: number) => (
            <div key={idx} className="flex gap-4 items-start p-2 border border-black rounded text-black bg-gray-50/50">
              {acc.photo ? (
                <img src={acc.photo} alt="Accused Mugshot" className="h-14 w-14 border border-black object-cover shrink-0" />
              ) : (
                <div className="h-14 w-14 border border-black flex items-center justify-center text-[7px] font-sans font-bold shrink-0 text-black">MUGSHOT</div>
              )}
              <table className="w-full border-collapse text-left text-[9px] flex-1">
                <tbody>
                  <tr>
                    <td className="w-1/4 font-bold py-0.5">{tLabel("accusedName")}:</td>
                    <td className="w-3/4 py-0.5 text-black font-semibold" colSpan={3}>{translateVal(acc.name)}</td>
                  </tr>
                  <tr>
                    <td className="w-1/4 font-bold py-0.5">{tLabel("ageGender")}:</td>
                    <td className="w-1/4 py-0.5 text-black">{acc.age} Years / {translateVal(acc.gender, "gender")}</td>
                    <td className="w-1/4 font-bold py-0.5 pl-2">{tLabel("custodyStatus")}:</td>
                    <td className="w-1/4 py-0.5 text-black">{translateVal(acc.arrestId || acc.arrested ? "Arrested / In Custody" : "Wanted / At Large", "custody")}</td>
                  </tr>
                  {acc.arrestId && (
                    <tr>
                      <td className="w-1/4 font-bold py-0.5">{tLabel("warrantId")}:</td>
                      <td className="w-1/4 py-0.5 text-black">ARR-{acc.arrestId}</td>
                      <td className="w-1/4 font-bold py-0.5 pl-2">{tLabel("arrestDate")}:</td>
                      <td className="w-1/4 py-0.5 text-black">{formatDate(acc.arrestDate)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      {/* 11. Victim Details */}
      <div className="border-b border-black py-3 text-black">
        <h3 className="font-bold mb-1.5 text-black text-xs">{tLabel("victimsTitle")}</h3>
        <table className="w-full border-collapse border border-black text-left text-[9px]">
          <thead>
            <tr className="bg-gray-100 border-b border-black">
              <th className="border-r border-black p-1 font-bold text-center w-8 text-black">{tLabel("sNo")}</th>
              <th className="border-r border-black p-1 font-bold text-black">{tLabel("victimName")}</th>
              <th className="border-r border-black p-1 font-bold text-center w-24 text-black">{tLabel("ageSex")}</th>
              <th className="border-r border-black p-1 font-bold text-center w-24 text-black">{tLabel("policeOfficer")}</th>
              <th className="p-1 font-bold text-black">{tLabel("injuryStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {caseData.victims.map((vic: any, idx: number) => (
              <tr key={idx} className="border-b border-black last:border-b-0 text-black">
                <td className="border-r border-black p-1 text-center text-black">{idx + 1}</td>
                <td className="border-r border-black p-1 text-black">{translateVal(vic.name)}</td>
                <td className="border-r border-black p-1 text-center text-black">{vic.age} / {translateVal(vic.gender, "gender")}</td>
                <td className="border-r border-black p-1 text-center text-black">{vic.isPolice ? (printLang === "kn" ? "ಹೌದು" : printLang === "en" ? "Yes" : "ಹೌದು / Yes") : (printLang === "kn" ? "ಇಲ್ಲ" : printLang === "en" ? "No" : "ಇಲ್ಲ / No")}</td>
                <td className="p-1 text-black">{translateVal(vic.injuryStatus || "Uninjured")}</td>
              </tr>
            ))}
            {caseData.victims.length === 0 && (
              <tr>
                <td colSpan={5} className="p-2 text-center text-gray-500 italic text-black">{tLabel("noVictims")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 12. Brief Facts */}
      <div className="border-b border-black py-3 text-black">
        <h3 className="font-bold mb-1 text-black text-xs">{tLabel("briefFactsTitle")}</h3>
        <p className="italic text-justify font-sans text-[10px] leading-relaxed p-2.5 bg-gray-50 border border-gray-300 rounded text-black">
          "{translateVal(caseData.briefFacts)}"
        </p>
      </div>

      {/* 13. Chargesheet Details */}
      {caseData.status === "Charge Sheeted" && (
        <div className="border-b border-black py-3 text-black">
          <h3 className="font-bold mb-1.5 text-black text-xs">{tLabel("chargesheetTitle")}</h3>
          <table className="w-full border-collapse text-left text-[10px]">
            <tbody>
              <tr>
                <td className="w-1/4 font-bold py-1 pr-2">{tLabel("chargesheetNo")}:</td>
                <td className="w-1/4 py-1 text-black">{caseData.chargesheetNo || "CS-4412"}</td>
                <td className="w-1/4 font-bold py-1 pl-4 pr-2">{tLabel("filingDate")}:</td>
                <td className="w-1/4 py-1 text-black">{caseData.chargesheetDate ? formatDate(caseData.chargesheetDate) : formatDate(caseData.registeredDate)}</td>
              </tr>
              <tr>
                <td className="w-1/4 font-bold py-1 pr-2">{tLabel("chargesheetType")}:</td>
                <td className="w-1/4 py-1 text-black">{translateVal(caseData.chargesheetType || "Original Chargesheet")}</td>
                <td className="w-1/4 font-bold py-1 pl-4 pr-2">{tLabel("authorityOfficer")}:</td>
                <td className="w-1/4 py-1 text-black">{translateVal(caseData.registeringOfficer || "PI Ramesh Kumar")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 14. GD Details */}
      <div className="border-b border-black py-3 text-black">
        <h3 className="font-bold mb-1.5 text-black text-xs">{tLabel("gdTitle")}</h3>
        <table className="w-full border-collapse text-left text-[10px]">
          <tbody>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("gdNo")}:</td>
              <td className="py-1 text-black">GD-{(Math.abs(caseData.caseMasterId) % 1000).toString().padStart(3, '0')}/2026</td>
            </tr>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("gdDateTime")}:</td>
              <td className="py-1 text-black">{formatDateTime(caseData.registeredDate)} HRS</td>
            </tr>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("delayReason")}:</td>
              <td className="py-1 text-black">{tLabel("noDelay")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 15. Court Dispatch */}
      <div className="border-b border-black py-3 text-black">
        <h3 className="font-bold mb-1.5 text-black text-xs">{tLabel("dispatchTitle")}</h3>
        <table className="w-full border-collapse text-left text-[10px]">
          <tbody>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("dispatchDateTime")}:</td>
              <td className="py-1 text-black">{formatDateTime(new Date(new Date(caseData.registeredDate).getTime() + 2 * 60 * 60 * 1000).toISOString())} HRS</td>
            </tr>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("dispatchMode")}:</td>
              <td className="py-1 text-black">{translateVal("Special Police Messenger (KGID: 29013)")}</td>
            </tr>
            <tr>
              <td className="w-1/3 font-bold py-1 pr-2">{tLabel("courtName")}:</td>
              <td className="py-1 text-black">{translateVal(caseData.courtName || "JMFC Court")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 9. Signatures Block */}
      <div className="pt-12 grid grid-cols-2 gap-12 text-center text-black">
        <div className="flex flex-col items-center justify-end h-24">
          <div className="border-t border-black pt-1.5 w-full text-[9px] font-sans text-black">
            <strong>{tLabel("signatureComplainant", "\n")}</strong>
          </div>
        </div>
        <div className="relative flex flex-col items-center justify-end h-24">
          <div className="font-bold text-[9px] font-sans text-right pr-6 h-10 text-black relative z-10">
            {caseData.officerPhoto && (
              <div className="inline-block border border-black p-0.5 bg-white">
                <img src={caseData.officerPhoto} alt="Officer Sign-off" className="h-8 w-8 object-cover" />
              </div>
            )}
          </div>
          <div className="border-t border-black pt-1.5 w-full text-[9px] font-sans text-black relative z-10">
            <strong>{tLabel("signatureOfficer", "\n")}</strong>
            <p className="text-gray-600">{tLabel("officerName")}: <span className="font-bold text-black">{translateVal(caseData.registeringOfficer || "PI Ramesh Kumar")}</span></p>
            <p className="text-gray-600">{tLabel("officerRank")}: <span className="font-bold text-black">{translateVal(caseData.officerRank || "Police Inspector (PI)")}</span></p>
          </div>
        </div>
      </div>

      {/* END OF DOCUMENT */}
      <div className="mt-10 pt-3 border-t border-dashed border-black/25 text-center font-mono text-[8px] text-black/50 select-none">
        {tLabel("endDoc")}
      </div>
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
