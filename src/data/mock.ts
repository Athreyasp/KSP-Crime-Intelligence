// Mock data derived from Police FIR ER diagram schema
// All values seeded deterministically for stable renders.

export type District = {
  id: number;
  name: string;
  // normalized 0..1 coordinates within Karnataka bounding grid
  x: number;
  y: number;
  population: number;
  urbanization: number; // %
  literacy: number; // %
};

export const DISTRICTS: District[] = [
  { id: 1, name: "Bengaluru Urban", x: 0.62, y: 0.60, population: 12300000, urbanization: 96, literacy: 88 },
  { id: 2, name: "Bengaluru Rural", x: 0.58, y: 0.55, population: 990000, urbanization: 42, literacy: 78 },
  { id: 3, name: "Mysuru", x: 0.48, y: 0.72, population: 3000000, urbanization: 58, literacy: 79 },
  { id: 4, name: "Dakshina Kannada", x: 0.22, y: 0.55, population: 2100000, urbanization: 47, literacy: 88 },
  { id: 5, name: "Dharwad", x: 0.32, y: 0.30, population: 1850000, urbanization: 56, literacy: 80 },
  { id: 6, name: "Belagavi", x: 0.28, y: 0.18, population: 4780000, urbanization: 30, literacy: 73 },
  { id: 7, name: "Kalaburagi", x: 0.62, y: 0.14, population: 2560000, urbanization: 32, literacy: 65 },
  { id: 8, name: "Ballari", x: 0.55, y: 0.30, population: 2450000, urbanization: 38, literacy: 68 },
  { id: 9, name: "Vijayapura", x: 0.45, y: 0.15, population: 2170000, urbanization: 22, literacy: 67 },
  { id: 10, name: "Tumakuru", x: 0.55, y: 0.50, population: 2680000, urbanization: 27, literacy: 76 },
  { id: 11, name: "Shivamogga", x: 0.35, y: 0.45, population: 1750000, urbanization: 35, literacy: 80 },
  { id: 12, name: "Udupi", x: 0.20, y: 0.48, population: 1180000, urbanization: 30, literacy: 87 },
  { id: 13, name: "Davanagere", x: 0.45, y: 0.38, population: 1950000, urbanization: 33, literacy: 76 },
  { id: 14, name: "Raichur", x: 0.60, y: 0.22, population: 1930000, urbanization: 24, literacy: 60 },
  { id: 15, name: "Hassan", x: 0.42, y: 0.60, population: 1780000, urbanization: 21, literacy: 77 },
  { id: 16, name: "Mandya", x: 0.50, y: 0.66, population: 1810000, urbanization: 17, literacy: 71 },
  { id: 17, name: "Chikkamagaluru", x: 0.36, y: 0.55, population: 1140000, urbanization: 22, literacy: 80 },
  { id: 18, name: "Kodagu", x: 0.34, y: 0.72, population: 550000, urbanization: 15, literacy: 82 },
  { id: 19, name: "Bidar", x: 0.72, y: 0.08, population: 1700000, urbanization: 25, literacy: 71 },
  { id: 20, name: "Kolar", x: 0.72, y: 0.55, population: 1540000, urbanization: 30, literacy: 74 },
  { id: 21, name: "Bagalkote", x: 0.38, y: 0.20, population: 1890000, urbanization: 31, literacy: 69 },
  { id: 22, name: "Chamarajanagara", x: 0.48, y: 0.80, population: 1020000, urbanization: 17, literacy: 61 },
  { id: 23, name: "Chikkaballapura", x: 0.68, y: 0.50, population: 1250000, urbanization: 22, literacy: 69 },
  { id: 24, name: "Chitradurga", x: 0.48, y: 0.42, population: 1660000, urbanization: 20, literacy: 73 },
  { id: 25, name: "Gadag", x: 0.35, y: 0.26, population: 1060000, urbanization: 36, literacy: 75 },
  { id: 26, name: "Haveri", x: 0.36, y: 0.34, population: 1600000, urbanization: 22, literacy: 77 },
  { id: 27, name: "Koppal", x: 0.50, y: 0.26, population: 1390000, urbanization: 17, literacy: 67 },
  { id: 28, name: "Ramanagara", x: 0.56, y: 0.64, population: 1080000, urbanization: 25, literacy: 69 },
  { id: 29, name: "Uttara Kannada", x: 0.24, y: 0.38, population: 1440000, urbanization: 29, literacy: 84 },
  { id: 30, name: "Yadgir", x: 0.64, y: 0.18, population: 1170000, urbanization: 19, literacy: 51 },
  { id: 31, name: "Vijayanagara", x: 0.52, y: 0.32, population: 1400000, urbanization: 32, literacy: 68 },
];

export const CRIME_HEADS = [
  { id: 1, name: "Crimes Against Body", color: "hsl(15 85% 60%)" },
  { id: 2, name: "Crimes Against Property", color: "hsl(45 90% 60%)" },
  { id: 3, name: "Crimes Against Women", color: "hsl(340 80% 65%)" },
  { id: 4, name: "Cyber Crimes", color: "hsl(195 80% 60%)" },
  { id: 5, name: "Economic Offences", color: "hsl(270 60% 65%)" },
  { id: 6, name: "Narcotics", color: "hsl(120 55% 55%)" },
  { id: 7, name: "Public Order", color: "hsl(220 70% 65%)" },
];

export const CASE_STATUS = ["Under Investigation", "Charge Sheeted", "Closed", "Pending Trial"] as const;
export const GRAVITY = ["Heinous", "Non-Heinous"] as const;
export const CASE_CATEGORY = ["FIR", "UDR", "Zero FIR", "PAR"] as const;

export const MO_TAGS = [
  "Night Burglary", "Vehicle Snatching", "OTP Fraud", "Chain Snatching",
  "House Break-in", "Cheque Fraud", "Digital Arrest Scam", "Drug Peddling",
  "Land Fraud", "Ransom Call",
];

// Deterministic PRNG
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];

const FIRST_NAMES = ["Ravi", "Suresh", "Anitha", "Priya", "Karthik", "Manjunath", "Deepa", "Vinay", "Lakshmi", "Ganesh", "Nagaraj", "Bhavya", "Arjun", "Meena", "Chetan"];
const LAST_NAMES = ["Gowda", "Rao", "Shetty", "Naik", "Iyer", "Reddy", "Patil", "Kumar", "Bhat", "Hegde"];

const randName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

export type Case = {
  caseMasterId: number;
  crimeNo: string;
  registeredDate: string;
  incidentDate: string;
  hour: number;
  district: District;
  policeStation: string;
  category: string;
  gravity: string;
  crimeHead: (typeof CRIME_HEADS)[number];
  status: string;
  actSections: string[];
  moTag: string;
  briefFacts: string;
  complainant: {
    name: string;
    age: number;
    gender: string;
    occupation: string;
    religion?: string;
    caste?: string;
    phone?: string;
    relation?: string;
    address?: string;
  };
  victims: { name: string; age: number; gender: string; isPolice?: boolean; photo?: string; phone?: string }[];
  accused: { id: string; name: string; age: number; gender: string; arrestId?: number; arrestDate?: string; arrestDistrict?: string; ioName?: string; courtName?: string; photo?: string; phone?: string; vehicleUsed?: boolean; vehicleNo?: string; physicalMarkers?: { x: number; y: number; part: string; desc: string }[] }[];
  latitude: number;
  longitude: number;
  incidentToDate?: string;
  infoReceivedPSDate?: string;
  registeringOfficer?: string;
  courtName?: string;
  officerPhoto?: string;
  chargesheetNo?: string;
  chargesheetDate?: string;
  chargesheetType?: string;
  occurrencePlace?: string;
};

const OCCUPATIONS = ["Farmer", "Shopkeeper", "IT Employee", "Student", "Homemaker", "Auto Driver", "Govt Employee", "Businessperson"];
const ACT_SECTIONS = ["BNS 103", "BNS 109", "BNS 305", "BNS 318", "IT Act 66C", "IT Act 66D", "NDPS 20", "IPC 379", "IPC 420", "Arms Act 25"];

export const CASES: Case[] = [];

// Repeat offenders — cluster accused names that recur across cases
export type Offender = {
  id: string;
  name: string;
  age: number;
  gender: "M" | "F";
  incidentCount: number;
  jurisdictions: string[];
  moTags: string[];
  cases: number[]; // caseMasterId
  riskScore: number; // 0..100
};

export const OFFENDERS: Offender[] = CASES.length > 0 ? Array.from({ length: 24 }, (_, i) => {
  const name = randName();
  const cases = Array.from({ length: 2 + Math.floor(rand() * 6) }, () => CASES[Math.floor(rand() * CASES.length)]);
  return {
    id: `OFF-${1000 + i}`,
    name,
    age: 22 + Math.floor(rand() * 30),
    gender: rand() > 0.2 ? "M" : "F",
    incidentCount: cases.length,
    jurisdictions: Array.from(new Set(cases.map(c => c.district.name))),
    moTags: Array.from(new Set(cases.map(c => c.moTag))),
    cases: cases.map(c => c.caseMasterId),
    riskScore: Math.min(100, Math.round(40 + cases.length * 6 + rand() * 15)),
  };
}) : [];

// Associates linked to each offender (co-accused, victims, handlers)
const RELATIONS = ["Co-Accused", "Known Associate", "Family", "Financial Link", "Same MO Cell", "Cellmate"] as const;
export type Associate = {
  id: string;
  name: string;
  role: "Co-Accused" | "Victim" | "Handler" | "Informant";
  relation: string;
  sharedCases: number;
  strength: number;
};

export const OFFENDER_ASSOCIATES: Record<string, Associate[]> = Object.fromEntries(
  OFFENDERS.map(o => {
    const pool = OFFENDERS.filter(x => x.id !== o.id);
    const assoc: Associate[] = Array.from({ length: 3 + Math.floor(rand() * 4) }, (_, k) => {
      const other = pool[Math.floor(rand() * pool.length)];
      return {
        id: other.id,
        name: other.name,
        role: k === 0 ? "Handler" : k % 3 === 0 ? "Informant" : "Co-Accused",
        relation: RELATIONS[Math.floor(rand() * RELATIONS.length)],
        sharedCases: 1 + Math.floor(rand() * 4),
        strength: 40 + Math.floor(rand() * 60),
      };
    });
    const victimLinks: Associate[] = o.cases.slice(0, 2).map(cid => {
      const c = CASES.find(x => x.caseMasterId === cid)!;
      return {
        id: `V-${cid}`,
        name: c.victims[0].name,
        role: "Victim",
        relation: "Targeted",
        sharedCases: 1,
        strength: 25 + Math.floor(rand() * 30),
      };
    });
    return [o.id, [...assoc, ...victimLinks]];
  })
);

// Per-offender predictive intelligence — what they are likely to do next
export type Prediction = {
  nextCrime: string;
  probability: number;
  window: string;
  district: string;
  timeBand: string;
  confidence: "Low" | "Medium" | "High";
  drivers: string[];
  timeline: { day: string; risk: number }[];
};

const TIME_BANDS = ["00:00–04:00", "04:00–08:00", "18:00–22:00", "22:00–02:00", "12:00–16:00"];
export const OFFENDER_PREDICTIONS: Record<string, Prediction> = Object.fromEntries(
  OFFENDERS.map(o => {
    const likelyMo = o.moTags[Math.floor(rand() * o.moTags.length)] ?? "Vehicle Snatching";
    const likelyDist = o.jurisdictions[Math.floor(rand() * o.jurisdictions.length)] ?? "Bengaluru Urban";
    const prob = Math.min(96, Math.round(50 + o.riskScore * 0.35 + rand() * 10));
    return [o.id, {
      nextCrime: likelyMo,
      probability: prob,
      window: `${3 + Math.floor(rand() * 12)} days`,
      district: likelyDist,
      timeBand: TIME_BANDS[Math.floor(rand() * TIME_BANDS.length)],
      confidence: prob > 80 ? "High" : prob > 65 ? "Medium" : "Low",
      drivers: [
        `${o.incidentCount} prior FIRs on record`,
        `Recurring MO: ${likelyMo}`,
        `Active across ${o.jurisdictions.length} district(s)`,
        rand() > 0.5 ? "Recent bail — 30d window" : "Known associate re-arrested",
      ],
      timeline: Array.from({ length: 14 }, (_, k) => ({
        day: `D+${k + 1}`,
        risk: Math.max(10, Math.min(100, Math.round(prob * 0.6 + Math.sin(k / 2) * 15 + rand() * 12))),
      })),
    }];
  })
);

// Network graph — accused ↔ case ↔ victim ↔ location
export type NetNode = { id: string; label: string; type: "accused" | "case" | "victim" | "location"; x: number; y: number };
export type NetEdge = { source: string; target: string };

export const NETWORK: { nodes: NetNode[]; edges: NetEdge[] } = (() => {
  const nodes: NetNode[] = [];
  const edges: NetEdge[] = [];
  const R = 260;
  const centers = OFFENDERS.slice(0, 8);
  centers.forEach((off, i) => {
    const angle = (i / centers.length) * Math.PI * 2;
    const cx = 400 + Math.cos(angle) * R;
    const cy = 320 + Math.sin(angle) * R;
    nodes.push({ id: off.id, label: off.name, type: "accused", x: cx, y: cy });
    off.cases.slice(0, 3).forEach((caseId, ci) => {
      const cAngle = angle + (ci - 1) * 0.3;
      const cxx = cx + Math.cos(cAngle) * 90;
      const cyy = cy + Math.sin(cAngle) * 90;
      const cid = `C-${caseId}`;
      if (!nodes.find(n => n.id === cid)) {
        nodes.push({ id: cid, label: `FIR ${caseId}`, type: "case", x: cxx, y: cyy });
      }
      edges.push({ source: off.id, target: cid });
      const kase = CASES.find(c => c.caseMasterId === caseId)!;
      const locId = `L-${kase.district.id}`;
      if (!nodes.find(n => n.id === locId)) {
        nodes.push({ id: locId, label: kase.district.name, type: "location", x: 400 + kase.district.x * 200 - 100, y: 320 + kase.district.y * 200 - 100 });
      }
      edges.push({ source: cid, target: locId });
      const vid = `V-${caseId}`;
      if (!nodes.find(n => n.id === vid)) {
        nodes.push({ id: vid, label: kase.victims[0].name, type: "victim", x: cxx + Math.cos(cAngle) * 60, y: cyy + Math.sin(cAngle) * 60 });
      }
      edges.push({ source: cid, target: vid });
    });
  });
  return { nodes, edges };
})();

// 30-day trend
export const DAILY_TREND = Array.from({ length: 30 }, (_, i) => {
  const day = new Date();
  day.setDate(day.getDate() - (29 - i));
  const base = 40 + Math.sin(i / 3) * 8 + rand() * 10;
  return {
    day: day.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    firs: Math.round(base),
    arrests: Math.round(base * 0.4 + rand() * 6),
    heinous: Math.round(base * 0.25),
  };
});

// 14-day forecast
export const FORECAST = Array.from({ length: 14 }, (_, i) => {
  const day = new Date();
  day.setDate(day.getDate() + i + 1);
  return {
    day: day.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    predicted: Math.round(45 + Math.sin(i / 2) * 10 + rand() * 6),
    upper: Math.round(60 + Math.sin(i / 2) * 10 + rand() * 8),
    lower: Math.round(30 + Math.sin(i / 2) * 8 + rand() * 4),
  };
});

// Alerts feed
export const ALERTS = [
  { id: 1, severity: "critical", district: "Bengaluru Urban", text: "Chain-snatching cluster spike +38% vs 6-mo avg", time: "12 min ago" },
  { id: 2, severity: "high", district: "Mysuru", text: "Cyber fraud reports doubled in last 72h", time: "34 min ago" },
  { id: 3, severity: "high", district: "Kalaburagi", text: "Vehicle theft anomaly detected in Zone-4", time: "1 hr ago" },
  { id: 4, severity: "medium", district: "Dharwad", text: "NDPS seizure trend rising in student areas", time: "2 hr ago" },
  { id: 5, severity: "medium", district: "Belagavi", text: "Unusual late-night burglary pattern flagged", time: "3 hr ago" },
  { id: 6, severity: "low", district: "Udupi", text: "Public order incidents above weekly baseline", time: "5 hr ago" },
];

// District-level aggregates
export const DISTRICT_STATS = DISTRICTS.map(d => {
  const dCases = CASES.filter(c => c.district.id === d.id);
  const heinous = dCases.filter(c => c.gravity === "Heinous").length;
  const arrests = dCases.reduce((s, c) => s + c.accused.filter(a => a.arrestId).length, 0);
  const spike = Math.round((rand() * 60 - 20)); // %
  return {
    district: d,
    total: dCases.length,
    heinous,
    arrests,
    spike,
    riskScore: Math.min(100, Math.round(30 + dCases.length * 1.2 + heinous * 2 + rand() * 10)),
  };
}).sort((a, b) => b.total - a.total);

// KPIs
export const KPIS = {
  totalFIRs: CASES.length,
  heinousPct: CASES.length > 0 ? Math.round((CASES.filter(c => c.gravity === "Heinous").length / CASES.length) * 100) : 0,
  arrests: CASES.reduce((s, c) => s + c.accused.filter(a => a.arrestId).length, 0),
  pending: CASES.filter(c => c.status === "Under Investigation").length,
  chargeSheeted: CASES.filter(c => c.status === "Charge Sheeted").length,
  activeDistricts: DISTRICTS.length,
};

// Hourly crime distribution
export const HOURLY = Array.from({ length: 24 }, (_, h) => ({
  hour: `${String(h).padStart(2, "0")}:00`,
  count: CASES.filter(c => c.hour === h).length,
}));

// Crime head distribution
export const HEAD_DIST = CRIME_HEADS.map(h => ({
  name: h.name,
  value: CASES.filter(c => c.crimeHead.id === h.id).length,
  fill: h.color,
}));

// Sociological correlation dataset
export const SOCIO = DISTRICTS.map(d => {
  const dCases = CASES.filter(c => c.district.id === d.id);
  return {
    district: d.name,
    urbanization: d.urbanization,
    literacy: d.literacy,
    population: d.population,
    crimeRate: Math.round((dCases.length / (d.population / 100000)) * 10) / 10,
    cyberShare: Math.round((dCases.filter(c => c.crimeHead.id === 4).length / Math.max(dCases.length, 1)) * 100),
  };
});

// ============ Sub-area drill-down ============
export type SubArea = {
  id: string;
  districtId: number;
  name: string;
  firs: number;
  topCrime: string;
  peakHours: string;
  spike: number;
  lat: number;
  lng: number;
};

// Approximate district centroids (lat, lng) — used as fallback for area coords
export const DISTRICT_COORDS: Record<string, [number, number]> = {
  "Bengaluru Urban": [12.9716, 77.5946],
  "Bengaluru Rural": [13.2846, 77.6947],
  "Mysuru": [12.2958, 76.6394],
  "Dakshina Kannada": [12.9141, 74.856],
  "Dharwad": [15.3647, 75.124],
  "Belagavi": [15.8497, 74.4977],
  "Kalaburagi": [17.3297, 76.8343],
  "Ballari": [15.1394, 76.9214],
  "Vijayanagara": [15.2689, 76.3909],
  "Vijayapura": [16.8302, 75.71],
  "Tumakuru": [13.3409, 77.101],
  "Shivamogga": [13.9299, 75.5681],
  "Udupi": [13.3409, 74.7421],
  "Davanagere": [14.4644, 75.9218],
  "Raichur": [16.2076, 77.3463],
  "Hassan": [13.0072, 76.0962],
  "Mandya": [12.5218, 76.8951],
  "Chikkamagaluru": [13.3153, 75.7754],
  "Kodagu": [12.4244, 75.7382],
  "Bidar": [17.9104, 77.5199],
  "Kolar": [13.1372, 78.1298],
};

export const AREA_COORDS: Record<string, [number, number]> = {
  "Whitefield": [12.9698, 77.75],
  "Koramangala": [12.9352, 77.6245],
  "Indiranagar": [12.9784, 77.6408],
  "MG Road": [12.9756, 77.6069],
  "Electronic City": [12.8452, 77.6602],
  "Yelahanka": [13.1007, 77.5963],
  "Jayanagar": [12.9250, 77.5938],
  "HSR Layout": [12.9116, 77.6473],
  "Malleshwaram": [13.0035, 77.5647],
  "Marathahalli": [12.9591, 77.6974],
  "Peenya": [13.0284, 77.5195],
  "Yeshwanthpur": [13.0250, 77.5462],
  "Rajajinagar": [12.9882, 77.5548],
  "Devanahalli": [13.2437, 77.7126],
  "Doddaballapur": [13.2957, 77.5378],
  "Hoskote": [13.0707, 77.7982],
  "Nelamangala": [13.0996, 77.3936],
  "Krishnaraja": [12.3051, 76.6552],
  "Chamundipuram": [12.2884, 76.6641],
  "Vijayanagar": [12.3216, 76.6146],
  "Hebbal": [12.3384, 76.6034],
  "T. Narasipur": [12.2166, 76.8956],
  "Nanjangud": [12.1163, 76.6836],
  "Hunsur": [12.3033, 76.2895],
  "Mangaluru North": [12.95, 74.85],
  "Mangaluru South": [12.86, 74.83],
  "Bantwal": [12.8905, 75.0355],
  "Puttur": [12.7605, 75.2003],
  "Sullia": [12.5636, 75.3873],
  "Belthangady": [12.9902, 75.2857],
  "Hubballi Central": [15.3647, 75.124],
  "Hubballi East": [15.365, 75.16],
  "Dharwad City": [15.4589, 75.0078],
  "Navanagar": [15.4, 75.09],
  "Kalghatgi": [15.1858, 74.9639],
  "Belagavi City": [15.8497, 74.4977],
  "Khanapur": [15.6414, 74.5091],
  "Bailhongal": [15.8161, 74.8552],
  "Chikkodi": [16.4247, 74.5936],
  "Athani": [16.7266, 75.0653],
  "Ramdurg": [15.9525, 75.2986],
  "Kalaburagi City": [17.3297, 76.8343],
  "Afzalpur": [17.201, 76.3607],
  "Chincholi": [17.4661, 77.4179],
  "Sedam": [17.1785, 77.2842],
  "Aland": [17.5666, 76.5686],
  "Jevargi": [17.0125, 76.7735],
  "Ballari City": [15.1394, 76.9214],
  "Hosapete": [15.2689, 76.3909],
  "Sandur": [15.0838, 76.5474],
  "Siruguppa": [15.6299, 76.8964],
  "Kudligi": [14.9057, 76.3919],
  "Harapanahalli": [14.5126, 75.9868],
  "Kotturu": [14.8214, 76.2201],
  "Huvina Hadagali": [15.0211, 75.9555],
  "Hagaribommanahalli": [15.0991, 76.1952],
  "Vijayapura City": [16.8302, 75.71],
  "Indi": [17.176, 75.9494],
  "Sindagi": [16.9101, 76.2317],
  "Basavana Bagevadi": [16.5793, 75.9686],
  "Muddebihal": [16.3339, 76.1319],
  "Tumakuru City": [13.3409, 77.101],
  "Tiptur": [13.2569, 76.4785],
  "Sira": [13.7418, 76.9042],
  "Kunigal": [13.0244, 77.0287],
  "Madhugiri": [13.6603, 77.2109],
  "Chiknayakanhalli": [13.4127, 76.6247],
  "Shivamogga City": [13.9299, 75.5681],
  "Sagar": [14.1667, 75.0333],
  "Bhadravati": [13.8489, 75.7052],
  "Shikaripur": [14.2695, 75.3517],
  "Thirthahalli": [13.6912, 75.244],
  "Hosanagara": [13.9333, 75.0833],
  "Udupi City": [13.3409, 74.7421],
  "Kundapura": [13.6259, 74.6926],
  "Karkala": [13.2085, 74.9974],
  "Byndoor": [13.8664, 74.6416],
  "Davanagere City": [14.4644, 75.9218],
  "Harihar": [14.5133, 75.807],
  "Channagiri": [14.023, 75.9273],
  "Honnali": [14.2405, 75.6474],
  "Jagaluru": [14.5187, 76.339],
  "Raichur City": [16.2076, 77.3463],
  "Manvi": [15.9878, 77.0454],
  "Sindhanur": [15.7684, 76.7605],
  "Devadurga": [16.4249, 76.9448],
  "Lingasugur": [16.1567, 76.5219],
  "Hassan City": [13.0072, 76.0962],
  "Arsikere": [13.3134, 76.257],
  "Channarayapatna": [12.9066, 76.3888],
  "Belur": [13.1631, 75.8648],
  "Sakleshpur": [12.9432, 75.7856],
  "Holenarasipur": [12.7847, 76.2419],
  "Mandya City": [12.5218, 76.8951],
  "Maddur": [12.5843, 77.0432],
  "Malavalli": [12.3839, 77.0648],
  "Nagamangala": [12.8188, 76.7548],
  "Pandavapura": [12.5052, 76.6721],
  "Srirangapatna": [12.4108, 76.6941],
  "Chikkamagaluru City": [13.3153, 75.7754],
  "Kadur": [13.5518, 76.0122],
  "Tarikere": [13.7075, 75.8158],
  "Mudigere": [13.1339, 75.6386],
  "Koppa": [13.5316, 75.3565],
  "Sringeri": [13.4197, 75.2569],
  "Madikeri": [12.4244, 75.7382],
  "Virajpet": [12.1971, 75.8067],
  "Somwarpet": [12.5901, 75.8531],
  "Bidar City": [17.9104, 77.5199],
  "Bhalki": [18.0421, 77.2098],
  "Humnabad": [17.7666, 77.1338],
  "Basavakalyan": [17.8724, 76.9494],
  "Aurad": [18.2503, 77.4109],
  "Kolar City": [13.1372, 78.1298],
  "Bangarpet": [12.9909, 78.1783],
  "Malur": [13.0053, 77.9377],
  "Mulbagal": [13.1653, 78.3949],
  "Srinivaspur": [13.3402, 78.2117],
};

export const AREA_NAMES: Record<string, string[]> = {
  "Bengaluru Urban": ["Whitefield","Koramangala","Indiranagar","MG Road","Electronic City","Yelahanka","Jayanagar","HSR Layout","Malleshwaram","Marathahalli","Peenya","Yeshwanthpur","Rajajinagar"],
  "Bengaluru Rural": ["Devanahalli","Doddaballapur","Hoskote","Nelamangala"],
  "Mysuru": ["Krishnaraja","Chamundipuram","Vijayanagar","Hebbal","T. Narasipur","Nanjangud","Hunsur"],
  "Dakshina Kannada": ["Mangaluru North","Mangaluru South","Bantwal","Puttur","Sullia","Belthangady"],
  "Dharwad": ["Hubballi Central","Hubballi East","Dharwad City","Navanagar","Kalghatgi"],
  "Belagavi": ["Belagavi City","Khanapur","Bailhongal","Chikkodi","Athani","Ramdurg"],
  "Kalaburagi": ["Kalaburagi City","Afzalpur","Chincholi","Sedam","Aland","Jevargi"],
  "Ballari": ["Ballari City", "Sandur", "Siruguppa"],
  "Vijayanagara": ["Hosapete", "Kudligi", "Harapanahalli", "Kotturu", "Huvina Hadagali", "Hagaribommanahalli"],
  "Vijayapura": ["Vijayapura City","Indi","Sindagi","Basavana Bagevadi","Muddebihal"],
  "Tumakuru": ["Tumakuru City","Tiptur","Sira","Kunigal","Madhugiri","Chiknayakanhalli"],
  "Shivamogga": ["Shivamogga City","Sagar","Bhadravati","Shikaripur","Thirthahalli","Hosanagara"],
  "Udupi": ["Udupi City","Kundapura","Karkala","Byndoor"],
  "Davanagere": ["Davanagere City","Harihar","Channagiri","Honnali","Jagaluru"],
  "Raichur": ["Raichur City","Manvi","Sindhanur","Devadurga","Lingasugur"],
  "Hassan": ["Hassan City","Arsikere","Channarayapatna","Belur","Sakleshpur","Holenarasipur"],
  "Mandya": ["Mandya City","Maddur","Malavalli","Nagamangala","Pandavapura","Srirangapatna"],
  "Chikkamagaluru": ["Chikkamagaluru City","Kadur","Tarikere","Mudigere","Koppa","Sringeri"],
  "Kodagu": ["Madikeri","Virajpet","Somwarpet"],
  "Bidar": ["Bidar City","Bhalki","Humnabad","Basavakalyan","Aurad"],
  "Kolar": ["Kolar City","Bangarpet","Malur","Mulbagal","Srinivaspur"],
};

const PEAK_BANDS = ["00:00–06:00","06:00–12:00","12:00–18:00","18:00–24:00"];

export const SUB_AREAS: Record<number, SubArea[]> = (() => {
  const out: Record<number, SubArea[]> = {};
  for (const d of DISTRICTS) {
    const names = AREA_NAMES[d.name] ?? [`${d.name} Central`, `${d.name} North`, `${d.name} South`];
    const stat = DISTRICT_STATS.find(s => s.district.id === d.id)!;
    // deterministic pseudo-random weights per area
    const weights = names.map((n, i) => {
      const seed = (d.id * 131 + i * 17 + n.length) % 97;
      return 0.4 + (seed / 97) * 1.2;
    });
    const wSum = weights.reduce((a, b) => a + b, 0);
    out[d.id] = names.map((n, i) => {
      const share = weights[i] / wSum;
      const firs = Math.max(3, Math.round(stat.total * share));
      const seed = (d.id * 211 + i * 53) % 1000;
      const topCrime = CRIME_HEADS[seed % CRIME_HEADS.length].name;
      const peakHours = PEAK_BANDS[(seed >> 3) % PEAK_BANDS.length];
      const spike = Math.round(((seed % 60) - 15) + (share > 0.2 ? 12 : 0));
      const base = AREA_COORDS[n];
      const center = DISTRICT_COORDS[d.name] ?? [15.0, 76.5];
      const jLat = (((seed * 13) % 100) / 100 - 0.5) * 0.18;
      const jLng = (((seed * 17) % 100) / 100 - 0.5) * 0.22;
      const [lat, lng] = base ?? [center[0] + jLat, center[1] + jLng];
      return {
        id: `${d.id}-${i}`,
        districtId: d.id,
        name: n,
        firs,
        topCrime,
        peakHours,
        spike,
        lat,
        lng,
      };
    }).sort((a, b) => b.firs - a.firs);
  }
  return out;
})();

export const getSubAreas = (districtId: number): SubArea[] => SUB_AREAS[districtId] ?? [];

// ============ Micro-spot drill-down (street / beat level) ============
export type MicroSpot = {
  id: string;
  subAreaId: string;
  name: string;
  firs: number;
  topCrime: string;
  peakHours: string;
  spike: number;
  // normalized 0..1 coords within the sub-area cell
  x: number;
  y: number;
};

export const STREET_SUFFIXES = ["Main Rd", "Cross", "Circle", "Market", "Junction", "Bus Stand", "Layout", "Nagar", "Colony", "Beat"];

export const getMicroSpots = (area: SubArea): MicroSpot[] => {
  const count = 6 + ((area.name.length + area.districtId) % 4); // 6..9
  const out: MicroSpot[] = [];
  for (let i = 0; i < count; i++) {
    const seed = (area.districtId * 977 + area.name.charCodeAt(0) * 53 + i * 131) % 10000;
    const share = 0.5 + ((seed % 100) / 100) * 1.4;
    const wSum = count * 1.2;
    const firs = Math.max(1, Math.round((area.firs * share) / wSum));
    const topCrime = CRIME_HEADS[(seed >> 2) % CRIME_HEADS.length].name;
    const peakHours = PEAK_BANDS[(seed >> 5) % PEAK_BANDS.length];
    const spike = Math.round(((seed % 70) - 20) + (share > 1.3 ? 10 : 0));
    // jittered positions
    const gx = ((seed * 9301 + 49297) % 233280) / 233280;
    const gy = ((seed * 4711 + 21221) % 233280) / 233280;
    out.push({
      id: `${area.id}-m${i}`,
      subAreaId: area.id,
      name: `${area.name} ${STREET_SUFFIXES[i % STREET_SUFFIXES.length]}`,
      firs,
      topCrime,
      peakHours,
      spike,
      x: 0.1 + gx * 0.8,
      y: 0.1 + gy * 0.8,
    });
  }
  return out.sort((a, b) => b.firs - a.firs);
};
