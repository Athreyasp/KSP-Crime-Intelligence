import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDb } from "@/hooks/use-db";
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
  const { offenders = [], cases: allCases = [] } = useDb();
  const navigate = useNavigate();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

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
  const [compLat, setCompLat] = useState("12.9716");
  const [compLng, setCompLng] = useState("77.5946");
  const compMapContainerRef = useRef<HTMLDivElement | null>(null);
  const compMapRef = useRef<maplibregl.Map | null>(null);
  const compMarkerRef = useRef<maplibregl.Marker | null>(null);

  const occMapContainerRef = useRef<HTMLDivElement | null>(null);
  const occMapRef = useRef<maplibregl.Map | null>(null);
  const occMarkerRef = useRef<maplibregl.Marker | null>(null);

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

  // Geocode Complainant Residential Address
  const geocodeComplainantAddress = async () => {
    if (!complainantAddress) return;
    const query = encodeURIComponent(`${complainantAddress}, Bengaluru, Karnataka, India`);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
        headers: { "User-Agent": "KSP-Crime-Intelligence-Platform/1.0" }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const firstResult = data[0];
          const parsedLat = Number(firstResult.lat);
          const parsedLon = Number(firstResult.lon);
          if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
            const newLat = parsedLat.toFixed(4);
            const newLng = parsedLon.toFixed(4);
            setCompLat(newLat);
            setCompLng(newLng);
            
            // Move map camera and update marker
            if (compMapRef.current) {
              compMapRef.current.panTo([parsedLon, parsedLat]);
            }
            if (compMarkerRef.current) {
              compMarkerRef.current.setLngLat([parsedLon, parsedLat]);
            }
            toast.success("Map centered to address location.");
          }
        } else {
          toast.error("Address location not found on map.");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error fetching map coordinates.");
    }
  };

  // Complainant Address Map Initialization
  useEffect(() => {
    if (step !== 1 || !compMapContainerRef.current) {
      if (compMapRef.current) {
        compMapRef.current.remove();
        compMapRef.current = null;
        compMarkerRef.current = null;
      }
      return;
    }

    if (compMapRef.current) return; // already initialized

    const initialLng = Number(compLng) || 77.5946;
    const initialLat = Number(compLat) || 12.9716;

    const mapStyle = {
      version: 8 as const,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        "osm": {
          "type": "raster" as const,
          "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          "tileSize": 256,
          "attribution": "&copy; OpenStreetMap"
        }
      },
      layers: [
        {
          "id": "osm-tiles",
          "type": "raster" as const,
          "source": "osm",
          "minzoom": 0,
          "maxzoom": 19
        }
      ]
    };

    const map = new maplibregl.Map({
      container: compMapContainerRef.current,
      style: mapStyle,
      center: [initialLng, initialLat],
      zoom: 13,
      attributionControl: false
    });
    compMapRef.current = map;

    // Custom pulsing pin element
    const el = document.createElement("div");
    el.className = "custom-rapido-pin";
    el.innerHTML = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; height: 32px; width: 32px; background: rgba(37, 99, 235, 0.25); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; height: 16px; width: 16px; background: #2563eb; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center;">
          <div style="height: 6px; width: 6px; background: white; border-radius: 50%;"></div>
        </div>
      </div>
    `;

    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([initialLng, initialLat])
      .addTo(map);
    compMarkerRef.current = marker;

    marker.on("dragend", async () => {
      const lngLat = marker.getLngLat();
      const newLat = lngLat.lat.toFixed(4);
      const newLng = lngLat.lng.toFixed(4);
      setCompLat(newLat);
      setCompLng(newLng);

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`, {
          headers: { "User-Agent": "KSP-Crime-Intelligence-Platform/1.0" }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            setComplainantAddress(data.display_name);
            toast.success("Residential Address updated from map pin!");
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    map.on("click", async (e) => {
      const newLat = e.lngLat.lat.toFixed(4);
      const newLng = e.lngLat.lng.toFixed(4);
      setCompLat(newLat);
      setCompLng(newLng);
      marker.setLngLat(e.lngLat);
      map.panTo(e.lngLat);

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`, {
          headers: { "User-Agent": "KSP-Crime-Intelligence-Platform/1.0" }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            setComplainantAddress(data.display_name);
            toast.success("Residential Address updated from map click!");
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      if (compMapRef.current) {
        compMapRef.current.remove();
        compMapRef.current = null;
        compMarkerRef.current = null;
      }
    };
  }, [step]);

  // Occurrence Location Map Initialization
  useEffect(() => {
    if (step !== 3 || !occMapContainerRef.current) {
      if (occMapRef.current) {
        occMapRef.current.remove();
        occMapRef.current = null;
        occMarkerRef.current = null;
      }
      return;
    }

    if (occMapRef.current) return; // already initialized

    const initialLng = Number(lng) || 77.5946;
    const initialLat = Number(lat) || 12.9716;

    const mapStyle = {
      version: 8 as const,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        "osm": {
          "type": "raster" as const,
          "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          "tileSize": 256,
          "attribution": "&copy; OpenStreetMap"
        }
      },
      layers: [
        {
          "id": "osm-tiles",
          "type": "raster" as const,
          "source": "osm",
          "minzoom": 0,
          "maxzoom": 19
        }
      ]
    };

    const map = new maplibregl.Map({
      container: occMapContainerRef.current,
      style: mapStyle,
      center: [initialLng, initialLat],
      zoom: 13,
      attributionControl: false
    });
    occMapRef.current = map;

    // Custom pulsing pin element
    const el = document.createElement("div");
    el.className = "custom-rapido-pin";
    el.innerHTML = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; height: 32px; width: 32px; background: rgba(217, 48, 37, 0.25); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; height: 16px; width: 16px; background: #d93025; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center;">
          <div style="height: 6px; width: 6px; background: white; border-radius: 50%;"></div>
        </div>
      </div>
    `;

    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([initialLng, initialLat])
      .addTo(map);
    occMarkerRef.current = marker;

    marker.on("dragend", async () => {
      const lngLat = marker.getLngLat();
      const newLat = lngLat.lat.toFixed(4);
      const newLng = lngLat.lng.toFixed(4);
      setLat(newLat);
      setLng(newLng);

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`, {
          headers: { "User-Agent": "KSP-Crime-Intelligence-Platform/1.0" }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            setOccurrencePlace(data.display_name);
            toast.success("Occurrence Location updated from map pin!");
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    map.on("click", async (e) => {
      const newLat = e.lngLat.lat.toFixed(4);
      const newLng = e.lngLat.lng.toFixed(4);
      setLat(newLat);
      setLng(newLng);
      marker.setLngLat(e.lngLat);
      map.panTo(e.lngLat);

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`, {
          headers: { "User-Agent": "KSP-Crime-Intelligence-Platform/1.0" }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            setOccurrencePlace(data.display_name);
            toast.success("Occurrence Location updated from map click!");
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      if (occMapRef.current) {
        occMapRef.current.remove();
        occMapRef.current = null;
        occMarkerRef.current = null;
      }
    };
  }, [step]);

  // Update map pin when lat/lng are changed via occurrencePlace geocoding
  useEffect(() => {
    if (occMapRef.current && occMarkerRef.current) {
      const parsedLat = Number(lat);
      const parsedLng = Number(lng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        occMarkerRef.current.setLngLat([parsedLng, parsedLat]);
        occMapRef.current.panTo([parsedLng, parsedLat]);
      }
    }
  }, [lat, lng]);

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

  // Step validation helpers
  const handleNextStep = () => {
    if (step === 1) {
      if (!complainantName.trim()) {
        toast.error("Please enter complainant name in Step 1.");
        return;
      }
      if (!complainantPhone.trim()) {
        toast.error("Please enter complainant contact phone.");
        return;
      }
      if (!complainantAddress.trim()) {
        toast.error("Please enter complainant address.");
        return;
      }
    }
    if (step === 2) {
      if (!policeStation.trim()) {
        toast.error("Please enter police station unit name in Step 2.");
        return;
      }
    }
    if (step === 3) {
      if (!occurrencePlace.trim()) {
        toast.error("Please enter occurrence location in Step 3.");
        return;
      }
      if (!lat.trim() || !lng.trim()) {
        toast.error("Please enter coordinates (Latitude/Longitude) in Step 3.");
        return;
      }
    }
    if (step === 4) {
      if (victims.some(v => !v.name.trim())) {
        toast.error("Please fill in names for all victims in Step 4.");
        return;
      }
      if (accused.some(a => !a.name.trim())) {
        toast.error("Please fill in names for all accused persons in Step 4.");
        return;
      }
    }
    setStep(prev => Math.min(prev + 1, 5));
  };

  const handlePrevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  // Step 1: Open Review Modal Popup on Form Submit
  const handleOpenReviewModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complainantName.trim()) {
      toast.error("Please enter complainant name.");
      setStep(1);
      return;
    }
    if (!policeStation.trim()) {
      toast.error("Please enter police station name.");
      setStep(2);
      return;
    }
    if (!occurrencePlace.trim()) {
      toast.error("Please enter occurrence place.");
      setStep(3);
      return;
    }
    if (victims.some(v => !v.name.trim())) {
      toast.error("Please fill in names for all victims.");
      setStep(4);
      return;
    }
    if (accused.some(a => !a.name.trim())) {
      toast.error("Please fill in names for all accused.");
      setStep(4);
      return;
    }
    if (!briefFacts.trim()) {
      toast.error("Please provide brief facts of the crime in Step 5.");
      setStep(5);
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

      // Toast Notification indicating Data updated across database
      toast.success(`FIR #${crimeNo} Registered Successfully! Database updated.`, {
        duration: 5000,
        description: `Crime Head: ${selectedCrimeHead.name} | Accused: ${accused.map(a => a.name).join(", ") || "Unknown"} | Location: ${occurrencePlace}`,
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
        section="08"
        eyebrow="Karnataka State Police · Record Entry"
        title="New FIR Registration"
        description="Official FIR Form No. 1 entry. Coordinates are synced directly with the Live Crime Hotspots tracking system."
      />

      <div className="rounded-2xl border border-border bg-surface-1 p-5 shadow-sm">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          {[
            { num: 1, label: "Complainant" },
            { num: 2, label: "Police & Station" },
            { num: 3, label: "Acts & Occurrence" },
            { num: 4, label: "Accused & Victims" },
            { num: 5, label: "Facts & Narrative" }
          ].map((s, idx) => {
            const isCompleted = step > s.num;
            const isActive = step === s.num;
            return (
              <div key={s.num} className="flex-1 flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (s.num < step) {
                      setStep(s.num);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 focus:outline-none relative z-10"
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border font-mono text-xs font-bold transition-all duration-200 ${
                    isCompleted
                      ? "bg-success text-success-foreground border-success"
                      : isActive
                        ? "bg-[#2563eb] text-white border-[#2563eb] shadow-sm"
                        : "bg-surface-2 text-muted-foreground border-border"
                  }`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : s.num}
                  </div>
                  <span className={`text-[10px] font-sans font-bold uppercase tracking-wider hidden md:inline transition-colors duration-200 ${
                    isActive ? "text-[#2563eb]" : "text-muted-foreground"
                  }`}>
                    {s.label}
                  </span>
                </button>
                {idx < 4 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-200 ${
                    isCompleted ? "bg-success" : "bg-border"
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleOpenReviewModal} className="space-y-6 pb-12">

        {/* SECTION 1: COMPLAINANT DETAILS */}
        {step === 1 && (
          <Card className="bg-surface-1 border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-foreground font-semibold">
                  <User className="h-4.5 w-4.5 text-signal" /> Section 1: Complainant Details (ComplainantDetails)
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] uppercase border-[#2563eb]/45 text-[#2563eb]">
                  Step 1 of 5
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
                <div className="flex gap-2">
                  <Input 
                    value={complainantAddress} 
                    onChange={e => setComplainantAddress(e.target.value)} 
                    className="bg-surface-2 border-border flex-1 text-sm font-sans" 
                    required 
                  />
                  <Button 
                    type="button" 
                    onClick={geocodeComplainantAddress} 
                    className="bg-slate-900 hover:bg-slate-800 text-white font-mono text-[10px] uppercase tracking-wider font-extrabold px-4 h-10 border-2 border-slate-900 rounded-sm shadow-[2px_2px_0_0_#202124] active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <MapPin className="h-4 w-4 mr-1 shrink-0" /> Locate
                  </Button>
                </div>
              </div>

              {/* Uber / Rapido Style Live Map Selector Widget */}
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-widest text-[#5f6368] font-bold">📍 INTERACTIVE RESIDENTIAL SELECTOR</label>
                <div className="relative border-2 border-slate-900 rounded-sm overflow-hidden h-[240px] shadow-[4px_4px_0_0_#202124]">
                  {/* Floating Coordinates Card */}
                  <div className="absolute top-3 left-3 z-10 bg-white/95 border-2 border-slate-900 px-3 py-1.5 rounded-xs shadow-md font-sans pointer-events-none flex items-center gap-2 max-w-[280px]">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[7.5px] uppercase font-bold tracking-widest text-[#5f6368] leading-none">📍 Pinned Coordinates</p>
                      <p className="text-[10px] font-black text-slate-800 font-mono tracking-wider mt-0.5">{compLat}, {compLng}</p>
                    </div>
                  </div>

                  {/* GPS Locator Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            const newLat = position.coords.latitude.toFixed(4);
                            const newLng = position.coords.longitude.toFixed(4);
                            setCompLat(newLat);
                            setCompLng(newLng);
                            if (compMapRef.current) compMapRef.current.panTo([Number(newLng), Number(newLat)]);
                            if (compMarkerRef.current) compMarkerRef.current.setLngLat([Number(newLng), Number(newLat)]);
                            
                            // Reverse geocode GPS location
                            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`, {
                              headers: { "User-Agent": "KSP-Crime-Intelligence-Platform/1.0" }
                            })
                              .then(res => res.json())
                              .then(data => {
                                if (data && data.display_name) {
                                  setComplainantAddress(data.display_name);
                                  toast.success("Residential Address synced with GPS coordinates!");
                                }
                              });
                          },
                          () => {
                            toast.error("Geolocation request denied or timed out.");
                          }
                        );
                      } else {
                        toast.error("Geolocation not supported by browser.");
                      }
                    }}
                    className="absolute bottom-3 right-3 z-10 bg-white border-2 border-slate-900 p-1.5 rounded-xs shadow-md hover:bg-slate-50 cursor-pointer active:scale-95 transition-all text-xs font-bold leading-none"
                    title="GPS Locate"
                  >
                    🧭 GPS
                  </button>

                  <div ref={compMapContainerRef} className="w-full h-full bg-slate-100" />
                </div>
                <p className="text-[8px] text-[#5f6368] font-bold uppercase tracking-wider italic">
                  * Drag the location pin or double-click the map to auto-update residential address.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Relation to Incident *</label>
                <Input value={complainantRelation} onChange={e => setComplainantRelation(e.target.value)} className="bg-surface-2 border-border" required />
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION 2: POLICE DETAILS */}
        {step === 2 && (
          <Card className="bg-surface-1 border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-foreground font-semibold">
                  <Landmark className="h-4.5 w-4.5 text-signal" /> Section 2: Police Station & Officer Details (Unit & Employee)
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] uppercase border-[#2563eb]/45 text-[#2563eb]">
                  Step 2 of 5
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
        )}

        {/* STEP 3: ACTS & OCCURRENCE */}
        {step === 3 && (
          <Card className="bg-surface-1 border-border animate-fade-in">
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-foreground font-semibold">
                  <FileText className="h-4.5 w-4.5 text-[#2563eb]" /> Section 3: Case & Offence Details (CaseMaster & ActSection)
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] uppercase border-[#2563eb]/45 text-[#2563eb]">
                  Step 3 of 5
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

              {/* Occurrence Location Map Selector */}
              <div className="md:col-span-3 flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-widest text-[#5f6368] font-bold">📍 INTERACTIVE OCCURRENCE SELECTOR (HOTSPOT GEOLOCATION MAP)</label>
                <div className="relative border-2 border-slate-900 rounded-sm overflow-hidden h-[240px] shadow-[4px_4px_0_0_#202124]">
                  {/* Floating Coordinates Card */}
                  <div className="absolute top-3 left-3 z-10 bg-white/95 border-2 border-slate-900 px-3 py-1.5 rounded-xs shadow-md font-sans pointer-events-none flex items-center gap-2 max-w-[280px]">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#d93025] animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[7.5px] uppercase font-bold tracking-widest text-[#5f6368] leading-none">🔴 Incident Hotspot</p>
                      <p className="text-[10px] font-black text-slate-800 font-mono tracking-wider mt-0.5">{lat}, {lng}</p>
                    </div>
                  </div>

                  {/* GPS Locator Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            const newLat = position.coords.latitude.toFixed(4);
                            const newLng = position.coords.longitude.toFixed(4);
                            setLat(newLat);
                            setLng(newLng);
                            if (occMapRef.current) occMapRef.current.panTo([Number(newLng), Number(newLat)]);
                            if (occMarkerRef.current) occMarkerRef.current.setLngLat([Number(newLng), Number(newLat)]);
                            
                            // Reverse geocode GPS location
                            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`, {
                              headers: { "User-Agent": "KSP-Crime-Intelligence-Platform/1.0" }
                            })
                              .then(res => res.json())
                              .then(data => {
                                if (data && data.display_name) {
                                  setOccurrencePlace(data.display_name);
                                  toast.success("Occurrence Location synced with GPS!");
                                }
                              });
                          },
                          () => {
                            toast.error("Geolocation request denied or timed out.");
                          }
                        );
                      } else {
                        toast.error("Geolocation not supported by browser.");
                      }
                    }}
                    className="absolute bottom-3 right-3 z-10 bg-white border-2 border-slate-900 p-1.5 rounded-xs shadow-md hover:bg-slate-50 cursor-pointer active:scale-95 transition-all text-xs font-bold leading-none"
                    title="GPS Locate"
                  >
                    🧭 GPS
                  </button>

                  <div ref={occMapContainerRef} className="w-full h-full bg-slate-100" />
                </div>
                <p className="text-[8px] text-[#5f6368] font-bold uppercase tracking-wider italic">
                  * Drag this pin or double-click to set the exact crime scene location. It will automatically pinpoint on the Hotspots maps once submitted!
                </p>
              </div>

              {/* Act & Section Association Sub-block */}
              <div className="md:col-span-3 rounded-md bg-surface-2 border border-border/50 p-3.5 space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-[#2563eb]" /> Act & Section Association (ActSectionAssociation)
                </label>
                <div className="flex items-center gap-3">
                  <Input placeholder="Enter legal act/section e.g. BNS 303 / IPC 379" value={newActSection} onChange={e => setNewActSection(e.target.value)} className="bg-paper border-border max-w-sm" />
                  <Button type="button" onClick={handleAddActSection} size="sm" className="h-9 bg-[#2563eb] text-white hover:bg-[#1d4ed8]">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Section
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {actSections.map((sec, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-paper border border-border gap-2 px-3 py-1 text-xs">
                      <span>{sec}</span>
                      <button type="button" onClick={() => handleRemoveActSection(idx)} className="text-red-500 hover:text-red-700 font-bold">
                        &times;
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: ACCUSED & VICTIMS */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            {/* SECTION A: VICTIM DETAILS */}
            <Card className="bg-surface-1 border-border">
              <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-[#2563eb]" />
                  <CardTitle className="text-base font-semibold text-foreground">Section 4A: Victim Details (Victim)</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] uppercase border-[#2563eb]/45 text-[#2563eb]">
                    Step 4 of 5
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

            {/* SECTION B: ACCUSED DETAILS */}
            <Card className="bg-surface-1 border-border">
              <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 text-[#2563eb]" />
                  <CardTitle className="text-base font-semibold text-foreground">Section 4B: Accused / Suspect Record (Accused & ArrestSurrender)</CardTitle>
                </div>
                <Button type="button" onClick={handleAddAccused} variant="outline" className="h-7 px-2.5 text-[11px]">
                  <Plus className="mr-1 h-3 w-3" /> Add Accused
                </Button>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {accused.map((acc, idx) => (
                  <div key={idx} className="space-y-3.5 border-b border-border/40 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex flex-wrap md:flex-nowrap gap-3 items-end p-3.5 bg-surface-2 border border-border/50 rounded-md">
                      <div className="flex-1 flex flex-col gap-1 min-w-[180px]">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Accused {idx + 1} Name *</label>
                        <Input placeholder="Accused / Suspect Name" value={acc.name} onChange={e => handleUpdateAccused(idx, "name", e.target.value)} className="bg-paper border-border" required />
                      </div>
                      <div className="w-20 flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Age *</label>
                        <Input type="number" value={acc.age} onChange={e => handleUpdateAccused(idx, "age", Number(e.target.value))} className="bg-paper border-border" required />
                      </div>
                      <div className="w-24 flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gender</label>
                        <select value={acc.gender} onChange={e => handleUpdateAccused(idx, "gender", e.target.value)} className="form-select border border-border bg-paper px-2.5 py-1.5 rounded-md text-sm">
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
                        <select value={acc.arrested ? "1" : "0"} onChange={e => handleUpdateAccused(idx, "arrested", e.target.value === "1")} className="form-select border border-border bg-paper px-2 py-1.5 rounded-md text-xs">
                          <option value="0">Wanted / At Large</option>
                          <option value="1">Arrested / In Custody</option>
                        </select>
                      </div>
                      {accused.length > 1 && (
                        <Button type="button" onClick={() => handleRemoveAccused(idx)} variant="destructive" className="h-9 px-3 shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Behavioral DNA preview if offender is found in the database */}
                    {(() => {
                      const offenderMatch = offenders.find(o => o.name.toLowerCase() === acc.name.toLowerCase());
                      if (!offenderMatch) return null;
                      
                      const associatesCount = allCases.filter(c => c.accused.some(a => a.name.toLowerCase().includes(acc.name.toLowerCase()))).length;
                      const mobility = Math.min(100, (offenderMatch.jurisdictions?.length || 1) * 33);
                      
                      return (
                        <div className="w-full mt-2 p-4 bg-emerald-50/60 border-2 border-emerald-300 rounded-xl space-y-3.5 animate-in slide-in-from-top-2 duration-200 font-sans text-ink">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span className="text-[9.5px] font-black text-emerald-800 uppercase tracking-widest font-mono">REPEAT CRIMINAL PROFILE MATCHED (BEHAVIORAL DNA)</span>
                            </div>
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-sm border border-emerald-800 shadow-[1px_1px_0_0_#065f46]">
                              PROFILE SYNCED
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* DNA Stats */}
                            <div className="space-y-2">
                              <p className="text-[8.5px] uppercase tracking-wider text-emerald-800/80 font-extrabold font-mono">BEHAVIORAL DNA SCORECARD</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-1 font-sans">
                                {[
                                  { label: "Mobility Range", score: Math.max(25, mobility) },
                                  { label: "Violence Severity", score: offenderMatch.riskScore > 75 ? 85 : 45 },
                                  { label: "Property Crime Focus", score: 80 },
                                  { label: "Night Operations", score: 85 },
                                  { label: "Syndicate Links", score: Math.min(100, associatesCount * 25) },
                                  { label: "MO Consistency", score: 90 },
                                ].map(m => (
                                  <div key={m.label} className="space-y-1">
                                    <div className="flex justify-between text-[9.5px] font-bold text-slate-700 leading-none">
                                      <span>{m.label}</span>
                                      <span>{m.score}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden border border-slate-300/35">
                                      <div 
                                        className="h-full bg-emerald-600 rounded-full transition-all duration-700" 
                                        style={{ width: `${m.score}%` }} 
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Threat watches */}
                            <div className="p-3 bg-white/70 border-2 border-emerald-300 rounded-lg flex flex-col justify-between shadow-sm">
                              <div>
                                <p className="text-[8px] uppercase tracking-widest text-[#5f6368] font-bold">Predictive Recidivism Forecast</p>
                                <div className="flex items-baseline gap-1.5 mt-1">
                                  <span className="text-xs font-black text-[#d93025] uppercase tracking-wider font-mono">
                                    {offenderMatch.riskScore > 75 ? "CRITICAL WATCH" : "HIGH THREAT"}
                                  </span>
                                  <span className="text-[9.5px] text-slate-500 font-bold font-mono">({offenderMatch.riskScore}% Probability)</span>
                                </div>
                                <p className="text-[10px] text-slate-700 leading-relaxed mt-1.5 font-medium">
                                  Suspect has logged repeat property offences in {offenderMatch.jurisdictions?.join(", ") || "Bengaluru East"}. Aligned Modus Operandi matches historical night burglaries.
                                </p>
                              </div>
                              <div className="mt-2.5 pt-2 border-t border-emerald-100 flex items-center justify-between text-[8px] font-mono text-emerald-800/80 font-bold leading-none">
                                <span>🧬 dossier ID: KSP-OFF-{offenderMatch.id}</span>
                                <span>PROFILE AUTO-POPULATED</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 5: FACTS & NARRATIVE */}
        {step === 5 && (
          <Card className="bg-surface-1 border-border animate-fade-in">
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-foreground font-semibold">
                  <FileText className="h-4.5 w-4.5 text-[#2563eb]" /> Section 5: Brief Facts & Generated Details
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] uppercase border-[#2563eb]/45 text-[#2563eb]">
                  Step 5 of 5
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Brief Facts Text Area */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Brief Facts of the Crime (BriefFacts) *</label>
                <textarea value={briefFacts} onChange={e => setBriefFacts(e.target.value)} rows={6} placeholder="Describe the comprehensive incident narrative as reported..." className="form-textarea border border-border bg-surface-2 px-3 py-2 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2563eb] w-full" required />
              </div>

              {/* Structured Crime Number Banner */}
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 flex justify-between items-center shadow-sm">
                <div>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-700 font-semibold">System Generated Structured Crime Number (CrimeNo)</span>
                  <p className="font-mono text-base font-bold text-emerald-900 tracking-widest mt-0.5">{getCrimeNoPreview()}</p>
                </div>
                <Badge className="bg-emerald-600 text-white font-mono text-[10px] uppercase hover:bg-emerald-700">{category}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stepper Navigation Actions Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            {step > 1 && (
              <Button type="button" onClick={handlePrevStep} variant="outline" className="px-5">
                &larr; Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Link to="/cases" className="rounded-md border border-ink/20 bg-paper px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2 transition-colors">
              Cancel
            </Link>
            {step < 5 ? (
              <Button type="button" onClick={handleNextStep} className="px-7 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold flex items-center gap-1.5">
                Continue Step {step + 1} &rarr;
              </Button>
            ) : (
              <Button type="submit" size="lg" className="px-7 py-3 text-sm font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Submit FIR & Review Details
              </Button>
            )}
          </div>
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
