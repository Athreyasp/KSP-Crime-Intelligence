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

    // Map ArrestSurrender by AccusedMasterID
    const arrestMap = new Map<number, any>();
    (arrests || []).forEach((row: any) => {
      const accId = Number(row.AccusedMasterID);
      if (accId) arrestMap.set(accId, row);
    });

    // Map ActSectionAssociation by CaseMasterID
    const actMap = new Map<number, string[]>();
    (actSections || []).forEach((row: any) => {
      const cid = Number(row.CaseMasterID);
      if (cid) {
        if (!actMap.has(cid)) actMap.set(cid, []);
        const actName = row.ActID === 1 ? "BNS" : row.ActID === 2 ? "IPC" : "IT Act";
        const secName = row.SectionID || "103";
        actMap.get(cid)!.push(`${actName} ${secName}`);
      }
    });

    // Map accused by CaseMasterID
    const accusedMap = new Map<number, any[]>();
    (accused || []).forEach((row: any, idx: number) => {
      const cid = Number(row.CaseMasterID);
      if (!accusedMap.has(cid)) accusedMap.set(cid, []);
      
      const accusedMasterId = Number(row.ROWID || row.AccusedMasterID || idx);
      const arrestRecord = arrestMap.get(accusedMasterId);
      const isArrested = !!arrestRecord;
      
      accusedMap.get(cid)!.push({
        id: row.PersonID || `A${idx + 1}`,
        name: row.AccusedName || "Unknown Accused",
        age: Number(row.AgeYear) || 25,
        gender: row.GenderID === 2 ? "F" : row.GenderID === 3 ? "T" : "M",
        arrestId: isArrested ? accusedMasterId : undefined,
        arrestDate: isArrested ? String(arrestRecord.ArrestSurrenderDate || "").slice(0, 10) : undefined,
        arrestDistrict: isArrested ? (DISTRICTS.find(d => d.id === Number(arrestRecord.ArrestSurrenderDistrictId))?.name || "Bengaluru City") : undefined,
        ioName: isArrested ? `Officer ID ${arrestRecord.IOID}` : undefined,
        courtName: isArrested ? (COURTS[Number(arrestRecord.CourtID) - 1] || "JMFC Court") : undefined
      });
    });

    // Map victims by CaseMasterID
    const victimsMap = new Map<number, any[]>();
    (victims || []).forEach((row: any) => {
      const cid = Number(row.CaseMasterID);
      if (!victimsMap.has(cid)) victimsMap.set(cid, []);
      
      const isPoliceVal = row.VictimPolice === true || row.VictimPolice === 1 || row.VictimPolice === "1" || row.VictimPolice === "true";
      victimsMap.get(cid)!.push({
        name: row.VictimName || "Unknown Victim",
        age: Number(row.AgeYear) || 30,
        gender: row.GenderID === 2 ? "F" : row.GenderID === 3 ? "T" : "M",
        isPolice: isPoliceVal
      });
    });

    // Map complainants by CaseMasterID
    const complainantsMap = new Map<number, any>();
    (complainants || []).forEach((row: any) => {
      const cid = Number(row.CaseMasterID);
      complainantsMap.set(cid, row);
    });

    return (cases || []).map((row: any) => {
      const caseMasterId = Number(row.ROWID || row.CaseMasterID);
      const crimeNo = String(row.CrimeNo || "");
      const distId = Number(crimeNo.substring(1, 5));
      const district = DISTRICTS.find((d) => d.id === distId) || DISTRICTS.find((d) => d.name === row.DistrictName) || DISTRICTS[0];

      const crimeHeadId = Number(row.CrimeMajorHeadID || 1);
      const crimeHead = CRIME_HEADS.find((ch) => ch.id === crimeHeadId) || CRIME_HEADS[0];

      const complainantRaw = complainantsMap.get(caseMasterId);
      const complainant = complainantRaw ? {
        name: complainantRaw.ComplainantName || "Unknown Complainant",
        age: Number(complainantRaw.AgeYear) || 35,
        gender: complainantRaw.GenderID === 2 ? "F" : complainantRaw.GenderID === 3 ? "T" : "M",
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

      const victims = victimsMap.get(caseMasterId) || [];
      const accused = accusedMap.get(caseMasterId) || [];

      const statusMap: Record<number, string> = {
        1: "Under Investigation",
        2: "Charge Sheeted",
        3: "Closed",
        4: "Pending Trial"
      };
      const statusId = Number(row.CaseStatusID || 1);
      const status = statusMap[statusId] || "Under Investigation";

      let actSections = actMap.get(caseMasterId);
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
      } else if (crimeHead.name.includes("Burglary") || crimeHead.name.includes("Theft")) {
        moTag = "Night Burglary";
      }

      return {
        caseMasterId,
        crimeNo,
        registeredDate: String(row.CrimeRegisteredDate || "").slice(0, 10),
        incidentDate: String(row.IncidentFromDate || row.CrimeRegisteredDate || "").slice(0, 10),
        hour: row.IncidentFromDate ? new Date(row.IncidentFromDate).getHours() : 10,
        district,
        policeStation: row.PoliceStationName || `Station ${row.PoliceStationID || 'A'}`,
        category: row.CaseCategoryID === 3 ? "UDR" : row.CaseCategoryID === 8 ? "Zero FIR" : "FIR",
        gravity: row.GravityOffenceID === 1 ? "Heinous" : "Non-Heinous",
        crimeHead,
        status,
        actSections,
        moTag,
        briefFacts: String(row.BriefFacts || ""),
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
}

export async function seedLiveCases(cases: Case[]) {
  const subset = cases.slice(0, 12);
  for (const c of subset) {
    await insertLiveCase(c);
  }
}
