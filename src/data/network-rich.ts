// Enriched network graph derived from OFFENDERS + CASES for the Association Atlas.
import { OFFENDERS, CASES } from "./mock";

export type EntityType = "accused" | "victim" | "case" | "location" | "vehicle" | "phone";
export type RelationType =
  | "co-accused" | "victim-of" | "occurred-at" | "called" | "drove" | "resides-at";

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
  "called":       "oklch(0.55 0.15 300)",
  "drove":        "oklch(0.55 0.14 155)",
  "resides-at":   "oklch(0.45 0.03 250)",
};

export const relationColor = (r: RelationType) => RELATION_COLORS[r];

const VEHICLE_PLATES = ["KA-01-XX-4421", "KA-05-MJ-9013", "KA-19-BZ-7702", "KA-09-AP-3388", "KA-51-KL-1147", "KA-25-RB-5560"];
const PHONE_NUMBERS  = ["+91 98450 ●●●32", "+91 96632 ●●●08", "+91 90080 ●●●17", "+91 99011 ●●●94", "+91 88677 ●●●45"];
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
      add({
        id: vid, label: victim.name, type: "victim", cluster,
        meta: { age: victim.age, district: kase.district.name },
      });
      edges.push({ source: vid, target: cid, relation: "victim-of", weight: 1 });
    });

    // vehicle + phone for some offenders
    if (i % 2 === 0) {
      const veh = `VEH-${off.id}`;
      add({ id: veh, label: VEHICLE_PLATES[i % VEHICLE_PLATES.length], type: "vehicle", cluster, meta: { plate: VEHICLE_PLATES[i % VEHICLE_PLATES.length] } });
      edges.push({ source: off.id, target: veh, relation: "drove", weight: 1.5 });
    }
    if (i % 3 === 0) {
      const ph = `PH-${off.id}`;
      add({ id: ph, label: PHONE_NUMBERS[i % PHONE_NUMBERS.length], type: "phone", cluster, meta: { number: PHONE_NUMBERS[i % PHONE_NUMBERS.length] } });
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
        aliases: [`"${off.name.split(" ")[0]} bhai"`],
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
