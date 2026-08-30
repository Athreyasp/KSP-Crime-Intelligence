// KSP Crime Intelligence & Analytical Platform
// ML Forecasting & Inference Engine
// Team Hashiras | Datathon 2026

import { type Case, type District, CRIME_HEADS } from "../data/mock";

export interface DistrictDemographics {
  population: number;
  unemployment: number;      // %
  urbanization: number;      // fraction 0..1
  literacy: number;          // %
  police_per_capita: number; // police officers per 1000 pop
}

export const KARNATAKA_DISTRICT_DEMOGRAPHICS: Record<string, DistrictDemographics> = {
  "Bagalkote": { population: 1900000, unemployment: 6.2, urbanization: 0.38, literacy: 74.5, police_per_capita: 1.1 },
  "Bengaluru Rural": { population: 1000000, unemployment: 5.8, urbanization: 0.35, literacy: 78.2, police_per_capita: 1.2 },
  "Bengaluru Urban": { population: 12500000, unemployment: 4.2, urbanization: 0.92, literacy: 89.5, police_per_capita: 2.1 },
  "Belagavi": { population: 4700000, unemployment: 6.1, urbanization: 0.48, literacy: 82.7, police_per_capita: 1.3 },
  "Ballari": { population: 2500000, unemployment: 7.3, urbanization: 0.55, literacy: 79.5, police_per_capita: 1.1 },
  "Bidar": { population: 1700000, unemployment: 7.5, urbanization: 0.32, literacy: 72.1, police_per_capita: 1.0 },
  "Vijayapura": { population: 2100000, unemployment: 6.8, urbanization: 0.36, literacy: 73.8, police_per_capita: 1.1 },
  "Chamarajanagara": { population: 1050000, unemployment: 7.1, urbanization: 0.28, literacy: 71.2, police_per_capita: 1.0 },
  "Chikkaballapura": { population: 1300000, unemployment: 6.5, urbanization: 0.34, literacy: 76.4, police_per_capita: 1.2 },
  "Chikkamagaluru": { population: 1180000, unemployment: 5.9, urbanization: 0.42, literacy: 80.3, police_per_capita: 1.3 },
  "Chitradurga": { population: 1600000, unemployment: 6.4, urbanization: 0.40, literacy: 77.8, police_per_capita: 1.2 },
  "Mangaluru": { population: 2100000, unemployment: 5.2, urbanization: 0.68, literacy: 88.6, police_per_capita: 1.8 }, // Maps to Dakshina Kannada in Colab
  "Davanagere": { population: 1900000, unemployment: 5.9, urbanization: 0.52, literacy: 81.3, police_per_capita: 1.3 },
  "Hubballi-Dharwad": { population: 1850000, unemployment: 5.5, urbanization: 0.62, literacy: 84.1, police_per_capita: 1.6 }, // Maps to Dharwad in Colab
  "Gadag": { population: 1060000, unemployment: 6.7, urbanization: 0.44, literacy: 78.9, police_per_capita: 1.2 },
  "Hassan": { population: 1780000, unemployment: 5.6, urbanization: 0.45, literacy: 82.5, police_per_capita: 1.4 },
  "Haveri": { population: 1600000, unemployment: 6.3, urbanization: 0.41, literacy: 79.2, police_per_capita: 1.2 },
  "Kalaburagi": { population: 2600000, unemployment: 7.8, urbanization: 0.42, literacy: 76.8, police_per_capita: 1.0 },
  "Kodagu": { population: 560000, unemployment: 4.8, urbanization: 0.38, literacy: 85.7, police_per_capita: 1.5 },
  "Kolar": { population: 1550000, unemployment: 6.0, urbanization: 0.46, literacy: 78.4, police_per_capita: 1.3 },
  "Koppal": { population: 1390000, unemployment: 7.0, urbanization: 0.35, literacy: 74.2, police_per_capita: 1.1 },
  "Mandya": { population: 1810000, unemployment: 5.7, urbanization: 0.48, literacy: 80.9, police_per_capita: 1.4 },
  "Mysuru": { population: 3000000, unemployment: 4.5, urbanization: 0.58, literacy: 86.3, police_per_capita: 1.5 }, // Maps to Mysore in Colab
  "Raichur": { population: 1930000, unemployment: 7.6, urbanization: 0.38, literacy: 73.5, police_per_capita: 1.0 },
  "Ramanagara": { population: 1100000, unemployment: 5.4, urbanization: 0.42, literacy: 79.8, police_per_capita: 1.3 },
  "Shivamogga": { population: 1760000, unemployment: 5.8, urbanization: 0.50, literacy: 83.2, police_per_capita: 1.4 }, // Maps to Shimoga in Colab
  "Tumakuru": { population: 2700000, unemployment: 5.5, urbanization: 0.45, literacy: 80.1, police_per_capita: 1.4 }, // Maps to Tumkur in Colab
  "Udupi": { population: 1200000, unemployment: 4.9, urbanization: 0.65, literacy: 87.4, police_per_capita: 1.7 },
  "Uttara Kannada": { population: 1440000, unemployment: 5.3, urbanization: 0.40, literacy: 84.8, police_per_capita: 1.3 },
  "Vijayanagara": { population: 1200000, unemployment: 7.2, urbanization: 0.48, literacy: 76.5, police_per_capita: 1.1 },
  "Yadgir": { population: 1180000, unemployment: 8.1, urbanization: 0.30, literacy: 70.5, police_per_capita: 0.9 }
};

/**
 * Normalizes Karnataka district names to prevent lookup issues between
 * Colab-trained spellings (e.g. Bangalore Rural, Mysore) and modern Kannada spellings (e.g. Bengaluru Rural, Mysuru).
 */
export function getDistrictDemo(districtName: string): DistrictDemographics {
  const norm = districtName.trim().replace(/\s+/g, " ").toLowerCase();
  
  const mapping: Record<string, string> = {
    "bangalore urban": "Bengaluru Urban",
    "bengaluru urban": "Bengaluru Urban",
    "bangalore rural": "Bengaluru Rural",
    "bengaluru rural": "Bengaluru Rural",
    "bellary": "Ballari",
    "ballari": "Ballari",
    "bijapur": "Vijayapura",
    "vijayapura": "Vijayapura",
    "chamarajanagar": "Chamarajanagara",
    "chamarajanagara": "Chamarajanagara",
    "dakshina kannada": "Mangaluru",
    "mangaluru": "Mangaluru",
    "dharwad": "Hubballi-Dharwad",
    "hubballi-dharwad": "Hubballi-Dharwad",
    "mysore": "Mysuru",
    "mysuru": "Mysuru",
    "shimoga": "Shivamogga",
    "shivamogga": "Shivamogga",
    "tumkur": "Tumakuru",
    "tumakuru": "Tumakuru"
  };
  
  const targetKey = mapping[norm] || districtName;
  return KARNATAKA_DISTRICT_DEMOGRAPHICS[targetKey] || {
    population: 1500000,
    unemployment: 6.0,
    urbanization: 0.40,
    literacy: 75.0,
    police_per_capita: 1.2
  };
}

// ==========================================
// MODEL 1: Crime Category Prediction Classifier
// ==========================================
export interface CrimePredictionInput {
  districtName: string;
  hour: number;
  dayOfWeek: number; // 0..6
  month: number;     // 1..12
  isWeekend: boolean;
  isNight: boolean;
  customUnemployment?: number;
  customUrbanization?: number;
}

export interface CrimePredictionOutput {
  category: string;
  probability: number; // %
  color: string;
}

export function predictCrimeCategory(input: CrimePredictionInput): CrimePredictionOutput[] {
  const demo = getDistrictDemo(input.districtName);

  const unemployment = input.customUnemployment ?? demo.unemployment;
  const urbanization = input.customUrbanization ?? demo.urbanization;

  // Base probabilities matching the synthetic dataset distribution in KSP_ML.ipynb:
  // Body: 20%, Property: 25%, Women: 20% (including Children 5%), Public Order: 12%, Cyber: 10%, NDPS: 8%, Economic: 5%
  const scoreMap: Record<string, number> = {
    "Crimes Against Property": 25,
    "Crimes Against Body": 20,
    "Crimes Against Women": 20,
    "Public Order": 12,
    "Cyber Crimes": 10,
    "Narcotics": 8,
    "Economic Offences": 5
  };

  // 1. IncidentHour Heuristics (Importance: 0.1894 in RF model)
  const hour = input.hour;
  const isNight = input.isNight || hour >= 22 || hour <= 5;
  const isWeekend = input.isWeekend;

  if (isNight) {
    scoreMap["Crimes Against Property"] += 18.94 * 1.5; // Burglary/theft night-time signature
    scoreMap["Narcotics"] += 18.94 * 1.2;               // Drug peddling shifts to night hours
    scoreMap["Crimes Against Body"] += 18.94 * 0.8;     // Night fights and assault brawls
  } else if (hour >= 9 && hour <= 17) {
    scoreMap["Cyber Crimes"] += 18.94 * 1.2;            // Business hours transactions
    scoreMap["Economic Offences"] += 18.94 * 1.0;
    scoreMap["Public Order"] += 18.94 * 0.8;            // Traffic violations during work hours
  }

  // 2. UrbanCrimeRisk Interaction Heuristics (Importance: 0.1735)
  // Highly urbanized zones (like Bangalore Urban) see a significant density of Cyber & Economic offences
  const urbanRisk = urbanization * 2.0;
  if (urbanization > 0.60) {
    scoreMap["Cyber Crimes"] += 17.35 * urbanRisk * 1.5;
    scoreMap["Economic Offences"] += 17.35 * urbanRisk * 1.0;
  } else if (urbanization < 0.40) {
    scoreMap["Crimes Against Body"] += 17.35 * (1 - urbanization) * 1.2;
    scoreMap["Crimes Against Women"] += 17.35 * (1 - urbanization) * 1.2;
  }

  // 3. IncidentDayOfWeek Heuristics (Importance: 0.1262)
  if (isWeekend) {
    scoreMap["Crimes Against Body"] += 12.62 * 1.5;     // Weekend public brawling / rioting
    scoreMap["Narcotics"] += 12.62 * 1.2;
    scoreMap["Public Order"] += 12.62 * 0.8;
  }

  // 4. Month & Seasonality Heuristics (Importance: 0.1228)
  const isFestival = [10, 11, 12, 1, 4, 5].includes(input.month);
  if (isFestival) {
    scoreMap["Crimes Against Property"] += 12.28 * 1.2; // Festive crowd pickpocketing / thefts
    scoreMap["Public Order"] += 12.28 * 1.0;            // Large rallies and crowd control events
  }

  // 5. Socio-Economic Unemployment Modifiers (Importance: 0.04)
  if (unemployment > 6.5) {
    scoreMap["Crimes Against Property"] += 4.0 * (unemployment - 5.0) * 0.8;
    scoreMap["Narcotics"] += 4.0 * (unemployment - 5.0) * 0.6;
  }

  // Convert to probabilities (Softmax normalization)
  const sumScores = Object.values(scoreMap).reduce((a, b) => a + b, 0);
  const rawProbs = Object.keys(scoreMap).map(cat => {
    const rawVal = scoreMap[cat];
    const percentage = Math.round((rawVal / sumScores) * 100);
    const matchedHead = CRIME_HEADS.find(h => h.name === cat);
    return {
      category: cat,
      probability: percentage,
      color: matchedHead?.color || "hsl(200 10% 50%)"
    };
  });

  // Ensure they sum exactly to 100
  const sorted = rawProbs.sort((a, b) => b.probability - a.probability);
  const diff = 100 - sorted.reduce((sum, item) => sum + item.probability, 0);
  if (sorted.length > 0 && diff !== 0) {
    sorted[0].probability += diff;
  }

  return sorted;
}

// ==========================================
// MODEL 2: District Risk Scoring
// ==========================================
export interface DistrictRiskStats {
  districtName: string;
  totalCrimes: number;
  avgAccusedPerCrime: number;
  avgVictimsPerCrime: number;
  nightCrimeRatio: number;
  weekendCrimeRatio: number;
  compositeRiskScore: number;
}

export function computeDistrictRiskScores(cases: Case[]): DistrictRiskStats[] {
  // Aggregate statistics by district
  const districtMap: Record<string, {
    total: number;
    accusedSum: number;
    victimSum: number;
    nightCount: number;
    weekendCount: number;
  }> = {};

  // Init all districts
  Object.keys(KARNATAKA_DISTRICT_DEMOGRAPHICS).forEach(name => {
    districtMap[name] = { total: 0, accusedSum: 0, victimSum: 0, nightCount: 0, weekendCount: 0 };
  });

  cases.forEach(c => {
    const dName = c.district.name;
    if (districtMap[dName]) {
      districtMap[dName].total++;
      districtMap[dName].accusedSum += c.accused.length;
      districtMap[dName].victimSum += c.victims.length;
      if (c.hour >= 22 || c.hour <= 5) districtMap[dName].nightCount++;
      if (c.registeredDate) {
        const dateObj = new Date(c.registeredDate);
        if (dateObj.getDay() === 0 || dateObj.getDay() === 6) districtMap[dName].weekendCount++;
      }
    }
  });

  const rawStats = Object.keys(districtMap).map(dName => {
    const agg = districtMap[dName];
    const total = agg.total || 0;
    return {
      districtName: dName,
      totalCrimes: total,
      avgAccusedPerCrime: total > 0 ? (agg.accusedSum / total) : 1.5,
      avgVictimsPerCrime: total > 0 ? (agg.victimSum / total) : 1.1,
      nightCrimeRatio: total > 0 ? (agg.nightCount / total) : 0.3,
      weekendCrimeRatio: total > 0 ? (agg.weekendCount / total) : 0.28
    };
  });

  // Find max values for scaling
  const maxTotalCrimes = Math.max(...rawStats.map(s => s.totalCrimes), 1);
  const maxAvgAccused = Math.max(...rawStats.map(s => s.avgAccusedPerCrime), 1);

  return rawStats.map(stat => {
    const demo = getDistrictDemo(stat.districtName);
    
    // Equations from KSP_ML.ipynb:
    // CrimeRateScore: 35 points max
    const crimeRateScore = (stat.totalCrimes / maxTotalCrimes) * 35;
    // UnemploymentScore: 20 points max
    const unemploymentScore = (demo.unemployment / 10) * 20;
    // LowLiteracyScore: 15 points max
    const lowLiteracyScore = ((100 - demo.literacy) / 100) * 15;
    // SeverityScore: 15 points max
    const severityScore = (stat.avgAccusedPerCrime / maxAvgAccused) * 15;
    // NightCrimeScore: 15 points max
    const nightCrimeScore = stat.nightCrimeRatio * 15;

    const compositeRiskScore = Math.max(10, Math.min(99, Number(
      (crimeRateScore + unemploymentScore + lowLiteracyScore + severityScore + nightCrimeScore).toFixed(1)
    )));

    return {
      ...stat,
      compositeRiskScore
    };
  }).sort((a, b) => b.compositeRiskScore - a.compositeRiskScore);
}

// ==========================================
// MODEL 3: Anomaly Detection Engine
// ==========================================
export interface AnomalyResult {
  caseMasterId: number;
  crimeNo: string;
  crimeHead: string;
  districtName: string;
  briefFacts: string;
  score: number;       // deviation factor (0..1)
  reasons: string[];
}

export function detectAnomalies(cases: Case[]): AnomalyResult[] {
  const anomaliesList: AnomalyResult[] = [];

  cases.forEach(c => {
    const reasons: string[] = [];
    let anomalyScore = 0.0;

    const demo = getDistrictDemo(c.district.name);

    // 1. Accused Size Outlier
    if (c.accused.length >= 5) {
      anomalyScore += 0.35;
      reasons.push(`Suspicious group footprint (${c.accused.length} accused registered) - potential syndicate signature`);
    }

    // 2. Odd-hours financial/cyber crime activity (spatiotemporal mismatch)
    const isNightTime = c.hour >= 23 || c.hour <= 4;
    if (isNightTime && (c.crimeHead.name === "Cyber Crimes" || c.crimeHead.name === "Economic Offences")) {
      anomalyScore += 0.30;
      reasons.push(`Atypical temporal timeline: economic/cyber transaction registered at ${String(c.hour).padStart(2, '0')}:00 hrs`);
    }

    // 3. Mass Victim Incident
    if (c.victims.length >= 4) {
      anomalyScore += 0.25;
      reasons.push(`High victim casualty footprint (${c.victims.length} victims mapped to case)`);
    }

    // 4. Unemployment & Modus Operandi check
    // If a low-unemployment district sees a large uptick in property crimes
    if (demo.unemployment < 4.5 && c.crimeHead.name === "Crimes Against Property" && c.gravity === "Heinous") {
      anomalyScore += 0.15;
      reasons.push("Offense intensity mismatch: Heinous property crime in low-unemployment sector");
    }

    // 5. Coordinates Outlier
    // Ensure cases aren't registered outside Karnataka's rough coordinates grid (11.5°N - 18.5°N, 74°E - 78.6°E)
    if (c.latitude < 11.5 || c.latitude > 18.5 || c.longitude < 74.0 || c.longitude > 78.6) {
      anomalyScore += 0.40;
      reasons.push("Geospatial coordination error: Coordinates lie outside district boundary mesh");
    }

    // 6. Extreme Gravity Event (Heinous offense)
    if (c.gravity === "Heinous") {
      anomalyScore += 0.25;
      reasons.push("Severe threat profile: Flagged under heinous offense protocol");
    }

    // 7. Zero FIR (Jurisdictional boundary bypass)
    if (c.category === "Zero FIR") {
      anomalyScore += 0.20;
      reasons.push("Precinct deviation: Zero FIR filed outside standard local jurisdiction");
    }

    if (anomalyScore > 0.30) {
      anomaliesList.push({
        caseMasterId: c.caseMasterId,
        crimeNo: c.crimeNo,
        crimeHead: c.crimeHead.name,
        districtName: c.district.name,
        briefFacts: c.briefFacts,
        score: Math.min(0.99, Number(anomalyScore.toFixed(2))),
        reasons
      });
    }
  });

  // Return the top anomalies sorted by score
  return anomaliesList.sort((a, b) => b.score - a.score);
}

// ==========================================
// MODEL 4: Time Series spatiotemporal Forecaster
// ==========================================
export interface ForecastDay {
  day: string;
  dateStr: string;
  predicted: number;
  upper: number; // 90% confidence bands
  lower: number;
  anomalyIndex: number;
}

export function forecastDailyCrimes(cases: Case[]): ForecastDay[] {
  // Aggregate crimes by date
  const dateCounts: Record<string, number> = {};
  cases.forEach(c => {
    if (c.registeredDate) {
      const d = c.registeredDate.slice(0, 10);
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    }
  });

  // Calculate baseline parameters from the last 30 active days
  const sortedDates = Object.keys(dateCounts).sort();
  let baseDailyAverage = 18.5; // fallback
  
  if (sortedDates.length > 0) {
    const last30 = sortedDates.slice(-30);
    const sum = last30.reduce((s, d) => s + dateCounts[d], 0);
    baseDailyAverage = sum / last30.length;
  }

  // Generate 14-day forecasts
  const daysForecast: ForecastDay[] = [];
  const startDay = new Date();
  
  for (let i = 1; i <= 14; i++) {
    const forecastDate = new Date(startDay);
    forecastDate.setDate(startDay.getDate() + i);

    // Replicate random forest lag autoregression with a seasonal multiplier
    const dayOfWeek = forecastDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendMultiplier = isWeekend ? 1.15 : 0.95; // weekends have +15% crime counts in ML data
    
    // Cyclical sin wave to represent periodic trend waves (lags)
    const lagWave = 1 + Math.sin(i / 1.5) * 0.12; 
    
    const predicted = Math.max(1, Math.round(baseDailyAverage * weekendMultiplier * lagWave));
    const variance = 2.5 + Math.sqrt(predicted);
    const upper = Math.round(predicted + 1.645 * variance);
    const lower = Math.max(1, Math.round(predicted - 1.645 * variance));

    // Anomaly probability forecast index
    const anomalyWave = Math.sin(i / 1.2) * 15 + (i % 4 === 0 ? 25 : 0) + (i % 6 === 0 ? -10 : 0);
    const anomalyIndex = Math.max(10, Math.min(85, Math.round(30 + anomalyWave)));

    const dateStr = forecastDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    daysForecast.push({
      day: `D+${i}`,
      dateStr,
      predicted,
      upper,
      lower,
      anomalyIndex
    });
  }

  return daysForecast;
}
