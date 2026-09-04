import React, { useState, useEffect, useRef, useMemo } from "react";
import { Terminal, X, Send, ShieldAlert, Network, Database, User, RefreshCw, ArrowRight, Mic, MicOff, ChevronRight, BadgeCheck } from "lucide-react";
import { useDb } from "@/hooks/use-db";

const BotIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="black" />
    <rect x="36" y="36" width="10" height="22" rx="5" fill="white" transform="rotate(12 41 47)" className="animate-bot-blink" />
    <rect x="54" y="34" width="10" height="22" rx="5" fill="white" transform="rotate(12 59 45)" className="animate-bot-blink" />
  </svg>
);
import { useLanguage } from "@/hooks/use-language";
import { toast } from "sonner";

type PredictionData = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore: number;          // 0-100
  nextCrimeType: string;
  atRiskDistricts: string[];
  estimatedWindow: string;
  behavioralTriggers: string[];
  recidivismChance: number;   // 0-100
  escalationTrend: "STABLE" | "ESCALATING" | "DE-ESCALATING";
  patternSummary: string;
};

type FirData = {
  crimeNo: string;
  targetAccused: string;
  status: string;
  gravity: string;
  crimeHead: string;
  policeStation: string;
  district: string;
  date: string;
  acts: string;
  officer: string;
  victims: string[];
  accused: string[];
  briefFacts: string;
  done: string;
  prediction: PredictionData;
};

type Message = {
  id: string;
  sender: "user" | "system" | "security";
  text: string;
  timestamp: string;
  formType?: "name" | "fir";
  firData?: FirData;
  graphData?: {
    criminal: string;
    connections: { name: string; role: "Co-Accused" | "Victim"; strength: number }[];
  };
};

function generateBNSAdvisorReport(
  userQuery: string,
  allCases: any[],
  offenders: any[],
  language: string
): string {
  const query = userQuery.toLowerCase().trim();
  const isKn = language === "kn";

  // 1. SEARCH FOR SPECIFIC CASE OR OFFENDER IN DATABASE
  let matchedCase: any = null;

  // Search by exact FIR Number or Case ID
  matchedCase = allCases.find((c: any) => {
    const crimeNoStr = String(c.crimeNo || "").toLowerCase();
    const caseIdStr = String(c.caseMasterId || "").toLowerCase();
    return (
      query.includes(crimeNoStr) ||
      (c.crimeNo && query.includes(c.crimeNo.split("/")[0])) ||
      query.includes(`case ${caseIdStr}`) ||
      query.includes(`fir ${crimeNoStr}`) ||
      (caseIdStr.length > 2 && query.includes(caseIdStr))
    );
  });

  // Search by Accused Name if no case found yet
  if (!matchedCase) {
    matchedCase = allCases.find((c: any) =>
      c.accused?.some((a: any) => a.name && query.includes(a.name.toLowerCase()))
    );
  }

  // Search by Offender Name if no case found yet
  if (!matchedCase) {
    const matchedOffender = offenders.find((o: any) => o.name && query.includes(o.name.toLowerCase()));
    if (matchedOffender && matchedOffender.cases && matchedOffender.cases.length > 0) {
      matchedCase = allCases.find((c: any) => c.caseMasterId === matchedOffender.cases[0]);
    }
  }

  // Search by Police Station / District Name if no case found yet
  if (!matchedCase) {
    matchedCase = allCases.find((c: any) =>
      (c.policeStation && query.includes(c.policeStation.toLowerCase())) ||
      (c.district?.name && query.includes(c.district.name.toLowerCase()))
    );
  }

  // IF A SPECIFIC CASE MATCH WAS FOUND IN DATABASE:
  if (matchedCase) {
    const c = matchedCase;
    const crimeHeadName = c.crimeHead?.name || "Offence";
    const districtName = c.district?.name || "Karnataka District";
    const stationName = c.policeStation || "PS";
    const brief = c.briefFacts || "Case file under active investigation.";
    const accusedNames = (c.accused || []).map((a: any) => `${a.name}${a.arrestId || a.isArrested ? " (In Custody)" : " (At Large)"}`).join(", ") || "Unidentified Suspects";

    let bnsPrimary = "BNS Section 303(2) (Theft)";
    let ipcLegacy = "IPC Section 379";
    let penalty = isKn ? "3 ವರ್ಷಗಳವರೆಗೆ ಜೈಲು ಶಿಕ್ಷೆ ಅಥವಾ ದಂಡ. ಜಾಮೀನು ರಹಿತ, ಕಾಗ್ನಿಜಬಲ್." : "Imprisonment up to 3 years, or fine, or both. Non-bailable, Cognizable.";
    let secondarySections: string[] = [];

    const textToScan = `${crimeHeadName} ${brief} ${c.moTag || ""}`.toLowerCase();

    if (textToScan.includes("murder") || textToScan.includes("kill") || textToScan.includes("homicide")) {
      bnsPrimary = "BNS Section 103(1) (Murder)";
      ipcLegacy = "IPC Section 302";
      penalty = isKn ? "ಮರಣದಂಡನೆ ಅಥವಾ ಜೀವಾವಧಿ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ, ಕಾಗ್ನಿಜಬಲ್." : "Death or Imprisonment for Life, and fine. Non-bailable, Cognizable.";
      secondarySections.push("BNS Section 61 (Criminal Conspiracy)", "BNSS Section 187 (Custody Remand Procedure)");
    } else if (textToScan.includes("attempt to murder") || textToScan.includes("stabbing") || textToScan.includes("shoot") || textToScan.includes("gun")) {
      bnsPrimary = "BNS Section 109 (Attempt to Murder)";
      ipcLegacy = "IPC Section 307";
      penalty = isKn ? "10 ವರ್ಷಗಳವರೆಗೆ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ; ಗಾಯ ಉಂಟಾದರೆ ಜೀವಾವಧಿ. ಜಾಮೀನು ರಹಿತ." : "Imprisonment up to 10 years and fine; if hurt caused, up to Life. Non-bailable.";
      secondarySections.push("BNS Section 118 (Grievous hurt by dangerous weapon)", "Arms Act Section 25/27");
    } else if (textToScan.includes("robbery") || textToScan.includes("dacoity") || textToScan.includes("gang") || textToScan.includes("extortion")) {
      bnsPrimary = textToScan.includes("dacoity") || textToScan.includes("gang") ? "BNS Section 310 (Dacoity / Gang Robbery)" : "BNS Section 309 (Robbery)";
      ipcLegacy = textToScan.includes("dacoity") ? "IPC Section 395" : "IPC Section 392";
      penalty = isKn ? "10 ರಿಂದ 14 ವರ್ಷಗಳವರೆಗೆ ಕಠಿಣ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ." : "Rigorous imprisonment 10 to 14 years and fine. Non-bailable.";
      secondarySections.push("BNS Section 111 (Organized Crime Syndicate)", "BNS Section 308 (Extortion)");
    } else if (textToScan.includes("burglary") || textToScan.includes("housebreak") || textToScan.includes("shutter") || textToScan.includes("night") || textToScan.includes("lock")) {
      bnsPrimary = "BNS Section 331(4) (Lurking house-trespass or house-breaking by night)";
      ipcLegacy = "IPC Section 457";
      penalty = isKn ? "14 ವರ್ಷಗಳವರೆಗೆ ಕಠಿಣ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ." : "Rigorous imprisonment up to 14 years and fine. Non-bailable.";
      secondarySections.push("BNS Section 305 (Theft in dwelling house)", "BNS Section 317 (Receiving stolen property)");
    } else if (textToScan.includes("snatch") || textToScan.includes("chain")) {
      bnsPrimary = "BNS Section 307 (Snatching - New BNS Offence)";
      ipcLegacy = "Legacy IPC Section 379A";
      penalty = isKn ? "3 ವರ್ಷಗಳವರೆಗೆ ಕಠಿಣ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ." : "Rigorous imprisonment up to 3 years and fine. Non-bailable.";
      secondarySections.push("BNS Section 317 (Stolen Property)");
    } else if (textToScan.includes("cyber") || textToScan.includes("phish") || textToScan.includes("fraud") || textToScan.includes("online") || textToScan.includes("cheating") || textToScan.includes("bank")) {
      bnsPrimary = "BNS Section 318(4) (Cheating & Dishonestly Inducing Delivery of Property)";
      ipcLegacy = "IPC Section 420 / 419";
      penalty = isKn ? "7 ವರ್ಷಗಳವರೆಗೆ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ, ಪ್ರಥಮ ದರ್ಜೆ ಮ್ಯಾಜಿಸ್ಟ್ರೇಟ್ ವಿಚಾರಣೆ." : "Imprisonment up to 7 years and fine. Non-bailable, Cognizable.";
      secondarySections.push("IT Act Section 66C (Identity Theft)", "IT Act Section 66D (Cheating by Computer Resource)");
    } else if (textToScan.includes("assault") || textToScan.includes("hurt") || textToScan.includes("fight") || textToScan.includes("weapon")) {
      bnsPrimary = "BNS Section 117 (Voluntarily Causing Grievous Hurt)";
      ipcLegacy = "IPC Section 325 / 323";
      penalty = isKn ? "7 ವರ್ಷಗಳವರೆಗೆ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ/ಸಹಿತ." : "Imprisonment up to 7 years and fine. Non-bailable/Bailable.";
      secondarySections.push("BNS Section 126 (Wrongful Restraint)", "BNS Section 189 (Unlawful Assembly)");
    }

    if (isKn) {
      return `⚖️ [ಪ್ರಕರಣದ ನಿರ್ದಿಷ್ಟ BNS ಕಾನೂನು ಸಲಹಾ ವರದಿ - FIR #${c.crimeNo}]

• ಪ್ರಕರಣ ಸಂಖ್ಯೆ: FIR No. ${c.crimeNo} (${c.policeStation}, ${districtName})
• ಅಪರಾಧ ವರ್ಗೀಕರಣ: ${crimeHeadName} [ಗಾಂಭೀರ್ಯತೆ: ${c.gravity}]
• ಆರೋಪಿಗಳ ಪಟ್ಟಿ: ${accusedNames}

---------------------------------------------------
📌 ಪ್ರಾಥಮಿಕ ಬಿಎನ್‌ಎಸ್ (BNS, 2023) ಸೆಕ್ಷನ್‌ಗಳು:
• ಪ್ರಮುಖ BNS ಸೆಕ್ಷನ್: ${bnsPrimary}
• ಹಳೆಯ IPC ಸಮಾನ ಸೆಕ್ಷನ್: ${ipcLegacy}
• ಶಿಕ್ಷೆ ಮತ್ತು ಕಾನೂನು ಸ್ವರೂಪ: ${penalty}

🛡️ ಹೆಚ್ಚುವರಿ ಲಗತ್ತಿಸಬೇಕಾದ ಬಿಎನ್‌ಎಸ್/ವಿಶೇಷ ಕಾಯ್ದೆಗಳು:
${secondarySections.length > 0 ? secondarySections.map(s => `  • ${s}`).join("\n") : "  • BNS Section 61 (Criminal Conspiracy)"}

📋 ಪ್ರಕರಣದ ನೈಜ ಸಾರಾಂಶ ವಿಶ್ಲೇಷಣೆ:
"${brief}"

💡 ತನಿಖಾಧಿಕಾರಿಗಳಿಗೆ (IO) ಕಾರ್ಯವಿಧಾನ ನಿರ್ದೇಶನ:
1. ಎಫ್‌ಐಆರ್ ದಾಖಲಾತಿ ಫಾರ್ಮ್‌ನ ಹಂತ 3 ರಲ್ಲಿ ${bnsPrimary} ಮತ್ತು ${secondarySections[0] || "BNS 317"} ಸೆಕ್ಷನ್‌ಗಳನ್ನು ನೋಂದಾಯಿಸಿ.
2. ಬಿಎನ್‌ಎಸ್‌ಎಸ್ (BNSS, 2023) ರ ಸೆಕ್ಷನ್ 176(3) ರ ಪ್ರಕಾರ ಫೊರೆನ್ಸಿಕ್ ಮತ್ತು ಡಿಜಿಟಲ್ ಪುರಾವೆಗಳನ್ನು ಕಡ್ಡಾಯವಾಗಿ ಸಂಗ್ರಹಿಸಿ.
3. ಬಂಧಿತ ಆರೋಪಿಗಳ ವಿಚಾರಣೆಯನ್ನು BNSS ಸೆಕ್ಷನ್ 187 ರ ಪ್ರಕಾರ ನಡೆಸಿ.`;
    } else {
      return `⚖️ [CASE-SPECIFIC BNS LEGAL ADVISOR REPORT · FIR #${c.crimeNo}]

• Case Identification: FIR No. ${c.crimeNo} (${c.policeStation}, ${districtName})
• Crime Classification: ${crimeHeadName} [Gravity: ${c.gravity}]
• Linked Suspects: ${accusedNames}

---------------------------------------------------
📌 PRIMARY BNS (2023) STATUTORY MAPPING:
• Primary BNS Section: ${bnsPrimary}
• Legacy IPC Equivalent: ${ipcLegacy}
• Statutory Mandate & Penalty: ${penalty}

🛡️ RECOMMENDED ADDITIONAL STATUTORY PROVISIONS:
${secondarySections.length > 0 ? secondarySections.map(s => `  • ${s}`).join("\n") : "  • BNS Section 61 (Criminal Conspiracy)"}

📋 FACTUAL CASE ANALYSIS:
"${brief}"

💡 INVESTIGATING OFFICER (IO) PROCEDURAL DIRECTIVES:
1. Formally record ${bnsPrimary} and ${secondarySections[0] || "BNS Section 317"} inside Step 3 (Acts & Sections) of the FIR form.
2. Mandatory collection of digital & physical evidence under BNSS Section 176(3).
3. Follow strict custody & remand timelines under BNSS Section 187.`;
    }
  }

  // 2. GENERAL DEEP BNS QUERY MAPPING FOR QUERY-BASED INPUTS
  let bnsSec = "BNS Section 303(2) (Theft)";
  let ipcSec = "IPC Section 379";
  let details = isKn 
    ? "3 ವರ್ಷಗಳವರೆಗೆ ಜೈಲು ಶಿಕ್ಷೆ ಅಥವಾ ದಂಡ. ಜಾಮೀನು ರಹಿತ, ಯಾವುದೇ ಮ್ಯಾಜಿಸ್ಟ್ರೇಟ್ ಅವರಿಂದ ವಿಚಾರಣೆ."
    : "Punishment: Imprisonment up to 3 years, or fine, or both. Non-bailable, triable by any Magistrate.";
  let addlSections: string[] = [];

  if (query.includes("murder") || query.includes("kill") || query.includes("homicide") || query.includes("death") || query.includes("dead")) {
    bnsSec = "BNS Section 103(1) (Murder)";
    ipcSec = "IPC Section 302";
    details = isKn 
      ? "ಮರಣದಂಡನೆ ಅಥವಾ ಜೀವಾವಧಿ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ, ಸೆಷನ್ಸ್ ನ್ಯಾಯಾಲಯ ವಿಚಾರಣೆ."
      : "Punishment: Death or Imprisonment for Life, and fine. Non-bailable, Cognizable, triable by Court of Session.";
    addlSections = ["BNS Section 61 (Criminal Conspiracy)", "BNSS Section 187 (Custody Remand)"];
  } else if (query.includes("attempt to murder") || query.includes("stabbing") || query.includes("shoot") || query.includes("gun")) {
    bnsSec = "BNS Section 109 (Attempt to Murder)";
    ipcSec = "IPC Section 307";
    details = isKn 
      ? "10 ವರ್ಷಗಳವರೆಗೆ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ; ಗಾಯ ಸಂಭವಿಸಿದರೆ ಜೀವಾವಧಿ. ಜಾಮೀನು ರಹಿತ."
      : "Punishment: Imprisonment up to 10 years and fine; up to Life if hurt is caused. Non-bailable.";
    addlSections = ["BNS Section 118 (Grievous hurt with weapon)", "Arms Act Section 25/27"];
  } else if (query.includes("robbery") || query.includes("dacoity") || query.includes("extortion") || query.includes("gang")) {
    bnsSec = query.includes("dacoity") || query.includes("gang") ? "BNS Section 310 (Dacoity / Gang Robbery)" : "BNS Section 309 (Robbery)";
    ipcSec = query.includes("dacoity") ? "IPC Section 395" : "IPC Section 392";
    details = isKn 
      ? "10 ರಿಂದ 14 ವರ್ಷಗಳವರೆಗೆ ಕಠಿಣ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ."
      : "Punishment: Rigorous imprisonment up to 10 to 14 years and fine. Non-bailable.";
    addlSections = ["BNS Section 111 (Organized Crime Syndicate)", "BNS Section 308 (Extortion)"];
  } else if (query.includes("trespass") || query.includes("break") || query.includes("night") || query.includes("window") || query.includes("shutter") || query.includes("house")) {
    bnsSec = "BNS Section 331(4) (Lurking house-trespass or house-breaking by night)";
    ipcSec = "IPC Section 457";
    details = isKn 
      ? "14 ವರ್ಷಗಳವರೆಗೆ ಕಠಿಣ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ, ಪ್ರಥಮ ದರ್ಜೆ ಮ್ಯಾಜಿಸ್ಟ್ರೇಟ್ ವಿಚಾರಣೆ."
      : "Punishment: Rigorous imprisonment up to 14 years and fine. Non-bailable, triable by Magistrate of First Class.";
    addlSections = ["BNS Section 305 (Theft in dwelling house)", "BNS Section 317 (Receiving stolen property)"];
  } else if (query.includes("snatch") || query.includes("chain")) {
    bnsSec = "BNS Section 307 (Snatching)";
    ipcSec = "Legacy IPC Section 379A";
    details = isKn 
      ? "3 ವರ್ಷಗಳವರೆಗೆ ಕಠಿಣ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ, ಕಾಗ್ನಿಜಬಲ್."
      : "Punishment: Rigorous imprisonment up to 3 years and fine. Non-bailable, Cognizable.";
    addlSections = ["BNS Section 317 (Receiving stolen property)"];
  } else if (query.includes("cyber") || query.includes("hack") || query.includes("online") || query.includes("phish") || query.includes("fraud") || query.includes("phone") || query.includes("bank") || query.includes("cheating")) {
    bnsSec = "BNS Section 318(4) (Cheating & Dishonestly Inducing Delivery of Property)";
    ipcSec = "IPC Section 420 / 419";
    details = isKn 
      ? "7 ವರ್ಷಗಳವರೆಗೆ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ, ಪ್ರಥಮ ದರ್ಜೆ ಮ್ಯಾಜಿಸ್ಟ್ರೇಟ್ ವಿಚಾರಣೆ."
      : "Punishment: Imprisonment up to 7 years and fine. Non-bailable, Cognizable, triable by Magistrate of First Class.";
    addlSections = ["IT Act Section 66C (Identity Theft)", "IT Act Section 66D (Cheating by Computer Resource)"];
  } else if (query.includes("hurt") || query.includes("beat") || query.includes("assault") || query.includes("hit") || query.includes("fight")) {
    bnsSec = "BNS Section 115 (Voluntarily Causing Hurt)";
    ipcSec = "IPC Section 323";
    details = isKn 
      ? "1 ವರ್ಷದವರೆಗೆ ಜೈಲು ಶಿಕ್ಷೆ ಅಥವಾ ದಂಡ. ಜಾಮೀನು ಸಹಿತ, ಯಾವುದೇ ಮ್ಯಾಜಿಸ್ಟ್ರೇಟ್ ವಿಚಾರಣೆ."
      : "Punishment: Imprisonment up to 1 year or fine. Bailable, triable by any Magistrate.";
    addlSections = ["BNS Section 117 (Grievous Hurt)", "BNS Section 126 (Wrongful Restraint)"];
  } else if (query.includes("kidnap") || query.includes("abduct") || query.includes("ransom")) {
    bnsSec = query.includes("ransom") ? "BNS Section 140 (Kidnapping for Ransom)" : "BNS Section 137 (Kidnapping)";
    ipcSec = query.includes("ransom") ? "IPC Section 364A" : "IPC Section 363";
    details = isKn 
      ? "ಮರಣದಂಡನೆ ಅಥವಾ ಜೀವಾವಧಿ ಕಾರಾಗೃಹ ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ."
      : "Punishment: Death or Life Imprisonment, and fine. Non-bailable, Cognizable.";
    addlSections = ["BNS Section 61 (Criminal Conspiracy)", "BNSS Section 187"];
  } else if (query.includes("drug") || query.includes("ganja") || query.includes("narcotic") || query.includes("substance")) {
    bnsSec = "NDPS Act Section 20/22 (Possession of Psychotropic Substances)";
    ipcSec = "NDPS Act, 1985";
    details = isKn 
      ? "10 ರಿಂದ 20 ವರ್ಷಗಳವರೆಗೆ ಕಠಿಣ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ."
      : "Punishment: Rigorous imprisonment 10 to 20 years and fine. Non-bailable.";
    addlSections = ["BNS Section 111 (Organized Crime Syndicate)"];
  } else if (query.includes("weapon") || query.includes("gun") || query.includes("pistol") || query.includes("arms") || query.includes("sword")) {
    bnsSec = "Arms Act Section 25(1B) / Section 27 (Illegal Arms Possession/Use)";
    ipcSec = "Arms Act, 1959";
    details = isKn 
      ? "3 ರಿಂದ 7 ವರ್ಷಗಳ ಜೈಲು ಶಿಕ್ಷೆ ಮತ್ತು ದಂಡ. ಜಾಮೀನು ರಹಿತ."
      : "Punishment: Imprisonment 3 to 7 years and fine. Non-bailable.";
    addlSections = ["BNS Section 192 (Rioting with deadly weapon)"];
  }

  if (isKn) {
    return `⚖️ [BNS ಕ್ರಾಸ್-ಮ್ಯಾಪಿಂಗ್ ಹಾಗೂ ಕಾನೂನು ಸಲಹಾ ವರದಿ]

• ಹೊಸ ಬಿಎನ್‌ಎಸ್ ಸೆಕ್ಷನ್: ${bnsSec}
• ಹಳೆಯ ಐಪಿಸಿ ಸಮಾನ ಸೆಕ್ಷನ್: ${ipcSec}
• ಶಾಸನಬದ್ಧ ಶಿಕ್ಷೆ ವಿವರಗಳು: ${details}

🛡️ ಹೆಚ್ಚುವರಿ ಲಗತ್ತಿಸಬೇಕಾದ ಬಿಎನ್‌ಎಸ್/ವಿಶೇಷ ಕಾಯ್ದೆಗಳು:
${addlSections.length > 0 ? addlSections.map(s => `  • ${s}`).join("\n") : "  • BNS Section 61 (Criminal Conspiracy)"}

💡 ತನಿಖಾಧಿಕಾರಿಗಳಿಗೆ (IO) ಕಾರ್ಯವಿಧಾನ ಸೂಚನೆ:
1. ಎಫ್‌ಐಆರ್ ನ ಹಂತ 3 (ಕಾಯ್ದೆಗಳು ಮತ್ತು ಸೆಕ್ಷನ್‌ಗಳು) ರ ಅಡಿಯಲ್ಲಿ ಈ ಸೆಕ್ಷನ್ಗಳನ್ನು ದಾಖಲಿಸಿ.
2. ಬಿಎನ್‌ಎಸ್‌ಎಸ್ (BNSS, 2023) ಶಾಸನಬದ್ಧ ನಿಯಮಗಳ ಪ್ರಕಾರ ತನಿಖಾ ಪುರಾವೆಗಳನ್ನು ಸಂಗ್ರಹಿಸಿ.`;
  } else {
    return `⚖️ [BNS LEGAL STATUTORY ADVISORY REPORT]

• New BNS Section: ${bnsSec}
• Legacy IPC Equivalent: ${ipcSec}
• Statutory Penalty Details: ${details}

🛡️ RECOMMENDED COMPONENT SECTIONS:
${addlSections.length > 0 ? addlSections.map(s => `  • ${s}`).join("\n") : "  • BNS Section 61 (Criminal Conspiracy)"}

💡 INVESTIGATING OFFICER (IO) PROCEDURAL DIRECTIVES:
1. Map these sections inside Step 3 (Acts & Sections) of the FIR Filing form.
2. Ensure compliance with evidence recording guidelines under BNSS (2023).`;
  }
}

export function CopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"standard" | "simulator" | "advisor">("standard");
  const [searchState, setSearchState] = useState<{ step: 1 | 2 | 3; name: string; fir: string }>({
    step: 1,
    name: "",
    fir: ""
  });
  const [simulatorState, setSimulatorState] = useState<{ activeSuspect: string; turnCount: number }>({
    activeSuspect: "",
    turnCount: 0
  });
  const { cases: allCases, offenders } = useDb();
  const { language } = useLanguage();
  const [searchForm, setSearchForm] = useState({ name: "", fir: "" });
  const [activeCaseContext, setActiveCaseContext] = useState<FirData | null>(null);
  const [inlineName, setInlineName] = useState("");
  const [inlineFir, setInlineFir] = useState("");

  const systemText = useMemo(() => {
    const isKn = language === "kn";
    return {
      title: isKn ? "KSP ಅಪರಾಧ ತನಿಖಾ AI ಸಹಾಯಕ" : "KSP Crime Intelligence Assistant",
      statusOnline: isKn ? "ಆನ್‌ಲೈನ್" : "ONLINE",
      suggestionsTitle: isKn ? "ಸಲಹೆಗಳು" : "SUGGESTED QUERIES",
      clickToInterrogate: isKn ? "ನೆಟ್‌ವರ್ಕ್ ನೋಡ್ ಕ್ಲಿಕ್ ಮಾಡಿ" : "Click network node to inspect connections",
      placeholder: isKn ? "ಸಂದೇಶ ಅಥವಾ ಎಫ್‌ಐಆರ್ ನಮೂದಿಸಿ..." : "Ask a question, enter FIR, or type suspect name...",
    };
  }, [language]);

  const suggestions = useMemo(() => {
    if (mode === "simulator") {
      return [
        { type: "name", value: "Vijay Bhat" },
        { type: "name", value: "Darshan" },
        { type: "name", value: "Ramesh" }
      ];
    }
    if (mode === "advisor") {
      return [
        { type: "fir", value: "FIR/BAG/2026/204" },
        { type: "query", value: "BNS penalty for robbery & dacoity" },
        { type: "query", value: "Cyber cheating & bank fraud sections" }
      ];
    }
    return [
      { type: "name", value: "Vijay Bhat" },
      { type: "name", value: "Darshan" },
      { type: "fir", value: "FIR/BAG/2026/204" }
    ];
  }, [mode]);

  const getWelcomeMessage = (currentMode: "standard" | "simulator" | "advisor") => {
    const isKn = language === "kn";
    if (currentMode === "simulator") {
      return isKn
        ? "[ತನಿಖಾ ಸ್ಯಾಂಡ್‌ಬಾಕ್ಸ್] ಶಂಕಿತರನ್ನು ವಿಚಾರಣೆ ಮಾಡುವ ಅಭ್ಯಾಸ ವಲಯಕ್ಕೆ ಸುಸ್ವಾಗತ. ದಯವಿಟ್ಟು ವಿಚಾರಣೆ ಮಾಡಲು ಶಂಕಿತನ ಹೆಸರನ್ನು ನಮೂದಿಸಿ (ಉದಾ: Vijay Bhat ಅಥವಾ Darshan):"
        : "[INTERROGATION SANDBOX] Welcome to Suspect Interrogation Practice. Please enter a suspect name to interrogate (e.g. Vijay Bhat or Darshan):";
    }
    if (currentMode === "advisor") {
      return isKn
        ? "[ಬಿಎನ್‌ಎಸ್ ಕಾನೂನು ಸಲಹೆಗಾರ] ಬಿಎನ್‌ಎಸ್ (BNS, 2023) ಶಾಸನಬದ್ಧ ಮ್ಯಾಪಿಂಗ್ ಮತ್ತು ಎಫ್‌ಐಆರ್ ಪ್ರಕರಣದ ಕಾನೂನು ಸಲಹೆಗಾಗಿ ಎಫ್‌ಐಆರ್ ಸಂಖ್ಯೆ, ಆರೋಪಿಯ ಹೆಸರು ಅಥವಾ ಕಾನೂನು ಪ್ರಶ್ನೆಯನ್ನು ನಮೂದಿಸಿ:"
        : "[BNS STATUTORY LEGAL ADVISOR] Enter FIR Number, Accused Name, or Legal Question for automated BNS / BNSS 2023 statutory mapping & case advisory report:";
    }
    return isKn
      ? "ಆರೋಪಿಯ ಹೆಸರು ನಮೂದಿಸಿ:"
      : "Enter Accused / Suspect Name:";
  };

  const handleModeChange = (newMode: "standard" | "simulator" | "advisor") => {
    setMode(newMode);
    setSearchState({ step: 1, name: "", fir: "" });
    setSimulatorState({ activeSuspect: "", turnCount: 0 });
    setActiveCaseContext(null);
    const welcomeMsg = getWelcomeMessage(newMode);
    setMessages([
      {
        id: "init_mode_" + Date.now(),
        sender: "system",
        text: welcomeMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        formType: newMode === "standard" ? "name" : undefined
      }
    ]);
  };

  const handleInlineNameSubmit = (val: string) => {
    if (!val.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Post user name selection
    setMessages(prev => [
      ...prev.map(m => m.id === "init_name" ? { ...m, formType: undefined } : m),
      {
        id: Math.random().toString(),
        sender: "user",
        text: val.trim(),
        timestamp
      }
    ]);

    // Save state
    const targetName = val.trim();
    
    // Try to auto-suggest matched FIR if possible to save typing
    const matchedCase = allCases.find((c: any) => c.accused.some((a: any) => a.name.toLowerCase().includes(targetName.toLowerCase())));
    const suggestedFir = matchedCase ? matchedCase.crimeNo : "";

    setSearchState({ step: 2, name: targetName, fir: suggestedFir });
    setInlineFir(suggestedFir);

    // Ask for FIR
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: "init_fir",
          sender: "system",
          text: language === "kn" ? "FIR ಸಂಖ್ಯೆ ನಮೂದಿಸಿ:" : "Enter Associated FIR Number:",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          formType: "fir"
        }
      ]);
    }, 500);
  };

  const handleInlineFirSubmit = (val: string) => {
    if (!val.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetName = searchState.name;
    const searchTerm = val.trim();

    // Post user FIR selection
    setMessages(prev => [
      ...prev.map(m => m.id === "init_fir" ? { ...m, formType: undefined } : m),
      {
        id: Math.random().toString(),
        sender: "user",
        text: searchTerm,
        timestamp
      }
    ]);

    // Format FIR number
    let formattedSearchTerm = searchTerm;
    let cleanedInput = searchTerm.replace(/\s+/g, "").replace(/\//g, "").toLowerCase();
    const firRegex = /^(fir)?([a-z]+)?(20\d{2})(\d+)$/;
    const match = cleanedInput.match(firRegex);
    if (match) {
      const station = match[2] ? match[2].toUpperCase() : "BAG";
      const year = match[3];
      const number = match[4];
      formattedSearchTerm = `FIR/${station}/${year}/${number}`;
    } else {
      formattedSearchTerm = searchTerm.toUpperCase().replace(/\s+/g, "");
    }

    const queryFormatted = formattedSearchTerm.toLowerCase();
    
    // Match case by crimeNo/caseId AND check if target criminal is listed in accused list
    const matchedCase = allCases.find((c: any) => 
      (c.crimeNo.toLowerCase().includes(queryFormatted) || 
       c.crimeNo.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanedInput) ||
       String(c.caseMasterId).includes(queryFormatted)) &&
      c.accused.some((a: any) => a.name.toLowerCase().includes(targetName.toLowerCase()))
    );

    if (!matchedCase) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: "system",
          text: language === "kn"
            ? `ದಾಖಲೆ ಕಂಡುಬಂದಿಲ್ಲ: ಆರೋಪಿ "${targetName}" ಒಳಗೊಂಡಿರುವ ಎಫ್‌ಐಆರ್ #${searchTerm} ನೊಂದಿಗೆ ಹೊಂದಾಣಿಕೆಯಾಗುವ ಯಾವುದೇ ಪ್ರಕರಣವು ಕಂಡುಬಂದಿಲ್ಲ.`
            : `RECORD NOT FOUND: No record found for FIR #${searchTerm} involving accused "${targetName}". Please verify and try again.`,
          timestamp
        }]);
        
        // Reset to Step 1 name input so they can retry
        setTimeout(() => {
          setSearchState({ step: 1, name: "", fir: "" });
          setInlineName("");
          setMessages(prev => [...prev, {
            id: "init_name",
            sender: "system",
            text: language === "kn" ? "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ. ಆರೋಪಿಯ ಹೆಸರು ನಮೂದಿಸಿ:" : "Try again. Enter Accused / Suspect Name:",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            formType: "name"
          }]);
        }, 800);
      }, 500);
      return;
    }

    // ── Prediction Engine ──
    const allCriminalCases = allCases.filter((c: any) =>
      c.accused.some((a: any) => a.name.toLowerCase().includes(targetName.toLowerCase()))
    );

    const crimeTypeFreq: Record<string, number> = {};
    const districtFreq: Record<string, number> = {};
    const moFreq: Record<string, number> = {};
    const hourBuckets: number[] = [];
    let heinousCount = 0;

    allCriminalCases.forEach((c: any) => {
      const ct = c.crimeHead.name;
      crimeTypeFreq[ct] = (crimeTypeFreq[ct] || 0) + 1;
      districtFreq[c.district.name] = (districtFreq[c.district.name] || 0) + 1;
      moFreq[c.moTag] = (moFreq[c.moTag] || 0) + 1;
      hourBuckets.push(c.hour);
      if (c.gravity === "Heinous") heinousCount++;
    });

    const totalCases = allCriminalCases.length;
    const topCrimeType = Object.entries(crimeTypeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? matchedCase.crimeHead.name;
    const topDistricts = Object.entries(districtFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    const topMo = Object.entries(moFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? matchedCase.moTag;
    const avgHour = hourBuckets.length ? Math.round(hourBuckets.reduce((a, b) => a + b, 0) / hourBuckets.length) : 14;
    const coAccusedCount = new Set(allCriminalCases.flatMap((c: any) => c.accused.map((a: any) => a.name))).size - 1;

    let riskScore = 30;
    riskScore += Math.min(totalCases * 8, 30);
    riskScore += heinousCount > 0 ? 15 : 0;
    riskScore += coAccusedCount > 2 ? 10 : 0;
    riskScore += topDistricts.length > 1 ? 5 : 0;
    riskScore = Math.min(riskScore, 100);

    const riskLevel: PredictionData["riskLevel"] =
      riskScore >= 85 ? "CRITICAL" :
      riskScore >= 65 ? "HIGH" :
      riskScore >= 45 ? "MEDIUM" : "LOW";

    const timeOfDay = avgHour < 6 ? "late night (00:00–06:00)" :
      avgHour < 12 ? "morning (06:00–12:00)" :
      avgHour < 18 ? "afternoon (12:00–18:00)" : "evening/night (18:00–24:00)";

    const recentHeinous = allCriminalCases.slice(-3).filter((c: any) => c.gravity === "Heinous").length;
    const olderHeinous  = allCriminalCases.slice(0, 3).filter((c: any) => c.gravity === "Heinous").length;
    const escalationTrend: PredictionData["escalationTrend"] =
      recentHeinous > olderHeinous ? "ESCALATING" :
      recentHeinous < olderHeinous ? "DE-ESCALATING" : "STABLE";

    const triggers: string[] = [];
    if (coAccusedCount >= 3) triggers.push("Organized syndicate member — acts in groups");
    if (heinousCount > 0)    triggers.push("History of violence — escalation likely");
    if (totalCases >= 3)     triggers.push("Repeat offender — established criminal pattern");
    if (topDistricts.length > 1) triggers.push("Cross-district mobility — surveillance recommended");
    triggers.push(`Preferred MO: ${topMo}`);
    if (triggers.length < 3) triggers.push("Likely to target repeat victims from known network");

    const recidivismChance = Math.min(20 + totalCases * 12 + (heinousCount > 0 ? 10 : 0), 98);

    const prediction: PredictionData = {
      riskLevel,
      riskScore,
      nextCrimeType: topCrimeType,
      atRiskDistricts: topDistricts,
      estimatedWindow: `Next 30–60 days · ${timeOfDay}`,
      behavioralTriggers: triggers,
      recidivismChance,
      escalationTrend,
      patternSummary: `Based on ${totalCases} FIR(s), primarily ${topCrimeType.toLowerCase()} offences ` +
        `across ${topDistricts.join(", ")}. Operates with ${coAccusedCount} known associates.`
    };

    const firData: FirData = {
      crimeNo: matchedCase.crimeNo,
      targetAccused: targetName,
      status: matchedCase.status,
      gravity: `${matchedCase.gravity} — ${matchedCase.crimeHead.name}`,
      crimeHead: matchedCase.crimeHead.name,
      policeStation: matchedCase.policeStation,
      district: matchedCase.district.name,
      date: matchedCase.registeredDate,
      acts: matchedCase.actSections.join(", "),
      officer: matchedCase.registeringOfficer || "N/A",
      victims: matchedCase.victims.map((v: any) => v.name),
      accused: matchedCase.accused.map((a: any) => a.name),
      briefFacts: matchedCase.briefFacts,
      done: language === "kn" ? "ಅಪರಾಧಿ ಪ್ರೊಫೈಲ್ ಲೋಡ್ ಆಗಿದೆ." : "Accused profile loaded successfully.",
      prediction
    };

    const connections: { name: string; role: "Co-Accused" | "Victim"; strength: number }[] = [
      ...matchedCase.accused.map((a: any) => ({
        name: a.name,
        role: "Co-Accused" as const,
        strength: 80
      })),
      ...matchedCase.victims.map((v: any) => ({
        name: v.name,
        role: "Victim" as const,
        strength: 50
      }))
    ];

    setSearchState({ step: 3, name: targetName, fir: searchTerm });
    setActiveCaseContext(firData);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: "system",
        text: "",
        timestamp,
        firData,
        graphData: {
          criminal: targetName,
          connections
        }
      }]);
    }, 500);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleFormSearch = () => {
    if (!searchForm.name.trim() || !searchForm.fir.trim()) {
      toast.error(
        language === "kn" ? "ಎರಡೂ ಕ್ಷೇತ್ರಗಳು ಕಡ್ಡಾಯ" : "Both Fields Required",
        { description: language === "kn" ? "ದಯವಿಟ್ಟು ಆರೋಪಿಯ ಹೆಸರು ಮತ್ತು FIR ಸಂಖ್ಯೆ ಎರಡನ್ನೂ ನಮೂದಿಸಿ." : "Please enter both criminal name and FIR number." }
      );
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetName = searchForm.name.trim();
    const searchTerm = searchForm.fir.trim();

    // Log the search action in the chat feed
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender: "user",
      text: language === "kn"
        ? `ವಿಚಾರಣೆ: ಆರೋಪಿ="${targetName}" · FIR="${searchTerm}"`
        : `Interrogating: Accused="${targetName}" · FIR="${searchTerm}"`,
      timestamp
    }]);

    // Format the search query
    let formattedSearchTerm = searchTerm;
    let cleanedInput = searchTerm.replace(/\s+/g, "").replace(/\//g, "").toLowerCase();
    const firRegex = /^(fir)?([a-z]+)?(20\d{2})(\d+)$/;
    const match = cleanedInput.match(firRegex);
    if (match) {
      const station = match[2] ? match[2].toUpperCase() : "BAG";
      const year = match[3];
      const number = match[4];
      formattedSearchTerm = `FIR/${station}/${year}/${number}`;
    } else {
      formattedSearchTerm = searchTerm.toUpperCase().replace(/\s+/g, "");
    }

    const queryFormatted = formattedSearchTerm.toLowerCase();
    
    // Match case by crimeNo/caseId AND check if target criminal is listed in accused list
    const matchedCase = allCases.find((c: any) => 
      (c.crimeNo.toLowerCase().includes(queryFormatted) || 
       c.crimeNo.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanedInput) ||
       String(c.caseMasterId).includes(queryFormatted)) &&
      c.accused.some((a: any) => a.name.toLowerCase().includes(targetName.toLowerCase()))
    );

    if (!matchedCase) {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: "system",
        text: language === "kn"
          ? `ದಾಖಲೆ ಕಂಡುಬಂದಿಲ್ಲ: ಆರೋಪಿ "${targetName}" ಒಳಗೊಂಡಿರುವ ಎಫ್‌ಐಆರ್ #${searchTerm} ನೊಂದಿಗೆ ಹೊಂದಾಣಿಕೆಯಾಗುವ ಯಾವುದೇ ಪ್ರಕರಣವು ಡೇಟಾಸ್ಟೋರ್‌ನಲ್ಲಿ ಕಂಡುಬಂದಿಲ್ಲ.`
          : `RECORD NOT FOUND: No record found for FIR #${searchTerm} involving accused "${targetName}". Please verify and try again.`,
        timestamp
      }]);
      return;
    }

    // ── Prediction Engine ──
    const allCriminalCases = allCases.filter((c: any) =>
      c.accused.some((a: any) => a.name.toLowerCase().includes(targetName.toLowerCase()))
    );

    const crimeTypeFreq: Record<string, number> = {};
    const districtFreq: Record<string, number> = {};
    const moFreq: Record<string, number> = {};
    const hourBuckets: number[] = [];
    let heinousCount = 0;

    allCriminalCases.forEach((c: any) => {
      const ct = c.crimeHead.name;
      crimeTypeFreq[ct] = (crimeTypeFreq[ct] || 0) + 1;
      districtFreq[c.district.name] = (districtFreq[c.district.name] || 0) + 1;
      moFreq[c.moTag] = (moFreq[c.moTag] || 0) + 1;
      hourBuckets.push(c.hour);
      if (c.gravity === "Heinous") heinousCount++;
    });

    const totalCases = allCriminalCases.length;
    const topCrimeType = Object.entries(crimeTypeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? matchedCase.crimeHead.name;
    const topDistricts = Object.entries(districtFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    const topMo = Object.entries(moFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? matchedCase.moTag;
    const avgHour = hourBuckets.length ? Math.round(hourBuckets.reduce((a, b) => a + b, 0) / hourBuckets.length) : 14;
    const coAccusedCount = new Set(allCriminalCases.flatMap((c: any) => c.accused.map((a: any) => a.name))).size - 1;

    let riskScore = 30;
    riskScore += Math.min(totalCases * 8, 30);
    riskScore += heinousCount > 0 ? 15 : 0;
    riskScore += coAccusedCount > 2 ? 10 : 0;
    riskScore += topDistricts.length > 1 ? 5 : 0;
    riskScore = Math.min(riskScore, 100);

    const riskLevel: PredictionData["riskLevel"] =
      riskScore >= 85 ? "CRITICAL" :
      riskScore >= 65 ? "HIGH" :
      riskScore >= 45 ? "MEDIUM" : "LOW";

    const timeOfDay = avgHour < 6 ? "late night (00:00–06:00)" :
      avgHour < 12 ? "morning (06:00–12:00)" :
      avgHour < 18 ? "afternoon (12:00–18:00)" : "evening/night (18:00–24:00)";

    const recentHeinous = allCriminalCases.slice(-3).filter((c: any) => c.gravity === "Heinous").length;
    const olderHeinous  = allCriminalCases.slice(0, 3).filter((c: any) => c.gravity === "Heinous").length;
    const escalationTrend: PredictionData["escalationTrend"] =
      recentHeinous > olderHeinous ? "ESCALATING" :
      recentHeinous < olderHeinous ? "DE-ESCALATING" : "STABLE";

    const triggers: string[] = [];
    if (coAccusedCount >= 3) triggers.push("Organized syndicate member — acts in groups");
    if (heinousCount > 0)    triggers.push("History of violence — escalation likely");
    if (totalCases >= 3)     triggers.push("Repeat offender — established criminal pattern");
    if (topDistricts.length > 1) triggers.push("Cross-district mobility — surveillance recommended");
    triggers.push(`Preferred MO: ${topMo}`);
    if (triggers.length < 3) triggers.push("Likely to target repeat victims from known network");

    const recidivismChance = Math.min(20 + totalCases * 12 + (heinousCount > 0 ? 10 : 0), 98);

    const prediction: PredictionData = {
      riskLevel,
      riskScore,
      nextCrimeType: topCrimeType,
      atRiskDistricts: topDistricts,
      estimatedWindow: `Next 30–60 days · ${timeOfDay}`,
      behavioralTriggers: triggers,
      recidivismChance,
      escalationTrend,
      patternSummary: `Based on ${totalCases} FIR(s), primarily ${topCrimeType.toLowerCase()} offences ` +
        `across ${topDistricts.join(", ")}. Operates with ${coAccusedCount} known associates.`
    };

    const firData: FirData = {
      crimeNo: matchedCase.crimeNo,
      targetAccused: targetName,
      status: matchedCase.status,
      gravity: `${matchedCase.gravity} — ${matchedCase.crimeHead.name}`,
      crimeHead: matchedCase.crimeHead.name,
      policeStation: matchedCase.policeStation,
      district: matchedCase.district.name,
      date: matchedCase.registeredDate,
      acts: matchedCase.actSections.join(", "),
      officer: matchedCase.registeringOfficer || "N/A",
      victims: matchedCase.victims.map((v: any) => v.name),
      accused: matchedCase.accused.map((a: any) => a.name),
      briefFacts: matchedCase.briefFacts,
      done: language === "kn" ? "ಹೊಸ ಹುಡುಕಾಟಕ್ಕಾಗಿ ಮೇಲಿನ ಫಾರ್ಮ್ ಬಳಸಿ" : "Search complete — use the form above to run a new search",
      prediction
    };

    const connections: { name: string; role: "Co-Accused" | "Victim"; strength: number }[] = [
      ...matchedCase.accused.map((a: any) => ({
        name: a.name,
        role: "Co-Accused" as const,
        strength: 80
      })),
      ...matchedCase.victims.map((v: any) => ({
        name: v.name,
        role: "Victim" as const,
        strength: 50
      }))
    ];

    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender: "system",
      text: "",
      timestamp,
      firData,
      graphData: {
        criminal: targetName,
        connections
      }
    }]);

    // Clear form inputs and save context
    setSearchForm({ name: "", fir: "" });
    setActiveCaseContext(firData);
  };

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Speech Recognition input toggle
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(language === "kn" ? "ಧ್ವನಿ ಇನ್ಪುಟ್ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ" : "Voice Input Not Supported", {
        description: language === "kn" ? "ನಿಮ್ಮ ಬ್ರೌಸರ್ ಧ್ವನಿ ಇನ್ಪುಟ್ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ." : "This browser does not support Speech Recognition API.",
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === "kn" ? "kn-IN" : "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const speechToText = event.results[0][0].transcript;
        setInput(speechToText);
        toast.success(language === "kn" ? "ಧ್ವನಿ ಗುರುತಿಸಲಾಗಿದೆ!" : "Speech recognized!", {
          description: `"${speechToText}"`,
        });
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          toast.error(language === "kn" ? "ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ" : "Microphone Access Denied", {
            description: language === "kn" ? "ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿಯನ್ನು ನೀಡಿ." : "Please enable microphone permission in your browser.",
          });
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  // Auto-scroll chat feed
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Live FIR number formatter: converts raw input → FIR/BAG/2026/001 format
  const formatFirInput = (raw: string): string => {
    // If already well-formed, leave it
    if (/^FIR\/[A-Z]+\/\d{4}\/\d+$/i.test(raw.trim())) return raw.trim().toUpperCase();
    // Strip non-alphanumeric (except existing slashes) to get tokens
    const clean = raw.replace(/[^a-zA-Z0-9\s\/]/g, "").trim();
    const parts = clean.split(/[\s\/]+/).filter(Boolean);
    if (parts.length === 0) return "";
    const upper = parts.map(p => p.toUpperCase());
    // Detect if first token is "FIR" already
    let tokens = upper[0] === "FIR" ? upper.slice(1) : upper;
    if (tokens.length === 0) return "FIR/";
    if (tokens.length === 1) return `FIR/${tokens[0]}`;
    if (tokens.length === 2) return `FIR/${tokens[0]}/${tokens[1]}`;
    // 3+ tokens: FIR/STATION/YEAR/NUMBER
    const station = tokens[0];
    const year    = tokens[1];
    const num     = tokens.slice(2).join("").padStart(3, "0");
    return `FIR/${station}/${year}/${num}`;
  };

  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: searchTerm,
      timestamp
    };

    setInput("");
    const query = searchTerm.trim().toLowerCase();

    // 1. ADVISOR MODE (Case-specific & statutory BNS Legal Advisor)
    if (mode === "advisor") {
      setMessages(prev => [...prev, userMsg]);
      const responseText = generateBNSAdvisorReport(query, allCases, offenders, language);

      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: "system",
          text: responseText,
          timestamp
        }]);
      }, 400);
      return;
    }

    // 2. STANDARD MODE
    if (mode === "standard") {
      const isFir = /fir/i.test(searchTerm) || searchTerm.split("/").length > 2 || /^\d+$/.test(searchTerm);
      const isQuestion = query.split(" ").length > 3 || 
                         query.includes("who") || query.includes("what") || query.includes("show") || 
                         query.includes("list") || query.includes("help") || query.includes("ಯಾರು") || 
                         query.includes("ಹೇಗೆ") || query.includes("ತೋರಿಸಿ");

      if (searchState.step === 1 && !isFir && !isQuestion) {
        setInlineName(searchTerm);
        handleInlineNameSubmit(searchTerm);
        return;
      }
      if (searchState.step === 2 && isFir && !isQuestion) {
        setInlineFir(searchTerm);
        handleInlineFirSubmit(searchTerm);
        return;
      }

      if (searchState.step === 3 && !isFir && !isQuestion) {
        setMessages([]);
        setSearchState({ step: 1, name: "", fir: "" });
        setInlineName(searchTerm);
        setInlineFir("");
        setActiveCaseContext(null);
        setTimeout(() => {
          setMessages([
            {
              id: "init_name",
              sender: "system",
              text: language === "kn" ? "ಆರೋಪಿಯ ಹೆಸರು ನಮೂದಿಸಿ:" : "Enter Accused / Suspect Name:",
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              formType: "name"
            }
          ]);
          setTimeout(() => {
            handleInlineNameSubmit(searchTerm);
          }, 300);
        }, 100);
        return;
      }

      if (!activeCaseContext) {
        let reply = "";
        const isKn = language === "kn";
        
        if (query.includes("offender") || query.includes("suspect") || query.includes("criminal") || query.includes("ಆರೋಪಿ") || query.includes("ಅಪರಾಧಿ")) {
          const offenderNames = offenders.slice(0, 4).map((o: any) => o.name).join(", ");
          reply = isKn
            ? `ವ್ಯವಸ್ಥೆಯಲ್ಲಿ ನೋಂದಾಯಿಸಲಾದ ಕೆಲವು ಪ್ರಮುಖ ಅಪರಾಧಿಗಳು: ${offenderNames}. ಅವರ ವಿವರವಾದ ಪ್ರೊಫೈಲ್ ಮತ್ತು ನಡವಳಿಕೆಯ ಡಿಎನ್ಎ ವಿಶ್ಲೇಷಿಸಲು ಅವರ ಹೆಸರನ್ನು ಇಲ್ಲಿ ನಮೂದಿಸಿ.`
            : `Some active offenders in our records include: ${offenderNames}. Enter any of their names to load their behavioral DNA dossier.`;
        }
        else if (query.includes("hotspot") || query.includes("map") || query.includes("location") || query.includes("ನಕ್ಷೆ") || query.includes("ಸ್ಥಳ") || query.includes("ಹಾಟ್‌ಸ್ಪಾಟ್")) {
          reply = isKn
            ? `ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ನಕ್ಷೆಯಲ್ಲಿ ಗುರುತಿಸಲಾಗಿದೆ. ಮೇಲಿನ ನ್ಯಾವಿಗೇಶನ್ ಮೆನುವಿನಲ್ಲಿರುವ 'Hotspots' ವಿಭಾಗಕ್ಕೆ ಭೇಟಿ ನೀಡಿ.`
            : `Crime hotspots and spatial clusters are tracked dynamically. Visit the 'Hotspots' tab in the left sidebar to view the live interactive map.`;
        }
        else if (query.includes("case") || query.includes("fir") || query.includes("ಪ್ರಕರಣ") || query.includes("ಎಫ್‌ಐಆರ್")) {
          const recentFirs = allCases.slice(0, 3).map((c: any) => c.crimeNo).join(", ");
          reply = isKn
            ? `ಇತ್ತೀಚಿನ ಅಪರಾಧ ಪ್ರಕರಣಗಳು: ${recentFirs}. ನಿರ್ದಿಷ್ಟ ಪ್ರಕರಣದ ವಿವರಗಳಿಗಾಗಿ ಆರೋಪಿಯ ಹೆಸರು ಮತ್ತು ಎಫ್‌ಐಆರ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.`
            : `Recent registered cases: ${recentFirs}. Interrogate by providing a suspect's name to examine their specific files.`;
        }
        else {
          reply = isKn
            ? `ನಮಸ್ಕಾರ, ನಾನು SCRB ಇಂಟೆಲ್ ಅಸಿಸ್ಟೆಂಟ್. ತನಿಖೆ ಪ್ರಾರಂಭಿಸಲು ಆರೋಪಿಯ ಹೆಸರನ್ನು ನಮೂದಿಸಿ:`
            : `Hello, I am the SCRB Intelligence Assistant. Please enter an Accused / Suspect Name to begin querying the crime database:`;
        }

        setMessages(prev => [...prev, userMsg]);

        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            sender: "system",
            text: reply,
            timestamp
          }]);
        }, 500);

        return;
      }

      setMessages(prev => [...prev, userMsg]);
      let reply = "";
      const text = searchTerm.toLowerCase();
      const isKn = language === "kn";

      if (text.includes("associate") || text.includes("co-accused") || text.includes("partner") || text.includes("ಸಹಚರ") || text.includes("ಸಂಗಡಿಗ") || text.includes("ಮಿತ್ರ")) {
        const names = activeCaseContext.accused.filter(n => n.toLowerCase() !== activeCaseContext.targetAccused.toLowerCase());
        if (names.length > 0) {
          reply = isKn
            ? `ಆರೋಪಿ ${activeCaseContext.targetAccused} ರ ಸಹಚರರು: ${names.join(", ")}.`
            : `The co-accused associates linked with ${activeCaseContext.targetAccused} in this case are: ${names.join(", ")}.`;
        } else {
          reply = isKn
            ? `ಈ ಪ್ರಕರಣದಲ್ಲಿ ಆರೋಪಿ ${activeCaseContext.targetAccused} ಗೆ ಯಾವುದೇ ಸಹಚರರು ಕಂಡುಬಂದಿಲ್ಲ (ಒಂಟಿಯಾಗಿ ಅಪರಾಧ ಎಸಗಿದ್ದಾನೆ).`
            : `No co-accused associates were listed for ${activeCaseContext.targetAccused} in this specific case.`;
        }
      } 
      else if (text.includes("fact") || text.includes("detail") || text.includes("happen") || text.includes("crime") || text.includes("ಮಾಹಿತಿ") || text.includes("ವಿವರ") || text.includes("ಘಟನೆ") || text.includes("ಸಂಗತಿ")) {
        reply = isKn
          ? `ಅಪರಾಧದ ಸಾರಾಂಶ: ${activeCaseContext.briefFacts}\n\nಪ್ರಕರಣದ ಶೀರ್ಷಿಕೆ: ${activeCaseContext.gravity}`
          : `Brief Facts of the Crime:\n${activeCaseContext.briefFacts}\n\nOffence Classification: ${activeCaseContext.gravity}`;
      } 
      else if (text.includes("bail") || text.includes("section") || text.includes("act") || text.includes("ಕಾನೂನು") || text.includes("ಸೆಕ್ಷನ್") || text.includes("ಜಾಮೀನು") || text.includes("ಕಲಂ")) {
        const isBailable = !activeCaseContext.prediction?.behavioralTriggers.some(t => t.toLowerCase().includes("heinous")) && !activeCaseContext.gravity.toLowerCase().includes("heinous");
        const bailStatus = isBailable 
          ? (isKn ? "ಜಾಮೀನು ಪಡೆಯಬಹುದಾದ ಅಪರಾಧ" : "Bailable Offence") 
          : (isKn ? "ಜಾಮೀನು ರಹಿತ ಗಂಭೀರ ಅಪರಾಧ" : "Non-Bailable Heinous Offence");
          
        reply = isKn
          ? `ನಮೂದಿಸಲಾದ ಸೆಕ್ಷನ್ಗಳು: ${activeCaseContext.acts}\n\nಜಾಮೀನು ಸ್ಥಿತಿ: ${bailStatus}`
          : `Registered Sections: ${activeCaseContext.acts}\n\nBail Parameter: ${bailStatus}`;
      } 
      else if (text.includes("officer") || text.includes("station") || text.includes("police") || text.includes("ಠಾಣೆ") || text.includes("ಅಧಿಕಾರಿ") || text.includes("ಠಾಣೆಯ")) {
        reply = isKn
          ? `ಈ ಪ್ರಕರಣವನ್ನು '${activeCaseContext.policeStation}' ಪೊಲೀಸ್ ಠಾಣೆಯಲ್ಲಿ ದಾಖಲಿಸಲಾಗಿದೆ. ತನಿಖಾಧಿಕಾರಿ: ${activeCaseContext.officer}.`
          : `This case was registered at '${activeCaseContext.policeStation}' Police Station. Registered by Officer: ${activeCaseContext.officer}.`;
      } 
      else if (text.includes("risk") || text.includes("threat") || text.includes("repeat") || text.includes("ಅಪಾಯ") || text.includes("ಶಂಕೆ") || text.includes("ಅಪರಾಧ ಸಾಧ್ಯತೆ")) {
        reply = isKn
          ? `ಆರೋಪಿಯ ಅಪಾಯದ ಮಟ್ಟ: ${activeCaseContext.prediction?.riskLevel} (${activeCaseContext.prediction?.riskScore}%)\n\nಮತ್ತೆ ಅಪರಾಧ ಎಸಗುವ ಸಾಧ್ಯತೆ: ${activeCaseContext.prediction?.recidivismChance}%\n\nಪ್ರವೃತ್ತಿ ಟ್ರೆಂಡ್: ${activeCaseContext.prediction?.escalationTrend}`
          : `Offender Risk Assessment:\n• Risk Level: ${activeCaseContext.prediction?.riskLevel} (${activeCaseContext.prediction?.riskScore}%)\n• Recidivism Probability: ${activeCaseContext.prediction?.recidivismChance}%\n• Escalation Trend: ${activeCaseContext.prediction?.escalationTrend}`;
      }
      else {
        reply = isKn
          ? `ನಾನು ಆರೋಪಿ ${activeCaseContext.targetAccused} (FIR: ${activeCaseContext.crimeNo}) ರ ಪ್ರಕರಣದ ವಿವರಗಳನ್ನು ಹೊಂದಿದ್ದೇನೆ. ನೀವು ಅವರ ಸಹಚರರು, ಜಾಮೀನು ವಿವರಗಳು, ಅಧಿಕಾರಿ ಅಥವಾ ಅಪರಾಧದ ಸಾರಾಂಶದ ಬಗ್ಗೆ ಕೇಳಬಹುದು.`
          : `I am currently analyzing the dossier for ${activeCaseContext.targetAccused} (FIR: ${activeCaseContext.crimeNo}). You can ask me about their associates, crime details, bail status, risk profile, or the investigating officer.`;
      }

      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: "system",
          text: reply,
          timestamp
        }]);
      }, 500);

      return;
    }

    // 3. SIMULATOR MODE
    if (mode === "simulator") {
      setMessages(prev => [...prev, userMsg]);
      if (!simulatorState.activeSuspect) {
        setSimulatorState({ activeSuspect: searchTerm.trim(), turnCount: 0 });
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: "system",
          text: language === "kn"
            ? `[ವಿಚಾರಣೆ ಲೋಡ್ ಆಗಿದೆ] ಶಂಕಿತ: ${searchTerm.trim()}.\n\nವಿಚಾರಣೆ ಪ್ರಾರಂಭಿಸಿ. ಉದಾಹರಣೆಗೆ ಅವರ ಫೋನ್ ರೆಕಾರ್ಡ್ಸ್ ಅಥವಾ ವಾಹನದ ಬಗ್ಗೆ ಪ್ರಶ್ನಿಸಿ!`
            : `[SIMULATION ACTIVE] Now interrogating suspect: "${searchTerm.trim()}".\n\nAsk your questions or present evidence. (Try asking about their "phone logs", "vehicle plate", or "alibi")`,
          timestamp
        }]);
        return;
      }

      let reply = "";
      let alertMsg = "";
      const count = simulatorState.turnCount + 1;
      setSimulatorState(prev => ({ ...prev, turnCount: count }));

      if (query.includes("phone") || query.includes("call") || query.includes("tower") || query.includes("mobile")) {
        reply = language === "kn"
          ? "ನನ್ನ ಫೋನ್? ಆ ರಾತ್ರಿ... ನಾನು ಅದನ್ನು ಮನೆಯಲ್ಲೇ ಬಿಟ್ಟಿದ್ದೆ. ಅಥವಾ ಬೇರೊಬ್ಬರು ತಗೊಂಡಿರಬಹುದು. ನಾನು ಅಲ್ಲಿಗೆ ಹೋಗಿಲ್ಲ!"
          : "My phone? On that night... I must have left it at home. Or maybe someone else took it. You can't prove I was at the crime scene just because of tower logs!";
        alertMsg = language === "kn"
          ? "ಅಸಂಗತತೆ: ಶಂಕಿತರ ಸ್ಥಳ ದಾಖಲೆಗಳು ಮತ್ತು ಸೆಲ್ ಟವರ್ ಲಾಗ್‌ಗಳು ಹೊಂದಾಣಿಕೆಯಾಗುತ್ತಿಲ್ಲ!"
          : "CONTRADICTION DETECTED: Suspect cell tower ping logs place them at the crime scene location at 02:30 AM!";
      } else if (query.includes("vehicle") || query.includes("car") || query.includes("plate") || query.includes("drive") || query.includes("bike")) {
        reply = language === "kn"
          ? "ನಾನು ಆ ದಿನ ಗಾಡಿ ಓಡಿಸಿಲ್ಲ. ನನ್ನ ಹೆಸರಿನಲ್ಲಿ ಗಾಡಿ ಇರುವುದು ನಿಜ, ಆದರೆ ನನ್ನ ಸ್ನೇಹಿತ ತಗೊಂಡಿದ್ದ. ನನಗೂ ಅದಕ್ಕೂ ಸಂಬಂಧ ಇಲ್ಲ."
          : "I wasn't driving that day. Yes, the vehicle is registered in my name, but my friend borrowed it for some work. I have nothing to do with any robbery!";
        alertMsg = language === "kn"
          ? "ಸಾಕ್ಷ್ಯ ಹೊಂದಾಣಿಕೆ: ಪ್ರಕರಣದ ವಾಹನ ಸಂಖ್ಯೆಯು ಆರೋಪಿಗೆ ಸೇರಿದೆ!"
          : "EVIDENCE MATCHED: Entered case vehicle plate maps directly to suspect's registered vehicle asset registry!";
      } else if (query.includes("alibi") || query.includes("where") || query.includes("at the time") || query.includes("home")) {
        reply = language === "kn"
          ? "ನಾನು ಮನೆಯಲ್ಲೇ ಮಲಗಿದ್ದೆ! ನನ್ನ ಹೆಂಡತಿ ಅದನ್ನು ಖಚಿತಪಡಿಸಬಹುದು. ಅವಳನ್ನು ಕೇಳಿ. ನನಗೆ ಏನೂ ಗೊತ್ತಿಲ್ಲ."
          : "I was sleeping peacefully at home! My family can verify it. Ask them. I have no knowledge of any stolen cash.";
        alertMsg = language === "kn"
          ? "ಅಲಿಬಿ ಲಾಗ್: ಶಂಕಿತರ ಅಲಿಬಿ ಹೇಳಿಕೆಗಳು ಅಪರಾಧದ ಸಮಯದೊಂದಿಗೆ ಹೊಂದಾಣಿಕೆಯಾಗುತ್ತಿಲ್ಲ."
          : "ALIBI VERIFICATION ACTIVE: Checking family statements for verification... Discrepancy logged.";
      } else {
        reply = language === "kn"
          ? `ನೋಡಿ ಸರ್, ನಾನು ಮೊದಲೇ ಹೇಳಿದ್ದೇನೆ. ನನಗೂ ಆ ಕಳ್ಳತನಕ್ಕೂ ಯಾವುದೇ ಸಂಬಂಧವಿಲ್ಲ. ನೀವು ನನ್ನನ್ನು ಸುಮ್ಮನೆ ಇಲ್ಲೇ ಇರಿಸಿದ್ದೀರಿ.`
          : `Look officer, I have already told you. I have no idea about the incident and I don't know the complainant. You are holding me here without any proof.`;
      }

      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: "system",
          text: reply,
          timestamp
        }]);

        if (alertMsg) {
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            sender: "security",
            text: alertMsg,
            timestamp
          }]);
        }
      }, 600);
      return;
    }

    // 3. ADVISOR MODE
    if (mode === "advisor") {
      const responseText = generateBNSAdvisorReport(query, allCases, offenders, language);

      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: "system",
          text: responseText,
          timestamp
        }]);
      }, 500);
    }
  };

  return (
    <>
      {/* Floating FAB — Premium Branded Material Circular Icon Button without Blue Box */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-transparent group cursor-pointer hover:scale-110 active:scale-95 transition-all duration-300"
        title={language === "kn" ? "SCRB ಇಂಟೆಲ್ ಅಸಿಸ್ಟೆಂಟ್" : "SCRB Intel Assistant"}
      >
        {/* Pulsing ring background animations to attract user's attention */}
        <div className="absolute inset-0 rounded-full bg-black/15 dark:bg-white/20 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
        <div className="absolute inset-0.5 rounded-full border border-black/15 dark:border-white/20 animate-pulse pointer-events-none" />

        <BotIcon className="h-14 w-14 drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)] dark:drop-shadow-[0_6px_16px_rgba(255,255,255,0.2)] animate-bot-float animate-bot-wobble transition-all duration-200" />
      </button>

      {/* Backdrop — UNBLURRED background overlay per user request */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#202124]/10 z-40 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer Panel — Website-Similar High-Contrast Editorial Style */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col transition-all duration-300 ease-out transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header — Matches Website Masthead & Editorial Typography ── */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800 px-5 py-4 text-slate-800 dark:text-slate-100 shrink-0 justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center shrink-0">
              <BotIcon className="h-10 w-10 drop-shadow-md animate-bot-wobble" />
            </div>
            <div className="flex flex-col">
              <p className="font-sans text-[15px] font-bold text-slate-800 dark:text-slate-100 tracking-tight">{systemText.title}</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono tracking-widest uppercase mt-0.5">KSP · SCRB · SYSTEM INTEL</p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/30 rounded-full px-3 py-1 shadow-xs text-[9px] font-bold text-blue-600 dark:text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {systemText.statusOnline}
            </span>
            <button 
              onClick={() => setIsOpen(false)} 
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 cursor-pointer transition-colors active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-3 bg-slate-100/80 dark:bg-slate-950/20 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/40 m-3 gap-1 shrink-0">
          <button
            onClick={() => handleModeChange("standard")}
            className={`py-2 text-[10.5px] font-sans font-semibold uppercase tracking-wider rounded-lg transition-all duration-300 cursor-pointer ${
              mode === "standard"
                ? "bg-[#0b57d0] text-white shadow-md shadow-blue-500/10"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-850/50"
            }`}
          >
            {language === "kn" ? "🔍 ಸಾಮಾನ್ಯ ಶೋಧ" : "🔍 Standard"}
          </button>
          <button
            onClick={() => handleModeChange("simulator")}
            className={`py-2 text-[10.5px] font-sans font-semibold uppercase tracking-wider rounded-lg transition-all duration-300 cursor-pointer ${
              mode === "simulator"
                ? "bg-rose-600 text-white shadow-md shadow-rose-500/10"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-850/50"
            }`}
          >
            {language === "kn" ? "🎭 ಶಂಕಿತ ಸಿಮ್" : "🎭 Suspect Sim"}
          </button>
          <button
            onClick={() => handleModeChange("advisor")}
            className={`py-2 text-[10.5px] font-sans font-semibold uppercase tracking-wider rounded-lg transition-all duration-300 cursor-pointer ${
              mode === "advisor"
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/10"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-850/50"
            }`}
          >
            {language === "kn" ? "⚖️ BNS ಸಲಹೆಗಾರ" : "⚖️ BNS Advisor"}
          </button>
        </div>



        {mode === "simulator" && (
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-rose-50/40 dark:bg-rose-950/10 shrink-0 px-5 py-2.5 font-sans text-[10px] font-bold text-rose-600 dark:text-rose-400 w-full">
            🎭 {language === "kn" ? "ವಿಚಾರಣೆ ಸಿಮ್ಯುಲೇಟರ್ ಸಕ್ರಿಯವಾಗಿದೆ" : "SUSPECT SIMULATOR ACTIVE"}
            {simulatorState.activeSuspect && (
              <>
                <span className="bg-rose-100/60 dark:bg-rose-900/35 text-rose-700 dark:text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-200/30 ml-2 truncate max-w-[120px]">
                  🕵️ {simulatorState.activeSuspect.toUpperCase()}
                </span>
                <button
                  onClick={() => setSimulatorState({ activeSuspect: "", turnCount: 0 })}
                  className="ml-auto bg-paper hover:bg-surface-2 text-[#d93025] border-2 border-ink px-2 py-0.5 rounded-xs font-bold shadow-2xs cursor-pointer text-[8px]"
                >
                  {language === "kn" ? "ರೀಸೆಟ್" : "Reset"}
                </button>
              </>
            )}
          </div>
        )}

        {mode === "advisor" && (
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/10 shrink-0 px-5 py-2.5 font-sans text-[10px] font-bold text-amber-600 dark:text-amber-400">
            ⚖️ {language === "kn" ? "BNS ಕಾನೂನು ಸಲಹೆಗಾರ ಸಕ್ರಿಯವಾಗಿದೆ" : "BNS LEGAL ADVISOR ACTIVE"}
          </div>
        )}

        {/* ── Messages Feed — Google Web Fonts & Editorial Aesthetic ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[11px] leading-relaxed text-slate-700 dark:text-slate-350 bg-slate-50/50 dark:bg-slate-950/10 scrollbar-thin">

          {messages.map((m) => {
            if (m.sender === "user") {
              return (
                <div key={m.id} className="flex flex-col items-end gap-1 animate-in fade-in duration-200">
                  <div className="bg-[#0b57d0] text-white px-4 py-2.5 rounded-2xl rounded-tr-xs max-w-[85%] shadow-md shadow-blue-500/10 border border-blue-600/10">
                    <p className="font-sans text-[11.5px] leading-relaxed font-semibold">{m.text}</p>
                  </div>
                  <span className="text-[8px] font-mono text-[#5f6368] tracking-wider pr-1.5">{m.timestamp}</span>
                </div>
              );
            }

            if (m.sender === "security") {
              return (
                <div key={m.id} className="flex gap-2.5 animate-in fade-in duration-200">
                  <div className="flex h-7.5 w-7.5 items-center justify-center shrink-0 mt-0.5">
                    <div className="h-7.5 w-7.5 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center border border-rose-200/30">
                      <ShieldAlert className="h-4.5 w-4.5 text-[#d93025]" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 max-w-[90%]">
                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-slate-800 dark:text-rose-250 px-4 py-3 rounded-2xl rounded-tl-xs shadow-sm">
                      <p className="font-bold text-[9px] text-[#d93025] mb-1 tracking-wider uppercase flex items-center gap-1 font-mono">
                        ⚠️ {language === "kn" ? "ಭದ್ರತಾ ಉಲ್ಲಂಘನೆ" : "SECURITY VIOLATION"}
                      </p>
                      <p className="font-sans text-[10.5px] leading-relaxed font-medium">{m.text}</p>
                    </div>
                    <span className="text-[8px] font-mono text-[#5f6368] tracking-wider pl-1.5">{m.timestamp}</span>
                  </div>
                </div>
              );
            }

            // ── Structured FIR card message — High-Contrast Dashboard ─────────────────────────────
            if (m.firData) {
              const f = m.firData;
              return (
                <div key={m.id} className="flex gap-2.5 animate-in fade-in duration-300">
                  <div className="flex h-7.5 w-7.5 items-center justify-center shrink-0 mt-0.5">
                    <BotIcon className="h-7.5 w-7.5 drop-shadow-sm animate-bot-wobble" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <div className="bg-paper border-2 border-ink rounded-sm shadow-[4px_4px_0_0_#202124] overflow-hidden w-full">
                      {/* FIR Header */}
                      <div className="bg-ink text-paper px-4 py-3 flex items-center gap-2 border-b-2 border-ink">
                        <span className="text-base">📁</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-bold text-[11px] tracking-widest text-blue-400 dark:text-blue-300">{f.crimeNo}</p>
                          <p className="text-[8.5px] text-slate-400 tracking-widest font-mono uppercase">FIR Record · SCRB Datastore</p>
                        </div>
                        <span className={`text-[8.5px] font-bold px-2.5 py-0.5 rounded-sm border-2 border-ink font-mono tracking-wider shadow-sm ${
                          f.status === "Charge-Sheeted" ? "text-emerald-700 bg-emerald-50 border-emerald-300"
                          : f.status === "Under Investigation" ? "text-amber-700 bg-amber-50 border-amber-300"
                          : "text-slate-700 bg-slate-50 border-slate-350"
                        }`}>
                          {f.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Target Accused Banner */}
                      <div className="bg-rose-50 border-b-2 border-ink px-4 py-2 flex items-center gap-2 font-bold">
                        <User className="h-3.5 w-3.5 text-[#d93025] shrink-0 animate-pulse" />
                        <span className="text-[9px] text-[#d93025] font-bold uppercase tracking-wider font-sans">
                          {language === "kn" ? "ಗುರಿ ಆರೋಪಿ" : "Target Accused"}: <span className="underline decoration-red-500/40">{f.targetAccused.toUpperCase()}</span>
                        </span>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-2.5 p-4 text-[10.5px] font-sans bg-paper">
                        {([
                          [language === "kn" ? "ತೀವ್ರತೆ" : "Gravity", f.gravity],
                          [language === "kn" ? "ಠಾಣೆ / ಜಿಲ್ಲೆ" : "PS / District", `${f.policeStation}, ${f.district}`],
                          [language === "kn" ? "ದಿನಾಂಕ" : "Date", f.date],
                          [language === "kn" ? "ಕಾಯಿದೆ" : "Act Sections", f.acts],
                          [language === "kn" ? "ತನಿಖಾಧಿಕಾರಿ" : "IO", f.officer],
                        ] as [string, string][]).map(([label, val]) => (
                          <div key={label} className="bg-surface-2 border-2 border-ink/10 p-2.5 rounded-sm shadow-2xs">
                            <p className="text-[8px] text-[#5f6368] uppercase tracking-widest font-bold mb-0.5">{label}</p>
                            <p className="text-ink font-bold leading-tight">{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Victims & Accused Tags */}
                      <div className="px-4 pb-3 flex flex-col gap-2.5 bg-paper">
                        {f.victims.length > 0 && (
                          <div>
                            <p className="text-[8px] text-[#5f6368] uppercase tracking-widest font-bold mb-1">{language === "kn" ? "ಸಂತ್ರಸ್ತರು" : "Victims"}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {f.victims.map(v => (
                                <span key={v} className="text-[9px] bg-paper text-[#0b57d0] border-2 border-ink rounded-sm px-2.5 py-0.5 font-bold shadow-xs hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer">{v}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {f.accused.length > 0 && (
                          <div>
                            <p className="text-[8px] text-[#5f6368] uppercase tracking-widest font-bold mb-1">{language === "kn" ? "ಆರೋಪಿಗಳು" : "Accused"}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {f.accused.map(a => (
                                <span key={a} className="text-[9px] bg-paper text-[#d93025] border-2 border-ink rounded-sm px-2.5 py-0.5 font-bold shadow-xs hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer">{a}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Brief Facts */}
                      <div className="border-t-2 border-ink px-4 py-3 bg-surface-2">
                        <p className="text-[8px] text-[#5f6368] uppercase tracking-widest font-bold mb-1">{language === "kn" ? "ಸಾರಾಂಶ" : "Brief Facts"}</p>
                        <p className="text-[10px] text-ink leading-relaxed italic">{f.briefFacts}</p>
                      </div>

                      {/* ── AI Threat Prediction Panel ── */}
                      {(() => {
                        const p = f.prediction;
                        const riskColors: Record<PredictionData["riskLevel"], { bg: string; text: string; bgSoft: string; border: string }> = {
                          LOW:      { bg: "bg-emerald-600",   text: "text-emerald-700", bgSoft: "bg-emerald-50",   border: "border-emerald-200" },
                          MEDIUM:   { bg: "bg-amber-500",     text: "text-amber-700",   bgSoft: "bg-amber-50",     border: "border-amber-200"  },
                          HIGH:     { bg: "bg-orange-600",    text: "text-orange-750",  bgSoft: "bg-orange-50",    border: "border-orange-250" },
                          CRITICAL: { bg: "bg-[#d93025]",     text: "text-[#d93025]",   bgSoft: "bg-rose-50",      border: "border-[#d93025]/30"   },
                        };
                        const rc = riskColors[p.riskLevel];
                        const trendIcon = p.escalationTrend === "ESCALATING" ? "↑" : p.escalationTrend === "DE-ESCALATING" ? "↓" : "→";
                        const trendColor = p.escalationTrend === "ESCALATING" ? "text-[#d93025]" : p.escalationTrend === "DE-ESCALATING" ? "text-emerald-700" : "text-amber-700";
                        // SVG arc gauge params
                        const gaugeRadius = 28, gaugeCircum = Math.PI * gaugeRadius; // half-circle
                        const gaugeFill = (p.riskScore / 100) * gaugeCircum;
                        return (
                          <div className="border-t-2 border-ink">
                            {/* Prediction Header */}
                            <div className={`${rc.bg} border-b-2 border-ink px-4 py-2.5 flex items-center justify-between text-white`}>
                              <div className="flex items-center gap-1.5">
                                <span className="text-white text-[11px] animate-[pulse_1.5s_infinite]">🧠</span>
                                <span className="text-white font-mono font-bold text-[9px] tracking-widest uppercase">
                                  {language === "kn" ? "AI ಬೆದರಿಕೆ ಮುನ್ಸೂಚನೆ" : "AI THREAT PREDICTION"}
                                </span>
                              </div>
                              <span className="text-white/80 text-[8px] font-mono tracking-widest">
                                {language === "kn" ? "ಮಾದರಿ ವಿಶ್ಲೇಷಣೆ" : "PATTERN ANALYSIS"}
                              </span>
                            </div>

                            <div className="p-4 space-y-3 bg-paper">
                              {/* Risk Score Gauge + Recidivism */}
                              <div className="flex items-center gap-4">
                                {/* SVG Arc Gauge */}
                                <div className="flex flex-col items-center shrink-0 bg-surface-2 p-2 rounded-sm border-2 border-ink shadow-sm">
                                  <svg width="72" height="44" viewBox="0 0 72 44">
                                    {/* Background arc */}
                                    <path d="M 8 40 A 28 28 0 0 1 64 40" fill="none" stroke="currentColor" className="text-[#dadce0]" strokeWidth="7" strokeLinecap="round" />
                                    {/* Filled arc */}
                                    <path
                                      d="M 8 40 A 28 28 0 0 1 64 40"
                                      fill="none"
                                      stroke={p.riskLevel === "CRITICAL" ? "#d93025" : p.riskLevel === "HIGH" ? "#ea580c" : p.riskLevel === "MEDIUM" ? "#f9ab00" : "#188038"}
                                      strokeWidth="7"
                                      strokeLinecap="round"
                                      strokeDasharray={`${gaugeFill} ${gaugeCircum}`}
                                      style={{ transition: "stroke-dasharray 1s ease" }}
                                    />
                                    {/* Score label */}
                                    <text x="36" y="38" textAnchor="middle" fill="currentColor" className="fill-ink font-sans font-bold" fontSize="12">{p.riskScore}</text>
                                  </svg>
                                  <span className={`text-[8.5px] font-black tracking-widest ${rc.text} font-mono -mt-0.5`}>{p.riskLevel}</span>
                                  <span className="text-[7px] text-[#5f6368] font-bold tracking-widest mt-0.5">RISK SCORE</span>
                                </div>

                                {/* Right stats */}
                                <div className="flex-1 space-y-2.5">
                                  {/* Recidivism */}
                                  <div>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-[8px] text-[#5f6368] font-bold uppercase tracking-wider">{language === "kn" ? "ಮರು ಅಪರಾಧ ಸಾಧ್ಯತೆ" : "Recidivism Chance"}</span>
                                      <span className={`text-[8.5px] font-extrabold ${rc.text}`}>{p.recidivismChance}%</span>
                                    </div>
                                    <div className="h-2 rounded-sm bg-surface-2 border border-ink/20 overflow-hidden">
                                      <div className={`h-full bg-[#0b57d0] rounded-sm transition-all duration-700`} style={{ width: `${p.recidivismChance}%` }} />
                                    </div>
                                  </div>
                                  {/* Escalation */}
                                  <div className="flex items-center justify-between bg-surface-2 border-2 border-ink px-2.5 py-1.5 rounded-sm">
                                    <span className="text-[8px] text-[#5f6368] font-bold uppercase tracking-wider">{language === "kn" ? "ತ್ವರಣ" : "Escalation"}:</span>
                                    <span className={`text-[9px] font-bold ${trendColor} font-mono flex items-center gap-0.5`}>{trendIcon} {p.escalationTrend}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Info capsules */}
                              <div className="grid grid-cols-2 gap-2.5">
                                {/* Next Predicted Crime */}
                                <div className={`rounded-sm border-2 border-ink ${rc.bgSoft} p-2.5 shadow-sm`}>
                                  <p className="text-[7px] uppercase tracking-widest text-[#5f6368] font-bold mb-1">{language === "kn" ? "ಮುಂದಿನ ಊಹಿತ ಅಪರಾಧ" : "Predicted Next Crime Type"}</p>
                                  <p className={`text-[10px] font-bold ${rc.text} font-mono tracking-wide`}>{p.nextCrimeType.toUpperCase()}</p>
                                </div>

                                {/* Time window */}
                                <div className="rounded-sm border-2 border-ink bg-surface-2 p-2.5 flex flex-col justify-between shadow-sm">
                                  <p className="text-[7px] uppercase tracking-widest text-[#5f6368] font-bold mb-1">{language === "kn" ? "ಅಂದಾಜು ಸಮಯ" : "Estimated Window"}</p>
                                  <p className="text-[9.5px] text-ink font-semibold leading-tight flex items-center gap-1">
                                    <span>⏱</span> {p.estimatedWindow}
                                  </p>
                                </div>
                              </div>

                              {/* At-risk districts */}
                              {p.atRiskDistricts.length > 0 && (
                                <div>
                                  <p className="text-[7px] uppercase tracking-widest text-[#5f6368] font-bold mb-1">{language === "kn" ? "ಅಪಾಯದ ಜಿಲ್ಲೆಗಳು" : "At-Risk Districts"}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {p.atRiskDistricts.map((d, i) => (
                                      <span key={d} className={`text-[8.5px] px-2.5 py-0.5 rounded-sm font-bold font-mono border-2 border-ink ${rc.text} bg-paper shadow-sm`}>
                                        {i === 0 ? "🔴" : i === 1 ? "🟡" : "🟢"} {d}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Behavioral Triggers */}
                              <div>
                                <p className="text-[7px] uppercase tracking-widest text-[#5f6368] font-bold mb-1.5">{language === "kn" ? "ವರ್ತನೆಯ ಸೂಚಕಗಳು" : "Behavioral Indicators"}</p>
                                <div className="space-y-1.5">
                                  {p.behavioralTriggers.map((t, i) => (
                                    <div key={i} className="flex items-start gap-2 bg-surface-2 border-2 border-ink/45 px-2.5 py-1.5 rounded-sm">
                                      <span className="text-[9px] text-[#d93025] shrink-0 mt-0.5">⚠️</span>
                                      <span className="text-[9.5px] text-ink leading-tight font-medium font-sans">{t}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Pattern Summary */}
                              <div className="bg-surface-2 border-2 border-ink rounded-sm p-3 shadow-sm">
                                <p className="text-[7px] uppercase tracking-widest text-[#5f6368] font-bold mb-1">
                                  {language === "kn" ? "ಮಾದರಿ ಸಾರಾಂಶ" : "Pattern Summary"}
                                </p>
                                <p className="text-[9.5px] text-ink leading-relaxed italic">{p.patternSummary}</p>
                              </div>

                              <p className="text-[7.5px] text-[#5f6368] text-center tracking-wider font-mono">
                                ⚡ {language === "kn" ? "ಈ ಮುನ್ಸೂಚನೆ ಐತಿಹಾಸಿಕ FIR ಮಾದರಿ ವಿಶ್ಲೇಷಣೆಯ ಮೇಲೆ ಆಧಾರಿತವಾಗಿದೆ" : "PREDICTION BASED ON HISTORICAL FIR PATTERNS · INTERNAL USE ONLY"}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Network Graph — Professional Radial Layout */}
                      {m.graphData && m.graphData.connections.length > 0 && (() => {
                        const conns = m.graphData!.connections;
                        const W = 560, H = 300;
                        const cx = W / 2, cy = H / 2;
                        // Radius scales with count so nodes never overlap
                        const r = Math.min(115, Math.max(80, 40 + conns.length * 18));

                        return (
                          <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                            <p className="text-[8.5px] uppercase tracking-wider text-[#d93025] mb-3 flex items-center gap-1.5 font-bold">
                              <Network className="h-3.5 w-3.5 text-[#d93025] animate-[pulse_2s_infinite]" />
                              {language === "kn" ? "ಸಂಪರ್ಕ ಜಾಲ" : "Connection Network"}
                              <span className="ml-auto text-slate-400 font-mono">{conns.length} node{conns.length !== 1 ? "s" : ""}</span>
                            </p>
                            <div className="border border-slate-250 rounded-xl bg-white relative overflow-hidden shadow-xs">
                              {(() => {
                                return (
                                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: `${H}px` }}>
                                    <defs>
                                      {/* Target pulse ring gradient */}
                                      <radialGradient id="pulseRing" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#d93025" stopOpacity="0.15" />
                                        <stop offset="100%" stopColor="#d93025" stopOpacity="0" />
                                      </radialGradient>
                                      {/* Line gradient amber */}
                                      <linearGradient id="lineAmber" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#d93025" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
                                      </linearGradient>
                                      {/* Line gradient blue */}
                                      <linearGradient id="lineBlue" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#d93025" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
                                      </linearGradient>
                                      {/* Gradient background */}
                                      <radialGradient id="bgGrad" cx="50%" cy="50%" r="60%">
                                        <stop offset="0%" stopColor="#f8fafc" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                                      </radialGradient>
                                    </defs>

                                    {/* Background */}
                                    <rect width={W} height={H} fill="url(#bgGrad)" />

                                    {/* Subtle grid lines matching network page */}
                                    {[...Array(6)].map((_, i) => (
                                      <circle key={`grid-${i}`} cx={cx} cy={cy} r={(i + 1) * (r / 3.5)}
                                        fill="none" stroke="#0f172a" strokeWidth="0.4" opacity="0.05" strokeDasharray="4 6" />
                                    ))}

                                    {/* Connection lines with gradient */}
                                    {conns.map((c, i) => {
                                      const angle = (i * 2 * Math.PI) / conns.length - Math.PI / 2;
                                      const tx = cx + r * Math.cos(angle);
                                      const ty = cy + r * Math.sin(angle);
                                      const gradId = c.role === "Co-Accused" ? "lineAmber" : "lineBlue";
                                      const strokeColor = c.role === "Co-Accused" ? "#f59e0b" : "#3b82f6";
                                      // Midpoint for glow dot
                                      const mx = (cx + tx) / 2;
                                      const my = (cy + ty) / 2;
                                      return (
                                        <g key={`line-${i}`}>
                                          {/* Main line */}
                                          <line x1={cx} y1={cy} x2={tx} y2={ty}
                                            stroke={`url(#${gradId})`} strokeWidth="1.2"
                                            strokeDasharray="5 3" opacity="0.8" />
                                          {/* Midpoint pulse dot */}
                                          <circle cx={mx} cy={my} r="2"
                                            fill={strokeColor} opacity="0.6" />
                                        </g>
                                      );
                                    })}

                                    {/* Target node — center matching network.tsx style */}
                                    <circle cx={cx} cy={cy} r="40" fill="none" stroke="#d93025" strokeWidth="0.8" opacity="0.2" strokeDasharray="3 5" />
                                    <circle cx={cx} cy={cy} r="30" fill="url(#pulseRing)" className="animate-pulse" />
                                    
                                    <circle cx={cx} cy={cy} r="18" fill="#ffffff" stroke="#d93025" strokeWidth="2.5" />
                                    <circle cx={cx} cy={cy} r="11" fill="#d93025" />
                                    
                                    {/* Initials */}
                                    <text x={cx} y={cy} textAnchor="middle" fill="#ffffff"
                                      fontSize="7.5" fontWeight="bold" dominantBaseline="middle" fontFamily="monospace">
                                      {m.graphData!.criminal.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase()}
                                    </text>
                                    
                                    {/* Target labels */}
                                    <text x={cx} y={cy + 28} textAnchor="middle" fill="#d93025"
                                      fontSize="7" fontWeight="900" fontFamily="sans-serif" letterSpacing="1">
                                      TARGET
                                    </text>
                                    <text x={cx} y={cy + 39} textAnchor="middle" fill="#0f172a"
                                      fontSize="8" fontWeight="bold" fontFamily="sans-serif">
                                      {m.graphData!.criminal.split(" ")[0]}
                                    </text>

                                    {/* Orbit nodes matching network.tsx style */}
                                    {conns.map((c, i) => {
                                      const angle = (i * 2 * Math.PI) / conns.length - Math.PI / 2;
                                      const tx = cx + r * Math.cos(angle);
                                      const ty = cy + r * Math.sin(angle);
                                      const color = c.role === "Co-Accused" ? "#f59e0b" : "#3b82f6";
                                      const ringColor = c.role === "Co-Accused" ? "#d97706" : "#2563eb";
                                      const initials = c.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                                      const nameParts = c.name.trim().split(" ");
                                      const firstName = nameParts[0] ?? "";
                                      const restName = nameParts.slice(1).join(" ");
                                      const isCoAccused = c.role === "Co-Accused";

                                      return (
                                        <g key={`node-${i}`} className="cursor-pointer" onClick={() => handleSearch(c.name)}>
                                          {/* Outer dotted orbit ring */}
                                          <circle cx={tx} cy={ty} r="18" fill="none"
                                            stroke={color} strokeWidth="0.8" opacity="0.15" strokeDasharray="3 3" />
                                          
                                          {/* Node body shape */}
                                          {isCoAccused ? (
                                            <g>
                                              <circle cx={tx} cy={ty} r="14" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
                                              <circle cx={tx} cy={ty} r="8" fill="#f59e0b" />
                                            </g>
                                          ) : (
                                            <circle cx={tx} cy={ty} r="12" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                                          )}

                                          {/* Initials */}
                                          <text x={tx} y={ty} textAnchor="middle" fill="#fff"
                                            fontSize="6.5" fontWeight="bold" dominantBaseline="middle" fontFamily="monospace">
                                            {initials}
                                          </text>
                                          
                                          {/* Name labels */}
                                          <text x={tx} y={ty + 22} textAnchor="middle" fill="#0f172a"
                                            fontSize="7.5" fontWeight="bold" fontFamily="sans-serif">
                                            {firstName}
                                          </text>
                                          {restName && (
                                            <text x={tx} y={ty + 30} textAnchor="middle" fill="#64748b"
                                              fontSize="6" fontFamily="sans-serif">
                                              {restName}
                                            </text>
                                          )}
                                          {/* Role badge */}
                                          <text x={tx} y={ty + (restName ? 40 : 31)} textAnchor="middle"
                                            fill={ringColor} fontSize="5.5" fontWeight="900" fontFamily="monospace" letterSpacing="0.8">
                                            {c.role === "Co-Accused" ? "CO-ACCUSED" : "VICTIM"}
                                          </text>
                                          <title>{c.name} · {c.role} · Click to interrogate</title>
                                        </g>
                                      );
                                    })}

                                    {/* Legend — bottom left */}
                                    <g transform={`translate(10, ${H - 42})`}>
                                      <rect x="-4" y="-6" width="105" height="46" rx="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                                      <circle cx="6" cy="6" r="4.5" fill="#f59e0b" />
                                      <text x="16" y="9" fill="#475569" fontFamily="sans-serif" fontSize="6.5" fontWeight="bold">Co-Accused</text>
                                      <circle cx="6" cy="20" r="4.5" fill="#3b82f6" />
                                      <text x="16" y="23" fill="#475569" fontFamily="sans-serif" fontSize="6.5" fontWeight="bold">Victim</text>
                                      <circle cx="6" cy="34" r="4.5" fill="#d93025" />
                                      <text x="16" y="37" fill="#475569" fontFamily="sans-serif" fontSize="6.5" fontWeight="bold">Target Accused</text>
                                    </g>
                                  </svg>
                                );
                              })()}
                              <p className="text-[8px] text-center text-slate-500 tracking-wider py-2 bg-slate-100/60 border-t border-slate-200/80 font-sans font-semibold">
                                {systemText.clickToInterrogate}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Done footer */}
                      <div className="border-t-2 border-ink px-4 py-2.5 bg-surface-2 flex items-center gap-2 rounded-b-sm">
                        <RefreshCw className="h-3.5 w-3.5 text-[#5f6368] animate-[spin_4s_linear_infinite]" />
                        <p className="text-[8px] text-[#5f6368] italic leading-none font-bold">{f.done}</p>
                      </div>
                    </div>
                    <span className="text-[8px] font-mono text-[#5f6368] tracking-wider pl-1.5">{m.timestamp}</span>
                  </div>
                </div>
              );
            }

            // ── Generic system text bubble — Elegant Cards ──────────────────────────────
            return (
              <div key={m.id} className="flex gap-2.5 animate-in fade-in duration-200">
                <div className="flex h-7.5 w-7.5 items-center justify-center shrink-0 mt-0.5 animate-in zoom-in-50 duration-200">
                  <BotIcon className="h-7.5 w-7.5 drop-shadow-sm animate-bot-wobble" />
                </div>
                <div className="flex flex-col gap-1 max-w-[90%] w-full">
                  <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 text-slate-800 dark:text-slate-100 px-4.5 py-3.5 rounded-2xl rounded-tl-xs shadow-sm w-full">
                    <p className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed font-medium">{m.text}</p>
                    
                    {/* Inline Form Bubble Rendering */}
                    {m.formType === "name" && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/85 space-y-2.5 font-sans">
                        <input
                          type="text"
                          value={inlineName}
                          onChange={(e) => setInlineName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineNameSubmit(inlineName);
                          }}
                          placeholder={language === "kn" ? "ಆರೋಪಿಯ ಹೆಸರು..." : "e.g., Vijay Bhat"}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-[11.5px] placeholder-slate-400 focus:outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]/30 font-sans transition-all duration-200"
                          autoFocus
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleInlineNameSubmit(inlineName)}
                            className="bg-[#0b57d0] hover:bg-[#0b57d0]/90 text-white font-sans text-[10px] font-semibold px-4.5 py-1.8 rounded-lg shadow-sm shadow-blue-500/10 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                          >
                            {language === "kn" ? "ಸಲ್ಲಿಸು" : "Submit"}
                          </button>
                        </div>
                      </div>
                    )}

                    {m.formType === "fir" && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/85 space-y-2.5 font-sans">
                        <input
                          type="text"
                          value={inlineFir}
                          onChange={(e) => setInlineFir(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineFirSubmit(inlineFir);
                          }}
                          placeholder={language === "kn" ? "FIR ಸಂಖ್ಯೆ..." : "e.g., FIR/BAG/2026/001"}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-[11.5px] placeholder-slate-400 focus:outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]/30 font-mono transition-all duration-200"
                          autoFocus
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleInlineFirSubmit(inlineFir)}
                            className="bg-[#0b57d0] hover:bg-[#0b57d0]/90 text-white font-sans text-[10px] font-semibold px-4.5 py-1.8 rounded-lg shadow-sm shadow-blue-500/10 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                          >
                            {language === "kn" ? "ಸಲ್ಲಿಸು" : "Submit"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[8px] font-mono text-[#5f6368] tracking-wider pl-1.5">{m.timestamp}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Suggestion Pills — High-Contrast Clean Layout ── */}
        {suggestions.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold font-sans">
              {systemText.suggestionsTitle}
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {suggestions.map((s: { type: string; value: string }, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(s.value)}
                  className="text-[10px] text-[#0b57d0] dark:text-blue-400 bg-white dark:bg-slate-900 border border-blue-200/50 dark:border-slate-850 hover:bg-[#0b57d0] dark:hover:bg-blue-600 hover:text-white dark:hover:text-white px-3.5 py-1 rounded-full shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all duration-250 cursor-pointer font-semibold"
                >
                  {s.type === "fir" ? "FIR: " : s.type === "name" ? "Accused: " : ""}{s.value}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input Panel ── */}
        <div className="p-4 border-t border-slate-150 dark:border-slate-800/80 bg-white dark:bg-slate-900 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(input);
            }}
            className="flex gap-3 items-center"
          >
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={systemText.placeholder}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-12 py-3 text-[12px] text-slate-800 dark:text-slate-100 font-sans focus:outline-none focus:border-[#0b57d0] focus:ring-2 focus:ring-[#0b57d0]/10 placeholder-slate-400 transition-all duration-200"
              />

              {/* Mic button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`absolute right-3.5 p-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  isListening 
                    ? "bg-rose-500/10 text-rose-500 animate-pulse shadow-md" 
                    : "text-slate-400 dark:text-slate-500 hover:text-[#0b57d0] hover:bg-[#0b57d0]/10 dark:hover:text-blue-400 dark:hover:bg-blue-500/10"
                }`}
                title={language === "kn" ? "ಧ್ವನಿ ಇನ್ಪುಟ್" : "Voice Input"}
              >
                {isListening ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
              </button>

              {/* Listening soundwave overlay */}
              {isListening && (
                <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 flex items-center justify-between px-4 rounded-xl pointer-events-none">
                  <div className="flex items-center gap-2 text-rose-500 animate-pulse">
                    <Mic className="h-4.5 w-4.5 fill-rose-500" />
                    <span className="text-[9.5px] font-mono uppercase tracking-widest font-extrabold">
                      {language === "kn" ? "ಕೇಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ..." : "LISTENING..."}
                    </span>
                  </div>
                  <div className="flex gap-0.5 items-center h-4.5">
                    <span className="h-2.5 w-[3px] bg-rose-500 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite]" />
                    <span className="h-4 w-[3px] bg-rose-500 rounded-full animate-[soundwave_0.6s_ease-in-out_infinite_0.15s]" />
                    <span className="h-3 w-[3px] bg-rose-500 rounded-full animate-[soundwave_0.7s_ease-in-out_infinite_0.3s]" />
                    <span className="h-1.5 w-[3px] bg-rose-500 rounded-full animate-[soundwave_0.5s_ease-in-out_infinite_0.45s]" />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="bg-[#0b57d0] hover:bg-[#0b57d0]/90 text-white p-3 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/15 hover:-translate-y-0.5"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
