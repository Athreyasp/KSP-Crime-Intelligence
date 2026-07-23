import { CASES as SEED_CASES, DISTRICTS, CRIME_HEADS, CASE_STATUS, type Case, type District, type CrimeHead, type SubArea, type MicroSpot, AREA_NAMES, AREA_COORDS, DISTRICT_COORDS, STREET_SUFFIXES } from "../data/mock";
import { type Offender, type Associate, type Prediction, type RichNode, type RichEdge, type EntityType, type RelationType } from "../data/network-rich";
import { fetchLiveCases, insertLiveCase, clearLiveCases, seedLiveCases } from "./catalyst-api";


function initCases(): Case[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("ksp_cases_store");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error reading localStorage:", e);
    }
  }
  return [...SEED_CASES];
}

let loadedCases: Case[] = initCases();

// Load cases from memory
export function getStoredCases(): Case[] {
  if (loadedCases.length === 0) {
    loadedCases = initCases();
  }
  return loadedCases;
}

export function saveCases(cases: Case[]) {
  loadedCases = cases;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("ksp_cases_store", JSON.stringify(cases));
    } catch (e) {
      console.error("Failed to save cases to localStorage:", e);
    }
    window.dispatchEvent(new Event("db-update"));
  }
}

export async function clearDb(): Promise<void> {
  saveCases([]);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("ksp_cases_store");
      await clearLiveCases();
    } catch (err) {
      console.error("Failed to clear Zoho Catalyst cloud Data Store:", err);
    }
  }
}

export async function seedDb(): Promise<void> {
  saveCases([...SEED_CASES]);
  return Promise.resolve();
}

export async function addCase(c: Omit<Case, "caseMasterId">): Promise<Case> {
  const cases = getStoredCases();
  const nextId = cases.length > 0 ? Math.max(...cases.map(x => x.caseMasterId)) + 1 : 10000;
  const newCase: Case = {
    ...c,
    caseMasterId: nextId,
  };
  cases.push(newCase);
  saveCases(cases);

  // Sync to remote Catalyst Data Store
  try {
    const liveCreated = await insertLiveCase(c);
    const updatedCases = getStoredCases().map(x => x.crimeNo === c.crimeNo ? liveCreated : x);
    saveCases(updatedCases);
    return liveCreated;
  } catch (err) {
    console.error("Failed to sync new case to Zoho Catalyst Data Store:", err);
    return newCase;
  }
}

export async function syncWithCatalyst() {
  if (typeof window === "undefined") return;
  try {
    const liveCases = await fetchLiveCases();
    if (liveCases && Array.isArray(liveCases) && liveCases.length > 0) {
      const current = getStoredCases();
      const liveMap = new Map(liveCases.map(c => [c.crimeNo, c]));
      const merged = [...liveCases];
      
      for (const localCase of current) {
        if (!liveMap.has(localCase.crimeNo)) {
          merged.push(localCase);
        }
      }
      
      saveCases(merged);
    }
  } catch (err) {
    console.warn("Catalyst sync paused or waiting for API gateway configuration:", err.message);
  }
}



// Dynamic computations based on current cases list

export function computeKpis(cases: Case[]) {
  const total = cases.length;
  if (total === 0) {
    return {
      totalFIRs: 0,
      heinousPct: 0,
      arrests: 0,
      pending: 0,
      chargeSheeted: 0,
      activeDistricts: DISTRICTS.length,
    };
  }
  return {
    totalFIRs: total,
    heinousPct: Math.round((cases.filter(c => c.gravity === "Heinous").length / total) * 100),
    arrests: cases.reduce((s, c) => s + c.accused.filter(a => a.arrestId).length, 0),
    pending: cases.filter(c => c.status === "Under Investigation").length,
    chargeSheeted: cases.filter(c => c.status === "Charge Sheeted").length,
    activeDistricts: DISTRICTS.length,
  };
}

export function computeDailyTrend(cases: Case[]) {
  // Generate 30 days trailing trend ending today
  return Array.from({ length: 30 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (29 - i));
    const dayStr = day.toISOString().slice(0, 10);
    const dayCases = cases.filter(c => c.registeredDate.startsWith(dayStr));
    return {
      day: day.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      firs: dayCases.length,
      arrests: dayCases.reduce((s, c) => s + c.accused.filter(a => a.arrestId).length, 0),
      heinous: dayCases.filter(c => c.gravity === "Heinous").length,
    };
  });
}

export function computeDistrictStats(cases: Case[]) {
  return DISTRICTS.map(d => {
    const dCases = cases.filter(c => c.district.id === d.id);
    const heinous = dCases.filter(c => c.gravity === "Heinous").length;
    const arrests = dCases.reduce((s, c) => s + c.accused.filter(a => a.arrestId).length, 0);
    const total = dCases.length;
    // Mock spikes or base on recent data
    const spike = total > 0 ? Math.round((total * 10) % 60 - 20) : 0;
    return {
      district: d,
      total,
      heinous,
      arrests,
      spike,
      riskScore: Math.min(100, Math.round(30 + total * 1.2 + heinous * 2 + (total > 0 ? 5 : 0))),
    };
  }).sort((a, b) => b.total - a.total);
}

export function computeHourly(cases: Case[]) {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    count: cases.filter(c => c.hour === h).length,
  }));
}

export function computeHeadDist(cases: Case[]) {
  return CRIME_HEADS.map(h => ({
    name: h.name,
    value: cases.filter(c => c.crimeHead.id === h.id).length,
    fill: h.color,
  }));
}

export function computeSocio(cases: Case[]) {
  return DISTRICTS.map(d => {
    const dCases = cases.filter(c => c.district.id === d.id);
    return {
      district: d.name,
      urbanization: d.urbanization,
      literacy: d.literacy,
      population: d.population,
      crimeRate: Math.round((dCases.length / (d.population / 100000)) * 10) / 10,
      cyberShare: Math.round((dCases.filter(c => c.crimeHead.id === 4).length / Math.max(dCases.length, 1)) * 100),
    };
  });
}

// Compute offender profiles from cases: group accused by name to identify repeat offenders
export function computeOffenders(cases: Case[]): Offender[] {
  const accusedMap = new Map<string, { name: string; age: number; gender: "M" | "F"; cases: Case[] }>();
  
  for (const c of cases) {
    for (const a of c.accused) {
      const nameKey = a.name.trim().toLowerCase();
      if (!nameKey) continue;
      const existing = accusedMap.get(nameKey) || { name: a.name, age: a.age, gender: a.gender === "F" ? "F" : "M", cases: [] };
      existing.cases.push(c);
      accusedMap.set(nameKey, existing);
    }
  }

  // Filter or take all accused who have cases, and rank repeat offenders high
  return Array.from(accusedMap.entries()).map(([key, data], idx) => {
    const uniqueDistricts = Array.from(new Set(data.cases.map(c => c.district.name)));
    const uniqueMo = Array.from(new Set(data.cases.map(c => c.moTag)));
    const incidentCount = data.cases.length;
    return {
      id: `OFF-${1000 + idx}`,
      name: data.name,
      age: data.age,
      gender: data.gender,
      incidentCount,
      jurisdictions: uniqueDistricts,
      moTags: uniqueMo,
      cases: data.cases.map(c => c.caseMasterId),
      riskScore: Math.min(100, Math.round(40 + incidentCount * 12 + (incidentCount > 1 ? 15 : 0))),
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

export function computeOffenderAssociates(offenders: Offender[], cases: Case[]): Record<string, Associate[]> {
  return Object.fromEntries(
    offenders.map(o => {
      // Find Co-Accused from shared cases
      const coAccusedNames = new Set<string>();
      const sharedCasesMap = new Map<string, number>();

      for (const cid of o.cases) {
        const c = cases.find(x => x.caseMasterId === cid);
        if (!c) continue;
        for (const a of c.accused) {
          if (a.name.trim().toLowerCase() !== o.name.trim().toLowerCase()) {
            coAccusedNames.add(a.name.trim().toLowerCase());
            sharedCasesMap.set(a.name.trim().toLowerCase(), (sharedCasesMap.get(a.name.trim().toLowerCase()) || 0) + 1);
          }
        }
      }

      const associates: Associate[] = [];
      
      // Add Co-Accused associates
      coAccusedNames.forEach(name => {
        const otherOff = offenders.find(x => x.name.trim().toLowerCase() === name);
        if (otherOff) {
          associates.push({
            id: otherOff.id,
            name: otherOff.name,
            role: "Co-Accused",
            relation: "Co-Accused",
            sharedCases: sharedCasesMap.get(name) || 1,
            strength: Math.min(100, 40 + (sharedCasesMap.get(name) || 1) * 20),
          });
        }
      });

      // Add victims from cases
      o.cases.forEach((cid, idx) => {
        const c = cases.find(x => x.caseMasterId === cid);
        if (c && c.victims.length > 0) {
          associates.push({
            id: `V-${cid}-${idx}`,
            name: c.victims[0].name,
            role: "Victim",
            relation: "Targeted",
            sharedCases: 1,
            strength: 35,
          });
        }
      });

      return [o.id, associates];
    })
  );
}

export function computeOffenderPredictions(offenders: Offender[]): Record<string, Prediction> {
  const TIME_BANDS = ["00:00–04:00", "04:00–08:00", "18:00–22:00", "22:00–02:00", "12:00–16:00"];
  
  return Object.fromEntries(
    offenders.map((o, idx) => {
      const likelyMo = o.moTags[0] ?? "House Break-in";
      const likelyDist = o.jurisdictions[0] ?? "Bengaluru City";
      const prob = Math.min(96, Math.round(50 + o.riskScore * 0.35 + (idx % 10)));
      return [o.id, {
        nextCrime: likelyMo,
        probability: prob,
        window: `${3 + (idx % 10)} days`,
        district: likelyDist,
        timeBand: TIME_BANDS[idx % TIME_BANDS.length],
        confidence: prob > 80 ? "High" : prob > 65 ? "Medium" : "Low",
        drivers: [
          `${o.incidentCount} prior FIRs on record`,
          `Primary MO: ${likelyMo}`,
          `Active in ${o.jurisdictions.join(", ") || "Statewide"}`,
        ],
        timeline: Array.from({ length: 14 }, (_, k) => ({
          day: `D+${k + 1}`,
          risk: Math.max(10, Math.min(100, Math.round(prob * 0.6 + Math.sin(k / 2) * 15 + (k % 5)))),
        })),
      }];
    })
  );
}

export function computeNetworkRich(offenders: Offender[], cases: Case[]) {
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

  const VEHICLE_PLATES = ["KA-01-XX-4421", "KA-05-MJ-9013", "KA-19-BZ-7702"];
  const PHONE_NUMBERS  = ["+91 98450 ●●●32", "+91 96632 ●●●08"];

  // Generate network for first 12 offenders
  const centers = offenders.slice(0, 12);
  centers.forEach((off, i) => {
    const cluster = clusters[i % clusters.length].id;
    const off_cases = off.cases.slice(0, 3);
    const districts = new Set<string>();
    const dates: number[] = [];

    // Add accused node
    add({
      id: off.id,
      label: off.name,
      type: "accused",
      cluster,
      meta: {
        aliases: [`"${off.name.split(" ")[0]} bhai"`],
        age: off.age,
        district: off.jurisdictions[0] || "Statewide",
        activeFIRs: off_cases.length,
        riskScore: off.riskScore,
        moTags: off.moTags,
        predictedNext: {
          crime: off.moTags[0] ?? "Theft",
          probability: Math.min(94, off.riskScore + 5),
          window: "7 days"
        }
      }
    });

    off_cases.forEach(caseId => {
      const kase = cases.find(c => c.caseMasterId === caseId);
      if (!kase) return;
      districts.add(kase.district.name);
      
      const cid = `C-${caseId}`;
      add({
        id: cid, label: `FIR ${kase.crimeNo.slice(-6)}`, type: "case", cluster,
        meta: { district: kase.district.name, firstSeen: kase.registeredDate.slice(0, 10) },
      });
      edges.push({ source: off.id, target: cid, relation: "co-accused", weight: 2 });

      const lid = `L-${kase.district.id}`;
      add({ id: lid, label: kase.district.name, type: "location", cluster, meta: { district: kase.district.name } });
      edges.push({ source: cid, target: lid, relation: "occurred-at", weight: 1 });

      if (kase.victims.length > 0) {
        const victim = kase.victims[0];
        const vid = `V-${caseId}`;
        add({
          id: vid, label: victim.name, type: "victim", cluster,
          meta: { age: victim.age, district: kase.district.name },
        });
        edges.push({ source: vid, target: cid, relation: "victim-of", weight: 1 });
      }
    });

    if (i % 2 === 0) {
      const veh = `VEH-${off.id}`;
      add({ id: veh, label: VEHICLE_PLATES[i % VEHICLE_PLATES.length], type: "vehicle", cluster, meta: { plate: VEHICLE_PLATES[i % VEHICLE_PLATES.length] } });
      edges.push({ source: off.id, target: veh, relation: "drove", weight: 1.5 });
    }
  });

  return { nodes, edges, clusters };
}

export function computeAlerts(cases: Case[]) {
  // Generate alerts dynamically from cases
  if (cases.length === 0) return [];
  
  const recentCases = [...cases].sort((a, b) => b.caseMasterId - a.caseMasterId).slice(0, 6);
  return recentCases.map((c, i) => {
    let severity = "low";
    if (c.gravity === "Heinous") severity = "critical";
    else if (i % 3 === 0) severity = "high";
    else if (i % 2 === 0) severity = "medium";
    
    return {
      id: i + 1,
      severity,
      district: c.district.name,
      text: `${c.crimeHead.name}: ${c.briefFacts.slice(0, 45)}...`,
      time: "Just now"
    };
  });
}

// Main global DB state getter
export function getDbState() {
  const cases = getStoredCases();
  const kpis = computeKpis(cases);
  const dailyTrend = computeDailyTrend(cases);
  const districtStats = computeDistrictStats(cases);
  const hourly = computeHourly(cases);
  const headDist = computeHeadDist(cases);
  const socio = computeSocio(cases);
  
  const offenders = computeOffenders(cases);
  const offenderAssociates = computeOffenderAssociates(offenders, cases);
  const offenderPredictions = computeOffenderPredictions(offenders);
  const networkRich = computeNetworkRich(offenders, cases);
  const alerts = computeAlerts(cases);

  return {
    cases,
    kpis,
    dailyTrend,
    districtStats,
    hourly,
    headDist,
    socio,
    offenders,
    offenderAssociates,
    offenderPredictions,
    networkRich,
    alerts,
  };
}

export function computeSubAreas(districtId: number, districtStats: any[]): SubArea[] {
  const d = DISTRICTS.find(x => x.id === districtId);
  if (!d) return [];
  const stat = districtStats.find(s => s.district.id === d.id) || { total: 0 };
  const names = AREA_NAMES[d.name] ?? [`${d.name} Central`, `${d.name} North`, `${d.name} South`];
  
  const weights = names.map((n, i) => {
    const seed = (d.id * 131 + i * 17 + n.length) % 97;
    return 0.4 + (seed / 97) * 1.2;
  });
  const wSum = weights.reduce((a, b) => a + b, 0);
  
  const PEAK_BANDS = ["00:00–06:00","06:00–12:00","12:00–18:00","18:00–24:00"];

  return names.map((n, i) => {
    const share = weights[i] / wSum;
    const firs = Math.max(0, Math.round(stat.total * share));
    const seed = (d.id * 211 + i * 53) % 1000;
    const topCrime = CRIME_HEADS[seed % CRIME_HEADS.length].name;
    const peakHours = PEAK_BANDS[(seed >> 3) % PEAK_BANDS.length];
    const spike = stat.total > 0 ? Math.round(((seed % 60) - 15) + (share > 0.2 ? 12 : 0)) : 0;
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

export function computeMicroSpots(area: SubArea): MicroSpot[] {
  const count = 6 + ((area.name.length + area.districtId) % 4);
  const out: MicroSpot[] = [];
  const PEAK_BANDS = ["00:00–06:00","06:00–12:00","12:00–18:00","18:00–24:00"];
  for (let i = 0; i < count; i++) {
    const seed = (area.districtId * 977 + area.name.charCodeAt(0) * 53 + i * 131) % 10000;
    const share = 0.5 + ((seed % 100) / 100) * 1.4;
    const wSum = count * 1.2;
    const firs = area.firs > 0 ? Math.max(1, Math.round((area.firs * share) / wSum)) : 0;
    const topCrime = CRIME_HEADS[(seed >> 2) % CRIME_HEADS.length].name;
    const peakHours = PEAK_BANDS[(seed >> 5) % PEAK_BANDS.length];
    const spike = area.firs > 0 ? Math.round(((seed % 70) - 20) + (share > 1.3 ? 10 : 0)) : 0;
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
}
