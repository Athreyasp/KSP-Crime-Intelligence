import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DISTRICTS, CRIME_HEADS, MO_TAGS } from "@/data/mock";
import { addCase, clearDb, getStoredCases } from "@/lib/db";
import {
  ShieldAlert, User, ShieldCheck, Plus, Trash2, Calendar, FileText, MapPin, Scale, Database, RefreshCcw, Landmark, CheckCircle2, AlertCircle, Edit3, ArrowRight, Clock, Phone, Home, Check
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cases/new")({
  head: () => ({
    meta: [
      { title: "New FIR Registration · Karnataka State Police" },
      { name: "description", content: "Register a new First Information Report (FIR) into the Karnataka Police Crime database." },
    ],
  }),
  component: NewCasePage,
});

const RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Others"];
const CASTES = ["General", "OBC", "SC", "ST"];
const OCCUPATIONS = ["Business", "Farmer", "Government Employee", "Private Sector Employee", "Student", "Unemployed", "Professional", "Others"];
const COURTS = ["JMFC Court", "District and Sessions Court", "City Civil Court", "High Court of Karnataka"];
const REGISTERING_OFFICERS = [
  "PI Ramesh Kumar (KGID: 29013)",
  "PSI Santosh Gowda (KGID: 30124)",
  "WPSI Shruthi Patil (KGID: 31055)",
  "PI Ananda Swamy (KGID: 28410)",
  "PSI Vinayaka Hegde (KGID: 32490)"
];

function PhotoUploadWidget({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (base64: string) => void;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[120px]">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </label>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt="Preview"
            className="h-10 w-10 rounded-full object-cover border border-signal/30 shadow-sm"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-surface-2 border border-border border-dashed flex items-center justify-center text-muted-foreground text-xs font-semibold">
            N/A
          </div>
        )}
        <label className="cursor-pointer bg-surface-2 border border-border text-ink hover:bg-surface-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
          Upload
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}

function NewCasePage() {
  const navigate = useNavigate();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to format date for datetime-local value
  const formatDateLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // ==========================================
  // SECTION 1: COMPLAINANT DETAILS
  // ==========================================
  const [complainantName, setComplainantName] = useState("");
  const [complainantAge, setComplainantAge] = useState("35");
  const [complainantGender, setComplainantGender] = useState("M");
  const [complainantOccupation, setComplainantOccupation] = useState("Business");
  const [complainantReligion, setComplainantReligion] = useState("Hindu");
  const [complainantCaste, setComplainantCaste] = useState("General");
  const [complainantPhone, setComplainantPhone] = useState("+91 98765 43210");
  const [complainantAddress, setComplainantAddress] = useState("MG Road, Bengaluru");
  const [complainantRelation, setComplainantRelation] = useState("Self (Victim)");

  // ==========================================
  // SECTION 2: POLICE DETAILS
  // ==========================================
  const [districtId, setDistrictId] = useState(DISTRICTS[0].id);
  const [policeStation, setPoliceStation] = useState("Central PS-1");
  const [registeringOfficer, setRegisteringOfficer] = useState(REGISTERING_OFFICERS[0]);
  const [officerRank, setOfficerRank] = useState("Police Inspector (PI)");
  const [courtName, setCourtName] = useState(COURTS[0]);
  const [infoReceivedPSDate, setInfoReceivedPSDate] = useState(formatDateLocal(new Date()));
  const [officerPhoto, setOfficerPhoto] = useState("");

  // ==========================================
  // SECTION 3: VICTIM DETAILS
  // ==========================================
  const [victims, setVictims] = useState<{
    name: string;
    age: number;
    gender: "M" | "F" | "T";
    isPolice: boolean;
    injuryStatus: string;
    photo: string;
  }[]>([
    { name: "", age: 30, gender: "M", isPolice: false, injuryStatus: "Uninjured", photo: "" }
  ]);

  const handleAddVictim = () => setVictims([...victims, { name: "", age: 30, gender: "M", isPolice: false, injuryStatus: "Uninjured", photo: "" }]);
  const handleRemoveVictim = (index: number) => setVictims(victims.filter((_, i) => i !== index));
  const handleUpdateVictim = (index: number, field: string, value: any) => {
    const updated = [...victims];
    updated[index] = { ...updated[index], [field]: value };
    setVictims(updated);
  };

  // ==========================================
  // SECTION 4: CASE & OFFENCE DETAILS
  // ==========================================
  const [category, setCategory] = useState("FIR");
  const [gravity, setGravity] = useState<"Heinous" | "Non-Heinous">("Non-Heinous");
  const [crimeHeadId, setCrimeHeadId] = useState(CRIME_HEADS[0].id);
  const [status, setStatus] = useState<"Under Investigation" | "Charge Sheeted" | "Closed" | "Pending Trial">("Under Investigation");
  const [moTag, setMoTag] = useState(MO_TAGS[0] || "Night Burglary");
  const [briefFacts, setBriefFacts] = useState("");
  const [occurrencePlace, setOccurrencePlace] = useState("Commercial Street, MG Road, Bengaluru");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");
  const [incidentFromDate, setIncidentFromDate] = useState(formatDateLocal(new Date(Date.now() - 3600000)));
  const [incidentToDate, setIncidentToDate] = useState(formatDateLocal(new Date()));

  const [actSections, setActSections] = useState<string[]>(["BNS 303", "BNS 317"]);
  const [newActSection, setNewActSection] = useState("");

  const [accused, setAccused] = useState<{
    name: string;
    age: number;
    gender: "M" | "F" | "T";
    arrested: boolean;
    arrestDate: string;
    arrestDistrict: string;
    ioName: string;
    courtName: string;
    photo: string;
  }[]>([
    { name: "", age: 28, gender: "M", arrested: false, arrestDate: formatDateLocal(new Date()).slice(0, 10), arrestDistrict: DISTRICTS[0].name, ioName: REGISTERING_OFFICERS[0], courtName: COURTS[0], photo: "" }
  ]);

  const handleAddAccused = () => setAccused([...accused, {
    name: "",
    age: 25,
    gender: "M",
    arrested: false,
    arrestDate: formatDateLocal(new Date()).slice(0, 10),
    arrestDistrict: DISTRICTS[0].name,
    ioName: registeringOfficer,
    courtName: courtName,
    photo: ""
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

  // Auto-generate Crime Number code
  const getCrimeNoPreview = () => {
    const catCode = category === "FIR" ? "1" : category === "UDR" ? "3" : category === "Zero FIR" ? "8" : "4";
    const distCode = String(districtId).padStart(4, "0");
    const stationCode = "0001";
    const year = new Date().getFullYear();
    const currentCount = getStoredCases().length;
    const serial = String(currentCount + 1).padStart(5, "0");
    return `${catCode}${distCode}${stationCode}${year}${serial}`;
  };

  const handleClearDb = async () => {
    if (confirm("Are you sure you want to delete all case records? This will clear both local storage and cloud Data Store.")) {
      try {
        await toast.promise(
          clearDb(),
          {
            loading: 'Clearing database records...',
            success: 'Database and local storage cleared successfully!',
            error: (err) => `Failed to clear: ${err.message}`
          }
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Step 1: Open Review Modal Popup on Form Submit
  const handleOpenReviewModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complainantName.trim()) {
      toast.error("Please enter complainant name in Section 1");
      return;
    }
    if (victims.some(v => !v.name.trim())) {
      toast.error("Please fill in names for all victims in Section 3");
      return;
    }
    if (accused.some(a => !a.name.trim())) {
      toast.error("Please fill in names for all accused persons in Section 4");
      return;
    }
    if (!briefFacts.trim()) {
      toast.error("Please provide brief facts of the crime in Section 4");
      return;
    }

    setShowReviewModal(true);
  };

  // Step 2: Final Database Update Confirmation
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    const selectedDistrict = DISTRICTS.find(d => d.id === districtId)!;
    const selectedCrimeHead = CRIME_HEADS.find(h => h.id === crimeHeadId)!;
    const crimeNo = getCrimeNoPreview();

    const newCaseData = {
      crimeNo,
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
      officerRank,
      courtName,
      officerPhoto,

      complainant: {
        name: complainantName,
        age: Number(complainantAge) || 35,
        gender: complainantGender,
        occupation: complainantOccupation,
        religion: complainantReligion,
        caste: complainantCaste,
        phone: complainantPhone,
        address: complainantAddress,
        relation: complainantRelation,
      },
      victims: victims.map(v => ({
        name: v.name.trim(),
        age: v.age,
        gender: v.gender,
        isPolice: v.isPolice,
        injuryStatus: v.injuryStatus,
        photo: v.photo
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
        courtName: a.arrested ? a.courtName : undefined,
        photo: a.photo
      })),
      latitude: Number(lat) || 12.9716,
      longitude: Number(lng) || 77.5946
    };

    try {
      await addCase(newCaseData);
      setShowReviewModal(false);
      setIsSubmitting(false);

      // Toast Notification indicating Data updated across all 27 tables in the database
      toast.success(`FIR #${crimeNo} stored in all 27 Zoho Console tables! Data reflected instantly.`, {
        duration: 6000,
        description: `Reflected in CaseMaster, Accused, Victim, ComplainantDetails, ArrestSurrender, ActSectionAssociation, & 21 Master tables at ${policeStation}, ${selectedDistrict.name}.`,
      });

      // Redirect to the live cases directory
      navigate({ to: "/cases" });
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(`Failed to update database: ${err.message}`);
    }
  };

  const selectedDistrictObj = DISTRICTS.find(d => d.id === districtId)!;
  const selectedCrimeHeadObj = CRIME_HEADS.find(h => h.id === crimeHeadId)!;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        section="§ 08"
        eyebrow="Karnataka State Police · Record Entry"
        title="New FIR Registration"
        description="Official FIR Form No. 1 entry. Populates all 27 database tables in your Zoho Console instantly."
        actions={
          <div className="flex gap-2">
            <Button onClick={handleClearDb} variant="destructive" className="h-8 text-xs">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear Database
            </Button>
          </div>
        }
      />

      <form onSubmit={handleOpenReviewModal} className="space-y-6 pb-12">

        {/* SECTION 1: COMPLAINANT DETAILS */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-foreground font-semibold">
                <User className="h-4.5 w-4.5 text-signal" /> Section 1: Complainant Details (ComplainantDetails)
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-signal/40 text-signal">
                Part 1 of 4
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Complainant Full Name *</label>
              <Input placeholder="Enter complainant name" value={complainantName} onChange={e => setComplainantName(e.target.value)} className="bg-surface-2 border-border" required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Age (AgeYear) *</label>
              <Input type="number" value={complainantAge} onChange={e => setComplainantAge(e.target.value)} className="bg-surface-2 border-border" required />
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
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contact Phone *</label>
              <Input value={complainantPhone} onChange={e => setComplainantPhone(e.target.value)} className="bg-surface-2 border-border" required />
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
            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Residential Address *</label>
              <Input value={complainantAddress} onChange={e => setComplainantAddress(e.target.value)} className="bg-surface-2 border-border" required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Relation to Incident *</label>
              <Input value={complainantRelation} onChange={e => setComplainantRelation(e.target.value)} className="bg-surface-2 border-border" required />
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: POLICE DETAILS */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-foreground font-semibold">
                <Landmark className="h-4.5 w-4.5 text-signal" /> Section 2: Police Station & Officer Details (Unit & Employee)
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-signal/40 text-signal">
                Part 2 of 4
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">District (DistrictID)</label>
              <select value={districtId} onChange={e => setDistrictId(Number(e.target.value))} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {DISTRICTS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Police Station Unit (PoliceStationID / UnitID) *</label>
              <Input value={policeStation} onChange={e => setPoliceStation(e.target.value)} className="bg-surface-2 border-border" required />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Registering Officer / IO (PolicePersonID / EmployeeID)</label>
              <select value={registeringOfficer} onChange={e => setRegisteringOfficer(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                {REGISTERING_OFFICERS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Officer Rank (RankID)</label>
              <select value={officerRank} onChange={e => setOfficerRank(e.target.value)} className="form-select border border-border bg-surface-2 px-3 py-1.5 rounded-md text-sm">
                <option value="Police Inspector (PI)">Police Inspector (PI)</option>
                <option value="Police Sub-Inspector (PSI)">Police Sub-Inspector (PSI)</option>
                <option value="Deputy Superintendent (DySP)">Deputy Superintendent (DySP)</option>
                <option value="Assistant Sub-Inspector (ASI)">Assistant Sub-Inspector (ASI)</option>
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
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Info Received at PS Date & Time (InfoReceivedPSDate) *</label>
              <Input type="datetime-local" value={infoReceivedPSDate} onChange={e => setInfoReceivedPSDate(e.target.value)} className="bg-surface-2 border-border" required />
            </div>

            <div className="flex flex-col gap-1 md:col-span-3 pt-2 border-t border-border/40">
              <PhotoUploadWidget
                label="Registering Officer Profile Image"
                value={officerPhoto}
                onChange={setOfficerPhoto}
              />
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: VICTIM DETAILS */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-signal" />
              <CardTitle className="text-base font-semibold text-foreground">Section 3: Victim Details (Victim)</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-signal/40 text-signal">
                Part 3 of 4
              </Badge>
              <Button type="button" onClick={handleAddVictim} variant="outline" className="h-7 px-2.5 text-[11px]">
                <Plus className="mr-1 h-3 w-3" /> Add Victim
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {victims.map((victim, idx) => (
              <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 items-end p-3.5 bg-surface-2 border border-border/50 rounded-md">
                <div className="flex-1 flex flex-col gap-1 min-w-[180px]">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Victim {idx + 1} Name *</label>
                  <Input placeholder="Victim Full Name" value={victim.name} onChange={e => handleUpdateVictim(idx, "name", e.target.value)} className="bg-paper border-border" required />
                </div>
                <div className="w-20 flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Age *</label>
                  <Input type="number" value={victim.age} onChange={e => handleUpdateVictim(idx, "age", Number(e.target.value))} className="bg-paper border-border" required />
                </div>
                <div className="w-24 flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gender</label>
                  <select value={victim.gender} onChange={e => handleUpdateVictim(idx, "gender", e.target.value)} className="form-select border border-border bg-paper px-2.5 py-1.5 rounded-md text-sm">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="T">Transgender</option>
                  </select>
                </div>
                <div className="w-36 flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Injury Status</label>
                  <select value={victim.injuryStatus} onChange={e => handleUpdateVictim(idx, "injuryStatus", e.target.value)} className="form-select border border-border bg-paper px-2 py-1.5 rounded-md text-xs">
                    <option value="Uninjured">Uninjured</option>
                    <option value="Minor Injuries">Minor Injuries</option>
                    <option value="Severe / Hospitalized">Severe / Hospitalized</option>
                    <option value="Fatal">Fatal</option>
                  </select>
                </div>
                <PhotoUploadWidget
                  label="Victim Photo"
                  value={victim.photo}
                  onChange={(base64) => handleUpdateVictim(idx, "photo", base64)}
                />
                <div className="flex items-center gap-2 h-9 px-2 pb-1">
                  <input
                    type="checkbox"
                    id={`v-police-${idx}`}
                    checked={victim.isPolice}
                    onChange={e => handleUpdateVictim(idx, "isPolice", e.target.checked)}
                    className="form-checkbox h-4 w-4 text-signal rounded border-border"
                  />
                  <label htmlFor={`v-police-${idx}`} className="text-xs font-semibold text-muted-foreground cursor-pointer select-none">Police Duty? (VictimPolice)</label>
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

        {/* SECTION 4: CASE & OFFENCE DETAILS */}
        <Card className="bg-surface-1 border-border">
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-foreground font-semibold">
                <FileText className="h-4.5 w-4.5 text-signal" /> Section 4: Case & Offence Details (CaseMaster & ActSection)
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-signal/40 text-signal">
                Part 4 of 4
              </Badge>
            </div>
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

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Occurrence Location *</label>
              <Input value={occurrencePlace} onChange={e => setOccurrencePlace(e.target.value)} className="bg-surface-2 border-border" required />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Incident From (IncidentFromDate) *</label>
              <Input type="datetime-local" value={incidentFromDate} onChange={e => setIncidentFromDate(e.target.value)} className="bg-surface-2 border-border" required />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Incident To (IncidentToDate) *</label>
              <Input type="datetime-local" value={incidentToDate} onChange={e => setIncidentToDate(e.target.value)} className="bg-surface-2 border-border" required />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Latitude *</label>
                <Input type="number" step="0.0001" value={lat} onChange={e => setLat(e.target.value)} className="bg-surface-2 border-border" required />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Longitude *</label>
                <Input type="number" step="0.0001" value={lng} onChange={e => setLng(e.target.value)} className="bg-surface-2 border-border" required />
              </div>
            </div>

            {/* Act & Section Association Sub-block */}
            <div className="md:col-span-3 rounded-md bg-surface-2 border border-border/50 p-3.5 space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-signal" /> Act & Section Association (ActSectionAssociation)
              </label>
              <div className="flex items-center gap-3">
                <Input placeholder="Enter legal act/section e.g. BNS 303 / IPC 379" value={newActSection} onChange={e => setNewActSection(e.target.value)} className="bg-paper border-border max-w-sm" />
                <Button type="button" onClick={handleAddActSection} size="sm" className="h-9">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Section
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {actSections.map((sec, idx) => (
                  <Badge key={idx} variant="secondary" className="bg-paper border border-border gap-2 px-3 py-1 text-xs">
                    <span>{sec}</span>
                    <button type="button" onClick={() => handleRemoveActSection(idx)} className="text-signal hover:text-red-700 font-bold">
                      &times;
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Accused & Arrest Record Sub-block */}
            <div className="md:col-span-3 rounded-md bg-surface-2 border border-border/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-signal" /> Accused / Suspect Record (Accused & ArrestSurrender)
                </label>
                <Button type="button" onClick={handleAddAccused} variant="outline" className="h-7 px-2.5 text-[11px]">
                  <Plus className="mr-1 h-3 w-3" /> Add Accused
                </Button>
              </div>
              {accused.map((acc, idx) => (
                <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 items-end p-3 bg-paper border border-border/60 rounded-md">
                  <div className="flex-1 flex flex-col gap-1 min-w-[180px]">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Accused {idx + 1} Name *</label>
                    <Input placeholder="Accused / Suspect Name" value={acc.name} onChange={e => handleUpdateAccused(idx, "name", e.target.value)} className="bg-surface-2 border-border" required />
                  </div>
                  <div className="w-20 flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Age *</label>
                    <Input type="number" value={acc.age} onChange={e => handleUpdateAccused(idx, "age", Number(e.target.value))} className="bg-surface-2 border-border" required />
                  </div>
                  <div className="w-24 flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gender</label>
                    <select value={acc.gender} onChange={e => handleUpdateAccused(idx, "gender", e.target.value)} className="form-select border border-border bg-surface-2 px-2 py-1.5 rounded-md text-sm">
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="T">Transgender</option>
                    </select>
                  </div>
                  <PhotoUploadWidget
                    label="Mugshot"
                    value={acc.photo}
                    onChange={(base64) => handleUpdateAccused(idx, "photo", base64)}
                  />
                  <div className="w-36 flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Arrest Status</label>
                    <select value={acc.arrested ? "1" : "0"} onChange={e => handleUpdateAccused(idx, "arrested", e.target.value === "1")} className="form-select border border-border bg-surface-2 px-2 py-1.5 rounded-md text-xs">
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
              ))}
            </div>

            {/* Brief Facts Text Area */}
            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Brief Facts of the Crime (BriefFacts) *</label>
              <textarea value={briefFacts} onChange={e => setBriefFacts(e.target.value)} rows={4} placeholder="Describe the comprehensive incident narrative as reported..." className="form-textarea border border-border bg-surface-2 px-3 py-2 rounded-md text-sm resize-none focus:outline-none" required />
            </div>

            {/* Structured Crime Number Banner */}
            <div className="md:col-span-3 mt-1 rounded-md bg-signal/5 border border-signal/25 p-3 flex justify-between items-center">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-signal font-semibold">System Generated Structured Crime Number (CrimeNo)</span>
                <p className="font-mono text-base font-bold text-ink tracking-widest">{getCrimeNoPreview()}</p>
              </div>
              <Badge variant="outline" className="border-signal text-signal font-mono text-[10px]">{category}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Submit Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link to="/cases" className="rounded-md border border-ink/20 bg-paper px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2 transition-colors">
            Cancel
          </Link>
          <Button type="submit" size="lg" className="px-7 py-3 text-sm font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Submit FIR & Review Details
          </Button>
        </div>
      </form>

      {/* ==========================================
          INTERACTIVE POLICE FIR DOSSIER REVIEW MODAL
         ========================================== */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-surface-1 border-border">
          <DialogHeader className="border-b border-border/50 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-signal" />
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    OFFICIAL FIR DOSSIER REVIEW · POLICE FORM NO. 1
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Karnataka State Police · Verify all entered details before committing to database
                  </DialogDescription>
                </div>
              </div>
              <Badge className="font-mono text-xs font-bold bg-signal text-signal-foreground px-2.5 py-1">
                {getCrimeNoPreview()}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* DOSSIER SECTION 1: COMPLAINANT */}
            <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-border/40 pb-1.5 font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-signal" /> 1. Complainant Statement
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">ComplainantDetails</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div><span className="text-muted-foreground">Full Name:</span> <p className="font-semibold text-foreground">{complainantName}</p></div>
                <div><span className="text-muted-foreground">Age / Gender:</span> <p className="font-semibold text-foreground">{complainantAge} yrs · {complainantGender}</p></div>
                <div><span className="text-muted-foreground">Contact Phone:</span> <p className="font-semibold text-foreground">{complainantPhone}</p></div>
                <div><span className="text-muted-foreground">Occupation:</span> <p className="font-semibold text-foreground">{complainantOccupation}</p></div>
                <div><span className="text-muted-foreground">Religion / Caste:</span> <p className="font-semibold text-foreground">{complainantReligion} ({complainantCaste})</p></div>
                <div><span className="text-muted-foreground">Relation to Incident:</span> <p className="font-semibold text-foreground">{complainantRelation}</p></div>
                <div className="md:col-span-3"><span className="text-muted-foreground">Address:</span> <p className="font-semibold text-foreground">{complainantAddress}</p></div>
              </div>
            </div>

            {/* DOSSIER SECTION 2: POLICE DETAILS */}
            <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-border/40 pb-1.5 font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-signal" /> 2. Police Unit & Station Authority
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">Unit & Employee</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div><span className="text-muted-foreground">District:</span> <p className="font-semibold text-foreground">{selectedDistrictObj.name}</p></div>
                <div><span className="text-muted-foreground">Police Station:</span> <p className="font-semibold text-foreground">{policeStation}</p></div>
                <div>
                  <span className="text-muted-foreground">Investigating Officer:</span>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground mt-0.5">
                    {officerPhoto ? (
                      <img src={officerPhoto} alt="Officer" className="h-5 w-5 rounded-full object-cover border border-signal/20 shadow-sm shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-border flex items-center justify-center text-[7px] font-bold text-muted-foreground shrink-0">IO</div>
                    )}
                    <span>{registeringOfficer}</span>
                  </div>
                </div>
                <div><span className="text-muted-foreground">Officer Rank:</span> <p className="font-semibold text-foreground">{officerRank}</p></div>
                <div><span className="text-muted-foreground">Hearing Court:</span> <p className="font-semibold text-foreground">{courtName}</p></div>
                <div><span className="text-muted-foreground">Info Received PS:</span> <p className="font-semibold text-foreground">{new Date(infoReceivedPSDate).toLocaleString()}</p></div>
              </div>
            </div>

            {/* DOSSIER SECTION 3: VICTIM DETAILS */}
            <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-border/40 pb-1.5 font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-signal" /> 3. Victim Profile & Injury Record ({victims.length})
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">Victim</span>
              </div>
              <div className="space-y-1.5">
                {victims.map((v, i) => (
                  <div key={i} className="flex justify-between items-center p-2 rounded bg-paper border border-border/40 text-xs">
                    <div className="flex items-center gap-2">
                      {v.photo ? (
                        <img src={v.photo} alt="Victim" className="h-6 w-6 rounded-full object-cover border border-border shrink-0" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-border flex items-center justify-center text-[7px] font-bold text-muted-foreground shrink-0">VIC</div>
                      )}
                      <div>
                        <span className="font-bold text-foreground">Victim #{i + 1}: {v.name}</span>
                        <span className="text-muted-foreground ml-2">({v.age} yrs, {v.gender})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.isPolice && <Badge variant="outline" className="text-[9px] border-signal text-signal">Police Duty</Badge>}
                      <Badge variant="secondary" className="text-[10px]">{v.injuryStatus}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DOSSIER SECTION 4: CASE DETAILS */}
            <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-border/40 pb-1.5 font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-signal" /> 4. Case & Offence Master Record
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">CaseMaster & Acts</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div><span className="text-muted-foreground">Crime Category:</span> <p className="font-semibold text-foreground">{category}</p></div>
                <div><span className="text-muted-foreground">Gravity:</span> <p className="font-semibold text-alert">{gravity}</p></div>
                <div><span className="text-muted-foreground">Major Crime Head:</span> <p className="font-semibold text-foreground">{selectedCrimeHeadObj.name}</p></div>
                <div><span className="text-muted-foreground">Case Status:</span> <p className="font-semibold text-foreground">{status}</p></div>
                <div><span className="text-muted-foreground">Occurrence Location:</span> <p className="font-semibold text-foreground truncate">{occurrencePlace}</p></div>
                <div><span className="text-muted-foreground">Incident Window:</span> <p className="font-semibold text-foreground font-mono">{new Date(incidentFromDate).toLocaleDateString()}</p></div>
                <div className="md:col-span-3">
                  <span className="text-muted-foreground">Associated Acts & Sections:</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {actSections.map((sec, i) => (
                      <Badge key={i} className="bg-primary/10 text-primary border border-primary/30 text-[10px] font-mono">
                        {sec}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <span className="text-muted-foreground">Accused Particulars ({accused.length}):</span>
                  <div className="space-y-1 pt-1">
                    {accused.map((a, i) => (
                      <div key={i} className="text-[11px] font-medium text-foreground bg-paper p-1.5 rounded border border-border/40 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {a.photo ? (
                            <img src={a.photo} alt="Accused" className="h-6 w-6 rounded object-cover border border-border shrink-0" />
                          ) : (
                            <div className="h-6 w-6 rounded bg-border flex items-center justify-center text-[7px] font-bold text-muted-foreground shrink-0">MUG</div>
                          )}
                          <span>Accused #{i + 1}: {a.name} ({a.age} yrs, {a.gender})</span>
                        </div>
                        <Badge variant={a.arrested ? "default" : "outline"} className="text-[9px]">
                          {a.arrested ? `Arrested (${a.arrestDistrict})` : "Wanted / At Large"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-3 pt-1 border-t border-border/30">
                  <span className="text-muted-foreground">Brief Facts Narrative:</span>
                  <p className="font-medium text-foreground bg-paper p-2.5 rounded border border-border/40 mt-1 italic">
                    "{briefFacts}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => setShowReviewModal(false)} className="flex items-center gap-1.5">
              <Edit3 className="h-4 w-4" /> Edit / Modify Details
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="bg-success hover:bg-success/90 text-success-foreground font-bold flex items-center gap-2 px-6"
            >
              {isSubmitting ? (
                <>Saving to Database...</>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Confirm & Register FIR in Database
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
