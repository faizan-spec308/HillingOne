import { createContext, useContext, useState, useEffect } from "react";
import { languages, translations } from "../locales/translations";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem("atrium_lang") || "en"
  );

  const setLang = (code) => {
    if (!languages[code]) return;
    setLangState(code);
    localStorage.setItem("atrium_lang", code);
  };

  useEffect(() => {
    const { dir } = languages[lang] || { dir: "ltr" };
    document.documentElement.dir  = dir;
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key) =>
    translations[lang]?.[key] ?? translations.en[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, languages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
