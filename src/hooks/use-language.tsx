import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, Language, TranslationKey } from "@/lib/translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("preferred_language");
      return saved === "kn" || saved === "en" ? saved : "en";
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("preferred_language", lang);
  };

  useEffect(() => {
    const syncTranslation = () => {
      const combo = document.querySelector(".goog-te-combo") as HTMLSelectElement;
      if (combo) {
        const targetValue = language === "kn" ? "kn" : "";
        if (combo.value !== targetValue) {
          combo.value = targetValue;
          combo.dispatchEvent(new Event("change"));
        }
      }
    };

    syncTranslation();

    // Handle dynamic loading delays of Google Translate elements
    const timer = setTimeout(syncTranslation, 800);
    const interval = setInterval(syncTranslation, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [language]);

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations["en"][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
