import { useEffect, useMemo, useState } from "react";
import type {
  AppState,
  AttachFlowResult,
  Catalog,
  CatalogPack,
  CatalogSkill,
  InstallExecutionReport,
  ManagedLibraryActivation,
  SetupStatus
} from "@openclaw-skill-center/shared";
import { ExoskeletonMascot } from "./ExoskeletonMascot.js";

type EntryMode = "connect-existing" | "install-clawhub" | "install-openclaw";
type ManagedLibrary = {
  packs: Array<{ id: string; name: string; description: string; skillCount: number; skills: string[]; active: boolean }>;
  skills: Array<{
    slug: string;
    name: string;
    description: string;
    tags: string[];
    active: boolean;
    activationSource: "inactive" | "manual" | "pack" | "both";
  }>;
  activeSkillSlugs: string[];
  activePackIds: string[];
  manualSkillSlugs: string[];
};
type RepairCard = { title: string; body: string; steps: string[]; level: "blocked" | "warning" };

const featuredPackIds = ["demo-safe", "knowledge-work", "delivery-engine", "business-ops"] as const;
const featuredSkillSlugs = ["calendar", "research-first-decider", "product-brief-writer", "doc-systematizer"] as const;
const packAudience: Record<string, string> = {
  "demo-safe": "Best for a first install and a fast confidence check.",
  "knowledge-work": "Founders, operators, researchers, and documentation-heavy teams.",
  "delivery-engine": "Product, engineering, QA, and shipping-focused teams.",
  "business-ops": "Support, operations, and cross-functional execution roles."
};
const packOutcome: Record<string, string> = {
  "demo-safe": "Proves the shortest install to attach path with the smallest moving surface.",
  "knowledge-work": "Turns notes, transcripts, and research into structured outputs.",
  "delivery-engine": "Supports triage, release readiness, and shipping discipline.",
  "business-ops": "Improves support replies, runbooks, and coordination clarity."
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }
  return body as T;
}

function entryTitle(mode: EntryMode) {
  if (mode === "connect-existing") return "I already have OpenClaw / ClawX";
  if (mode === "install-clawhub") return "I have OpenClaw, but I still need clawhub";
  return "I still need OpenClaw / ClawX";
}

function entryDescription(mode: EntryMode) {
  if (mode === "connect-existing") return "Connect to your existing base and start enabling curated skills.";
  if (mode === "install-clawhub") return "Repair the skill installer first, then continue with starter installs.";
  return "Use the official install path first, then come back here to connect skills.";
}

function recommendationTitle(status: SetupStatus | null) {
  if (!status) return "Preparing your setup recommendation";
  if (status.recommendation === "install-openclaw") return "Install OpenClaw or ClawX first";
  if (status.recommendation === "install-clawhub") return "Install clawhub first";
  if (status.recommendation === "check-wsl-path") return "Confirm whether OpenClaw runs on Windows or WSL";
  return "Connect to your existing OpenClaw";
}

function recommendationSummary(status: SetupStatus | null) {
  if (!status) return "Checking this machine so we can recommend the safest next step.";
  if (status.recommendation === "install-openclaw") {
    return "No usable OpenClaw config was found yet, so there is nothing safe to attach skills to.";
  }
  if (status.recommendation === "install-clawhub") {
    return "OpenClaw was detected, but clawhub was not found, so registry-backed installs cannot run yet.";
  }
  if (status.recommendation === "check-wsl-path") {
    return "This machine appears to support both Windows and WSL. Confirm where OpenClaw actually runs before attaching skills.";
  }
  return "A usable OpenClaw environment was detected, so you can move straight into curated skill activation.";
}

function recommendationSteps(status: SetupStatus | null) {
  if (!status) return ["Checking the current environment."];
  if (status.recommendation === "install-openclaw") {
    return [
      "Install ClawX if you prefer a desktop GUI.",
      "Or install OpenClaw from the official docs.",
      "Launch it once, then come back and retry environment check."
    ];
  }
  if (status.recommendation === "install-clawhub") {
    return [
      "Install the official clawhub CLI.",
      "Come back here and click Retry environment check.",
      "Then continue with starter installs if you still need them."
    ];
  }
  if (status.recommendation === "check-wsl-path") {
    return [
      "If OpenClaw runs on Windows, stay on the Windows path.",
      "If OpenClaw runs inside WSL, prefer the WSL path consistently.",
      "Then continue with one managed pack."
    ];
  }
  return [
    "Enable one managed local pack below.",
    "Restart OpenClaw after the activation finishes.",
    "Then test the new skill inside OpenClaw."
  ];
}

function buildRepairCards(status: SetupStatus | null): RepairCard[] {
  if (!status) return [];
  const cards: RepairCard[] = [];
  if (!status.hasOpenClawConfig) {
    cards.push({
      title: "Install or launch OpenClaw first",
      body: "We cannot attach skills until OpenClaw or ClawX has created a usable config on this machine.",
      steps: [
        "Install OpenClaw or ClawX.",
        "Launch it once so the config is created.",
        "Return here and click Retry environment check."
      ],
      level: "blocked"
    });
  }
  if (!status.hasClawhub) {
    cards.push({
      title: "Install clawhub for starter online installs",
      body: "The managed local library can work without clawhub, but registry-backed installs still need it.",
      steps: [
        "Open the clawhub docs from the links below.",
        "Install clawhub.",
        "Run Retry environment check before trying starter installs again."
      ],
      level: "blocked"
    });
  }
  if (status.recommendation === "check-wsl-path") {
    cards.push({
      title: "Confirm whether OpenClaw runs on Windows or WSL",
      body: "This machine looks mixed. Use the side that actually hosts OpenClaw before attaching skills.",
      steps: [
        "If OpenClaw runs on Windows, keep using the Windows path.",
        "If OpenClaw runs in WSL, use the WSL side consistently.",
        "Then continue with one managed pack."
      ],
      level: "warning"
    });
  }
  if (cards.length === 0) {
    cards.push({
      title: "Environment looks ready",
      body: "The simplest path is to enable one managed local pack and keep the active skill set small.",
      steps: [
        "Enable one managed local pack.",
        "Restart OpenClaw.",
        "Test with the suggested prompt."
      ],
      level: "warning"
    });
  }
  return cards;
}

function buildStarterSummary(pack: CatalogPack, report: InstallExecutionReport) {
  return [
    `Processed pack: ${pack.name}`,
    `Installed: ${report.installed.length > 0 ? report.installed.map((entry) => entry.slug).join(", ") : "none"}`,
    `Skipped: ${report.skipped.length}`,
    `Retriable failures: ${report.failedRetriable.length}`,
    `Permanent failures: ${report.failedPermanent.length}`
  ];
}

function buildPrompt(managedResult: ManagedLibraryActivation | null, attachResult: AttachFlowResult | null) {
  if (managedResult && managedResult.activeSkillSlugs.length > 0) {
    return `Please list your currently loaded skills, confirm whether ${managedResult.activeSkillSlugs[0]} is available, and use it for the next matching task.`;
  }
  if (attachResult?.success) {
    return "Please check whether the calendar skill is loaded. If it is, use it to review today's schedule.";
  }
  return "";
}

function sourceLabel(skill: CatalogSkill) {
  if (skill.sourceType === "local") return "local curated";
  if (skill.trustLevel === "official") return "official registry";
  return "registry";
}

function activationSourceLabel(source: ManagedLibrary["skills"][number]["activationSource"]) {
  if (source === "manual") return "enabled directly";
  if (source === "pack") return "enabled by pack";
  if (source === "both") return "enabled directly and by pack";
  return "inactive";
}

export function App() {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [managedLibrary, setManagedLibrary] = useState<ManagedLibrary | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [attachResult, setAttachResult] = useState<AttachFlowResult | null>(null);
  const [managedResult, setManagedResult] = useState<ManagedLibraryActivation | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultLines, setResultLines] = useState<string[]>([]);
  const [nextStep, setNextStep] = useState("");
  const [advancedPayload, setAdvancedPayload] = useState<unknown>(null);
  const [actionLabel, setActionLabel] = useState("Nothing has run yet");
  const [failureTitle, setFailureTitle] = useState("");
  const [failureBody, setFailureBody] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("connect-existing");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  async function refresh() {
    const [setupData, catalogData, stateData, libraryData] = await Promise.all([
      getJson<SetupStatus>("/api/setup/status"),
      getJson<Catalog>("/api/catalog"),
      getJson<AppState>("/api/state"),
      getJson<ManagedLibrary>("/api/library")
    ]);
    setSetupStatus(setupData);
    setEntryMode(
      setupData.recommendation === "install-clawhub" || setupData.recommendation === "install-openclaw"
        ? setupData.recommendation
        : "connect-existing"
    );
    setCatalog(catalogData);
    setState(stateData);
    setManagedLibrary(libraryData);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, []);

  async function runAttach(kind: "calendar" | "demo-safe") {
    setBusy(true);
    setMessage("");
    try {
      setActionLabel(kind === "calendar" ? "Install and attach Calendar" : "Install demo-safe");
      const result = await getJson<AttachFlowResult>(`/api/attach/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setAttachResult(result);
      setManagedResult(null);
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle(result.failureCategory ? "This flow still needs attention" : "");
      setFailureBody(result.failureMessage ?? "");
      setMessage(result.success ? "Attach flow completed. Restart OpenClaw to use the new skill." : result.nextStep);
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Request failed");
      setFailureBody(text);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  async function runPackInstall(pack: CatalogPack) {
    setBusy(true);
    setMessage("");
    setAttachResult(null);
    setManagedResult(null);
    setActionLabel(`Install starter pack: ${pack.name}`);
    try {
      const result = await getJson<{ installReport: InstallExecutionReport }>(`/api/packs/${pack.id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patchConfig: true })
      });
      setAdvancedPayload(result);
      setResultLines(buildStarterSummary(pack, result.installReport));
      setNextStep("If the install succeeded, restart OpenClaw so it can refresh its skill list.");
      setFailureTitle(
        result.installReport.failedPermanent.length > 0 || result.installReport.failedRetriable.length > 0
          ? "The install report includes some failures"
          : ""
      );
      setFailureBody(
        result.installReport.failedPermanent.length > 0 || result.installReport.failedRetriable.length > 0
          ? "Open Advanced details to review the exact install report."
          : ""
      );
      setMessage(`Starter install completed for ${pack.name}.`);
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Pack install failed");
      setFailureBody(text);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  async function runManagedSkillActivation(slug: string) {
    setBusy(true);
    setMessage("");
    setActionLabel(`Enable managed skill: ${slug}`);
    try {
      const result = await getJson<ManagedLibraryActivation>(`/api/library/skills/${slug}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setManagedResult(result);
      setAttachResult(null);
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle(result.success ? "" : "Managed activation did not verify cleanly");
      setFailureBody(result.success ? "" : result.verify.findings.join(" "));
      setMessage(result.success ? "Managed skill enabled. Restart OpenClaw to refresh its skill list." : result.nextStep);
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Managed activation failed");
      setFailureBody(text);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  async function runManagedSkillDeactivation(slug: string) {
    setBusy(true);
    setMessage("");
    setActionLabel(`Disable managed skill: ${slug}`);
    try {
      const result = await getJson<ManagedLibraryActivation>(`/api/library/skills/${slug}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setManagedResult(result);
      setAttachResult(null);
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle(result.success ? "" : "Managed update did not verify cleanly");
      setFailureBody(result.success ? "" : result.verify.findings.join(" "));
      setMessage("Managed skill selection was updated.");
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Managed update failed");
      setFailureBody(text);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  async function runManagedPackActivation(packId: string) {
    setBusy(true);
    setMessage("");
    setActionLabel(`Enable managed pack: ${packId}`);
    try {
      const result = await getJson<ManagedLibraryActivation>(`/api/library/packs/${packId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setManagedResult(result);
      setAttachResult(null);
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle(result.success ? "" : "Managed activation did not verify cleanly");
      setFailureBody(result.success ? "" : result.verify.findings.join(" "));
      setMessage(result.success ? "Managed pack enabled. Restart OpenClaw to refresh its skill list." : result.nextStep);
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Managed pack activation failed");
      setFailureBody(text);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  async function runManagedPackDeactivation(packId: string) {
    setBusy(true);
    setMessage("");
    setActionLabel(`Disable managed pack: ${packId}`);
    try {
      const result = await getJson<ManagedLibraryActivation>(`/api/library/packs/${packId}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setManagedResult(result);
      setAttachResult(null);
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle(result.success ? "" : "Managed update did not verify cleanly");
      setFailureBody(result.success ? "" : result.verify.findings.join(" "));
      setMessage("Managed pack selection was updated.");
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Managed update failed");
      setFailureBody(text);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  async function clearManagedSkills() {
    setBusy(true);
    setMessage("");
    setActionLabel("Clear managed active skills");
    try {
      const result = await getJson<ManagedLibraryActivation>("/api/library/deactivate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setManagedResult(result);
      setAttachResult(null);
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle("");
      setFailureBody("");
      setMessage("Managed active skills were cleared.");
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Clear failed");
      setFailureBody(text);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  async function rollbackLatest() {
    const latest = state?.snapshots.at(-1);
    if (!latest) {
      setMessage("There is no snapshot to roll back yet.");
      return;
    }
    setBusy(true);
    setActionLabel("Undo last attach");
    try {
      const result = await getJson("/api/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: latest.id })
      });
      setManagedResult(null);
      setAttachResult(null);
      setAdvancedPayload(result);
      setResultLines(["Rollback completed.", "Restart OpenClaw if it is currently running."]);
      setNextStep("Restart OpenClaw so it drops the reverted state.");
      setFailureTitle("");
      setFailureBody("");
      setMessage("The most recent attach was rolled back.");
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Rollback failed");
      setFailureBody(text);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  const featuredPacks = useMemo(
    () => featuredPackIds.map((id) => catalog?.packs.find((pack) => pack.id === id)).filter(Boolean) as CatalogPack[],
    [catalog]
  );
  const featuredSkills = useMemo(
    () =>
      featuredSkillSlugs
        .map((slug) => catalog?.skills.find((skill) => skill.slug === slug))
        .filter(Boolean) as CatalogSkill[],
    [catalog]
  );
  const repairCards = buildRepairCards(setupStatus);
  const prompt = buildPrompt(managedResult, attachResult);
  const managedTags = useMemo(() => {
    const tags = new Set<string>();
    for (const skill of managedLibrary?.skills ?? []) {
      for (const tag of skill.tags) {
        tags.add(tag);
      }
    }
    return ["all", ...[...tags].sort()];
  }, [managedLibrary]);
  const filteredManagedSkills = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return (managedLibrary?.skills ?? []).filter((skill) => {
      if (showActiveOnly && !skill.active) {
        return false;
      }
      if (selectedTag !== "all" && !skill.tags.includes(selectedTag)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [skill.slug, skill.name, skill.description, ...skill.tags].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }, [libraryQuery, managedLibrary, selectedTag, showActiveOnly]);
  const filteredManagedPacks = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return (managedLibrary?.packs ?? []).filter((pack) => {
      if (showActiveOnly && !pack.active) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [pack.id, pack.name, pack.description, ...pack.skills].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }, [libraryQuery, managedLibrary, showActiveOnly]);

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">OpenClaw Exoskeleton</p>
          <h1>Curated skill library with progressive activation</h1>
          <p className="subtle lead">
            Keep a large curated library in one place, but only expose the small active skill set that OpenClaw should
            read right now.
          </p>
          <div className="hero-points">
            <span>Managed local skill library</span>
            <span>Active-skills only</span>
            <span>Starter online installs available</span>
            <span>Restart OpenClaw after activation</span>
          </div>
          <div className="hero-brand">
            <div className="hot-badge">HOT!</div>
            <div>
              <p className="brand-title">OpenClaw</p>
              <p className="brand-subtitle">Exoskeleton Task Center</p>
              <p className="brand-copy">Choose one pack, sync only those skills, then restart OpenClaw.</p>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <ExoskeletonMascot />
        </div>
        <div className="hero-action-card">
          <h2>Recommended next move</h2>
          <p>{recommendationSummary(setupStatus)}</p>
          <div className="tag-row">
            <span className={`chip ${setupStatus?.status === "blocked" ? "chip-danger" : setupStatus?.status === "needs attention" ? "chip-warning" : "chip-accent"}`}>
              {setupStatus?.status ?? "loading"}
            </span>
            {setupStatus ? <span className="chip">{setupStatus.recommendation}</span> : null}
          </div>
          <button className="primary" disabled={busy} onClick={() => void runManagedPackActivation("knowledge-work")}>Enable Knowledge Work for OpenClaw</button>
          <button disabled={busy} onClick={() => void refresh()}>Retry environment check</button>
          <button disabled={busy} onClick={() => void clearManagedSkills()}>Clear active skills</button>
          <button disabled={busy} onClick={() => void rollbackLatest()}>Undo last attach</button>
          <p className="subtle small">Current action: {actionLabel}</p>
        </div>
      </section>

      {message ? <section className="banner">{message}</section> : null}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Choose your current starting point</h2>
            <p className="subtle">Pick the closest path. We will guide the next step from there.</p>
          </div>
        </div>
        <div className="card-grid">
          {(["connect-existing", "install-clawhub", "install-openclaw"] as const).map((mode) => (
            <article className={`catalog-card ${entryMode === mode ? "catalog-card-active" : ""}`} key={mode}>
              <div className="catalog-topline"><span className="chip chip-accent">{mode === "connect-existing" ? "Connect" : mode === "install-clawhub" ? "Repair" : "Install"}</span></div>
              <h3>{entryTitle(mode)}</h3>
              <p>{entryDescription(mode)}</p>
              <div className="card-actions">
                <button className={entryMode === mode ? "primary" : ""} disabled={busy} onClick={() => setEntryMode(mode)}>Choose this path</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Environment status</h2>
          <div className="stat"><span>Status</span><strong className={setupStatus?.status === "ready" ? "ok" : setupStatus?.status === "blocked" ? "fail" : ""}>{setupStatus?.status ?? "loading"}</strong></div>
          <div className="stat"><span>clawhub</span><strong className={setupStatus?.hasClawhub ? "ok" : "fail"}>{setupStatus?.hasClawhub ? "detected" : "not detected"}</strong></div>
          <div className="stat"><span>OpenClaw config</span><strong className={setupStatus?.hasOpenClawConfig ? "ok" : "fail"}>{setupStatus?.hasOpenClawConfig ? "detected" : "not detected"}</strong></div>
          <div className="stat"><span>Mode</span><strong>{setupStatus?.platformMode ?? "loading"}</strong></div>
        </article>

        <article className="panel">
          <h2>{recommendationTitle(setupStatus)}</h2>
          <p className="subtle">{recommendationSummary(setupStatus)}</p>
          <ol className="step-list">{recommendationSteps(setupStatus).map((step) => <li key={step}>{step}</li>)}</ol>
        </article>

        <article className="panel">
          <h2>Current managed state</h2>
          <div className="stat"><span>Active skills</span><strong>{managedLibrary?.activeSkillSlugs.length ? managedLibrary.activeSkillSlugs.join(", ") : "none"}</strong></div>
          <div className="stat"><span>Active packs</span><strong>{managedLibrary?.activePackIds.length ? managedLibrary.activePackIds.join(", ") : "none"}</strong></div>
          <div className="stat"><span>Directly enabled skills</span><strong>{managedLibrary?.manualSkillSlugs.length ? managedLibrary.manualSkillSlugs.join(", ") : "none"}</strong></div>
          <div className="stat"><span>Managed path</span><strong>{managedResult?.activeRoot ?? "Will appear after first managed activation."}</strong></div>
        </article>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Repair guidance</h2>
            <p className="subtle">If you see blocked or needs attention, fix that first.</p>
          </div>
          {setupStatus ? (
            <div className="tag-row">
              <a className="button-link" href={setupStatus.docs.openClawInstallUrl} target="_blank" rel="noreferrer">Open OpenClaw docs</a>
              <a className="button-link" href={setupStatus.docs.clawhubUrl} target="_blank" rel="noreferrer">Open clawhub docs</a>
              <a className="button-link" href={setupStatus.docs.clawxUrl} target="_blank" rel="noreferrer">Open ClawX page</a>
            </div>
          ) : null}
        </div>
        <div className="repair-grid">
          {repairCards.map((card) => (
            <article className={`repair-card repair-${card.level}`} key={card.title}>
              <div className="catalog-topline"><span className={`chip ${card.level === "blocked" ? "chip-danger" : "chip-warning"}`}>{card.level === "blocked" ? "blocked" : "needs attention"}</span></div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <ol className="step-list">{card.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head"><div><h2>Managed local packs</h2><p className="subtle">Recommended path. Enable only the packs OpenClaw should see right now.</p></div></div>
        <div className="library-toolbar">
          <label className="search-field">
            <span className="store-label">Search library</span>
            <input
              type="search"
              value={libraryQuery}
              placeholder="Search skills, packs, tags, or descriptions"
              onChange={(event) => setLibraryQuery(event.target.value)}
            />
          </label>
          <div className="filter-group">
            <span className="store-label">View</span>
            <button
              className={showActiveOnly ? "primary" : ""}
              disabled={busy}
              onClick={() => setShowActiveOnly((current) => !current)}
            >
              {showActiveOnly ? "Showing active only" : "Show active only"}
            </button>
          </div>
        </div>
        <div className="card-grid">
          {filteredManagedPacks.map((pack) => (
            <article className="catalog-card" key={pack.id}>
              <div className="catalog-topline"><span className="chip chip-local">Managed</span><span className="subtle">{pack.skillCount} skills</span><span className={`chip ${pack.active ? "chip-accent" : ""}`}>{pack.active ? "active" : "inactive"}</span></div>
              <h3>{pack.name}</h3>
              <p>{pack.description}</p>
              <div className="tag-row">{pack.skills.slice(0, 4).map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
              <div className="card-actions">
                <button className="primary" disabled={busy || pack.active} onClick={() => void runManagedPackActivation(pack.id)}>{pack.active ? "Already active" : "Enable in OpenClaw"}</button>
                {pack.active ? <button disabled={busy} onClick={() => void runManagedPackDeactivation(pack.id)}>Disable pack</button> : null}
              </div>
            </article>
          ))}
          {managedLibrary && filteredManagedPacks.length === 0 ? <p className="subtle">No managed packs match the current filter.</p> : null}
          {!managedLibrary ? <p className="subtle">Loading managed library...</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-head"><div><h2>Managed local skills</h2><p className="subtle">Use this when you want one skill at a time instead of a full pack.</p></div></div>
        <div className="filter-strip">
          {managedTags.map((tag) => (
            <button
              key={tag}
              className={selectedTag === tag ? "primary" : ""}
              disabled={busy}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="card-grid">
          {filteredManagedSkills.map((skill) => (
            <article className="catalog-card skill-card" key={skill.slug}>
              <div className="catalog-topline"><span className="chip chip-local">local curated</span><span className="subtle">{activationSourceLabel(skill.activationSource)}</span><span className={`chip ${skill.active ? "chip-accent" : ""}`}>{skill.active ? "active" : "inactive"}</span></div>
              <h3>{skill.name}</h3>
              <p>{skill.description}</p>
              <div className="tag-row">{skill.tags.slice(0, 4).map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>
              <div className="card-actions">
                <button className="primary" disabled={busy || skill.active} onClick={() => void runManagedSkillActivation(skill.slug)}>{skill.active ? "Already active" : "Enable this skill"}</button>
                {skill.activationSource === "manual" || skill.activationSource === "both"
                  ? <button disabled={busy} onClick={() => void runManagedSkillDeactivation(skill.slug)}>Disable direct enable</button>
                  : null}
              </div>
            </article>
          ))}
          {managedLibrary && filteredManagedSkills.length === 0 ? <p className="subtle">No managed skills match the current filter.</p> : null}
          {!managedLibrary ? <p className="subtle">Loading managed library...</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-head"><div><h2>Starter online installs</h2><p className="subtle">Registry-backed starter flows remain available as an advanced option.</p></div></div>
        <div className="card-grid">
          {featuredPacks.map((pack) => (
            <article className="catalog-card" key={pack.id}>
              <div className="catalog-topline"><span className="chip chip-accent">{pack.id === "demo-safe" ? "Starter" : pack.id}</span><span className="subtle">{pack.skills.length} skills</span></div>
              <h3>{pack.name}</h3>
              <p>{pack.description}</p>
              <p className="catalog-meta"><strong>Best for:</strong> {packAudience[pack.id] ?? "Users who want to extend OpenClaw quickly."}</p>
              <p className="catalog-meta"><strong>Outcome:</strong> {packOutcome[pack.id] ?? pack.description}</p>
              <div className="card-actions">
                {pack.id === "demo-safe"
                  ? <button className="primary" disabled={busy} onClick={() => void runAttach("demo-safe")}>Install and attach</button>
                  : <button className="primary" disabled={busy} onClick={() => void runPackInstall(pack)}>Install starter pack</button>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head"><div><h2>Representative catalog skills</h2><p className="subtle">A quick view of what exists in the catalog beyond the default starter path.</p></div></div>
        <div className="card-grid">
          {featuredSkills.map((skill) => (
            <article className="catalog-card skill-card" key={skill.slug}>
              <div className="catalog-topline"><span className={`chip ${skill.sourceType === "local" ? "chip-local" : ""}`}>{sourceLabel(skill)}</span><span className="subtle">{skill.trustLevel}</span></div>
              <h3>{skill.name}</h3>
              <p>{skill.description}</p>
              <div className="tag-row">{skill.tags.slice(0, 4).map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Execution progress</h2>
        {attachResult ? (
          <div className="stages">
            {attachResult.stages.map((stage) => (
              <article className={`stage stage-${stage.status}`} key={stage.key}>
                <strong>{stage.key}</strong>
                <span>{stage.status}</span>
                <p>{stage.summary}</p>
              </article>
            ))}
          </div>
        ) : managedResult ? (
          <div className="summary-list">
            <p>Managed library mode is active.</p>
            <p>Active skills: {managedResult.activeSkillSlugs.length > 0 ? managedResult.activeSkillSlugs.join(", ") : "none"}</p>
            <p>Verify result: {managedResult.success ? "passed" : "failed"}</p>
          </div>
        ) : (
          <p className="subtle">Run any action and this area will show the current progress.</p>
        )}
      </section>

      <section className="grid">
        <article className="panel">
          <h2>User result</h2>
          {resultLines.length > 0 ? (
            <div className="summary-list">
              {resultLines.map((line) => <p key={line}>{line}</p>)}
              <p>Next step: <strong>{nextStep}</strong></p>
              {prompt ? <div className="prompt-box"><span className="store-label">Test this inside OpenClaw</span><p>{prompt}</p></div> : null}
            </div>
          ) : (
            <p className="subtle">Once you enable or install something, this area will explain the result in plain language.</p>
          )}
        </article>

        <article className="panel">
          <h2>If something failed</h2>
          {failureTitle || failureBody ? (<><p><strong>{failureTitle}</strong></p><p>{failureBody}</p></>) : (
            <p className="subtle">Failure guidance only appears when you actually need to do something.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Advanced details</h2>
        {advancedPayload ? (
          <details><summary>Show raw result payload</summary><pre>{JSON.stringify(advancedPayload, null, 2)}</pre></details>
        ) : (
          <p className="subtle">Raw details stay folded away until they are needed.</p>
        )}
      </section>
    </main>
  );
}
