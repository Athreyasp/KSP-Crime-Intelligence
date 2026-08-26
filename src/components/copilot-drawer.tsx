import React, { useState, useEffect, useRef, useMemo } from "react";
import { Terminal, X, Send, ShieldAlert, Network, Database, User, RefreshCw, ArrowRight, Mic, MicOff, Bot, ChevronRight, BadgeCheck } from "lucide-react";
import { useDb } from "@/hooks/use-db";
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
  firData?: FirData;
  graphData?: {
    criminal: string;
    connections: { name: string; role: "Co-Accused" | "Victim"; strength: number }[];
  };
};

export function CopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchState, setSearchState] = useState<{ step: 1 | 2; name: string; fir: string }>({
    step: 1,
    name: "",
    fir: ""
  });
  const { cases: allCases, offenders } = useDb();
  const { language } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  const handleInputChange = (raw: string) => {
    if (searchState.step === 2) {
      setInput(formatFirInput(raw));
    } else {
      setInput(raw);
    }
  };

  // System dictionary for local bilingual prompts
  const systemText = useMemo(() => {
    const isKn = language === "kn";
    return {
      title: isKn ? "ಎಸ್‌ಸಿಆರ್‌ಬಿ ಇಂಟೆಲ್ ಅಸಿಸ್ಟೆಂಟ್" : "SCRB Intel Assistant",
      statusOnline: isKn ? "ಆನ್‌ಲೈನ್" : "AI ONLINE",
      placeholder: searchState.step === 1 
        ? (isKn ? "ಅಪರಾಧಿಯ ಹೆಸರನ್ನು ನಮೂದಿಸಿ..." : "Enter Criminal Name...")
        : (isKn ? "ಸಂಬಂಧಿತ ಎಫ್‌ಐಆರ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ..." : "Enter associated FIR number..."),
      welcome: isKn 
        ? "[ಆದೇಶ ಪರಿಶೀಲನೆ] ಡೇಟಾಬೇಸ್ ತನಿಖೆ ಮಾಡಲು ಅಪರಾಧಿಯ ಹೆಸರು ಮತ್ತು ಎಫ್‌ಐಆರ್ (FIR) ಸಂಖ್ಯೆ ಎರಡೂ ಕಡ್ಡಾಯವಾಗಿದೆ.\n\nಹಂತ 1: ದಯವಿಟ್ಟು ಅಪರಾಧಿಯ ಹೆಸರನ್ನು ನಮೂದಿಸಿ:"
        : "[MANDATE CHECK] Both Criminal Name and FIR Number are COMPULSORY to interrogate the database.\n\nStep 1: Please enter the Criminal Name:",
      securityAlert: isKn
        ? "[ಭದ್ರತಾ ಪರಿಶೀಲನೆ] ಅನಧಿಕೃತ ವಿನಂತಿ. ಈ ಟರ್ಮಿನಲ್ ಅಪರಾಧ ದಾಖಲೆಗಳು ಮತ್ತು ನೆಟ್‌ವರ್ಕ್ ಲಿಂಕ್ ಅನ್ವೇಷಣೆಗೆ ಮಾತ್ರ ಸೀಮಿತವಾಗಿದೆ."
        : "[SECURITY CHECK] Unauthorized prompt. This terminal is restricted strictly to profile querying and network link discovery.",
      suggestionsTitle: isKn ? "ತ್ವರಿತ ಪ್ರಶ್ಗಳು:" : "Quick Queries:",
      casesFound: isKn ? "ಪತ್ತೆಯಾದ ಪ್ರಕರಣಗಳು" : "Matched Cases",
      associatesFound: isKn ? "ಅಸೋಸಿಯೇಟ್ಸ್ / ಸಂಪರ್ಕಗಳು" : "Accused Associates & Connections",
      clickToInterrogate: isKn ? "ನೆಟ್‌ವರ್ಕ್ ತನಿಖೆ ಮಾಡಲು ಹೆಸರನ್ನು ಕ್ಲಿಕ್ ಮಾಡಿ" : "Click node to interrogate associate"
    };
  }, [language, searchState.step]);

  // Initialize welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          sender: "system",
          text: systemText.welcome,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [systemText]);

  // Fetch quick suggestions from active cases/offenders database based on step
  const suggestions = useMemo(() => {
    const list: { type: "name" | "fir"; value: string }[] = [];
    if (searchState.step === 1) {
      if (offenders && offenders.length > 0) {
        list.push({ type: "name", value: offenders[0].name });
        if (offenders[1]) list.push({ type: "name", value: offenders[1].name });
      }
    } else if (searchState.step === 2) {
      // Show suggestions for FIRs containing the target criminal name
      const matchingCases = allCases.filter(c => 
        c.accused.some(a => a.name.toLowerCase().includes(searchState.name.toLowerCase()))
      );
      matchingCases.slice(0, 2).forEach(c => {
        list.push({ type: "fir", value: c.crimeNo });
      });
      if (list.length === 0 && allCases.length > 0) {
        list.push({ type: "fir", value: allCases[0].crimeNo });
      }
    }
    return list;
  }, [searchState, offenders, allCases]);

  // Execute database search matching criminal name or FIR number
  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: searchTerm,
      timestamp
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");

    const query = searchTerm.trim().toLowerCase();

    // STEP 1: Process Criminal Name
    if (searchState.step === 1) {
      // Check general chat guardrail
      const commonQuestionTriggers = ["hello", "hi", "hey", "who", "what", "where", "how", "why", "joke", "weather", "capital", "you", "help"];
      const isGeneralChat = commonQuestionTriggers.some(t => query.includes(t)) || query.length > 25;

      if (isGeneralChat) {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: "security",
          text: systemText.securityAlert,
          timestamp
        }]);
        toast.error(language === "kn" ? "ಅನಧಿಕೃತ ವಿನಂತಿ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ" : "Unauthorized Query Blocked", {
          description: language === "kn" ? "ಟರ್ಮಿನಲ್ ಪ್ರವೇಶ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ." : "Security system is locking response parameters.",
        });
        return;
      }

      // Record name and move to Step 2
      setSearchState({ step: 2, name: searchTerm.trim(), fir: "" });
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: "system",
        text: language === "kn"
          ? `ಅಪರಾಧಿಯ ಹೆಸರನ್ನು "${searchTerm.trim()}" ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ.\n\nಹಂತ 2: ದಯವಿಟ್ಟು ಸಂಬಂಧಿತ ಎಫ್‌ಐಆರ್ (FIR) ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ:`
          : `Criminal Name recorded: "${searchTerm.trim()}".\n\nStep 2: Now, enter the associated FIR Number to run validation:`,
        timestamp
      }]);
      return;
    }

    // STEP 2: Process FIR Number & Run Validation
    if (searchState.step === 2) {
      const targetName = searchState.name;
      
      // Auto-format the search query if it contains spaced-out characters/words
      // e.g. "f i r b a g 2026 0001" -> "FIR/BAG/2026/0001"
      let formattedSearchTerm = searchTerm.trim();
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
      const matchedCase = allCases.find(c => 
        (c.crimeNo.toLowerCase().includes(queryFormatted) || 
         c.crimeNo.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanedInput) ||
         String(c.caseMasterId).includes(queryFormatted)) &&
        c.accused.some(a => a.name.toLowerCase().includes(targetName.toLowerCase()))
      );

      // Reset step to 1 for the next query session
      setSearchState({ step: 1, name: "", fir: "" });

      if (!matchedCase) {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: "system",
          text: language === "kn"
            ? `ದಾಖಲೆ ಕಂಡುಬಂದಿಲ್ಲ: ಅಪರಾಧಿ "${targetName}" ಒಳಗೊಂಡಿರುವ ಎಫ್‌ಐಆರ್ #${searchTerm} ನೊಂದಿಗೆ ಹೊಂದಾಣಿಕೆಯಾಗುವ ಯಾವುದೇ ಪ್ರಕರಣವು ಡೇಟಾಸ್ಟೋರ್‌ನಲ್ಲಿ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ.\n\nಹಂತ 1: ಅಪರಾಧಿಯ ಹೆಸರನ್ನು ನಮೂದಿಸಿ:`
            : `RECORD NOT FOUND: No record found for FIR #${searchTerm} involving criminal "${targetName}". Please verify and start again.\n\nStep 1: Enter Criminal Name:`,
          timestamp
        }]);
        return;
      }

      // ── Prediction Engine ────────────────────────────────────────────
      // Gather ALL cases involving this criminal across the database
      const allCriminalCases = allCases.filter(c =>
        c.accused.some(a => a.name.toLowerCase().includes(targetName.toLowerCase()))
      );

      // Crime type frequency map
      const crimeTypeFreq: Record<string, number> = {};
      const districtFreq: Record<string, number> = {};
      const moFreq: Record<string, number> = {};
      const hourBuckets: number[] = [];
      let heinousCount = 0;

      allCriminalCases.forEach(c => {
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
      const coAccusedCount = new Set(allCriminalCases.flatMap(c => c.accused.map(a => a.name))).size - 1;

      // Risk score heuristic (0-100)
      let riskScore = 30;
      riskScore += Math.min(totalCases * 8, 30);      // repeat offender weight
      riskScore += heinousCount > 0 ? 15 : 0;         // heinous crime bonus
      riskScore += coAccusedCount > 2 ? 10 : 0;       // organized crime indicator
      riskScore += topDistricts.length > 1 ? 5 : 0;   // multi-district activity
      riskScore = Math.min(riskScore, 100);

      const riskLevel: PredictionData["riskLevel"] =
        riskScore >= 85 ? "CRITICAL" :
        riskScore >= 65 ? "HIGH" :
        riskScore >= 45 ? "MEDIUM" : "LOW";

      // Time window prediction
      const timeOfDay = avgHour < 6 ? "late night (00:00–06:00)" :
        avgHour < 12 ? "morning (06:00–12:00)" :
        avgHour < 18 ? "afternoon (12:00–18:00)" : "evening/night (18:00–24:00)";

      // Escalation trend (compare heinous ratio over time)
      const recentHeinous = allCriminalCases.slice(-3).filter(c => c.gravity === "Heinous").length;
      const olderHeinous  = allCriminalCases.slice(0, 3).filter(c => c.gravity === "Heinous").length;
      const escalationTrend: PredictionData["escalationTrend"] =
        recentHeinous > olderHeinous ? "ESCALATING" :
        recentHeinous < olderHeinous ? "DE-ESCALATING" : "STABLE";

      // Behavioral triggers
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
      // ── End Prediction Engine ────────────────────────────────────────

      // Build structured FIR card data
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
        victims: matchedCase.victims.map(v => v.name),
        accused: matchedCase.accused.map(a => a.name),
        briefFacts: matchedCase.briefFacts,
        done: language === "kn" ? "ಹೊಸ ಹುಡುಕಾಟಕ್ಕಾಗಿ ಅಪರಾಧಿಯ ಹೆಸರನ್ನು ನಮೂದಿಸಿ" : "Interrogation complete — enter a new Criminal Name to search again",
        prediction
      };

      // Build graph nodes
      const connections: { name: string; role: "Co-Accused" | "Victim"; strength: number }[] = [
        ...matchedCase.accused.map(a => ({
          name: a.name,
          role: "Co-Accused" as const,
          strength: 80
        })),
        ...matchedCase.victims.map(v => ({
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
    }
  };

  return (
    <>
      {/* Floating FAB — Premium Branded Material Editorial Square Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-sm bg-[#0b57d0] text-white border-2 border-ink shadow-[4px_4px_0_0_#202124] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#202124] transition-all duration-200 active:scale-95 group cursor-pointer animate-in fade-in duration-300"
        title={language === "kn" ? "SCRB ಇಂಟೆಲ್ ಅಸಿಸ್ಟೆಂಟ್" : "SCRB Intel Assistant"}
      >
        <Bot className="h-6 w-6 group-hover:scale-110 transition-all duration-200" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-sm bg-[#d93025] opacity-75"></span>
          <span className="relative inline-flex rounded-sm h-4 w-4 bg-[#d93025] border-2 border-ink shadow-xs"></span>
        </span>
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
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-paper border-l-4 border-ink shadow-[-4px_0_20px_rgba(0,0,0,0.06)] z-50 flex flex-col transition-all duration-300 ease-out transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header — Matches Website Masthead & Editorial Typography ── */}
        <div className="flex items-center gap-3 bg-paper border-b-4 border-ink px-5 py-4 text-ink shrink-0 justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-ink text-paper border-2 border-ink shrink-0 shadow-sm">
              <Bot className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col">
              <p className="font-editorial text-[15px] italic leading-none font-bold text-ink">{systemText.title}</p>
              <p className="text-[9px] text-[#5f6368] font-mono tracking-widest uppercase mt-0.5">KSP · SCRB · SYSTEM INTEL</p>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span className="flex items-center gap-1.5 bg-[#e8f0fe] border-2 border-ink rounded-sm px-2.5 py-0.5 shadow-sm text-[9px] font-bold text-[#0b57d0]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse border border-ink shadow-[0_0_4px_#10b981]" />
              {systemText.statusOnline}
            </span>
            <button 
              onClick={() => setIsOpen(false)} 
              className="p-1 rounded-sm border-2 border-ink bg-paper hover:bg-surface-2 text-ink shadow-sm cursor-pointer transition-colors active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Step Progress Indicator — Flat Border-2 Styled Pills ── */}
        <div className="flex items-center gap-0 border-b-2 border-ink/15 bg-surface-2 shrink-0 px-5 py-3">
          {/* Step 1 */}
          <div className="flex items-center gap-2">
            <div className={`flex h-5 w-5 items-center justify-center rounded-sm border-2 border-ink text-[9px] font-bold font-mono transition-all duration-300 ${
              searchState.step >= 1 
                ? "bg-[#0b57d0] text-white shadow-xs" 
                : "bg-paper text-[#5f6368]"
            }`}>
              {searchState.step > 1 ? <BadgeCheck className="h-3 w-3 text-white" /> : "1"}
            </div>
            <span className={`text-[9px] font-mono font-bold tracking-wider uppercase transition-colors duration-300 ${
              searchState.step === 1 ? "text-[#0b57d0]" : "text-[#5f6368]"
            }`}>
              {language === "kn" ? "ಹೆಸರು" : "Criminal Name"}
            </span>
          </div>

          <ChevronRight className="h-3.5 w-3.5 text-ink/30 mx-2.5" />

          {/* Step 2 */}
          <div className="flex items-center gap-2">
            <div className={`flex h-5 w-5 items-center justify-center rounded-sm border-2 border-ink text-[9px] font-bold font-mono transition-all duration-300 ${
              searchState.step === 2 
                ? "bg-[#0b57d0] text-white shadow-xs" 
                : "bg-paper text-[#5f6368]"
            }`}>
              2
            </div>
            <span className={`text-[9px] font-mono font-bold tracking-wider uppercase transition-colors duration-300 ${
              searchState.step === 2 ? "text-[#0b57d0]" : "text-[#5f6368]"
            }`}>
              {language === "kn" ? "FIR ಸಂಖ್ಯೆ" : "FIR Number"}
            </span>
          </div>

          {searchState.name && (
            <span className="ml-auto text-[9px] font-mono bg-[#e8f0fe] text-[#0b57d0] px-2.5 py-0.5 rounded-sm border-2 border-ink font-bold shadow-xs truncate max-w-[130px]">
              🔍 {searchState.name}
            </span>
          )}
        </div>

        {/* ── Messages Feed — Google Web Fonts & Editorial Aesthetic ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[11px] leading-relaxed text-ink bg-paper scrollbar-thin">
          {messages.map((m) => {
            if (m.sender === "user") {
              return (
                <div key={m.id} className="flex flex-col items-end gap-1 animate-in fade-in duration-200">
                  <div className="bg-[#e8f0fe] border-2 border-ink text-ink px-4 py-2.5 rounded-sm max-w-[85%] shadow-[2px_2px_0_0_#202124]">
                    <p className="font-sans text-[11.5px] leading-snug font-bold">{m.text}</p>
                  </div>
                  <span className="text-[8px] font-mono text-[#5f6368] tracking-wider pr-1.5">{m.timestamp}</span>
                </div>
              );
            }

            if (m.sender === "security") {
              return (
                <div key={m.id} className="flex gap-2.5 animate-in fade-in duration-200">
                  <div className="h-7.5 w-7.5 rounded-sm bg-rose-50 border-2 border-ink flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <ShieldAlert className="h-4.5 w-4.5 text-[#d93025]" />
                  </div>
                  <div className="flex flex-col gap-1.5 max-w-[90%]">
                    <div className="bg-rose-50 border-2 border-[#d93025] text-ink px-4 py-3 rounded-sm shadow-[2px_2px_0_0_#d93025]">
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
                  <div className="h-7.5 w-7.5 rounded-sm bg-paper border-2 border-ink flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Bot className="h-4.5 w-4.5 text-ink" />
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

                      {/* Network Graph — Branded Platform View */}
                      {m.graphData && m.graphData.connections.length > 0 && (
                        <div className="border-t-2 border-ink p-4 bg-surface-2">
                          <p className="text-[8.5px] uppercase tracking-wider text-[#d93025] mb-3 flex items-center gap-1 font-bold">
                            <Network className="h-3.5 w-3.5 text-[#d93025] animate-[pulse_2s_infinite]" />
                            {language === "kn" ? "ಸಂಪರ್ಕ ಜಾಲ" : "Connection Network"}
                          </p>
                          <div className="border-2 border-ink rounded-sm bg-paper relative overflow-hidden shadow-sm">
                            {(() => {
                              const conns = m.graphData!.connections;
                              const cx = 200, cy = 95;
                              const r = 70;
                              const svgH = 190 + (conns.length > 4 ? 30 : 0);
                              return (
                                <svg viewBox={`0 0 400 ${svgH}`} className="w-full" style={{ height: `${svgH}px` }}>
                                  <defs>
                                    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                                      <stop offset="0%" stopColor="#d93025" stopOpacity="0.2" />
                                      <stop offset="100%" stopColor="#d93025" stopOpacity="0" />
                                    </radialGradient>
                                  </defs>

                                  {/* Connection Lines */}
                                  {conns.map((c, i) => {
                                    const angle = (i * 2 * Math.PI) / conns.length - Math.PI / 2;
                                    const tx = cx + r * Math.cos(angle);
                                    const ty = cy + r * Math.sin(angle);
                                    return (
                                      <line key={i}
                                        x1={cx} y1={cy} x2={tx} y2={ty}
                                        stroke={c.role === "Co-Accused" ? "#f59e0b" : "#0b57d0"}
                                        strokeWidth="1.75" strokeDasharray="5 3" opacity="0.85"
                                      />
                                    );
                                  })}

                                  {/* Center pulsing glow */}
                                  <circle cx={cx} cy={cy} r="28" fill="url(#centerGlow)" className="animate-pulse" />
                                  <circle cx={cx} cy={cy} r="17" fill="#d93025" stroke="currentColor" className="text-ink" strokeWidth="2.5" />
                                  <text x={cx} y={cy - 2.5} textAnchor="middle" fill="#fff" fontSize="7" fontWeight="extrabold" className="font-sans">
                                    {m.graphData!.criminal.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase()}
                                  </text>
                                  <text x={cx} y={cy + 7.5} textAnchor="middle" fill="#fff" fontSize="5" fontWeight="black" opacity="0.95" className="font-mono tracking-wider">
                                    TARGET
                                  </text>

                                  {/* Orbit Nodes */}
                                  {conns.map((c, i) => {
                                    const angle = (i * 2 * Math.PI) / conns.length - Math.PI / 2;
                                    const tx = cx + r * Math.cos(angle);
                                    const ty = cy + r * Math.sin(angle);
                                    const color = c.role === "Co-Accused" ? "#f59e0b" : "#0b57d0";
                                    const words = c.name.trim().split(" ");
                                    const label1 = words[0] ?? "";
                                    const label2 = words.slice(1).join(" ");
                                    return (
                                      <g key={i} className="cursor-pointer group" onClick={() => handleSearch(c.name)}>
                                        <circle cx={tx} cy={ty} r="13" fill={color} stroke="currentColor" className="text-ink group-hover:scale-105 transition-transform duration-200" strokeWidth="2" opacity="0.95" />
                                        <text x={tx} y={ty + 1} textAnchor="middle" fill="#fff" fontSize="6.5" fontWeight="bold" dominantBaseline="middle" className="font-sans pointer-events-none">
                                          {c.name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase()}
                                        </text>
                                        {/* Name label below node */}
                                        <text x={tx} y={ty + 20} textAnchor="middle" fill="currentColor" className="fill-ink font-sans pointer-events-none font-bold" fontSize="7">{label1}</text>
                                        {label2 && <text x={tx} y={ty + 29} textAnchor="middle" fill="currentColor" className="fill-[#5f6368] font-sans pointer-events-none" fontSize="6">{label2}</text>}
                                        <text x={tx} y={ty + (label2 ? 38 : 29)} textAnchor="middle" fill={color} fontSize="5.5" fontWeight="black" className="font-mono tracking-wider pointer-events-none">
                                          {c.role === "Co-Accused" ? "CO-ACCUSED" : "VICTIM"}
                                        </text>
                                        <title>{c.name} · {c.role}</title>
                                      </g>
                                    );
                                  })}

                                  {/* Legend */}
                                  <g transform="translate(10, 10)">
                                    <circle cx="5" cy="5" r="4.5" fill="#f59e0b" />
                                    <text x="14" y="8" fill="currentColor" className="fill-ink font-mono font-bold" fontSize="6">Co-Accused</text>
                                    <circle cx="5" cy="17" r="4.5" fill="#0b57d0" />
                                    <text x="14" y="20" fill="currentColor" className="fill-ink font-mono font-bold" fontSize="6">Victim</text>
                                    <circle cx="5" cy="29" r="4.5" fill="#d93025" />
                                    <text x="14" y="32" fill="currentColor" className="fill-ink font-mono font-bold" fontSize="6">Target Accused</text>
                                  </g>
                                </svg>
                              );
                            })()}
                            <p className="text-[8px] text-center text-[#5f6368] tracking-wider py-2 bg-surface-2 border-t-2 border-ink font-mono font-bold">
                              {systemText.clickToInterrogate}
                            </p>
                          </div>
                        </div>
                      )}

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
                <div className="h-7.5 w-7.5 rounded-sm bg-paper border-2 border-ink flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Bot className="h-4.5 w-4.5 text-ink" />
                </div>
                <div className="flex flex-col gap-1 max-w-[90%]">
                  <div className="bg-paper border-2 border-ink text-ink px-4 py-3 rounded-sm shadow-[2px_2px_0_0_#202124]">
                    <p className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed font-medium">{m.text}</p>
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
          <div className="px-5 py-3 border-t-2 border-ink bg-surface-2 shrink-0">
            <span className="text-[9px] uppercase tracking-widest text-[#5f6368] font-bold font-mono">
              {systemText.suggestionsTitle}
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(s.value)}
                  className="text-[9.5px] text-[#0b57d0] bg-paper border-2 border-ink hover:bg-[#0b57d0] hover:text-white px-3 py-1 rounded-sm shadow-[2px_2px_0_0_#202124] hover:shadow-[3px_3px_0_0_#202124] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer font-bold"
                >
                  {s.type === "fir" ? "FIR: " : "Accused: "}{s.value}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input Panel — Pill Shape & Glowing States ── */}
        <div className="p-4 border-t-2 border-ink bg-paper shrink-0">
          {/* Step 2 live format preview */}
          {searchState.step === 2 && input && (
            <div className="mb-3 px-3 py-2 bg-[#e8f0fe] border-2 border-ink rounded-sm flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
              <span className="text-[9px] text-[#0b57d0] font-mono font-bold tracking-wider">FORMAT PREVIEW:</span>
              <span className="text-[10px] font-bold font-mono text-ink tracking-widest">{input}</span>
              <span className="ml-auto text-[8.5px] text-emerald-700 font-bold flex items-center gap-0.5">✓ {language === "kn" ? "ಸ್ವಯಂ" : "AUTO"}</span>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(input);
            }}
            className="flex gap-2.5 items-center"
          >
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={systemText.placeholder}
                className="w-full bg-paper border-2 border-ink rounded-sm pl-4 pr-12 py-3 text-[12px] text-ink font-sans focus:outline-none focus:border-[#0b57d0] placeholder-[#5f6368] transition-all"
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
                <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 flex items-center justify-between px-4 rounded-2xl pointer-events-none">
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
              className="bg-gradient-to-tr from-[#0b57d0] to-[#1a73e8] dark:from-[#3b82f6] dark:to-[#1d4ed8] hover:shadow-[0_4px_12px_rgba(11,87,208,0.25)] text-white p-3 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 shadow-sm hover:scale-105"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
