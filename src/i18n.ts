import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import te from "./locales/te.json";
let saved = "en";
try {
  saved = localStorage.getItem("silksense-language") || "en";
} catch {}
void i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, te: { translation: te } },
    lng: saved === "te" ? "te" : "en",
    fallbackLng: "en",
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    initAsync: false,
  });
function applyLanguage(language: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language === "te" ? "te" : "en";
    document.title =
      language === "te"
        ? "సిల్క్‌సెన్స్ · పట్టుపురుగుల సంరక్షణ"
        : "SilkSense · Rearing companion";
  }
  try {
    localStorage.setItem("silksense-language", language);
  } catch {}
}
i18n.on("languageChanged", applyLanguage);
applyLanguage(i18n.language);
export function t(
  key: string,
  values?: Record<string, string | number | undefined>,
): string {
  // Stored observations keep their original language-neutral values and authored English evidence.
  if (i18n.exists(key)) return i18n.t(key, values || {}) as string;
  const range = key.match(
    /^(Temperature|Relative humidity) ([\d.]+)(°C|%) is outside ([\d.]+)–([\d.]+)(°C|%)$/,
  );
  if (range)
    return t(
      "{{label}} {{value}}{{unit}} is outside {{low}}–{{high}}{{unit}}",
      {
        label: t(range[1]),
        value: range[2],
        unit: range[3],
        low: range[4],
        high: range[5],
      },
    );
  if (key.startsWith("[")) {
    try {
      const issues = JSON.parse(key);
      if (
        Array.isArray(issues) &&
        issues.every((x) => typeof x.message === "string")
      )
        return issues.map((x) => t(x.message)).join(" ");
    } catch {}
  }
  if (i18n.language === "te") {
    if (key.startsWith("Sync failed ("))
      return "సమకాలీకరణ విఫలమైంది. స్థానిక రికార్డులు భద్రంగా ఉన్నాయి. " + key;
    if (key.includes("records synced."))
      return "రికార్డులు సమకాలీకరించబడ్డాయి. ఫొటోలు, వీడియోలు ఈ పరికరంలోనే ఉంటాయి.";
    if (key.includes("records checked and imported."))
      return "రికార్డులు పరిశీలించి దిగుమతి చేయబడ్డాయి.";
    if (
      key.startsWith("Expected ") ||
      key.startsWith("Number must be") ||
      key.startsWith("String must contain") ||
      key === "Required"
    )
      return "ఇచ్చిన వివరాలు సరిచూడండి. అవసరమైన విలువలు సరైన పరిధిలో ఇవ్వండి.";
  }
  return key;
}
export const locale = () => (i18n.language === "te" ? "te-IN" : "en-IN");
export default i18n;
