import { useTranslation } from "react-i18next";
export default function LanguagePicker() {
  const { i18n } = useTranslation();
  return (
    <label className="language-picker">
      <span className="visually-hidden">Language / భాష</span>
      <select
        aria-label="Language / భాష"
        value={i18n.language === "te" ? "te" : "en"}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        <option value="en">English</option>
        <option value="te">తెలుగు</option>
      </select>
    </label>
  );
}
