import { t, locale } from "./i18n";
import { useTranslation } from "react-i18next";
import LanguagePicker from "./LanguagePicker";
import { useAccount, AccountControls } from "./AuthGate";
import type { TrayCapture } from "./tray-inference";
import DeepLab from "./DeepLab";
import CareExplainer from "./CareExplainer";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CloudUpload,
  CloudOff,
  Droplets,
  Ellipsis,
  Eye,
  FileUp,
  Flag,
  Home,
  Leaf,
  LoaderCircle,
  Plus,
  Settings,
  ShieldCheck,
  Sprout,
  Thermometer,
  TrendingUp,
  Users,
  WifiOff,
  Wind,
  X,
} from "lucide-react";
import {
  db,
  exportRecords,
  importRecords,
  saveEvent,
  synchronize,
  type LocalEvent,
  type Media,
} from "./db";
import { processMedia } from "./media";
import LeafLab from "./LeafLab";
import LeafPhotoInput, { LeafResult } from "./LeafCapture";
import type { LeafCapture } from "./leaf-model";
import ReviewHistory from "./ReviewHistory";
import Followups from "./Followups";
import HealthHistory from "./HealthHistory";
import LarvalEvidence, { LarvalModelEvidence } from "./LarvalEvidence";
import {
  latestAssessmentInRange,
  outcomeComparison,
} from "../shared/longitudinal";
import {
  assessmentSchema,
  batchSchema,
  instars,
  outcomeSchema,
  type Assessment,
  type Batch,
  type Intervention,
  type Outcome,
  type Risk,
  type Visual,
} from "../shared/domain";
import { assessRisk, outcomeMetrics, profiles, SOP_URL } from "../shared/risk";
type View =
  | "deep"
  | "home"
  | "capture"
  | "batches"
  | "supervisor"
  | "settings"
  | "batch"
  | "result"
  | "leaf";
const fmt = (date: string) =>
  new Intl.DateTimeFormat(locale(), {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
const today = () => new Date().toISOString().slice(0, 10);
function Badge({ level }: { level: Risk["level"] }) {
  return (
    <span className={`badge ${level}`}>
      <span />
      {t(level[0].toUpperCase() + level.slice(1))}
      {t(" risk")}
    </span>
  );
}
function Empty({
  icon = <Sprout />,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{t(label)}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog ref={dialog} onCancel={onClose}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={t("Close dialog")}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function ErrorNote({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {t(error)}
    </div>
  ) : null;
}
export default function App() {
  useTranslation();
  const { user } = useAccount();
  const [draftLeaf, setDraftLeaf] = useState<LeafCapture | null>(null);
  const [draftCapture, setDraftCapture] = useState<TrayCapture | null>(null);
  const [view, setView] = useState<View>(
    new URLSearchParams(location.search).has("deep") ? "deep" : "home",
  );
  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<Assessment | null>(null);
  const [modal, setModal] = useState<"batch" | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncBusy, setSyncBusy] = useState(false);
  const syncInFlight = useRef(false);
  const [notice, setNotice] = useState("");
  const [syncError, setSyncError] = useState("");
  const [token, setToken] = useState(sessionStorage.getItem("syncToken") || "");
  const events =
    useLiveQuery(() => db.events.orderBy("createdAt").toArray(), []) || [];
  const lastSync = useLiveQuery(() => db.settings.get("lastSync"), []);
  const pending = events.filter((e) => !e.synced).length;
  const batches = events
    .filter((e) => e.kind === "batch")
    .map((e) => e.payload as Batch);
  const assessments = events
    .filter((e) => e.kind === "assessment")
    .map((e) => e.payload as Assessment)
    .sort(
      (a, b) =>
        Date.parse(b.capturedAt) - Date.parse(a.capturedAt) ||
        b.id.localeCompare(a.id),
    );
  const interventions = events
    .filter((e) => e.kind === "intervention")
    .map((e) => e.payload as Intervention);
  const outcomes = events
    .filter((e) => e.kind === "outcome")
    .map((e) => e.payload as Outcome);
  const latest = batches.map((b) => ({
    batch: b,
    assessment: assessments.find((a) => a.batchId === b.id),
  }));
  const high = latest.filter((x) => x.assessment?.risk.level === "high");
  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    const previousFocus = document.activeElement;
    requestAnimationFrame(() => {
      if (
        document.activeElement === previousFocus ||
        document.activeElement === document.body
      )
        document.getElementById("main")?.focus({ preventScroll: true });
    });
  };
  const sync = useCallback(
    async (quiet = false) => {
      if (syncInFlight.current) return;
      syncInFlight.current = true;
      setSyncBusy(true);
      setSyncError("");
      try {
        const n = await synchronize(token);
        if (!quiet)
          setNotice(
            n
              ? `${n} records synced. Photos and videos remain on this device.`
              : "Records are up to date.",
          );
      } catch (e) {
        setSyncError((e as Error).message);
      } finally {
        syncInFlight.current = false;
        setSyncBusy(false);
      }
    },
    [token],
  );
  useEffect(() => {
    const on = () => {
      setOnline(true);
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (online) {
      const timer = setTimeout(() => void sync(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [online, pending, sync]);
  useEffect(() => {
    if (!online) return;
    // Pull reviews and observations even when this device has no queued writes.
    // Also retry transient server failures without requiring a network toggle.
    const refresh = () => {
      if (document.visibilityState === "visible") void sync(true);
    };
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [online, sync]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 7000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const openBatch = (id: string) => {
    setBatchId(id);
    navigate("batch");
  };
  const capture = (id = "") => {
    setDraftCapture(null);
    setDraftLeaf(null);
    setBatchId(id);
    navigate("capture");
  };
  const nav = [
    { id: "home" as View, label: "Today", icon: Home },
    { id: "batches" as View, label: "Batches", icon: ClipboardList },
    { id: "capture" as View, label: "Assess", icon: Camera },
    { id: "supervisor" as View, label: "Overview", icon: TrendingUp },
  ];
  return (
    <>
      <a className="skip" href="#main">
        {t("Skip to content")}
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("home");
            }}
          >
            <div className="brand-mark">
              <Leaf />
            </div>
            <span>
              {t("SilkSense")}
              <small>{t("YOUR REARING COMPANION")}</small>
            </span>
          </a>
          <div className="sidebar-label">{t("FIELD WORKSPACE")}</div>
          <nav>
            {nav
              .filter(
                (n) => n.id !== "supervisor" || !user || user.role !== "field",
              )
              .map((n) => (
                <button
                  key={n.id}
                  className={view === n.id ? "active" : ""}
                  onClick={() =>
                    n.id === "capture" ? capture() : navigate(n.id)
                  }
                >
                  <n.icon />
                  {t(n.label)}
                  {n.id === "supervisor" && high.length > 0 && (
                    <span className="nav-count">{high.length}</span>
                  )}
                </button>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="pilot-label">
              <span />
              {t("Research demo")}
            </div>
            <p>
              {t("Better observations.")}
              <br />
              {t("More informed care.")}
            </p>
            <button onClick={() => navigate("settings")}>
              <Settings size={18} />
              {t("Settings & evidence")}
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="mobile-brand">
              <Leaf size={23} />
              <strong>{t("SilkSense")}</strong>
            </div>
            <div className="desktop-location">
              <span className="dot" />
              {t("Field workspace ")}
              <span>/</span>
              {t(" Mulberry silkworm")}
            </div>
            <div className="top-actions">
              <LanguagePicker />
              <button
                className={`sync-indicator ${!online ? "offline" : ""}`}
                onClick={() => void sync()}
                disabled={syncBusy || !online}
                aria-label={
                  online
                    ? t("Synchronize records")
                    : t("Offline, records saved on device")
                }
              >
                {syncBusy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : online ? (
                  <CloudUpload size={16} />
                ) : (
                  <CloudOff size={16} />
                )}
                <span>
                  {!online
                    ? t("Offline")
                    : pending
                      ? t("{{v0}} pending", { v0: pending })
                      : t("On device")}
                </span>
              </button>
              <button
                className="avatar"
                onClick={() => navigate("settings")}
                aria-label={t("Open settings")}
              >
                {t("FS")}
              </button>
            </div>
          </header>
          <AccountControls />
          {!online && (
            <div className="offline-strip">
              <WifiOff size={15} />
              {t("You’re offline. Keep working; records stay on this device.")}
            </div>
          )}
          <main id="main" tabIndex={-1}>
            {view === "home" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">
                      {t("FIELD NOTES ·")}{" "}
                      {new Intl.DateTimeFormat(locale(), {
                        day: "numeric",
                        month: "long",
                      }).format(new Date())}
                    </div>
                    <h1>
                      {t("A little care.")}
                      <br className="mobile-only" />
                      {t(" A healthier harvest.")}
                    </h1>
                    <p>
                      {t(
                        "Your batches, observations and next steps, together.",
                      )}
                    </p>
                  </div>
                  <button
                    className="button primary desktop-only"
                    onClick={() => capture()}
                  >
                    <Plus size={18} />
                    {t("New assessment")}
                  </button>
                </div>
                <section className="hero">
                  <div className="hero-copy">
                    <div className="hero-eyebrow">
                      <Sprout size={16} />
                      {t("OBSERVE EARLY. ACT WITH CARE.")}
                    </div>
                    <h2>{t("Start with a closer look.")}</h2>
                    <p>
                      {t(
                        "A tray photo and a few shed observations help you decide what needs attention.",
                      )}
                    </p>
                    <button
                      className="button light"
                      onClick={() =>
                        batches.length ? capture() : setModal("batch")
                      }
                    >
                      <Camera size={18} />
                      {batches.length
                        ? t("Check a batch")
                        : t("Start your first batch")}
                      <ArrowRight size={18} />
                    </button>
                    <span className="hero-foot">
                      <ShieldCheck size={14} />
                      {t("Works offline · Non-diagnostic guidance")}
                    </span>
                  </div>
                  <div className="plant-art" aria-hidden="true">
                    <svg viewBox="0 0 240 260">
                      <path
                        d="M116 255C117 176 130 111 183 39"
                        fill="none"
                        stroke="#bbd1a7"
                        strokeWidth="4"
                      />
                      <path
                        d="M142 131C89 129 61 100 62 51c54 0 94 20 80 80Z"
                        fill="#cdddaf"
                      />
                      <path
                        d="M148 113c-20-39-5-80 47-102 21 54 6 83-47 102Z"
                        fill="#97b785"
                      />
                      <path
                        d="M127 182c-61 12-100-17-112-56 56-16 100-1 112 56Z"
                        fill="#9dbb89"
                      />
                      <path
                        d="M133 157c7-45 37-63 91-55-4 45-29 71-91 55Z"
                        fill="#d7e6b6"
                      />
                      <path
                        d="M120 226c19-43 60-53 98-31-20 41-56 52-98 31Z"
                        fill="#799e72"
                      />
                      <path
                        d="m142 131-53-50m44 76 62-29m-68 54-80-35m73 79 68-20"
                        stroke="#183e35"
                        strokeOpacity=".3"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                    <span className="art-orbit o1" />
                    <span className="art-orbit o2" />
                  </div>
                </section>
                <section className="stats-grid" aria-label={t("Batch summary")}>
                  <div>
                    <span className="stat-icon">
                      <ClipboardList />
                    </span>
                    <strong>{batches.length}</strong>
                    <span>{t("Active batches")}</span>
                  </div>
                  <div>
                    <span className="stat-icon amber">
                      <Flag />
                    </span>
                    <strong>{high.length}</strong>
                    <span>{t("High-risk batches")}</span>
                  </div>
                  <div>
                    <span className="stat-icon">
                      <CheckCircle2 />
                    </span>
                    <strong>
                      {
                        interventions.filter((i) => i.status === "completed")
                          .length
                      }
                    </strong>
                    <span>{t("Actions recorded")}</span>
                  </div>
                </section>
                <div className="home-columns">
                  <section>
                    <div className="section-heading">
                      <h2>
                        {t("Your batches ")}
                        <span>{batches.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => navigate("batches")}
                      >
                        {t("View all")}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    {!batches.length ? (
                      <div className="card">
                        <Empty
                          title={t("Every batch has a story")}
                          action={
                            <button
                              className="button secondary"
                              onClick={() => setModal("batch")}
                            >
                              <Plus size={17} />
                              {t("Add your first batch")}
                            </button>
                          }
                        >
                          {t(
                            "Start a batch to keep its observations, care and outcomes in one place.",
                          )}
                        </Empty>
                      </div>
                    ) : (
                      <div className="batch-list">
                        {latest.slice(0, 4).map(({ batch, assessment }) => (
                          <BatchCard
                            key={batch.id}
                            batch={batch}
                            assessment={assessment}
                            onClick={() => openBatch(batch.id)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                  <section>
                    <div className="section-heading">
                      <h2>{t("Before you assess")}</h2>
                      <Leaf size={19} />
                    </div>
                    <div className="care-card">
                      <span className="eyebrow">
                        {t("A BETTER FIELD PHOTO")}
                      </span>
                      <h3>{t("Clear tray. Clearer picture.")}</h3>
                      <p>
                        {t(
                          "Use even light, keep the camera steady, and include the larvae at a natural distance.",
                        )}
                      </p>
                      <div className="care-divider" />
                      <div className="mini-tip">
                        <Eye size={20} />
                        <span>
                          {t("Record what you see.")}
                          <small>
                            {t("Photos alone cannot confirm disease.")}
                          </small>
                        </span>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("leaf")}
                      >
                        {t("Experimental feed-leaf check")}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </section>
                </div>
                <div className="card form-card">
                  <h2>{t("Run the backend neural network")}</h2>
                  <p>
                    {t(
                      "Take a camera photo or upload an image for server-side MobileNetV3 inference and image explanations.",
                    )}
                  </p>
                  <button
                    className="button primary"
                    onClick={() => navigate("deep")}
                  >
                    {t("Deep-learning tray check")}
                  </button>
                </div>
                <div className="quiet-note">
                  <CircleHelp size={16} />
                  <p>
                    {t(
                      "Risk levels are prototype review priorities. “Low” means no recorded trigger, not proof of a healthy batch.",
                    )}
                  </p>
                </div>
              </>
            )}
            {view === "deep" && (
              <DeepLab
                back={() => navigate("home")}
                onUse={(photo) => {
                  setDraftLeaf(null);
                  setDraftCapture(photo);
                  setBatchId("");
                  navigate("capture");
                }}
              />
            )}
            {view === "leaf" && (
              <LeafLab
                back={() => navigate("home")}
                onUse={(leaf) => {
                  setDraftLeaf(leaf);
                  setDraftCapture(null);
                  navigate("capture");
                }}
              />
            )}
            {view === "batches" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">
                      {t("FOLLOW EVERY REARING CYCLE")}
                    </div>
                    <h1>{t("Your batches")}</h1>
                    <p>
                      {t("One continuous record, from brushing to harvest.")}
                    </p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => setModal("batch")}
                  >
                    <Plus size={18} />
                    {t("Add batch")}
                  </button>
                </div>
                <BatchBrowser latest={latest} open={openBatch} />
              </>
            )}
            {view === "capture" && (
              <Capture
                initialLeaf={draftLeaf}
                initialMedia={draftCapture}
                batches={batches}
                initialBatchId={batchId}
                addBatch={() => setModal("batch")}
                back={() => navigate("home")}
                onSave={(a) => {
                  setResult(a);
                  navigate("result");
                }}
              />
            )}
            {view === "result" && result && (
              <>
                <button
                  className="back-link"
                  onClick={() => openBatch(result.batchId)}
                >
                  <ArrowLeft size={17} />
                  {t("Back to batch")}
                </button>
                <RiskResult
                  assessment={result}
                  batch={batches.find((b) => b.id === result.batchId)}
                  onOpen={() => openBatch(result.batchId)}
                  onNew={() => capture(result.batchId)}
                />
              </>
            )}
            {view === "batch" && (
              <BatchDetail
                batch={batches.find((b) => b.id === batchId)}
                assessments={assessments.filter((a) => a.batchId === batchId)}
                interventions={interventions.filter(
                  (a) => a.batchId === batchId,
                )}
                outcomes={outcomes.filter((a) => a.batchId === batchId)}
                onBack={() => navigate("batches")}
                onCapture={() => capture(batchId)}
                onAssessment={(a) => {
                  setResult(a);
                  navigate("result");
                }}
              />
            )}
            {view === "supervisor" && (
              <Supervisor
                latest={latest}
                assessments={assessments}
                interventions={interventions}
                outcomes={outcomes}
                open={openBatch}
              />
            )}
            {view === "settings" && (
              <SettingsPage
                events={events}
                token={token}
                setToken={(v) => {
                  setToken(v);
                  sessionStorage.setItem("syncToken", v);
                }}
                sync={() => void sync()}
                busy={syncBusy}
                error={syncError}
                lastSync={lastSync?.value}
                notify={setNotice}
              />
            )}
          </main>
          <footer className="footer">
            <span>
              {t("SilkSense ")}
              <span>·</span>
              {t(" Field research demo")}
            </span>
            <button onClick={() => navigate("settings")}>
              {t("Evidence & limitations")}
              <ArrowRight size={13} />
            </button>
          </footer>
        </div>
      </div>
      <nav className="mobile-nav" aria-label={t("Main navigation")}>
        {nav
          .filter(
            (n) => n.id !== "supervisor" || !user || user.role !== "field",
          )
          .map((n) => (
            <button
              key={n.id}
              className={
                view === n.id ||
                (view === "batch" && n.id === "batches") ||
                (view === "result" && n.id === "capture")
                  ? "active"
                  : ""
              }
              onClick={() => (n.id === "capture" ? capture() : navigate(n.id))}
            >
              <n.icon size={21} />
              <span>{t(n.label)}</span>
            </button>
          ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          <span>{t(notice)}</span>
          <button
            aria-label={t("Dismiss notification")}
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "batch" && (
        <Modal title={t("Start a new batch")} onClose={() => setModal(null)}>
          <BatchForm
            onSave={(b) => {
              setModal(null);
              setBatchId(b.id);
              if (view !== "capture") openBatch(b.id);
              setNotice("Batch saved on this device.");
            }}
          />
        </Modal>
      )}
    </>
  );
}
function BatchCard({
  batch,
  assessment,
  onClick,
}: {
  batch: Batch;
  assessment?: Assessment;
  onClick: () => void;
}) {
  return (
    <button className="batch-card" onClick={onClick}>
      <div className="batch-icon">
        <Sprout size={22} />
      </div>
      <div className="batch-content">
        <strong>{batch.name}</strong>
        <span>
          {batch.farm} · {batch.shed}
          {batch.tray ? ` · ${batch.tray}` : ""}
        </span>
        <small>
          {assessment
            ? t("Instar {{v0}} · {{v1}}", {
                v0: assessment.instar,
                v1: fmt(assessment.capturedAt),
              })
            : t("Ready for its first observation")}
        </small>
      </div>
      <div className="batch-end">
        {assessment ? (
          <Badge level={assessment.risk.level} />
        ) : (
          <span className="badge neutral">{t("Unassessed")}</span>
        )}
        <ChevronRight size={18} />
      </div>
    </button>
  );
}
function BatchBrowser({
  latest,
  open,
}: {
  latest: { batch: Batch; assessment?: Assessment }[];
  open: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = latest.filter(
    ({ batch, assessment }) =>
      [batch.name, batch.farm, batch.shed, batch.tray]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (filter === "all" || (assessment?.risk.level || "unassessed") === filter),
  );
  const reset = () => {
    setQuery("");
    setFilter("all");
  };
  return (
    <>
      <section className="card batch-tools" aria-label={t("Find a batch")}>
        <div className="filter-row">
          <Field label={t("Search batches")}>
            <input
              type="search"
              placeholder={t("Batch, farm, shed or tray…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label={t("Filter by risk")}>
            <select
              aria-label={t("Filter by risk")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{t("All risk levels")}</option>
              <option value="unassessed">{t("Unassessed")}</option>
              <option value="high">{t("High risk")}</option>
              <option value="medium">{t("Medium risk")}</option>
              <option value="low">{t("Low risk")}</option>
            </select>
          </Field>
        </div>
        <div className="batch-results">
          <p role="status">
            {t("Showing ")}
            <strong>{filtered.length}</strong>
            {t(" of ")}
            {latest.length} {t("batches")}
          </p>
          {(query || filter !== "all") && (
            <button className="text-button" onClick={reset}>
              <X size={15} />
              {t("Clear filters")}
            </button>
          )}
        </div>
      </section>
      <div className="batch-list">
        {filtered.map((x) => (
          <BatchCard key={x.batch.id} {...x} onClick={() => open(x.batch.id)} />
        ))}
      </div>
      {!filtered.length && (
        <div className="card">
          <Empty
            title={
              latest.length ? t("No matching batches") : t("A fresh start")
            }
            action={
              latest.length ? (
                <button className="button secondary" onClick={reset}>
                  {t("Show all batches")}
                  <ArrowRight size={16} />
                </button>
              ) : undefined
            }
          >
            {latest.length
              ? t(
                  "Try a different batch, farm, shed or tray code, or clear your filters.",
                )
              : t("Use Add batch above to begin recording observations.")}
          </Empty>
        </div>
      )}
    </>
  );
}
function BatchForm({ onSave }: { onSave: (b: Batch) => void }) {
  const { user } = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const d = new FormData(e.currentTarget);
          const b = batchSchema.parse({
            id: crypto.randomUUID(),
            name: d.get("name"),
            farm: d.get("farm"),
            shed: d.get("shed"),
            tray: d.get("tray"),
            started: d.get("started"),
            initialLarvae: d.get("initialLarvae")
              ? Number(d.get("initialLarvae"))
              : null,
            species: "Bombyx mori",
          });
          await saveEvent("batch", b);
          onSave(b);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="form-intro">
        {t(
          "Use anonymous farm and shed codes. This demo supports mulberry silkworm,",
        )}{" "}
        <em>{t("Bombyx mori")}</em>.
      </p>
      <Field label={t("Batch name")}>
        <input
          autoFocus
          name="name"
          placeholder={t("e.g. September · Batch 01")}
          required
          maxLength={80}
        />
      </Field>
      <div className="field-grid">
        <Field label={t("Farm code")}>
          {user ? (
            <select name="farm" required>
              {user.farms.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          ) : (
            <input name="farm" required maxLength={80} placeholder="F-001" />
          )}
        </Field>
        <Field label={t("Shed code")}>
          <input name="shed" placeholder={t("S-01")} required maxLength={80} />
        </Field>
      </div>
      <Field label={t("Tray code (optional)")}>
        <input name="tray" placeholder={t("T-01")} maxLength={80} />
      </Field>
      <div className="field-grid">
        <Field label={t("Brushing date")}>
          <input
            type="date"
            name="started"
            defaultValue={today()}
            max={today()}
            required
          />
        </Field>
        <Field label={t("Larvae brushed (optional)")}>
          <input
            name="initialLarvae"
            type="number"
            min="1"
            max="10000000"
            step="1"
            placeholder={t("Count")}
          />
        </Field>
      </div>
      <ErrorNote error={error} />
      <button className="button primary full" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <Plus size={18} />
        )}
        {t("Save batch")}
      </button>
    </form>
  );
}
function Capture({
  batches,
  initialBatchId,
  initialMedia,
  initialLeaf,
  addBatch,
  back,
  onSave,
}: {
  initialMedia?: TrayCapture | null;
  initialLeaf?: LeafCapture | null;
  batches: Batch[];
  initialBatchId: string;
  addBatch: () => void;
  back: () => void;
  onSave: (a: Assessment) => void;
}) {
  const [selected, setSelected] = useState(
    initialBatchId || batches[0]?.id || "",
  );
  const [leaf, setLeaf] = useState<LeafCapture | null>(initialLeaf || null);
  const [leafBusy, setLeafBusy] = useState(false);
  const [stage, setStage] = useState<Assessment["instar"]>("III");
  const [moulting, setMoulting] = useState(false);
  const [media, setMedia] = useState<
    (Awaited<ReturnType<typeof processMedia>> & { name: string }) | null
  >(initialMedia || null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [symptoms, setSymptoms] = useState<Assessment["symptoms"]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (initialBatchId) setSelected(initialBatchId);
    else if (!selected && batches.length)
      setSelected(batches[batches.length - 1].id);
  }, [initialBatchId, batches.length]);
  const p = profiles[stage];
  async function loadFile(file?: File) {
    if (!file) return;
    setError("");
    setProcessing(true);
    setMedia(null);
    try {
      setMedia({ ...(await processMedia(file)), name: file.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }
  return (
    <>
      <button className="back-link" onClick={back}>
        <ArrowLeft size={17} />
        {t("Back to today")}
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("A MOMENT OF OBSERVATION")}</div>
          <h1>{t("Check a batch")}</h1>
          <p>{t("Capture what you see. Record what you measure.")}</p>
        </div>
        <span className="subtle-tag">
          <CloudUpload size={15} />
          {t("Works offline")}
        </span>
      </div>
      <form
        className="capture-layout"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            if (!selected) throw new Error("Add or choose a batch first.");
            const d = new FormData(e.currentTarget);
            const leafMediaId = leaf ? crypto.randomUUID() : null;
            const visual: Visual = {
              ...(media?.visual || { status: "not-assessed", warnings: [] }),
              ...(leaf
                ? { leaf: { ...leaf.evidence, mediaId: leafMediaId } }
                : {}),
            };
            const input = {
              instar: stage,
              moulting,
              temperature:
                d.get("temperature") === ""
                  ? null
                  : Number(d.get("temperature")),
              humidity:
                d.get("humidity") === "" ? null : Number(d.get("humidity")),
              ventilation: d.get("ventilation") as Assessment["ventilation"],
              hygiene: d.get("hygiene") as Assessment["hygiene"],
              feed: d.get("feed") as Assessment["feed"],
              symptoms,
              visual,
            };
            const id = crypto.randomUUID(),
              mediaId = media ? crypto.randomUUID() : null;
            const a = assessmentSchema.parse({
              ...input,
              id,
              batchId: selected,
              capturedAt: new Date().toISOString(),
              notes: d.get("notes"),
              mediaId,
              mediaKind: media?.kind || null,
              risk: assessRisk(input),
            });
            if (media && mediaId)
              await db.media.add({
                id: mediaId,
                blob: media.blob,
                thumbnail: media.thumbnail,
                kind: media.kind,
                name: media.name,
              });
            try {
              if (leaf && leafMediaId)
                await db.media.add({
                  id: leafMediaId,
                  blob: leaf.blob,
                  thumbnail: leaf.thumbnail,
                  kind: "image",
                  name: "mulberry-leaf.jpg",
                });
              await saveEvent("assessment", a);
            } catch (e) {
              if (mediaId) await db.media.delete(mediaId);
              if (leafMediaId) await db.media.delete(leafMediaId);
              throw e;
            }
            onSave(a);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="capture-main">
          <section className="card form-card">
            <div className="step-title">
              <span>01</span>
              <div>
                <h2>{t("Choose your batch")}</h2>
                <p>{t("The right context comes first.")}</p>
              </div>
            </div>
            <Field label={t("Batch")}>
              <select
                required
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="" disabled>
                  {t("Select a batch")}
                </option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.shed}
                  </option>
                ))}
              </select>
            </Field>
            <button type="button" className="text-button" onClick={addBatch}>
              <Plus size={16} />
              {t("Add a new batch")}
            </button>
            <div className="field-grid stage-fields">
              <Field label={t("Current instar")}>
                <select
                  value={stage}
                  onChange={(e) =>
                    setStage(e.target.value as Assessment["instar"])
                  }
                >
                  {instars.map((i) => (
                    <option key={i} value={i}>
                      {t("Instar ")}
                      {i}
                      {["I", "II"].includes(i) ? t(" · Chawki") : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="check-panel">
                <input
                  type="checkbox"
                  checked={moulting}
                  onChange={(e) => setMoulting(e.target.checked)}
                />
                <span>
                  {t("Currently moulting")}
                  <small>{t("Normal feeding pauses are expected.")}</small>
                </span>
              </label>
            </div>
          </section>
          <section className="card form-card">
            <div className="step-title">
              <span>02</span>
              <div>
                <h2>{t("A closer look")}</h2>
                <p>{t("Add a photo or a video up to 30 seconds.")}</p>
              </div>
            </div>
            <input
              ref={fileRef}
              className="visually-hidden"
              aria-label={t("Choose tray photo or video")}
              type="file"
              accept="image/*,video/*"
              onChange={(e) => void loadFile(e.target.files?.[0])}
            />
            {media ? (
              <div className="media-preview">
                <img src={media.thumbnail} alt={t("Captured tray preview")} />
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setMedia(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <X size={16} />
                  {t("Remove")}
                </button>
                <span>
                  {media.kind === "video"
                    ? t("Video · {{v0}} frames checked", {
                        v0: media.visual.frames,
                      })
                    : t("Photo · metadata stripped")}
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="capture-zone"
                onClick={() => fileRef.current?.click()}
                disabled={processing}
              >
                <span className="camera-circle">
                  {processing ? <LoaderCircle className="spin" /> : <Camera />}
                </span>
                <strong>
                  {processing
                    ? t("Checking your capture…")
                    : t("Add a tray photo or video")}
                </strong>
                <span>{t("Even light · steady hands · clear larvae")}</span>
                <small>{t("Up to 30 MB · media stays on this device")}</small>
              </button>
            )}
            {media?.visual.warnings.map((w) => (
              <div className="warning-note" key={w}>
                <Eye size={16} />
                {t(w)}
              </div>
            ))}
            <div className="inline-note">
              <CircleHelp size={15} />
              <span>
                {media
                  ? media.visual.larval
                    ? t("Capture checked. Model execution: {{v0}}.", {
                        v0:
                          media.visual.larval.execution === "backend"
                            ? "backend server"
                            : "this device",
                      })
                    : t(
                        "Capture quality checked; no usable model result was obtained.",
                      )
                  : t(
                      "No camera available? You can still save a checklist assessment.",
                    )}
              </span>
            </div>
          </section>
          <section className="card form-card">
            <div className="step-title">
              <span>03</span>
              <div>
                <h2>{t("Inside the shed")}</h2>
                <p>{t("Use measured readings where available.")}</p>
              </div>
            </div>
            <div className="field-grid">
              <Field
                label={t("Temperature (°C)")}
                hint={t("Reference: {{v0}}–{{v1}} °C", {
                  v0: p.temperature[0],
                  v1: p.temperature[1],
                })}
              >
                <div className="input-icon">
                  <Thermometer size={18} />
                  <input
                    name="temperature"
                    type="number"
                    step="0.1"
                    min="0"
                    max="60"
                    placeholder={t("Not measured")}
                  />
                </div>
              </Field>
              <Field
                label={t("Relative humidity (%)")}
                hint={t("Reference: {{v0}}%", {
                  v0:
                    p.humidity[0] === p.humidity[1]
                      ? p.humidity[0]
                      : p.humidity.join("–"),
                })}
              >
                <div className="input-icon">
                  <Droplets size={18} />
                  <input
                    name="humidity"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder={t("Not measured")}
                  />
                </div>
              </Field>
            </div>
            <div className="reference-note">
              {t(
                "CSR&TI Berhampore reference for Eastern & Northeastern India. Local guidance may differ.",
              )}{" "}
              <a href={SOP_URL} target="_blank" rel="noreferrer">
                {t("View source ↗")}
              </a>
            </div>
            <Field label={t("Air and ventilation")}>
              <select name="ventilation" defaultValue="unknown">
                <option value="unknown">{t("Not checked")}</option>
                <option value="adequate">
                  {t("Air circulating · no stuffiness")}
                </option>
                <option value="stuffy">
                  {t("Stuffy · limited air circulation")}
                </option>
              </select>
            </Field>
            <Field label={t("Rearing bed hygiene")}>
              <select name="hygiene" defaultValue="unknown">
                <option value="unknown">{t("Not checked")}</option>
                <option value="clean">{t("Clean bed · no damp litter")}</option>
                <option value="litter">{t("Wet litter or unclean bed")}</option>
              </select>
            </Field>
            <Field
              label={t("Mulberry feed")}
              hint={t(
                "Self-reported; freshness is not independently verified. The care guide also checks a suspect-feed scenario.",
              )}
            >
              <select name="feed" defaultValue="unknown">
                <option value="unknown">{t("Not checked")}</option>
                <option value="fresh">
                  {t("Reported fresh, clean leaves")}
                </option>
                <option value="poor">
                  {t("Wilted, wet or suspect leaves")}
                </option>
              </select>
            </Field>
          </section>
          <LeafPhotoInput
            value={leaf}
            onChange={setLeaf}
            onBusy={setLeafBusy}
          />
          <section className="card form-card">
            <div className="step-title">
              <span>04</span>
              <div>
                <h2>{t("Anything unusual?")}</h2>
                <p>{t("These are your observations, not diagnoses.")}</p>
              </div>
            </div>
            <div className="observation-grid">
              {(
                [
                  ["mortality", "Unusual deaths"],
                  ["discoloration", "Unusual appearance"],
                  ["reduced-feeding", "Reduced feeding"],
                  ["uneven-growth", "Uneven growth"],
                ] as const
              ).map(([value, label]) => (
                <label
                  className={`observation ${symptoms.includes(value) ? "selected" : ""}`}
                  key={value}
                >
                  <input
                    type="checkbox"
                    checked={symptoms.includes(value)}
                    onChange={(e) =>
                      setSymptoms(
                        e.target.checked
                          ? [...symptoms, value]
                          : symptoms.filter((s) => s !== value),
                      )
                    }
                  />
                  {t(label)}
                </label>
              ))}
            </div>
            {moulting && (
              <p className="inline-note">
                {t(
                  "Reduced feeding alone will not raise the score during moulting.",
                )}
              </p>
            )}
            <Field label={t("Field notes (optional)")}>
              <textarea
                name="notes"
                rows={3}
                maxLength={2000}
                placeholder={t(
                  "What changed since the last visit? Avoid personal details.",
                )}
              />
            </Field>
          </section>
        </div>
        <aside className="capture-summary">
          <div className="card">
            <div className="summary-icon">
              <ShieldCheck />
            </div>
            <h3>{t("A guide to your next step")}</h3>
            <p>
              {t(
                "Your observations and available larval image evidence are combined using a transparent review policy.",
              )}
            </p>
            <ul className="check-list">
              <li>
                <Check size={16} />
                {t("Traceable contributing factors")}
              </li>
              <li>
                <Check size={16} />
                {t("Preventive care suggestions")}
              </li>
              <li>
                <Check size={16} />
                {t("An ongoing batch history")}
              </li>
            </ul>
            <div className="summary-caution">
              {t(
                "This prototype does not diagnose disease or predict the chance of mortality.",
              )}
            </div>
            <ErrorNote error={error} />
            <button
              className="button primary full"
              disabled={busy || processing || leafBusy || !batches.length}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Activity size={18} />
              )}
              {t("Save & assess")}
              <ArrowRight size={17} />
            </button>
            <small>{t("Works without an internet connection")}</small>
          </div>
        </aside>
      </form>
    </>
  );
}
function RiskResult({
  assessment: a,
  batch,
  onOpen,
  onNew,
}: {
  assessment: Assessment;
  batch?: Batch;
  onOpen: () => void;
  onNew: () => void;
}) {
  const media = useLiveQuery(
    () => (a.mediaId ? db.media.get(a.mediaId) : undefined),
    [a.mediaId],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("OBSERVATION SAVED")}</div>
          <h1>{t("Your batch check")}</h1>
          <p>
            {batch?.name || t("Batch")}
            {t(" · Instar ")}
            {a.instar} · {fmt(a.capturedAt)}
          </p>
        </div>
        <Badge level={a.risk.level} />
      </div>
      <div className="result-layout">
        <section>
          <div className={`risk-card ${a.risk.level}`}>
            <div>
              <span className="eyebrow">
                {t("PROTOTYPE HEALTH RISK SCORE")}
              </span>
              <h2>
                {a.risk.level === "high"
                  ? t("Arrange a prompt field review")
                  : a.risk.level === "medium"
                    ? t("A few things need attention")
                    : t("Keep observing your batch")}
              </h2>
              <p>
                {a.risk.level === "low"
                  ? t(
                      "No trigger was recorded in the available checklist. This does not establish that the batch is healthy.",
                    )
                  : t(
                      "Use the contributing observations below to prioritize a field review and preventive care.",
                    )}
              </p>
            </div>
            <div className="score">
              <strong>{a.risk.score}</strong>
              <span>{t("/ 100 priority points")}</span>
            </div>
          </div>
          {a.risk.level === "low" &&
            (a.temperature === null ||
              a.humidity === null ||
              a.feed === "unknown" ||
              a.ventilation === "unknown" ||
              a.hygiene === "unknown") && (
              <p className="warning-note" role="status">
                {t(
                  "Assessment incomplete: low recorded points do not mean low risk. Fill in the missing checks.",
                )}
              </p>
            )}
          <div className="warning-note">
            <CircleHelp size={18} />
            <span>
              {t(
                "Unvalidated review priority, not disease probability. No validated confidence level is available.",
              )}
            </span>
          </div>
          {a.visual.leaf && <LeafResult evidence={a.visual.leaf} />}
          <div className="card form-card">
            <h2>{t("What contributed")}</h2>
            {!a.risk.factors.length ? (
              <p className="muted">
                {t(
                  "No risk trigger was recorded. Review missing information before drawing conclusions.",
                )}
              </p>
            ) : (
              a.risk.factors.map((f) => (
                <div className="factor" key={f.key}>
                  <div className="factor-head">
                    <span>{t(f.label)}</span>
                    <strong>+{f.points}</strong>
                  </div>
                  <div className="factor-track">
                    <span style={{ width: `${f.points}%` }} />
                  </div>
                  <p>{t(f.action)}</p>
                  <small>
                    {f.source.startsWith("http") ? (
                      <a href={f.source} target="_blank" rel="noreferrer">
                        {t("SOP reference ↗")}
                      </a>
                    ) : (
                      t(f.source)
                    )}
                  </small>
                </div>
              ))
            )}
          </div>
          <CareExplainer key={a.id} input={a} />
          <div className="card form-card">
            <h2>{t("Assessment coverage")}</h2>
            <p className="muted">
              {a.risk.missing.length
                ? t("These gaps limit interpretation:")
                : t(
                    "All checklist fields were provided. Field validation is still required.",
                  )}
            </p>
            <div className="gap-list">
              {a.risk.missing.map((m) => (
                <span key={m}>
                  <CircleHelp size={14} />
                  {t(m)}
                </span>
              ))}
            </div>
            <p className="reference-note">
              {t(a.risk.profile)}
              <br />
              {t("Rules: ")}
              {a.risk.version}
              {t(
                ". Thresholds: low &lt;20, medium 20–49, high ≥50. Weights and cutoffs are engineering assumptions.",
              )}
            </p>
          </div>
        </section>
        <aside>
          <div className="card form-card">
            <h3>{t("Capture & visual cues")}</h3>
            {media ? (
              <>
                <img
                  className="result-image"
                  src={media.thumbnail}
                  alt={t("Assessment tray capture")}
                />
                <p className="muted">
                  {a.visual.larval
                    ? t(
                        "A trained larval appearance model ran {{v0}}. See its evidence below.",
                        {
                          v0: t(
                            a.visual.larval.execution === "backend"
                              ? "on the backend"
                              : "on this device",
                          ),
                        },
                      )
                    : t(
                        "Capture quality only. No model result is available for this record.",
                      )}
                </p>
                {a.visual.warnings.map((w) => (
                  <p key={w} className="warning-note">
                    {t(w)}
                  </p>
                ))}
              </>
            ) : (
              <p className="muted">
                {a.mediaId
                  ? t(
                      "Media is stored on the capture device and was not synchronized.",
                    )
                  : t(
                      "No media attached. This is a checklist-only assessment.",
                    )}
              </p>
            )}
            {a.visual.frameDifference !== undefined && (
              <p className="muted">
                {a.visual.frames}
                {t(" frames sampled. Mean frame change:")}{" "}
                {a.visual.frameDifference.toFixed(1)}
                {t(
                  " / 255 luminance units. Camera motion and lighting affect this measurement; it is not larval activity or a health score.",
                )}
              </p>
            )}
            <p className="muted">
              {t("Reported observations:")}{" "}
              {a.symptoms.length
                ? a.symptoms.map((x) => t(x)).join(", ")
                : t("none selected")}
              .
            </p>
            {a.notes && <blockquote>{a.notes}</blockquote>}
          </div>
          {a.visual.larval && (
            <LarvalEvidence
              visual={a.visual.larval}
              thumbnail={media?.thumbnail}
            />
          )}
          <button className="button primary full" onClick={onOpen}>
            <ClipboardList size={18} />
            {t("Open batch & record action")}
          </button>
          <button className="button secondary full spaced" onClick={onNew}>
            <Plus size={17} />
            {t("New observation")}
          </button>
        </aside>
      </div>
    </>
  );
}
function BatchDetail({
  batch,
  assessments,
  interventions,
  outcomes,
  onBack,
  onCapture,
  onAssessment,
}: {
  batch?: Batch;
  assessments: Assessment[];
  interventions: Intervention[];
  outcomes: Outcome[];
  onBack: () => void;
  onCapture: () => void;
  onAssessment: (a: Assessment) => void;
}) {
  const [tab, setTab] = useState("observations");
  const [modal, setModal] = useState<"action" | "outcome" | null>(null);
  if (!batch)
    return (
      <Empty title={t("Batch not found")}>
        {t("Return to the batch list and select an existing record.")}
      </Empty>
    );
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={17} />
        {t("All batches")}
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {batch.farm} / {batch.shed}
            {batch.tray ? ` / ${batch.tray}` : ""}
          </div>
          <h1>{batch.name}</h1>
          <p>
            {t("Brushed ")}
            {batch.started} ·{" "}
            {batch.initialLarvae?.toLocaleString() || t("Unrecorded")}
            {t(" larvae · Bombyx mori")}
          </p>
        </div>
        <button className="button primary" onClick={onCapture}>
          <Camera size={18} />
          {t("New assessment")}
        </button>
      </div>
      <div className="batch-summary">
        <span>
          <Activity size={18} />
          {assessments.length}
          {t(" observations")}
        </span>
        <span>
          <CheckCircle2 size={18} />
          {interventions.length}
          {t(" interventions")}
        </span>
        {assessments[0] && <Badge level={assessments[0].risk.level} />}
      </div>
      <div className="tabs" role="tablist" aria-label={t("Batch records")}>
        {[
          ["observations", "Observations"],
          ["actions", "Care log"],
          ["outcomes", "Outcomes"],
          ["reviews", "Reviews"],
          ["followups", "Follow-ups"],
          ["health", "Observed health"],
        ].map(([id, label]) => (
          <button
            key={id}
            id={`batch-tab-${id}`}
            role="tab"
            aria-controls="batch-record-panel"
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
              if (!keys.includes(e.key)) return;
              e.preventDefault();
              const buttons = Array.from(
                e.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                ),
              );
              const index = buttons.indexOf(e.currentTarget);
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (e.key === "ArrowRight" ? 1 : -1) +
                        buttons.length) %
                      buttons.length;
              buttons[next].click();
              buttons[next].focus();
            }}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div
        id="batch-record-panel"
        role="tabpanel"
        aria-labelledby={`batch-tab-${tab}`}
        tabIndex={0}
      >
        {tab === "observations" && (
          <section>
            {assessments.length ? (
              <div className="timeline">
                {assessments.map((a) => (
                  <button
                    className="timeline-item"
                    key={a.id}
                    onClick={() => onAssessment(a)}
                  >
                    <div className="timeline-dot" />
                    <div>
                      <span className="eyebrow">{fmt(a.capturedAt)}</span>
                      <h3>
                        {t("Instar ")}
                        {a.instar}
                        {a.moulting ? t(" · Moulting") : ""}
                      </h3>
                      <p>
                        {a.temperature === null
                          ? t("Temperature missing")
                          : t("{{v0}}°C", { v0: a.temperature })}{" "}
                        ·{" "}
                        {a.humidity === null
                          ? t("Humidity missing")
                          : t("{{v0}}% RH", { v0: a.humidity })}{" "}
                        · {a.risk.factors.length}
                        {t(" contributing factors")}
                      </p>
                      <Badge level={a.risk.level} />
                    </div>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="card">
                <Empty
                  title={t("The story starts here")}
                  action={
                    <button className="button secondary" onClick={onCapture}>
                      {t("Make the first observation")}
                      <ArrowRight size={16} />
                    </button>
                  }
                >
                  {t(
                    "Check the tray and shed conditions to start a traceable history.",
                  )}
                </Empty>
              </div>
            )}
          </section>
        )}
        {tab === "followups" && <Followups assessments={assessments} />}
        {tab === "health" && (
          <HealthHistory batchId={batch.id} assessments={assessments} />
        )}
        {tab === "reviews" && (
          <ReviewHistory batchId={batch.id} assessments={assessments} />
        )}
        {tab === "actions" && (
          <section>
            <div className="section-heading">
              <h2>{t("Intervention history")}</h2>
              <button
                className="button secondary"
                onClick={() => setModal("action")}
              >
                <Plus size={17} />
                {t("Record action")}
              </button>
            </div>
            {interventions.length ? (
              interventions
                .slice()
                .reverse()
                .map((i) => (
                  <div className="card log-card" key={i.id}>
                    <div className="log-icon">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <span className="eyebrow">
                        {t(i.status)} · {fmt(i.recordedAt)}
                      </span>
                      <h3>{i.action}</h3>
                      {i.notes && <p>{i.notes}</p>}
                      <small>
                        {i.assessmentId
                          ? t("Linked to latest observation")
                          : t("Batch-level action")}
                      </small>
                    </div>
                  </div>
                ))
            ) : (
              <div className="card">
                <Empty icon={<CheckCircle2 />} title={t("Make care traceable")}>
                  {t(
                    "Record preventive actions, officer visits and what changed afterwards.",
                  )}
                </Empty>
              </div>
            )}
          </section>
        )}
        {tab === "outcomes" && (
          <section>
            <div className="section-heading">
              <h2>{t("Harvest & outcomes")}</h2>
              <button
                className="button secondary"
                onClick={() => setModal("outcome")}
              >
                <Plus size={17} />
                {t("Record outcome")}
              </button>
            </div>
            {outcomes.length ? (
              outcomes
                .slice()
                .reverse()
                .map((o) => {
                  const m = outcomeMetrics(o);
                  return (
                    <div className="card form-card" key={o.id}>
                      <div className="eyebrow">
                        {fmt(o.recordedAt)}
                        {t(" · REPORTED OUTCOME")}
                      </div>
                      <div className="outcome-grid">
                        <div>
                          <strong>
                            {m.err === null ? "—" : m.err.toFixed(1) + "%"}
                          </strong>
                          <span>{t("ERR by count")}</span>
                        </div>
                        <div>
                          <strong>
                            {o.cocoonKg === null ? "—" : o.cocoonKg + " kg"}
                          </strong>
                          <span>{t("Cocoon yield")}</span>
                        </div>
                        <div>
                          <strong>
                            {m.shellRatio === null
                              ? "—"
                              : m.shellRatio.toFixed(1) + "%"}
                          </strong>
                          <span>{t("Shell ratio")}</span>
                        </div>
                      </div>
                      <p className="muted">
                        {t("Harvest: ")}
                        {o.harvestDate || t("date unrecorded")}
                        {t(" · Count scope: ")}
                        {o.countScope ? t(o.countScope) : t("unrecorded")}
                        {t(" · Weight sample:")}{" "}
                        {o.sampleSize ?? t("unrecorded")}
                        {t(" cocoons")}
                        <br />
                        {o.cocoonsHarvested ?? "—"}
                        {t(" cocoons /")} {o.larvaeBrushed ?? "—"}
                        {t(" larvae brushed ·")} {o.mortality ?? "—"}
                        {t(" reported deaths")}
                      </p>
                      {o.notes && <p>{o.notes}</p>}
                    </div>
                  );
                })
            ) : (
              <div className="card">
                <Empty icon={<Sprout />} title={t("Close the learning loop")}>
                  {t(
                    "Record observed outcomes to compare them with earlier risk flags. Missing values remain unknown.",
                  )}
                </Empty>
              </div>
            )}
          </section>
        )}
      </div>
      {modal && (
        <Modal
          title={
            modal === "action"
              ? t("Record an intervention")
              : t("Record batch outcome")
          }
          onClose={() => setModal(null)}
        >
          {modal === "action" ? (
            <InterventionForm
              batchId={batch.id}
              assessment={assessments[0]}
              done={() => setModal(null)}
            />
          ) : (
            <OutcomeForm batch={batch} done={() => setModal(null)} />
          )}
        </Modal>
      )}
    </>
  );
}
function InterventionForm({
  batchId,
  assessment,
  done,
}: {
  batchId: string;
  assessment?: Assessment;
  done: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const d = new FormData(e.currentTarget);
          await saveEvent("intervention", {
            id: crypto.randomUUID(),
            batchId,
            assessmentId: assessment?.id || null,
            action: String(d.get("action")),
            status: d.get("status") as Intervention["status"],
            notes: String(d.get("notes")),
            recordedAt: new Date().toISOString(),
          });
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={t("Action taken or planned")}>
        <textarea
          required
          name="action"
          maxLength={500}
          rows={3}
          placeholder={t(
            "e.g. Rechecked tray temperature and arranged a field visit",
          )}
        />
      </Field>
      <Field label={t("Status")}>
        <select name="status">
          <option value="completed">{t("Completed")}</option>
          <option value="planned">{t("Planned")}</option>
        </select>
      </Field>
      <Field label={t("Notes (optional)")}>
        <textarea
          name="notes"
          maxLength={2000}
          rows={3}
          placeholder={t("Record changes or follow-up needed.")}
        />
      </Field>
      <ErrorNote error={error} />
      <button className="button primary full" disabled={busy}>
        {t("Save action")}
        <Check size={17} />
      </button>
    </form>
  );
}
function OutcomeForm({ batch, done }: { batch: Batch; done: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          const d = new FormData(e.currentTarget);
          const number = (key: string) =>
            d.get(key) === "" ? null : Number(d.get(key));
          const o = outcomeSchema.parse({
            id: crypto.randomUUID(),
            batchId: batch.id,
            recordedAt: new Date().toISOString(),
            harvestDate: d.get("harvestDate") || null,
            countScope: d.get("countScope"),
            sampleSize: number("sampleSize"),
            larvaeBrushed: number("larvaeBrushed"),
            cocoonsHarvested: number("cocoonsHarvested"),
            mortality: number("mortality"),
            cocoonKg: number("cocoonKg"),
            sampleCocoonG: number("sampleCocoonG"),
            sampleShellG: number("sampleShellG"),
            notes: d.get("notes"),
          });
          await saveEvent("outcome", o);
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="form-intro">
        {t(
          "State the count scope. Whole-cycle counts are needed for comparable ERR. Leave unmeasured fields blank. Shell and cocoon weights must refer to the same sample.",
        )}
      </p>
      <div className="field-grid">
        <Field label={t("Harvest date (if known)")}>
          <input
            type="date"
            name="harvestDate"
            min={batch.started}
            max={today()}
          />
        </Field>
        <Field label={t("Count scope")}>
          <select name="countScope" defaultValue="unknown">
            <option value="unknown">{t("Unknown / not confirmed")}</option>
            <option value="whole-cycle">{t("Whole rearing cycle")}</option>
            <option value="partial">{t("Partial cohort or period")}</option>
          </select>
        </Field>
        <Field label={t("Cocoons in weight sample")}>
          <input type="number" name="sampleSize" min="1" max="10000" step="1" />
        </Field>
        <Field label={t("Larvae brushed")}>
          <input
            type="number"
            name="larvaeBrushed"
            min="1"
            max="10000000"
            step="1"
            defaultValue={batch.initialLarvae || ""}
          />
        </Field>
        <Field label={t("Cocoons harvested")}>
          <input
            type="number"
            name="cocoonsHarvested"
            min="0"
            max="10000000"
            step="1"
          />
        </Field>
        <Field label={t("Total deaths recorded")}>
          <input
            type="number"
            name="mortality"
            min="0"
            max="10000000"
            step="1"
          />
        </Field>
        <Field label={t("Total cocoon yield (kg)")}>
          <input
            type="number"
            name="cocoonKg"
            min="0"
            max="100000"
            step="0.001"
          />
        </Field>
        <Field label={t("Sample cocoon weight (g)")}>
          <input
            type="number"
            name="sampleCocoonG"
            min="0.001"
            max="100"
            step="0.001"
          />
        </Field>
        <Field label={t("Same sample shell (g)")}>
          <input
            type="number"
            name="sampleShellG"
            min="0"
            max="100"
            step="0.001"
          />
        </Field>
      </div>
      <Field label={t("Outcome notes")}>
        <textarea
          name="notes"
          maxLength={2000}
          rows={2}
          placeholder={t("Sampling method, transfers or count limitations")}
        />
      </Field>
      <p className="reference-note">
        {t(
          "ERR = harvested cocoons ÷ larvae brushed × 100; displayed only for confirmed whole-cycle counts.",
        )}
        <br />
        {t(
          "Shell ratio = sample shell weight ÷ corresponding cocoon weight × 100.",
        )}
      </p>
      <ErrorNote error={error} />
      <button className="button primary full" disabled={busy}>
        {t("Save outcome")}
        <Check size={17} />
      </button>
    </form>
  );
}
function Supervisor({
  latest,
  assessments,
  interventions,
  outcomes,
  open,
}: {
  latest: { batch: Batch; assessment?: Assessment }[];
  assessments: Assessment[];
  interventions: Intervention[];
  outcomes: Outcome[];
  open: (id: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [farm, setFarm] = useState("all");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const invalidRange = Boolean(from && through && from > through);
  const farms = [...new Set(latest.map((x) => x.batch.farm))].sort();
  const visible = latest.filter(
    (x) =>
      (farm === "all" || x.batch.farm === farm) &&
      (filter === "all" ||
        (x.assessment?.risk.level || "unassessed") === filter) &&
      latestAssessmentInRange(x.assessment?.capturedAt, from, through),
  );
  const ids = new Set(visible.map((x) => x.batch.id));
  const scopedAssessments = assessments.filter((a) => ids.has(a.batchId));
  const scopedInterventions = interventions.filter((i) => ids.has(i.batchId));
  const scopedOutcomes = outcomes.filter((o) => ids.has(o.batchId));
  const ordered = [...visible].sort(
    (a, b) =>
      (b.assessment?.risk.score ?? -1) - (a.assessment?.risk.score ?? -1),
  );
  const levels = ["high", "medium", "low"] as const;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("SUPERVISOR OVERVIEW")}</div>
          <h1>{t("See where care is needed.")}</h1>
          <p>
            {t("Prioritize visits and follow each batch through its cycle.")}
          </p>
        </div>
        <span className="subtle-tag">
          <Users size={16} />
          {t("Shared records after sync")}
        </span>
      </div>
      <div className="card form-card">
        <div className="field-grid">
          <Field label={t("Filter by farm")}>
            <select value={farm} onChange={(e) => setFarm(e.target.value)}>
              <option value="all">{t("All farms")}</option>
              {farms.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Filter by latest risk")}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">{t("All risk levels")}</option>
              <option value="high">{t("High risk")}</option>
              <option value="medium">{t("Medium risk")}</option>
              <option value="low">{t("Low risk")}</option>
              <option value="unassessed">{t("Unassessed")}</option>
            </select>
          </Field>
          <Field
            label={t("Latest assessment from")}
            hint={t("UTC calendar date, inclusive.")}
          >
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field
            label={t("Latest assessment through")}
            hint={t("UTC calendar date, inclusive.")}
          >
            <input
              type="date"
              value={through}
              onChange={(e) => setThrough(e.target.value)}
            />
          </Field>
        </div>
        {invalidRange && (
          <p role="alert">
            {t("The end date must be on or after the start date.")}
          </p>
        )}
        <p className="muted">
          {t(
            "Dates select batches by their latest assessment. Selected batches retain their full histories; unassessed batches appear when dates are cleared.",
          )}
        </p>
        <button
          className="text-button"
          onClick={() => {
            setFarm("all");
            setFilter("all");
            setFrom("");
            setThrough("");
          }}
        >
          {t("Clear supervisor filters")}
        </button>
        <p className="muted" role="status">
          {t("Showing ")}
          {visible.length}
          {t(" of ")}
          {latest.length}
          {t(" batches. All sections below follow these filters.")}
        </p>
      </div>
      <Followups
        assessments={scopedAssessments}
        batches={visible.map((x) => x.batch)}
      />
      <div className="super-stats">
        {levels.map((level) => (
          <div className={`card super-stat ${level}`} key={level}>
            <Badge level={level} />
            <strong>
              {visible.filter((x) => x.assessment?.risk.level === level).length}
            </strong>
            <span>{t("batches · latest assessment")}</span>
          </div>
        ))}
      </div>
      <div className="home-columns">
        <section>
          <div className="section-heading">
            <h2>{t("Visit priorities")}</h2>
            <Flag size={18} />
          </div>
          <div className="batch-list">
            {ordered.length ? (
              ordered.map((x) => (
                <BatchCard
                  key={x.batch.id}
                  {...x}
                  onClick={() => open(x.batch.id)}
                />
              ))
            ) : (
              <div className="card">
                <Empty icon={<Users />} title={t("No matching batches")}>
                  {t(
                    "Clear the filters or choose another farm, risk level or date range.",
                  )}
                </Empty>
              </div>
            )}
          </div>
        </section>
        <section>
          <div className="section-heading">
            <h2>{t("Observation trend")}</h2>
            <TrendingUp size={18} />
          </div>
          <div className="card form-card">
            {scopedAssessments.length ? (
              <>
                <div
                  className="trend-chart"
                  role="img"
                  aria-label={t(
                    "Last {{v0}} assessment priority scores, oldest to newest: {{v1}}",
                    {
                      v0: Math.min(10, scopedAssessments.length),
                      v1: scopedAssessments
                        .slice(0, 10)
                        .reverse()
                        .map((a) => a.risk.score)
                        .join(", "),
                    },
                  )}
                >
                  {scopedAssessments
                    .slice(0, 10)
                    .reverse()
                    .map((a) => (
                      <div key={a.id}>
                        <span>{a.risk.score}</span>
                        <i
                          className={a.risk.level}
                          style={{ height: `${Math.max(4, a.risk.score)}px` }}
                        />
                        <small>{new Date(a.capturedAt).getDate()}</small>
                      </div>
                    ))}
                </div>
                <p className="chart-caption">
                  {t(
                    "Last 10 observations across matching batches · priority points",
                  )}
                </p>
              </>
            ) : (
              <Empty icon={<TrendingUp />} title={t("Patterns take time")}>
                {t("Record repeat observations to build a history.")}
              </Empty>
            )}
            <div className="care-divider" />
            <div className="summary-row">
              <span>{t("Interventions recorded")}</span>
              <strong>{scopedInterventions.length}</strong>
            </div>
            <div className="summary-row">
              <span>{t("Batches with outcomes")}</span>
              <strong>
                {new Set(scopedOutcomes.map((o) => o.batchId)).size}
              </strong>
            </div>
          </div>
        </section>
      </div>
      <section className="spaced">
        <div className="section-heading">
          <h2>{t("Risk & actual outcomes")}</h2>
        </div>
        <div className="card table-card">
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label={t("Risk and outcome comparison")}
          >
            <table>
              <thead>
                <tr>
                  <th>{t("Batch")}</th>
                  <th>{t("Risk before outcome entry")}</th>
                  <th>{t("ERR")}</th>
                  <th>{t("Cocoon yield")}</th>
                  <th>{t("Shell ratio")}</th>
                  <th>{t("Care actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ batch }) => {
                  const {
                    outcome: o,
                    assessment,
                    hoursBeforeEntry,
                  } = outcomeComparison(batch.id, assessments, outcomes);
                  const metrics = o ? outcomeMetrics(o) : null;
                  return (
                    <tr key={batch.id}>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => open(batch.id)}
                        >
                          {batch.name}
                        </button>
                      </td>
                      <td>
                        {assessment ? (
                          <>
                            <Badge level={assessment.risk.level} />
                            <small className="muted">
                              {" "}
                              {hoursBeforeEntry!.toFixed(1)}
                              {t(" h before entry")}
                            </small>
                          </>
                        ) : o ? (
                          t("No earlier assessment")
                        ) : (
                          t("No outcome recorded")
                        )}
                      </td>
                      <td>
                        {metrics?.err != null
                          ? metrics.err.toFixed(1) + "%"
                          : "—"}
                      </td>
                      <td>{o?.cocoonKg != null ? o.cocoonKg + " kg" : "—"}</td>
                      <td>
                        {metrics?.shellRatio != null
                          ? metrics.shellRatio.toFixed(1) + "%"
                          : "—"}
                      </td>
                      <td>
                        {
                          interventions.filter((i) => i.batchId === batch.id)
                            .length
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!visible.length && (
            <p className="table-empty">
              {t("No batch records yet. Unmeasured values will remain blank.")}
            </p>
          )}
          <p className="table-foot">
            {t(
              "Uses the last assessment captured before outcome entry. Entry time may differ from harvest or mortality onset; the interval is not early-warning lead time. Descriptive comparison only, with no validated yield or mortality prediction.",
            )}
          </p>
        </div>
      </section>
    </>
  );
}
function SettingsPage({
  events,
  token,
  setToken,
  sync,
  busy,
  error,
  lastSync,
  notify,
}: {
  events: LocalEvent[];
  token: string;
  setToken: (s: string) => void;
  sync: () => void;
  busy: boolean;
  error: string;
  lastSync?: string;
  notify: (s: string) => void;
}) {
  const { user, enabled } = useAccount();
  const [localError, setLocalError] = useState("");
  const [persist, setPersist] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t("TRANSPARENCY BUILT IN")}</div>
          <h1>{t("Settings & evidence")}</h1>
          <p>
            {t("Your data, the guidance behind it, and what is still unknown.")}
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <LarvalModelEvidence />
        <section className="card form-card">
          <h2>{t("Device & synchronization")}</h2>
          <p className="muted">
            {t(
              "Records are saved in this browser. Photos and videos remain on the capture device; structured records synchronize with the local demo server.",
            )}
          </p>
          <div className="summary-row">
            <span>{t("Records on device")}</span>
            <strong>{events.length}</strong>
          </div>
          <div className="summary-row">
            <span>{t("Waiting to sync")}</span>
            <strong>{events.filter((e) => !e.synced).length}</strong>
          </div>
          <p className="muted">
            {t("Last sync: ")}
            {lastSync ? fmt(lastSync) : t("Not yet synchronized")}
          </p>
          {!enabled && (
            <>
              {" "}
              <Field
                label={t("Sync token (if server requires one)")}
                hint={t("Kept for this browser session only.")}
              >
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </>
          )}
          {user && (
            <p className="reference-note">
              {t("Assigned farms")}: {user.farms.join(", ")}
            </p>
          )}
          <ErrorNote error={error} />
          <button className="button primary" onClick={sync} disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <CloudUpload size={17} />
            )}
            {t("Sync now")}
          </button>
          <div className="care-divider" />
          <h3>{t("Keep a copy")}</h3>
          <p className="muted">
            {t(
              "Export includes structured records, not media. Browser storage may be cleared by the device or user.",
            )}
          </p>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  const blob = await exportRecords();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `silksense-records-${today()}.json`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {
                  setLocalError((e as Error).message);
                }
              }}
            >
              <ArrowDownToLine size={17} />
              {t("Export")}
            </button>
            <label className="button secondary file-button">
              <FileUp size={17} />
              {t("Import")}
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLocalError("");
                  try {
                    const count = await importRecords(file);
                    notify(`${count} records checked and imported.`);
                  } catch (e) {
                    setLocalError((e as Error).message);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <button
            className="text-button spaced"
            onClick={async () => {
              setPersist(
                (await navigator.storage?.persist?.())
                  ? "Persistent storage granted. Keep regular exports too."
                  : "Persistent storage was not granted. Keep regular exports.",
              );
            }}
          >
            {t("Request persistent device storage")}
            <ArrowRight size={15} />
          </button>
          {persist && (
            <p role="status" className="muted">
              {t(persist)}
            </p>
          )}
          <ErrorNote error={localError} />
        </section>
        <section className="card form-card">
          <h2>{t("What this demo can tell you")}</h2>
          <div className="evidence-item">
            <span className="evidence-dot supported" />
            <div>
              <h3>{t("Source-backed guidance")}</h3>
              <p>
                {t(
                  "Stage-specific temperature and humidity references from CSR&TI Berhampore’s technology descriptor, Eastern and Northeastern India, printed pages 55 and 58. Other regions and hybrids may use different guidance.",
                )}
              </p>
              <a href={SOP_URL} target="_blank" rel="noreferrer">
                {t("Read the original SOP reference ↗")}
              </a>
            </div>
          </div>
          <div className="evidence-item">
            <span className="evidence-dot assumption" />
            <div>
              <h3>{t("Prototype scoring")}</h3>
              <p>
                {t(
                  "Checklist weights and the 20 / 50 priority cutoffs are engineering assumptions. The score is not a disease probability and has not been validated against future losses.",
                )}
              </p>
            </div>
          </div>
          <div className="evidence-item">
            <span className="evidence-dot unknown" />
            <div>
              <h3>{t("Visual analysis limits")}</h3>
              <p>
                {t(
                  "Brightness and edge clarity are measured for capture feedback. These are not disease cues. MobileNetV3 model files are installed. The Deep-learning tray check runs on the backend; checklist capture uses the offline browser model. The separate experimental feed-leaf screen runs a trained mulberry appearance model locally and shows an occlusion influence map; it does not assess larval disease.",
                )}
              </p>
            </div>
          </div>
          <div className="evidence-item">
            <span className="evidence-dot unknown" />
            <div>
              <h3>{t("Early-warning validation is pending")}</h3>
              <p>
                {t(
                  "No departmental longitudinal dataset has been supplied. Sensitivity, lead time, calibration and impact on ERR or yield are unmeasured.",
                )}
              </p>
            </div>
          </div>
        </section>
        <section className="card form-card">
          <h2>{t("Privacy & deployment")}</h2>
          <p className="muted">
            {t(
              "Use anonymous farm, shed and batch identifiers. Images are resized and re-encoded to remove original photo metadata. Video metadata is retained. Do not capture people or identifying documents.",
            )}
          </p>
          <p className="muted">
            {t(
              "The anonymous localhost demo has no individual accounts. Account mode enforces sign-in and assigned farm access on the server. Public use requires HTTPS, a retention policy and departmental SOP approval.",
            )}
          </p>
          <p className="muted">
            {t(
              "Records are append-only. New observations and actions preserve earlier entries. Structured exports allow a portable audit trail.",
            )}
          </p>
        </section>
        <section className="care-card">
          <div className="eyebrow">{t("DESIGNED FOR THE FIELD")}</div>
          <h3>{t("Keep observing. Keep learning.")}</h3>
          <p>
            {t(
              "Repeated observations linked with real outcomes are the foundation for a future validated early-warning model.",
            )}
          </p>
          <div className="mini-tip">
            <ShieldCheck />
            <span>
              {t("Decision support, with a human in the loop.")}
              <small>
                {t("Seek a trained officer’s review for worsening signs.")}
              </small>
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
