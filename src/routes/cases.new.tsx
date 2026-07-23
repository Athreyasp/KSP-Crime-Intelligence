import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DISTRICTS, CRIME_HEADS, CASE_STATUS, MO_TAGS } from "@/data/mock";
import { addCase, clearDb, getStoredCases } from "@/lib/db";
import {
  ShieldAlert, User, ShieldCheck, Plus, Trash2, Calendar, FileText, MapPin, Scale, Database, RefreshCcw, Landmark, UserCheck
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cases/new")({
  head: () => ({
    meta: [
      { title: "New Case Entry · KSP" },
      { name: "description", content: "Register a new FIR or case record into the Karnataka Police Crime database." },
    ],
  }),
  component: NewCasePage,
});

const RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Others"];
const CASTES = ["General", "OBC", "SC", "ST"];
const OCCUPATIONS = ["Farmer", "Business", "Government Employee", "Private Sector Employee", "Student", "Unemployed", "Others"];
const COURTS = ["JMFC Court", "District and Sessions Court", "City Civil Court", "High Court of Karnataka"];
const REGISTERING_OFFICERS = [
  "PI Ramesh Kumar (KGID: 29013)",
  "PSI Santosh Gowda (KGID: 30124)",
  "WPSI Shruthi Patil (KGID: 31055)"
];

function NewCasePage() {
  const navigate = useNavigate();
  
  const handleClearDb = async () => {
    if (confirm("Are you sure you want to delete all case records? This will clear both the local dashboard and Zoho Catalyst cloud Data Store?")) {
      try {
        await toast.promise(
          clearDb(),
          {
            loading: 'Clearing all remote database records...',
            success: 'Database and local storage cleared successfully!',
            error: (err) => `Failed to clear remote: ${err.message}`
          }
        );
      } catch (err) {
        console.error(err);
      }
    }
  };


  // Helper to format date for datetime-local value
  const formatDateLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Form states
  const [districtId, setDistrictId] = useState(DISTRICTS[0].id);
  const [policeStation, setPoliceStation] = useState("Central PS-1");
  const [category, setCategory] = useState("FIR");
  const [gravity, setGravity] = useState<"Heinous" | "Non-Heinous">("Non-Heinous");
  const [crimeHeadId, setCrimeHeadId] = useState(CRIME_HEADS[0].id);
  const [status, setStatus] = useState<"Under Investigation" | "Charge Sheeted" | "Closed" | "Pending Trial">("Under Investigation");
  const [moTag, setMoTag] = useState(MO_TAGS[0] || "Night Burglary");
  const [briefFacts, setBriefFacts] = useState("");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");

  // ER Diagram Schema Fields
  const [incidentFromDate, setIncidentFromDate] = useState(formatDateLocal(new Date(Date.now() - 3600000))); // 1h ago
  const [incidentToDate, setIncidentToDate] = useState(formatDateLocal(new Date()));
  const [infoReceivedPSDate, setInfoReceivedPSDate] = useState(formatDateLocal(new Date()));
  const [registeringOfficer, setRegisteringOfficer] = useState(REGISTERING_OFFICERS[0]);
  const [courtName, setCourtName] = useState(COURTS[0]);
  
  const [complainantName, setComplainantName] = useState("");
  const [complainantAge, setComplainantAge] = useState("35");
  const [complainantGender, setComplainantGender] = useState("M");
  const [complainantOccupation, setComplainantOccupation] = useState("Business");
  const [complainantReligion, setComplainantReligion] = useState("Hindu");
  const [complainantCaste, setComplainantCaste] = useState("General");

  // Dynamic lists with extended ER diagram parameters
  const [victims, setVictims] = useState<{ name: string; age: number; gender: "M" | "F" | "T"; isPolice: boolean }[]>([
    { name: "", age: 30, gender: "M", isPolice: false }
  ]);

  const [accused, setAccused] = useState<{ 
    name: string; 
    age: number; 
    gender: "M" | "F" | "T"; 
    arrested: boolean;
    arrestDate: string;
    arrestDistrict: string;
    ioName: string;
    courtName: string;
  }[]>([
    { name: "", age: 25, gender: "M", arrested: false, arrestDate: formatDateLocal(new Date()).slice(0, 10), arrestDistrict: DISTRICTS[0].name, ioName: REGISTERING_OFFICERS[0], courtName: COURTS[0] }
  ]);

  const [actSections, setActSections] = useState<string[]>(["BNS 103"]);
  const [newActSection, setNewActSection] = useState("");

  const handleAddVictim = () => setVictims([...victims, { name: "", age: 30, gender: "M", isPolice: false }]);
  const handleRemoveVictim = (index: number) => setVictims(victims.filter((_, i) => i !== index));
  const handleUpdateVictim = (index: number, field: string, value: any) => {
    const updated = [...victims];
    updated[index] = { ...updated[index], [field]: value };
    setVictims(updated);
  };

  const handleAddAccused = () => setAccused([...accused, { 
    name: "", 
    age: 25, 
    gender: "M", 
    arrested: false, 
    arrestDate: formatDateLocal(new Date()).slice(0, 10), 
    arrestDistrict: DISTRICTS[0].name, 
    ioName: registeringOfficer, 
    courtName: courtName 
  }]);
  const handleRemoveAccused = (index: number) => setAccused(accused.filter((_, i) => i !== index));
  const handleUpdateAccused = (index: number, field: string, value: any) => {
    const updated = [...accused];
    updated[index] = { ...updated[index], [field]: value };
    setAccused(updated);
  };

  const handleAddActSection = () => {
    if (newActSection.trim()) {
      setActSections([...actSections, newActSection.trim()]);
      setNewActSection("");
    }
  };
  const handleRemoveActSection = (index: number) => setActSections(actSections.filter((_, i) => i !== index));

  // Auto-generate Crime Number based on ER diagram:
  // 1-digit category code + 4-digit District ID + 4-digit Station ID + 4-digit Year + 5-digit Serial Number
  const getCrimeNoPreview = () => {
    const catCode = category === "FIR" ? "1" : category === "UDR" ? "3" : category === "Zero FIR" ? "8" : "4";
    const distCode = String(districtId).padStart(4, "0");
    const stationCode = "0001"; // default station ID placeholder
    const year = new Date().getFullYear();
    const currentCount = getStoredCases().length;
    const serial = String(currentCount + 1).padStart(5, "0");
    return `${catCode}${distCode}${stationCode}${year}${serial}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complainantName.trim()) {
      toast.error("Please enter complainant name");
      return;
    }
    if (victims.some(v => !v.name.trim())) {
      toast.error("Please fill in names for all victims");
      return;
    }
    if (accused.some(a => !a.name.trim())) {
      toast.error("Please fill in names for all accused persons");
      return;
    }

    const selectedDistrict = DISTRICTS.find(d => d.id === districtId)!;
    const selectedCrimeHead = CRIME_HEADS.find(h => h.id === crimeHeadId)!;
    
    const newCaseData = {
      crimeNo: getCrimeNoPreview(),
      registeredDate: new Date().toISOString(),
      incidentDate: new Date(incidentFromDate).toISOString(),
      hour: new Date(incidentFromDate).getHours(),
      district: selectedDistrict,
      policeStation,
      category,
      gravity,
      crimeHead: selectedCrimeHead,
      status,
      actSections,
      moTag,
      briefFacts: briefFacts || `FIR registered at ${policeStation} under crime head ${selectedCrimeHead.name}.`,
      
      // ER Diagram fields mapped to DB case object
      incidentToDate: new Date(incidentToDate).toISOString(),
      infoReceivedPSDate: new Date(infoReceivedPSDate).toISOString(),
      registeringOfficer,
      courtName,

      complainant: {
        name: complainantName,
        age: Number(complainantAge) || 35,
        gender: complainantGender,
        occupation: complainantOccupation,
        religion: complainantReligion,
        caste: complainantCaste
      },
      victims: victims.map(v => ({ 
        name: v.name.trim(), 
        age: v.age, 
        gender: v.gender, 
        isPolice: v.isPolice 
      })),
      accused: accused.map((a, idx) => ({
        id: `A${idx + 1}`,
        name: a.name.trim(),
        age: a.age,
        gender: a.gender,
        arrestId: a.arrested ? Math.floor(5000 + Math.random() * 500) : undefined,
        arrestDate: a.arrested ? a.arrestDate : undefined,
        arrestDistrict: a.arrested ? a.arrestDistrict : undefined,
        ioName: a.arrested ? a.ioName : undefined,
        courtName: a.arrested ? a.courtName : undefined
      })),
      latitude: Number(lat) || 12.9716,
      longitude: Number(lng) || 77.5946
    };

    if (!confirm("Are you sure the details are perfect? Click OK to upload this case to the Zoho Catalyst Console.")) {
      return;
    }

    try {
      await toast.promise(
        addCase(newCaseData),
        {
          loading: 'Registering case record with Zoho Catalyst Data Store...',
          success: (created: any) => {
            const isLocal = window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1");
            if (isLocal) {
              return `Successfully registered case ${created.crimeNo} locally! (Cloud sync skipped on localhost)`;
            }
            return `Successfully registered case ${created.crimeNo} and updated in Zoho Console!`;
          },
          error: (err: any) => `Failed to register: ${err.message}`
        }
      );
      navigate({ to: "/" });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        section="§ 08"
        eyebrow="Console / Records Entry"
        title="New FIR Registration"
        description="Register a new digital Case File. Input the particulars below following the Police FIR database schema."
        actions={
          <div className="flex gap-2">
            <Button onClick={handleClearDb} variant="destructive" className="h-8 text-xs">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear All Data
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6 pb-12">
        {/* SECTION 1: Case Details */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-signal" /> Case Master Particulars (CaseMaster)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Category (CaseCategoryID)</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                <option value="FIR">FIR (First Information Report)</option>
                <option value="UDR">UDR (Un-natural Death Report)</option>
                <option value="Zero FIR">Zero FIR</option>
                <option value="PAR">PAR (Petty Case)</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">District</label>
              <select value={districtId} onChange={e => setDistrictId(Number(e.target.value))} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {DISTRICTS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Police Station Unit (PoliceStationID)</label>
              <Input value={policeStation} onChange={e => setPoliceStation(e.target.value)} className="bg-surface-2 border-border" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Registering Officer (PolicePersonID)</label>
              <select value={registeringOfficer} onChange={e => setRegisteringOfficer(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {REGISTERING_OFFICERS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Hearing Court (CourtID)</label>
              <select value={courtName} onChange={e => setCourtName(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {COURTS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gravity of Offence (GravityOffenceID)</label>
              <select value={gravity} onChange={e => setGravity(e.target.value as any)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                <option value="Non-Heinous">Non-Heinous</option>
                <option value="Heinous">Heinous (Severe)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Major Crime Head (CrimeMajorHeadID)</label>
              <select value={crimeHeadId} onChange={e => setCrimeHeadId(Number(e.target.value))} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {CRIME_HEADS.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Case Status (CaseStatusID)</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                <option value="Under Investigation">Under Investigation</option>
                <option value="Charge Sheeted">Charge Sheeted</option>
                <option value="Pending Trial">Pending Trial</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Modus Operandi Tag</label>
              <select value={moTag} onChange={e => setMoTag(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {MO_TAGS.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>

            {/* Timestamps Section */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Incident From (IncidentFromDate)</label>
              <Input type="datetime-local" value={incidentFromDate} onChange={e => setIncidentFromDate(e.target.value)} className="bg-surface-2 border-border" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Incident To (IncidentToDate)</label>
              <Input type="datetime-local" value={incidentToDate} onChange={e => setIncidentToDate(e.target.value)} className="bg-surface-2 border-border" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Info Received at PS (InfoReceivedPSDate)</label>
              <Input type="datetime-local" value={infoReceivedPSDate} onChange={e => setInfoReceivedPSDate(e.target.value)} className="bg-surface-2 border-border" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Latitude</label>
              <Input type="number" step="0.0001" value={lat} onChange={e => setLat(e.target.value)} className="bg-surface-2 border-border" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Longitude</label>
              <Input type="number" step="0.0001" value={lng} onChange={e => setLng(e.target.value)} className="bg-surface-2 border-border" />
            </div>

            <div></div>

            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Brief Facts of the Crime (BriefFacts)</label>
              <textarea value={briefFacts} onChange={e => setBriefFacts(e.target.value)} rows={3} placeholder="Describe the incident narrative as reported..." className="form-textarea border border-border bg-surface-2 px-3 py-2 rounded-md text-sm resize-none focus:outline-none" />
            </div>
            
            <div className="md:col-span-3 mt-2 rounded-md bg-signal/5 border border-signal/25 p-3 flex justify-between items-center">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-signal font-semibold">System Generated Crime Number (CrimeNo)</span>
                <p className="font-mono text-base font-bold text-ink tracking-widest">{getCrimeNoPreview()}</p>
              </div>
              <Badge variant="outline" className="border-signal text-signal font-mono text-[10px]">{category}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: Complainant Details */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4.5 w-4.5 text-signal" /> Complainant Details (ComplainantDetails)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Full Name</label>
              <Input placeholder="Enter complainant name" value={complainantName} onChange={e => setComplainantName(e.target.value)} className="bg-surface-2 border-border" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Age (AgeYear)</label>
              <Input type="number" value={complainantAge} onChange={e => setComplainantAge(e.target.value)} className="bg-surface-2 border-border" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gender (GenderID)</label>
              <select value={complainantGender} onChange={e => setComplainantGender(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                <option value="M">Male (M)</option>
                <option value="F">Female (F)</option>
                <option value="T">Transgender (T)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Occupation (OccupationID)</label>
              <select value={complainantOccupation} onChange={e => setComplainantOccupation(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {OCCUPATIONS.map(occ => (
                  <option key={occ} value={occ}>{occ}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Religion (ReligionID)</label>
              <select value={complainantReligion} onChange={e => setComplainantReligion(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {RELIGIONS.map(rel => (
                  <option key={rel} value={rel}>{rel}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Caste (CasteID)</label>
              <select value={complainantCaste} onChange={e => setComplainantCaste(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {CASTES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: Victims Details */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-signal" /> Victims Record (Victim)
            </CardTitle>
            <Button type="button" onClick={handleAddVictim} variant="outline" className="h-7 px-2.5 text-[11px] border-ink/20">
              <Plus className="mr-1 h-3 w-3" /> Add Victim
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {victims.map((victim, idx) => (
              <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 items-end p-3 bg-surface-2 border border-border/50 rounded-md">
                <div className="flex-1 flex flex-col gap-1 min-w-[200px]">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Victim {idx + 1} Name</label>
                  <Input placeholder="Victim Name" value={victim.name} onChange={e => handleUpdateVictim(idx, "name", e.target.value)} className="bg-paper border-border" />
                </div>
                <div className="w-24 flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Age (AgeYear)</label>
                  <Input type="number" value={victim.age} onChange={e => handleUpdateVictim(idx, "age", Number(e.target.value))} className="bg-paper border-border" />
                </div>
                <div className="w-32 flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gender (GenderID)</label>
                  <select value={victim.gender} onChange={e => handleUpdateVictim(idx, "gender", e.target.value)} className="form-select border border-border bg-paper px-3 py-1.5 rounded-md text-sm">
                    <option value="M">M</option>
                    <option value="F">F</option>
                    <option value="T">T</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 h-9 px-2 pb-1">
                  <input
                    type="checkbox"
                    id={`v-police-${idx}`}
                    checked={victim.isPolice}
                    onChange={e => handleUpdateVictim(idx, "isPolice", e.target.checked)}
                    className="form-checkbox h-4 w-4 text-signal rounded border-border"
                  />
                  <label htmlFor={`v-police-${idx}`} className="text-xs font-semibold text-muted-foreground cursor-pointer select-none">Is Police? (VictimPolice)</label>
                </div>
                {victims.length > 1 && (
                  <Button type="button" onClick={() => handleRemoveVictim(idx)} variant="destructive" className="h-9 px-3">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* SECTION 4: Accused & Arrest Details */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-signal" /> Accused / Offender Record (Accused & ArrestSurrender)
            </CardTitle>
            <Button type="button" onClick={handleAddAccused} variant="outline" className="h-7 px-2.5 text-[11px] border-ink/20">
              <Plus className="mr-1 h-3 w-3" /> Add Accused
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {accused.map((acc, idx) => (
              <div key={idx} className="flex flex-col gap-3 p-3.5 bg-surface-2 border border-border/60 rounded-md">
                <div className="flex flex-wrap md:flex-nowrap gap-3 items-end w-full">
                  <div className="flex-1 flex flex-col gap-1 min-w-[200px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Accused {idx + 1} Name</label>
                    <Input placeholder="Accused Name" value={acc.name} onChange={e => handleUpdateAccused(idx, "name", e.target.value)} className="bg-paper border-border" />
                  </div>
                  <div className="w-24 flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Age (AgeYear)</label>
                    <Input type="number" value={acc.age} onChange={e => handleUpdateAccused(idx, "age", Number(e.target.value))} className="bg-paper border-border" />
                  </div>
                  <div className="w-32 flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gender (GenderID)</label>
                    <select value={acc.gender} onChange={e => handleUpdateAccused(idx, "gender", e.target.value)} className="form-select border border-border bg-paper px-3 py-1.5 rounded-md text-sm">
                      <option value="M">M</option>
                      <option value="F">F</option>
                      <option value="T">T</option>
                    </select>
                  </div>
                  <div className="w-48 flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Arrest Status</label>
                    <select value={acc.arrested ? "1" : "0"} onChange={e => handleUpdateAccused(idx, "arrested", e.target.value === "1")} className="form-select border border-border bg-paper px-3 py-1.5 rounded-md text-sm">
                      <option value="0">Wanted / At Large</option>
                      <option value="1">Arrested / In Custody</option>
                    </select>
                  </div>
                  {accused.length > 1 && (
                    <Button type="button" onClick={() => handleRemoveAccused(idx)} variant="destructive" className="h-9 px-3">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* ArrestSurrender Sub-form Fields conditional on Arrested status */}
                {acc.arrested && (
                  <div className="grid gap-3 md:grid-cols-4 border-t border-border/40 pt-3 mt-1 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Arrest Date (ArrestSurrenderDate)</label>
                      <Input type="date" value={acc.arrestDate} onChange={e => handleUpdateAccused(idx, "arrestDate", e.target.value)} className="bg-paper border-border" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Arrest District (ArrestSurrenderDistrictId)</label>
                      <select value={acc.arrestDistrict} onChange={e => handleUpdateAccused(idx, "arrestDistrict", e.target.value)} className="form-select border border-border bg-paper px-3 py-1.5 rounded-md text-sm">
                        {DISTRICTS.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Investigating Officer (IOID)</label>
                      <Input placeholder="Enter IO name/KGID" value={acc.ioName} onChange={e => handleUpdateAccused(idx, "ioName", e.target.value)} className="bg-paper border-border" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Produced Court (CourtID)</label>
                      <select value={acc.courtName} onChange={e => handleUpdateAccused(idx, "courtName", e.target.value)} className="form-select border border-border bg-paper px-3 py-1.5 rounded-md text-sm">
                        {COURTS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* SECTION 5: Act & Sections */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4.5 w-4.5 text-signal" /> Act & Section Association (ActSectionAssociation)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-end gap-3 max-w-md">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Add Legal Act / Section (e.g. IPC 379 / BNS 303)</label>
                <Input placeholder="Enter act & section" value={newActSection} onChange={e => setNewActSection(e.target.value)} className="bg-surface-2 border-border" />
              </div>
              <Button type="button" onClick={handleAddActSection} className="h-9">
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {actSections.map((sec, idx) => (
                <Badge key={idx} variant="secondary" className="bg-surface-2 border border-border gap-2.5 px-3 py-1 text-xs">
                  <span>{sec}</span>
                  <button type="button" onClick={() => handleRemoveActSection(idx)} className="text-signal hover:text-red-700 focus:outline-none">
                    &times;
                  </button>
                </Badge>
              ))}
              {actSections.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No acts/sections associated yet.</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form Submission Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link to="/cases" className="rounded-md border border-ink/20 bg-paper px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2 transition-colors">
            Cancel
          </Link>
          <Button type="submit" className="px-6 py-2.5 text-sm font-semibold shadow-hard">
            Register FIR Case
          </Button>
        </div>
      </form>
    </div>
  );
}
