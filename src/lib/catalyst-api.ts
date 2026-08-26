import { CASES, DISTRICTS, CRIME_HEADS, type Case, type District } from "@/data/mock";

// In development, Vite proxies /server → Catalyst (see vite.config.ts).
// In production (any external host), set VITE_API_BASE to your full
// Catalyst serverless URL, e.g.:
//   https://ksp-60078060929.development.catalystserverless.in
// Leave empty string if deploying directly on Zoho Catalyst Hosting.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

const COURTS = [
  "JMFC Court",
  "District and Sessions Court",
  "City Civil Court",
  "High Court of Karnataka"
];

export async function fetchLiveCases(): Promise<Case[]> {
  try {
    const res = await fetch(`${API_BASE}/server/api/cases`);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const result = await res.json();
    if (result.status !== "success") {
      throw new Error(result.message || "Failed to fetch from serverless function");
    }

    const { cases = [], accused = [], victims = [], complainants = [], arrests = [], actSections = [], chargesheet = [] } = result.data || {};

    // Map ArrestSurrender by AccusedMasterID and ROWID
    const arrestMap = new Map<string, any>();
    (arrests || []).forEach((row: any) => {
      if (row.AccusedMasterID) arrestMap.set(String(row.AccusedMasterID), row);
      if (row.ROWID) arrestMap.set(String(row.ROWID), row);
    });

    // Map cases by both string ROWID and string CaseMasterID
    const caseMasterMap = new Map<string, {
      raw: any;
      accused: any[];
      victims: any[];
      complainants: any[];
      arrests: any[];
      actSections: any[];
      chargesheet: any[];
    }>();

    (cases || []).forEach((c: any) => {
      const entry = {
        raw: c,
        accused: [],
        victims: [],
        complainants: [],
        arrests: [],
        actSections: [],
        chargesheet: []
      };
      if (c.ROWID) caseMasterMap.set(String(c.ROWID), entry);
      if (c.CaseMasterID) caseMasterMap.set(String(c.CaseMasterID), entry);
    });

    // Group child records cleanly by matching CaseMasterID foreign key
    (accused || []).forEach((a: any) => {
      const parent = caseMasterMap.get(String(a.CaseMasterID));
      if (parent) parent.accused.push(a);
    });

    (victims || []).forEach((v: any) => {
      const parent = caseMasterMap.get(String(v.CaseMasterID));
      if (parent) parent.victims.push(v);
    });

    (complainants || []).forEach((cm: any) => {
      const parent = caseMasterMap.get(String(cm.CaseMasterID));
      if (parent) parent.complainants.push(cm);
    });

    (arrests || []).forEach((ar: any) => {
      const parent = caseMasterMap.get(String(ar.CaseMasterID));
      if (parent) parent.arrests.push(ar);
    });

    (actSections || []).forEach((ac: any) => {
      const parent = caseMasterMap.get(String(ac.CaseMasterID));
      if (parent) parent.actSections.push(ac);
    });

    (chargesheet || []).forEach((cs: any) => {
      const parent = caseMasterMap.get(String(cs.CaseMasterID));
      if (parent) parent.chargesheet.push(cs);
    });

    return (cases || []).map((row: any, index: number) => {
      const caseMasterId = Number(row.ROWID || row.CaseMasterID || index + 1000);
      const crimeNo = String(row.CrimeNo || `KA-${String(index + 1).padStart(4, "0")}-2026`);
      const key = String(row.ROWID || row.CaseMasterID);
      const mappedChildData = caseMasterMap.get(key) || { accused: [], victims: [], complainants: [], arrests: [], actSections: [], chargesheet: [] };

      // District resolution
      let distId = 0;
      const psId = Number(row.PoliceStationID);
      if (psId > 100 && psId <= 131) {
        distId = psId - 100;
      } else if (psId >= 1 && psId <= 31) {
        distId = psId;
      }

      let district = DISTRICTS.find(d => d.id === distId);
      if (!district && row.BriefFacts) {
        const factsLower = String(row.BriefFacts).toLowerCase();
        district = DISTRICTS.find(d => factsLower.includes(d.name.toLowerCase()));
      }
      if (!district && row.DistrictName) {
        district = DISTRICTS.find(d => d.name.toLowerCase() === String(row.DistrictName).toLowerCase());
      }
      if (!district) {
        const pseudoId = (index % DISTRICTS.length) + 1;
        district = DISTRICTS.find(d => d.id === pseudoId) || DISTRICTS[0];
      }

      const crimeHeadId = Number(row.CrimeMajorHeadID || (index % CRIME_HEADS.length) + 1);
      const crimeHead = CRIME_HEADS.find((ch) => ch.id === crimeHeadId) || CRIME_HEADS[0];

      const complainantRaw = mappedChildData.complainants[0];
      const complainant = complainantRaw ? {
        name: complainantRaw.ComplainantName || "Unknown Complainant",
        age: Number(complainantRaw.AgeYear) || 35,
        gender: complainantRaw.GenderID === 2 || complainantRaw.GenderID === "2" ? "F" : "M",
        occupation: complainantRaw.OccupationID === 1 ? "Farmer" : complainantRaw.OccupationID === 2 ? "Business" : complainantRaw.OccupationID === 3 ? "Government Employee" : complainantRaw.OccupationID === 4 ? "Private Sector Employee" : complainantRaw.OccupationID === 5 ? "Student" : complainantRaw.OccupationID === 6 ? "Unemployed" : "Others",
        religion: complainantRaw.ReligionID === 1 ? "Hindu" : complainantRaw.ReligionID === 2 ? "Muslim" : complainantRaw.ReligionID === 3 ? "Christian" : complainantRaw.ReligionID === 4 ? "Sikh" : complainantRaw.ReligionID === 5 ? "Buddhist" : complainantRaw.ReligionID === 6 ? "Jain" : "Others",
        caste: complainantRaw.CasteID === 1 ? "General" : complainantRaw.CasteID === 2 ? "OBC" : complainantRaw.CasteID === 3 ? "SC" : complainantRaw.CasteID === 4 ? "ST" : "General"
      } : {
        name: "Unknown Complainant",
        age: 35,
        gender: "M",
        occupation: "Business",
        religion: "Hindu",
        caste: "General"
      };

      const victims = mappedChildData.victims.map((v, vIdx) => ({
        name: v.VictimName || `Victim ${vIdx + 1}`,
        age: Number(v.AgeYear) || 30,
        gender: v.GenderID === 2 || v.GenderID === "2" ? "F" : "M",
        isPolice: v.VictimPolice === true || v.VictimPolice === 1 || v.VictimPolice === "1" || v.VictimPolice === "true",
        photo: v.photo || ""
      }));

      const accused = mappedChildData.accused.map((a, aIdx) => {
        const accusedMasterId = String(a.AccusedMasterID || a.ROWID || aIdx);
        const arrestRecord = arrestMap.get(accusedMasterId) || arrestMap.get(String(a.ROWID));
        const isArrested = !!arrestRecord;

        return {
          id: a.PersonID || `A${aIdx + 1}`,
          name: a.AccusedName || `Accused ${aIdx + 1}`,
          age: Number(a.AgeYear) || 25,
          gender: a.GenderID === 2 || a.GenderID === "2" ? "F" : "M",
          arrested: isArrested,
          arrestId: isArrested ? Number(accusedMasterId) || (aIdx + 1) : undefined,
          arrestDate: isArrested ? String(arrestRecord.ArrestSurrenderDate || "").slice(0, 10) : undefined,
          arrestDistrict: isArrested ? (DISTRICTS.find(d => d.id === Number(arrestRecord.ArrestSurrenderDistrictId))?.name || "Bengaluru Urban") : undefined,
          ioName: isArrested ? `Officer ID ${arrestRecord.IOID}` : undefined,
          courtName: isArrested ? (COURTS[Number(arrestRecord.CourtID) - 1] || "JMFC Court") : undefined,
          photo: a.photo || ""
        };
      });

      let actSections = mappedChildData.actSections.map(ac => {
        const actName = ac.ActID === 1 || ac.ActID === "1" ? "BNS" : ac.ActID === 2 || ac.ActID === "2" ? "IPC" : "IT Act";
        const secName = ac.SectionID || "103";
        return `${actName} ${secName}`;
      });

      if (!actSections || actSections.length === 0) {
        actSections = ["BNS 103"];
      }

      let moTag = "Crime Scene Investigation";
      const factsLower = String(row.BriefFacts || "").toLowerCase();
      if (factsLower.includes("chain") || factsLower.includes("snatch")) {
        moTag = "Chain Snatching";
      } else if (factsLower.includes("rob") || factsLower.includes("threat")) {
        moTag = "Highway Robbery";
      } else if (factsLower.includes("scam") || factsLower.includes("phish") || factsLower.includes("online")) {
        moTag = "Online Fraud";
      } else if (factsLower.includes("murder") || factsLower.includes("kill")) {
        moTag = "Personal Enmity";
      } else if (factsLower.includes("accid") || factsLower.includes("crash") || factsLower.includes("hit")) {
        moTag = "Rash Driving";
      } else if (crimeHead.name.includes("Burglary") || crimeHead.name.includes("Theft") || crimeHead.name.includes("Property")) {
        moTag = "Night Burglary";
      }

      let hour = 10;
      if (row.IncidentFromDate) {
        const parsedDate = new Date(String(row.IncidentFromDate).replace(' ', 'T'));
        if (!isNaN(parsedDate.getTime())) {
          hour = parsedDate.getHours();
        }
      }

      const regDate = String(row.CrimeRegisteredDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
      const incDate = String(row.IncidentFromDate || row.CrimeRegisteredDate || "").slice(0, 10) || regDate;

      const statusId = Number(row.CaseStatusID || 1);
      const statusMap: { [key: number]: string } = {
        1: "Under Investigation",
        2: "Charge Sheeted",
        3: "Closed",
        4: "Pending Trial"
      };
      const status = statusMap[statusId] || "Under Investigation";

      const primaryChargesheet = mappedChildData.chargesheet?.[0];
      const chargesheetNo = primaryChargesheet ? `CS-${primaryChargesheet.CSID}` : (status === "Charge Sheeted" ? `CS-${Number(row.CaseMasterID || row.ROWID || index + 1000) % 10000}` : undefined);
      const chargesheetDate = primaryChargesheet ? String(primaryChargesheet.csdate || "").slice(0, 10) : (status === "Charge Sheeted" ? regDate : undefined);
      const chargesheetType = primaryChargesheet ? primaryChargesheet.cstype : (status === "Charge Sheeted" ? "Original Chargesheet" : undefined);

      return {
        caseMasterId,
        crimeNo,
        registeredDate: regDate,
        incidentDate: incDate,
        hour,
        district,
        policeStation: row.PoliceStationName || `Station ${row.PoliceStationID || 'A'}`,
        category: row.CaseCategoryID === 3 ? "UDR" : row.CaseCategoryID === 8 ? "Zero FIR" : "FIR",
        gravity: Number(row.GravityOffenceID) === 1 ? "Heinous" : "Non-Heinous",
        crimeHead,
        status,
        actSections,
        moTag,
        briefFacts: String(row.BriefFacts || "Case record retrieved from Zoho Catalyst console."),
        complainant,
        victims,
        accused,
        latitude: Number(row.latitude || row.Latitude || 12.9716),
        longitude: Number(row.longitude || row.Longitude || 77.5946),
        officerPhoto: row.officerPhoto || "",
        chargesheetNo,
        chargesheetDate,
        chargesheetType
      };
    });
  } catch (err) {
    console.warn("Catalyst live DB fetch failed:", err);
    throw err;
  }
}

export async function fetchLiveTables(): Promise<{ tables: any[]; data: Record<string, any[]> }> {
  try {
    const res = await fetch(`${API_BASE}/server/api/tables`);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const result = await res.json();
    return {
      tables: result.tables || [],
      data: result.data || {}
    };
  } catch (err) {
    console.warn("Failed to fetch live tables from Catalyst serverless API:", err);
    return { tables: [], data: {} };
  }
}

export async function fetchLiveDistricts(): Promise<District[]> {
  return DISTRICTS;
}

export async function insertLiveCase(newCase: Omit<Case, "caseMasterId">): Promise<Case> {
  const res = await fetch(`${API_BASE}/server/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newCase)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to insert case via serverless function: ${errorText}`);
  }

  const result = await res.json();
  if (result.status !== "success") {
    throw new Error(result.message || "Serverless function returned failure");
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("zoho-table-update"));
  }

  return result.data;
}

export async function updateLiveCase(
  caseMasterId: number, 
  status: string, 
  briefFacts: string,
  chargesheetNo?: string,
  chargesheetDate?: string,
  chargesheetType?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/server/api/cases`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseMasterId, status, briefFacts, chargesheetNo, chargesheetDate, chargesheetType })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update case: ${errorText}`);
  }
  const result = await res.json();
  if (result.status !== "success") {
    throw new Error(result.message || "Server returned failure");
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("zoho-table-update"));
  }
}

export async function clearLiveCases() {
  const res = await fetch(`${API_BASE}/server/api/cases`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to clear datastore: ${errorText}`);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("zoho-table-update"));
  }
}

export async function seedLiveCases(cases: Case[]) {
  const subset = cases.slice(0, 12);
  for (const c of subset) {
    await insertLiveCase(c);
  }
}

