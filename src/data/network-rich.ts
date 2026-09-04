// Enriched network graph derived from OFFENDERS + CASES for the Association Atlas.
import { OFFENDERS, CASES } from "./mock";

export type EntityType = "accused" | "victim" | "case" | "location" | "vehicle" | "phone";
export type RelationType =
  | "co-accused" | "victim-of" | "occurred-at" | "called" | "drove" | "resides-at";

export type TravelCheckpoint = {
  checkpointId: string;
  locationName: string;
  district: string;
  timestamp: string;
  speedKmph: number;
  cameraType: "ANPR Camera" | "Toll Plaza CCTV" | "Traffic Checkpost" | "Highway Speed Trap";
  anprConfidence: number;
  imageSnapshot: string;
  occupantsDetected?: string[];
  flagStatus: "Normal" | "Suspicious" | "Hotlisted Vehicle" | "Stolen Alert";
  coords: { lat: number; lng: number };
};

export type CallLogEntry = {
  callId: string;
  timestamp: string;
  type: "Incoming" | "Outgoing" | "Missed" | "Encrypted VOIP" | "SMS";
  otherPartyNumber: string;
  otherPartyName: string;
  durationSeconds: number;
  towerId: string;
  towerLocation: string;
  district: string;
  imei: string;
  callStatus: "Completed" | "Intercept Flagged" | "Dropped" | "Short Burst";
  coords: { lat: number; lng: number };
};

export type RichNode = {
  id: string;
  label: string;
  type: EntityType;
  cluster: string;
  meta: {
    photo?: string;
    caseMasterId?: number;
    crimeNo?: string;
    briefFacts?: string;
    aliases?: string[];
    age?: number;
    district?: string;
    firstSeen?: string;
    lastSeen?: string;
    activeFIRs?: number;
    riskScore?: number;
    moTags?: string[];
    predictedNext?: { crime: string; probability: number; window: string };
    plate?: string;
    number?: string;
    travelHistory?: TravelCheckpoint[];
    vehicleDetails?: {
      makeModel: string;
      category?: string;
      color: string;
      ownerName: string;
      regDate: string;
      status: string;
    };
    callLogs?: CallLogEntry[];
    phoneDetails?: {
      subscriberName: string;
      operator: string;
      circle: string;
      imei: string;
      status: string;
    };
  };
};

export type RichEdge = {
  source: string;
  target: string;
  relation: RelationType;
  weight: number;
};

const RELATION_COLORS: Record<RelationType, string> = {
  "co-accused":   "var(--signal)",
  "victim-of":    "var(--amber-ink)",
  "occurred-at":  "var(--info)",
  "called":       "#0284c7",
  "drove":        "oklch(0.55 0.14 155)",
  "resides-at":   "oklch(0.45 0.03 250)",
};

export const relationColor = (r: RelationType) => RELATION_COLORS[r];

export const VEHICLE_PLATES = ["KA-01-MP-4421", "KA-05-MJ-9013", "KA-19-BZ-7702", "KA-09-AP-3388", "KA-51-KL-1147", "KA-25-RB-5560"];
export const PHONE_NUMBERS  = [
  "+91 98450 67132",
  "+91 96632 89108",
  "+91 90080 43217",
  "+91 99011 54294",
  "+91 88677 21045",
  "+91 94481 33901",
  "+91 97412 88204",
  "+91 98805 11923"
];

export function getFormatted10DigitPhone(index: number = 0, inputPhone?: string): string {
  let clean = (inputPhone || "").replace(/[^0-9]/g, "");
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  if (clean.length === 12 && clean.startsWith("91")) {
    const p10 = clean.slice(2);
    return `+91 ${p10.slice(0, 5)} ${p10.slice(5)}`;
  }
  const bases = [
    "98450 67132", "96632 89108", "90080 43217", "99011 54294", "88677 21045",
    "94481 33901", "97412 88204", "98805 11923", "91482 76540", "96861 44521"
  ];
  return `+91 ${bases[Math.abs(index) % bases.length]}`;
}

export function createCallLogs(phoneNumber: string, district?: string, ownerName?: string): CallLogEntry[] {
  const cleanPhone = getFormatted10DigitPhone(0, phoneNumber);
  const hash = cleanPhone.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dateToday = new Date().toISOString().slice(0, 10);

  const contacts = [
    { name: ownerName ? `${ownerName} (Self SIM)` : "Target Suspect", num: cleanPhone },
    { name: "Suresh Gowda (Co-Accused)", num: "+91 98450 67132" },
    { name: "Priya Shetty (Associate)", num: "+91 96632 89108" },
    { name: "Encrypted VoIP Handler", num: "+91 90080 43217" },
    { name: "Unknown Intercept #4", num: "+91 99011 54294" },
    { name: "Karthik Hegde (Receiver)", num: "+91 88677 21045" },
  ];

  const towers = [
    { id: "KGI-BLR-CELL#402", loc: "M.G. Road Tower 4", dist: district || "Bengaluru Urban", lat: 12.9716, lng: 77.5946 },
    { id: "ELE-BLR-CELL#109", loc: "Electronic City Phase 1 Tower", dist: "Bengaluru Urban", lat: 12.8452, lng: 77.6602 },
    { id: "ATT-BLR-CELL#088", loc: "Attibele Border Checkpost Tower", dist: "Bengaluru Urban", lat: 12.7784, lng: 77.7712 },
    { id: "MYS-ORR-CELL#312", loc: "Mysuru ORR Outer Ring Junction", dist: "Mysuru", lat: 12.2958, lng: 76.6394 },
    { id: "HUB-MAIN-CELL#501", loc: "Hubballi Railway Station Tower", dist: "Dharwad", lat: 15.3647, lng: 75.1240 },
  ];

  const imei = `86490204${String(1000000 + (hash * 13 % 8999999))}`;

  return [
    {
      callId: `CDR-${hash}-01`,
      timestamp: `${dateToday} 08:14:10 IST`,
      type: "Outgoing",
      otherPartyNumber: contacts[1].num,
      otherPartyName: contacts[1].name,
      durationSeconds: 245,
      towerId: towers[0].id,
      towerLocation: towers[0].loc,
      district: towers[0].dist,
      imei,
      callStatus: "Completed",
      coords: { lat: towers[0].lat, lng: towers[0].lng }
    },
    {
      callId: `CDR-${hash}-02`,
      timestamp: `${dateToday} 09:32:45 IST`,
      type: "Incoming",
      otherPartyNumber: contacts[2].num,
      otherPartyName: contacts[2].name,
      durationSeconds: 112,
      towerId: towers[1].id,
      towerLocation: towers[1].loc,
      district: towers[1].dist,
      imei,
      callStatus: "Completed",
      coords: { lat: towers[1].lat, lng: towers[1].lng }
    },
    {
      callId: `CDR-${hash}-03`,
      timestamp: `${dateToday} 11:05:02 IST`,
      type: "Encrypted VOIP",
      otherPartyNumber: contacts[3].num,
      otherPartyName: contacts[3].name,
      durationSeconds: 480,
      towerId: towers[2].id,
      towerLocation: towers[2].loc,
      district: towers[2].dist,
      imei,
      callStatus: "Intercept Flagged",
      coords: { lat: towers[2].lat, lng: towers[2].lng }
    },
    {
      callId: `CDR-${hash}-04`,
      timestamp: `${dateToday} 13:40:18 IST`,
      type: "Missed",
      otherPartyNumber: contacts[4].num,
      otherPartyName: contacts[4].name,
      durationSeconds: 0,
      towerId: towers[3].id,
      towerLocation: towers[3].loc,
      district: towers[3].dist,
      imei,
      callStatus: "Dropped",
      coords: { lat: towers[3].lat, lng: towers[3].lng }
    },
    {
      callId: `CDR-${hash}-05`,
      timestamp: `${dateToday} 16:12:50 IST`,
      type: "Outgoing",
      otherPartyNumber: contacts[5].num,
      otherPartyName: contacts[5].name,
      durationSeconds: 18,
      towerId: towers[4].id,
      towerLocation: towers[4].loc,
      district: towers[4].dist,
      imei,
      callStatus: "Short Burst",
      coords: { lat: towers[4].lat, lng: towers[4].lng }
    },
    {
      callId: `CDR-${hash}-06`,
      timestamp: `${dateToday} 18:25:00 IST`,
      type: "SMS",
      otherPartyNumber: contacts[1].num,
      otherPartyName: contacts[1].name,
      durationSeconds: 0,
      towerId: towers[0].id,
      towerLocation: towers[0].loc,
      district: towers[0].dist,
      imei,
      callStatus: "Intercept Flagged",
      coords: { lat: towers[0].lat, lng: towers[0].lng }
    }
  ];
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","),
    ...rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const DEFAULT_MALE_ACCUSED_PHOTOS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80"
];

export const DEFAULT_FEMALE_ACCUSED_PHOTOS = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80"
];

export function isFemaleName(name: string, gender?: string): boolean {
  if (gender === "F" || gender === "f" || gender === "Female" || gender === "female") return true;
  if (gender === "M" || gender === "m" || gender === "Male" || gender === "male") return false;

  const lower = (name || "").toLowerCase().trim();
  const femaleKeywords = [
    "kavitha", "priya", "lakshmi", "sunitha", "pooja", "anitha", "rekha", "divya",
    "swapna", "sneha", "deepa", "swati", "savitha", "radha", "shanthi", "meena",
    "saroj", "geeta", "leela", "shoba", "suman", "renuka", "bhagya", "latha",
    "parvathi", "saraswathi", "sudha", "asha", "usha", "female", "devi", "kumari",
    "begum", "fathima", "ayesha", "mary", "anita", "roopa", "rupa", "shanthala",
    "shubha", "bhavana", "ramya", "vidya", "archana", "keerthi", "nisha", "preeti",
    "varsha", "anusha", "monika", "shruthi", "swetha", "soundarya", "nayana", "bhavya"
  ];

  if (femaleKeywords.some(k => lower.includes(k))) return true;
  if (lower.endsWith("amma") || lower.endsWith("akka") || lower.endsWith("devi") || lower.endsWith("kumari")) return true;

  return false;
}

export function getAccusedPhoto(name: string, gender?: string, index: number = 0, explicitPhoto?: string): string {
  if (explicitPhoto && explicitPhoto.trim()) return explicitPhoto;
  const female = isFemaleName(name, gender);
  const pool = female ? DEFAULT_FEMALE_ACCUSED_PHOTOS : DEFAULT_MALE_ACCUSED_PHOTOS;
  return pool[Math.abs(index) % pool.length];
}

export const VICTIM_PHOTOS = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80"
];

export const VEHICLE_PHOTOS = [
  "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&auto=format&fit=crop&q=80"
];

export const VEHICLE_SPECS = [
  { makeModel: "Mahindra Scorpio-N Black Edition", color: "Midnight Black", status: "Hotlisted - ANPR Active" },
  { makeModel: "Bajaj Pulsar 220F Sport Bike", color: "Racing Red", status: "Flagged in 3 Crime Scenes" },
  { makeModel: "Hyundai Creta SX (O) Diesel", color: "Polar White", status: "Under Surveillance" },
  { makeModel: "Toyota Fortuner 4x4 Automatic", color: "Super White", status: "Hotlisted - Suspect Transport" },
  { makeModel: "Maruti Suzuki Swift ZXi", color: "Magma Grey", status: "Impound Order Active" }
];

export const BIKE_CATALOG = [
  {
    makeModel: "Bajaj Pulsar NS200 ABS",
    category: "Motorcycle",
    color: "Racing Red / Gloss White",
    status: "Chain Snatching Getaway Bike",
    photo: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-05-BK"
  },
  {
    makeModel: "Royal Enfield Classic 350",
    category: "Motorcycle",
    color: "Stealth Black",
    status: "Suspect Escape Vehicle",
    photo: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-09-RE"
  },
  {
    makeModel: "TVS Apache RTR 200 4V",
    category: "Motorcycle",
    color: "Matte Black / Red Lines",
    status: "High-Speed Snatching Bike",
    photo: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-19-MC"
  },
  {
    makeModel: "Yamaha R15 V4 Superbike",
    category: "Motorcycle",
    color: "Racing Blue",
    status: "Flagged in Street Robbery",
    photo: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-25-RB"
  },
  {
    makeModel: "Honda Activa 6G Scooter",
    category: "Scooter",
    color: "Pearl Precious White",
    status: "Local NDPS Peddling Scooter",
    photo: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-12-AC"
  },
  {
    makeModel: "KTM Duke 390 ABS",
    category: "Motorcycle",
    color: "Electric Orange",
    status: "Stolen Two-Wheeler Alert",
    photo: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-51-DK"
  }
];

export const CAR_CATALOG = [
  {
    makeModel: "Mahindra Scorpio-N Z8L 4x4",
    category: "SUV",
    color: "Midnight Black",
    status: "Hotlisted - Gang Transport",
    photo: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-01-MP"
  },
  {
    makeModel: "Toyota Fortuner Legender 4x4",
    category: "SUV",
    color: "Super White / Black Roof",
    status: "Inter-State Smuggling Vehicle",
    photo: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-51-KL"
  },
  {
    makeModel: "Hyundai Creta SX (O) Diesel",
    category: "SUV",
    color: "Polar White",
    status: "Under Police Surveillance",
    photo: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-19-BZ"
  },
  {
    makeModel: "Tata Harrier Dark Edition",
    category: "SUV",
    color: "Atlas Black",
    status: "Flagged in Dacoity Crime",
    photo: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-53-SK"
  },
  {
    makeModel: "Honda City e:HEV Hybrid",
    category: "Sedan",
    color: "Platinum White Pearl",
    status: "Cyber Crime Money Transport",
    photo: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-04-HC"
  },
  {
    makeModel: "Maruti Suzuki Swift ZXi+",
    category: "Hatchback",
    color: "Solid Fire Red",
    status: "Impound Warrant Active",
    photo: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-41-SW"
  },
  {
    makeModel: "Mahindra Thar 4WD Convertible",
    category: "SUV",
    color: "Napoli Black",
    status: "Hotlisted - Illegal Sand Raid",
    photo: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&auto=format&fit=crop&q=80",
    prefix: "KA-20-TH"
  }
];

export function isTwoWheelerCrime(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("snatch") ||
    lower.includes("chain") ||
    lower.includes("bike") ||
    lower.includes("two wheeler") ||
    lower.includes("scooter") ||
    lower.includes("peddl") ||
    lower.includes("ndps") ||
    lower.includes("pocket") ||
    lower.includes("mobile theft")
  );
}

export function getUniqueVehicleDetails(index: number, inputPlate?: string, ownerName?: string, moTagOrCrime?: string) {
  const isBike = isTwoWheelerCrime(moTagOrCrime);
  const catalog = isBike ? BIKE_CATALOG : CAR_CATALOG;
  const item = catalog[index % catalog.length];
  
  let plate = inputPlate?.trim();
  if (!plate || plate === "KA-01-XX-4421" || plate.length < 8) {
    const rtoCodes = ["KA-01", "KA-02", "KA-03", "KA-04", "KA-05", "KA-09", "KA-19", "KA-25", "KA-51", "KA-53", "KA-12", "KA-14", "KA-20", "KA-32"];
    const rto = rtoCodes[index % rtoCodes.length];
    const letters = isBike ? ["BK", "MC", "RE", "RB", "DK", "AC", "SK"] : ["MP", "AB", "BZ", "CD", "EF", "GH", "JK", "LM", "PR", "RS", "VT", "WX"];
    const series = letters[index % letters.length];
    const num = String(1000 + ((index * 739 + 421) % 8999)).padStart(4, "0");
    plate = `${rto}-${series}-${num}`;
  }

  return {
    plate,
    photo: item.photo,
    vehicleDetails: {
      makeModel: item.makeModel,
      category: item.category,
      color: item.color,
      ownerName: ownerName || "Registered Driver",
      regDate: `${(index % 28) + 1} ${(index % 2 === 0 ? "Mar" : "Nov")} ${2020 + (index % 4)}`,
      status: item.status
    }
  };
}

export function createTravelHistory(plate: string, district: string, offName?: string, customVehPhoto?: string): TravelCheckpoint[] {
  const cleanPlate = plate || "KA-01-XX-4421";
  const baseLat = 12.9716;
  const baseLng = 77.5946;
  const dateToday = new Date().toISOString().slice(0, 10);
  
  const hash = cleanPlate.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const p1 = customVehPhoto || VEHICLE_PHOTOS[hash % VEHICLE_PHOTOS.length];
  const p2 = customVehPhoto || VEHICLE_PHOTOS[(hash + 1) % VEHICLE_PHOTOS.length];
  const p3 = customVehPhoto || VEHICLE_PHOTOS[(hash + 2) % VEHICLE_PHOTOS.length];
  const p4 = customVehPhoto || VEHICLE_PHOTOS[(hash + 3) % VEHICLE_PHOTOS.length];

  const plateId = cleanPlate.replace(/[^A-Z0-9]/g, "");

  return [
    {
      checkpointId: `ANPR-${plateId}-01`,
      locationName: `Silk Board Junction Flyover ANPR #3`,
      district: district || "Bengaluru Urban",
      timestamp: `${dateToday} 07:15:22 IST`,
      speedKmph: 68 + (hash % 12),
      cameraType: "ANPR Camera",
      anprConfidence: 99.4,
      imageSnapshot: p1,
      occupantsDetected: offName ? [offName, "Unidentified Associate"] : ["Known Driver"],
      flagStatus: "Suspicious",
      coords: { lat: baseLat + 0.02, lng: baseLng - 0.01 }
    },
    {
      checkpointId: `ANPR-${plateId}-02`,
      locationName: `Electronic City Toll Plaza Gate 4`,
      district: "Bengaluru Urban",
      timestamp: `${dateToday} 08:42:10 IST`,
      speedKmph: 82 + (hash % 10),
      cameraType: "Toll Plaza CCTV",
      anprConfidence: 98.8,
      imageSnapshot: p2,
      occupantsDetected: offName ? [offName] : ["Driver Only"],
      flagStatus: "Hotlisted Vehicle",
      coords: { lat: baseLat - 0.05, lng: baseLng + 0.03 }
    },
    {
      checkpointId: `ANPR-${plateId}-03`,
      locationName: `Attibele Karnataka-TN Border Checkpost`,
      district: "Bengaluru Urban",
      timestamp: `${dateToday} 11:10:05 IST`,
      speedKmph: 72 + (hash % 8),
      cameraType: "Traffic Checkpost",
      anprConfidence: 99.1,
      imageSnapshot: p3,
      occupantsDetected: offName ? [offName, "Co-Accused associate"] : ["2 Occupants"],
      flagStatus: "Hotlisted Vehicle",
      coords: { lat: baseLat - 0.12, lng: baseLng + 0.08 }
    },
    {
      checkpointId: `ANPR-${plateId}-04`,
      locationName: `Mandya Expressway Highway Speed Camera #12`,
      district: "Mandya",
      timestamp: `${dateToday} 14:05:40 IST`,
      speedKmph: 90 + (hash % 15),
      cameraType: "Highway Speed Trap",
      anprConfidence: 97.6,
      imageSnapshot: p4,
      occupantsDetected: ["Driver Only"],
      flagStatus: "Hotlisted Vehicle",
      coords: { lat: 12.5218, lng: 76.8951 }
    },
    {
      checkpointId: `ANPR-${plateId}-05`,
      locationName: `Mysuru Outer Ring Road Junction Checkpoint`,
      district: "Mysuru",
      timestamp: `${dateToday} 16:30:18 IST`,
      speedKmph: 48 + (hash % 10),
      cameraType: "ANPR Camera",
      anprConfidence: 99.7,
      imageSnapshot: p1,
      occupantsDetected: offName ? [offName, "2 Gang Members"] : ["3 Occupants"],
      flagStatus: "Hotlisted Vehicle",
      coords: { lat: 12.2958, lng: 76.6394 }
    }
  ];
}
const PREDICT_POOL = [
  { crime: "Chain Snatching", window: "0–14d" },
  { crime: "Vehicle Theft",   window: "0–21d" },
  { crime: "OTP Fraud",       window: "0–7d" },
  { crime: "House Break-in",  window: "0–30d" },
  { crime: "NDPS Peddling",   window: "0–14d" },
];

function seeded(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export const NETWORK_RICH: { nodes: RichNode[]; edges: RichEdge[]; clusters: { id: string; label: string; kind: "organised" | "recurring-mo" | "geo-ring" }[] } = (() => {
  const r = seeded(11);
  const nodes: RichNode[] = [];
  const edges: RichEdge[] = [];
  const seen = new Set<string>();
  const add = (n: RichNode) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); } };

  const clusters = [
    { id: "A-04", label: "Bengaluru Snatching Ring", kind: "organised" as const },
    { id: "A-07", label: "Mysuru Chain-Snatch MO",   kind: "recurring-mo" as const },
    { id: "A-11", label: "Hubballi Cyber Cell",      kind: "organised" as const },
    { id: "A-13", label: "Ballari Vehicle Ring",     kind: "geo-ring" as const },
  ];

  const centers = OFFENDERS.slice(0, 12);
  centers.forEach((off, i) => {
    const cluster = clusters[i % clusters.length].id;
    const off_cases = off.cases.slice(0, 3);
    const districts = new Set<string>();
    const dates: number[] = [];

    off_cases.forEach(caseId => {
      const kase = CASES.find(c => c.caseMasterId === caseId);
      if (!kase) return;
      districts.add(kase.district.name);
      dates.push(new Date(kase.registeredDate).getTime());

      const cid = `C-${caseId}`;
      add({
        id: cid, label: `FIR ${kase.crimeNo.slice(-6)}`, type: "case", cluster,
        meta: { district: kase.district.name, firstSeen: kase.registeredDate.slice(0, 10) },
      });
      edges.push({ source: off.id, target: cid, relation: "co-accused", weight: 2 });

      const lid = `L-${kase.district.id}`;
      add({ id: lid, label: kase.district.name, type: "location", cluster, meta: { district: kase.district.name } });
      edges.push({ source: cid, target: lid, relation: "occurred-at", weight: 1 });

      const victim = kase.victims[0];
      const vid = `V-${caseId}`;
      const victimPhoto = victim.photo || VICTIM_PHOTOS[(caseId + i) % VICTIM_PHOTOS.length];
      add({
        id: vid, label: victim.name, type: "victim", cluster,
        meta: { age: victim.age, district: kase.district.name, photo: victimPhoto },
      });
      edges.push({ source: vid, target: cid, relation: "victim-of", weight: 1 });
    });

    // vehicle + phone for some offenders
    if (i % 2 === 0) {
      const veh = `VEH-${off.id}`;
      const primaryMo = off.moTags?.[0] || "General Crime";
      const vehInfo = getUniqueVehicleDetails(i, undefined, `${off.name} (Alias Reg)`, primaryMo);
      const travelHistory = createTravelHistory(vehInfo.plate, Array.from(districts)[0] || "Bengaluru Urban", off.name, vehInfo.photo);
      add({
        id: veh,
        label: vehInfo.plate,
        type: "vehicle",
        cluster,
        meta: {
          plate: vehInfo.plate,
          district: Array.from(districts)[0] || "Bengaluru Urban",
          photo: vehInfo.photo,
          vehicleDetails: vehInfo.vehicleDetails,
          travelHistory
        }
      });
      edges.push({ source: off.id, target: veh, relation: "drove", weight: 1.5 });
    }
    if (i % 3 === 0) {
      const ph = `PH-${off.id}`;
      const phoneNum = getFormatted10DigitPhone(i);
      const callLogs = createCallLogs(phoneNum, Array.from(districts)[0] || "Bengaluru Urban", off.name);
      add({
        id: ph,
        label: phoneNum,
        type: "phone",
        cluster,
        meta: {
          number: phoneNum,
          district: Array.from(districts)[0] || "Bengaluru Urban",
          callLogs,
          phoneDetails: {
            subscriberName: off.name,
            operator: i % 2 === 0 ? "Airtel Karnataka" : "Jio Digital KA",
            circle: "Karnataka - BLR Hub",
            imei: `86490204${String(1000000 + (i * 71329 % 8999999))}`,
            status: "Active Intercept"
          }
        }
      });
      edges.push({ source: off.id, target: ph, relation: "called", weight: 1 });
    }

    dates.sort((a, b) => a - b);
    const pred = PREDICT_POOL[i % PREDICT_POOL.length];
    add({
      id: off.id,
      label: off.name,
      type: "accused",
      cluster,
      meta: {
        photo: getAccusedPhoto(off.name, off.gender, i, off.photo),
        aliases: [`"${off.name.split(" ")[0]} alias"`],
        age: off.age,
        district: Array.from(districts)[0],
        firstSeen: dates[0] ? new Date(dates[0]).toISOString().slice(0, 10) : undefined,
        lastSeen: dates.at(-1) ? new Date(dates.at(-1)!).toISOString().slice(0, 10) : undefined,
        activeFIRs: off_cases.length,
        riskScore: off.riskScore,
        moTags: off.moTags,
        predictedNext: {
          crime: pred.crime,
          probability: Math.min(94, off.riskScore + Math.round(r() * 10)),
          window: pred.window,
        },
      },
    });
  });

  // co-accused edges between offenders in same cluster
  const byCluster = new Map<string, string[]>();
  nodes.filter(n => n.type === "accused").forEach(n => {
    const arr = byCluster.get(n.cluster) ?? [];
    arr.push(n.id);
    byCluster.set(n.cluster, arr);
  });
  byCluster.forEach(arr => {
    for (let i = 0; i < arr.length - 1; i++) {
      edges.push({ source: arr[i], target: arr[i + 1], relation: "co-accused", weight: 2.5 });
    }
  });

  return { nodes, edges, clusters };
})();

// Adjacency helper
export function neighborsOf(id: string) {
  const set = new Set<string>();
  for (const e of NETWORK_RICH.edges) {
    if (e.source === id) set.add(e.target);
    if (e.target === id) set.add(e.source);
  }
  return set;
}

export function degreeMap() {
  const m = new Map<string, number>();
  for (const e of NETWORK_RICH.edges) {
    m.set(e.source, (m.get(e.source) ?? 0) + 1);
    m.set(e.target, (m.get(e.target) ?? 0) + 1);
  }
  return m;
}
