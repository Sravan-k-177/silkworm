import { t } from "./i18n";
import { useTranslation } from "react-i18next";
import LanguagePicker from "./LanguagePicker";
import { useEffect, useState } from "react";
import CareExplainer from "./CareExplainer";
import type { RiskInput } from "../shared/domain";
const input: RiskInput = {
  instar: "V",
  moulting: false,
  temperature: 29,
  humidity: 85,
  ventilation: "stuffy",
  hygiene: "clean",
  feed: "fresh",
  symptoms: ["mortality"],
  visual: { status: "not-assessed", warnings: [] },
};
export default function Demo() {
  useTranslation();
  const [health, setHealth] = useState("Checking backend…");
  useEffect(() => {
    fetch("/api/health")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((r) =>
        setHealth(
          r.ok
            ? "Backend connected · production frontend running"
            : "Backend unavailable",
        ),
      )
      .catch(() =>
        setHealth("Backend unreachable · care guide still works offline"),
      );
  }, []);
  return (
    <main style={{ maxWidth: 850, margin: "0 auto", padding: "32px 20px" }}>
      <div className="eyebrow">
        {t("SILKSENSE · INTERACTIVE DEMONSTRATION")}
      </div>
      <h1>{t("Understand the next step.")}</h1>
      <p role="status">{health}</p>
      <p>
        {t(
          "This fictional fifth-instar tray has 29°C temperature, 85% humidity, stuffy air and reported unusual deaths. No farm records are created.",
        )}
      </p>
      <LanguagePicker />
      <CareExplainer input={input} />
      <a className="button primary" href="/">
        {t("Open the full application")}
      </a>
      <p>
        {t(
          "To try real image inference, open Experimental feed-leaf check on the home screen.",
        )}
      </p>
    </main>
  );
}
