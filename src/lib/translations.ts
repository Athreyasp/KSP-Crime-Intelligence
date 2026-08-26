export const translations = {
  en: {
    // Navigation items
    navOverview: "Overview",
    navHotspots: "Hotspots",
    navNetwork: "Network",
    navOffenders: "Offenders",
    navPredictive: "Predictive",
    navSociological: "Sociological",
    navCases: "Cases",
    navNewFir: "New FIR",

    // Navigation Subtitle (Sidebar)
    navigationRegistry: "Navigation Registry",

    // Header
    mastheadTitle: "The Karnataka Crime Daily.",
    mastheadSub: "Strategic intelligence brief",
    activeDistricts: "districts",
    crimeHeads: "crime heads",
    rolling30Days: "rolling 30-day window",
    realtimeAnomaly: "real-time anomaly channel",
    tagline: "Read the state, then the street.",
    syncConsole: "Sync Live Console",
    syncing: "Syncing Zoho Tables...",

    // KPI Row
    totalFirs: "Total FIRs",
    heinousShare: "Heinous Share",
    arrests: "Arrests",
    chargeSheeted: "Charge-sheeted",

    // UI Buttons and Search
    searchPlaceholder: "Search FIR, offender, district...",
  },
  kn: {
    // Navigation items
    navOverview: "ಅವಲೋಕನ",
    navHotspots: "ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು",
    navNetwork: "ನೆಟ್‌ವರ್ಕ್",
    navOffenders: "ಅಪರಾಧಿಗಳು",
    navPredictive: "ಮುನ್ಸೂಚನೆ ಬುದ್ಧಿಮತ್ತೆ",
    navSociological: "ಸಾಮಾಜಿಕ ಸಂಬಂಧ",
    navCases: "ಪ್ರಕರಣಗಳು",
    navNewFir: "ಹೊಸ ಎಫ್‌ಐಆರ್",

    // Navigation Subtitle (Sidebar)
    navigationRegistry: "ನಾವಿಗೇಷನ್ ರಿಜಿಸ್ಟ್ರಿ",

    // Header
    mastheadTitle: "ಕರ್ನಾಟಕ ಅಪರಾಧ ದೈನಿಕ.",
    mastheadSub: "ಕಾರ್ಯತಂತ್ರದ ಬುದ್ಧಿಮತ್ತೆ ಸಂಕ್ಷಿಪ್ತ ಮಾಹಿತಿ",
    activeDistricts: "ಜಿಲ್ಲೆಗಳು",
    crimeHeads: "ಅಪರಾಧ ವಿಭಾಗಗಳು",
    rolling30Days: "ಚಲಿಸುವ 30-ದಿನಗಳ ಅವಧಿ",
    realtimeAnomaly: "ನೈಜ-ಸಮಯದ ಅಸಂಗತತೆ ಚಾನಲ್",
    tagline: "ರಾಜ್ಯವನ್ನು ಓದಿ, ನಂತರ ಬೀದಿಯನ್ನು ತಿಳಿಯಿರಿ.",
    syncConsole: "ಲೈವ್ ಕನ್ಸೋಲ್ ಸಿಂಕ್ ಮಾಡಿ",
    syncing: "ಜೋಹೋ ಟೇಬಲ್ಸ್ ಸಿಂಕ್ ಆಗುತ್ತಿದೆ...",

    // KPI Row
    totalFirs: "ಒಟ್ಟು ಎಫ್‌ಐಆರ್‌ಗಳು",
    heinousShare: "ಹೇಯ ಕೃತ್ಯಗಳ ಪಾಲು",
    arrests: "ಬಂಧನಗಳು",
    chargeSheeted: "ದೋಷಾರೋಪಣೆ ಪಟ್ಟಿ ಸಲ್ಲಿಕೆ",

    // UI Buttons and Search
    searchPlaceholder: "ಎಫ್‌ಐಆರ್, ಅಪರಾಧಿ, ಜಿಲ್ಲೆಯನ್ನು ಹುಡುಕಿ...",
  },
} as const;

export type Language = "en" | "kn";
export type TranslationKey = keyof typeof translations.en;
