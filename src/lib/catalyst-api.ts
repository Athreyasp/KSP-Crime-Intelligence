import { CASES, DISTRICTS, CRIME_HEADS, type Case, type District } from "@/data/mock";

const COURTS = [
  "JMFC Court",
  "District and Sessions Court",
  "City Civil Court",
  "High Court of Karnataka"
];

export async function fetchLiveCases(): Promise<Case[]> {
  try {
    const res = await fetch("/server/api/cases");
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const result = await res.json();
    if (result.status !== "success") {
      throw new Error(result.message || "Failed to fetch from serverless function");
    }

    const { cases = [], accused = [], victims = [], complainants = [], arrests = [], actSections = [] } = result.data || {};

    // Map ArrestSurrender by AccusedMasterID and ROWID
    const arrestMap = new Map<string, any>();
    (arrests || []).forEach((row: any) => {
      if (row.AccusedMasterID) arrestMap.set(String(row.AccusedMasterID), row);
      if (row.ROWID) arrestMap.set(String(row.ROWID), row);
    });

    // Map cases by string ROWID / CaseMasterID
    const caseMasterMap = new Map<string, {
      raw: any;
      accused: any[];
      victims: any[];
      complainants: any[];
      arrests: any[];
      actSections: any[];
    }>();

    (cases || []).forEach((c: any) => {
      const key = String(c.ROWID || c.CaseMasterID);
      caseMasterMap.set(key, {
        raw: c,
        accused: [],
        victims: [],
        complainants: [],
        arrests: [],
        actSections: []
      });
    });

    // Sequential ROWID grouping (handles cases where child tables store truncated CaseMasterID in Catalyst)
    const allItems: { type: string; rowId: bigint; raw: any }[] = [];
    (cases || []).forEach((c: any) => c.ROWID && allItems.push({ type: 'case', rowId: BigInt(c.ROWID), raw: c }));
    (accused || []).forEach((a: any) => a.ROWID && allItems.push({ type: 'accused', rowId: BigInt(a.ROWID), raw: a }));
    (victims || []).forEach((v: any) => v.ROWID && allItems.push({ type: 'victim', rowId: BigInt(v.ROWID), raw: v }));
    (complainants || []).forEach((cm: any) => cm.ROWID && allItems.push({ type: 'complainant', rowId: BigInt(cm.ROWID), raw: cm }));
    (arrests || []).forEach((ar: any) => ar.ROWID && allItems.push({ type: 'arrest', rowId: BigInt(ar.ROWID), raw: ar }));
    (actSections || []).forEach((ac: any) => ac.ROWID && allItems.push({ type: 'act', rowId: BigInt(ac.ROWID), raw: ac }));

    allItems.sort((a, b) => (a.rowId < b.rowId ? -1 : a.rowId > b.rowId ? 1 : 0));

    let activeCaseKey: string | null = null;
    allItems.forEach(item => {
      if (item.type === 'case') {
        activeCaseKey = String(item.raw.ROWID || item.raw.CaseMasterID);
      } else if (activeCaseKey && caseMasterMap.has(activeCaseKey)) {
        const target = caseMasterMap.get(activeCaseKey)!;
        if (item.type === 'accused') target.accused.push(item.raw);
        else if (item.type === 'victim') target.victims.push(item.raw);
        else if (item.type === 'complainant') target.complainants.push(item.raw);
        else if (item.type === 'arrest') target.arrests.push(item.raw);
        else if (item.type === 'act') target.actSections.push(item.raw);
      }
    });

    return (cases || []).map((row: any, index: number) => {
      const caseMasterId = Number(row.ROWID || row.CaseMasterID || index + 1000);
      const crimeNo = String(row.CrimeNo || `KA-${String(index + 1).padStart(4, "0")}-2026`);
      const key = String(row.ROWID || row.CaseMasterID);
      const mappedChildData = caseMasterMap.get(key) || { accused: [], victims: [], complainants: [], arrests: [], actSections: [] };

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
        isPolice: v.VictimPolice === true || v.VictimPolice === 1 || v.VictimPolice === "1" || v.VictimPolice === "true"
      }));

      const accused = mappedChildData.accused.map((a, aIdx) => {
        const accusedMasterId = String(a.ROWID || a.AccusedMasterID || aIdx);
        const arrestRecord = arrestMap.get(accusedMasterId);
        const isArrested = !!arrestRecord;

        return {
          id: a.PersonID || `A${aIdx + 1}`,
          name: a.AccusedName || `Accused ${aIdx + 1}`,
          age: Number(a.AgeYear) || 25,
          gender: a.GenderID === 2 || a.GenderID === "2" ? "F" : "M",
          arrestId: isArrested ? Number(accusedMasterId) || (aIdx + 1) : undefined,
          arrestDate: isArrested ? String(arrestRecord.ArrestSurrenderDate || "").slice(0, 10) : undefined,
          arrestDistrict: isArrested ? (DISTRICTS.find(d => d.id === Number(arrestRecord.ArrestSurrenderDistrictId))?.name || "Bengaluru City") : undefined,
          ioName: isArrested ? `Officer ID ${arrestRecord.IOID}` : undefined,
          courtName: isArrested ? (COURTS[Number(arrestRecord.CourtID) - 1] || "JMFC Court") : undefined
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
      };
    });
  } catch (err) {
    console.warn("Catalyst live DB fetch failed:", err);
    throw err;
  }
}

export async function fetchLiveTables(): Promise<{ tables: any[]; data: Record<string, any[]> }> {
  try {
    const res = await fetch("/server/api/tables");
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
  const res = await fetch("/server/api/cases", {
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

export async function clearLiveCases() {
  const res = await fetch("/server/api/cases", {
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

