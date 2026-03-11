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
  packs: Array<{
    id: string;
    name: string;
    description: string;
    skillCount: number;
    skills: string[];
    category?: string;
    audience?: string;
    outcome?: string;
    active: boolean;
  }>;
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
  activeRoot: string;
  activeSkillsPath: string;
  lockFileExists: boolean;
  skillMdCount: number;
  currentModeTitle: string;
  currentModeSummary: string;
  recentActions: Array<{
    at: string;
    label: string;
    mode: ManagedLibraryActivation["mode"];
    targetId: string;
    activeSkillSlugs: string[];
  }>;
};
type RepairCard = { title: string; body: string; steps: string[]; level: "blocked" | "warning" };

const featuredPackIds = ["demo-safe", "knowledge-work", "delivery-engine", "business-ops"] as const;
const featuredSkillSlugs = ["calendar", "research-first-decider", "product-brief-writer", "doc-systematizer"] as const;
const workScenarios = [
  {
    packId: "knowledge-work",
    title: "Research and planning",
    summary: "Turn notes, transcripts, and rough ideas into briefs, summaries, and structured documentation.",
    audience: "Founders, operators, researchers",
    deliverable: "Clear briefs, decisions, and reusable docs"
  },
  {
    packId: "delivery-engine",
    title: "Build and ship",
    summary: "Keep OpenClaw focused on implementation, triage, QA gates, and release-readiness work.",
    audience: "Engineering, QA, product delivery",
    deliverable: "Cleaner triage, stronger release discipline"
  },
  {
    packId: "business-ops",
    title: "Support and operations",
    summary: "Help with customer replies, runbooks, coordination, and repeatable operating procedures.",
    audience: "Support, operations, cross-functional teams",
    deliverable: "Calmer support responses and sharper runbooks"
  },
  {
    packId: "paper-factory",
    title: "Paper Factory",
    summary: "Keep a paper workspace staged, scanned, and validated without dropping into ad hoc draft chaos.",
    audience: "Researchers and paper-heavy teams",
    deliverable: "A tighter manifest-first paper workflow"
  }
] as const;

const taskLaunchers = [
  {
    packId: "knowledge-work",
    title: "Research and write a plan",
    summary: "Turn notes, transcripts, and rough ideas into a clearer brief, summary, or working plan.",
    sampleAsk: "Summarize these notes and turn them into a structured plan."
  },
  {
    packId: "delivery-engine",
    title: "Ship a change",
    summary: "Keep OpenClaw focused on delivery, QA gates, release checks, and implementation flow.",
    sampleAsk: "Review this change, find delivery risks, and tell me what must happen before release."
  },
  {
    packId: "business-ops",
    title: "Handle support or operations",
    summary: "Use support, runbook, and operations skills without loading unrelated modes.",
    sampleAsk: "Draft a calm customer reply and tell me the next operating step."
  },
  {
    packId: "paper-factory",
    title: "Work on a paper",
    summary: "Keep paper work manifest-first, structured, and staged instead of drifting into draft chaos.",
    sampleAsk: "Scan this paper workspace, tell me the current stage, and list the blocking gaps."
  }
] as const;

const scenarioPrompt = (packName: string, scenarioTitle: string) =>
  `Please list your currently loaded skills, confirm whether the ${packName} mode is active, and then handle my next ${scenarioTitle.toLowerCase()} task with the best matching active skill.`;

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

function buildScenarioPromptCard(currentScenario: { scenario: (typeof workScenarios)[number]; pack: ManagedLibrary["packs"][number] } | null, fallbackPrompt: string) {
  if (currentScenario) {
    return {
      title: `Test ${currentScenario.scenario.title} in OpenClaw`,
      body: `After restarting OpenClaw, ask it to confirm that ${currentScenario.pack.name} is active and then handle one ${currentScenario.scenario.title.toLowerCase()} task.`,
      prompt: scenarioPrompt(currentScenario.pack.name, currentScenario.scenario.title)
    };
  }

  return {
    title: "Test the current active set in OpenClaw",
    body: "After restarting OpenClaw, ask it to list the currently loaded skills and use the best matching active skill for your next task.",
    prompt: fallbackPrompt || "Please list your currently loaded skills, confirm which active skills are available, and then use the best matching one for my next task."
  };
}

function buildModeRationale(currentScenario: { scenario: (typeof workScenarios)[number]; pack: ManagedLibrary["packs"][number] } | null, managedLibrary: ManagedLibrary | null) {
  if (currentScenario) {
    return {
      title: `Why ${currentScenario.scenario.title} is active`,
      body: `${currentScenario.pack.name} keeps OpenClaw focused on ${currentScenario.scenario.title.toLowerCase()} work instead of forcing it to scan the whole library.`,
      points: [
        `Best for: ${currentScenario.scenario.audience}`,
        `Delivers: ${currentScenario.scenario.deliverable}`,
        `Active skill count: ${currentScenario.pack.skills.length}`
      ]
    };
  }

  return {
    title: "Why the managed active set stays small",
    body: "OpenClaw performs better when it only sees the few skills that match the current job, not the whole library at once.",
    points: [
      `Active skills right now: ${managedLibrary?.activeSkillSlugs.length ?? 0}`,
      "Switch modes when the kind of work changes.",
      "Use direct skill enables only for narrow exceptions."
    ]
  };
}

function buildGuidedJourney(currentScenario: { scenario: (typeof workScenarios)[number]; pack: ManagedLibrary["packs"][number] } | null) {
  if (currentScenario) {
    return {
      title: `You are set up for ${currentScenario.scenario.title}`,
      steps: [
        `Keep ${currentScenario.pack.name} as the active mode.`,
        "Restart OpenClaw so it reloads the current active skills.",
        `Use one ${currentScenario.scenario.title.toLowerCase()} request to confirm the mode is working.`
      ]
    };
  }

  return {
    title: "Start with one focused task mode",
    steps: [
      "Choose one task card below.",
      "Switch OpenClaw to that matching mode.",
      "Restart OpenClaw and test with the copied prompt."
    ]
  };
}

function buildModeReadiness(
  currentScenario: { scenario: (typeof workScenarios)[number]; pack: ManagedLibrary["packs"][number] } | null,
  managedLibrary: ManagedLibrary | null
) {
  if (currentScenario && managedLibrary) {
    return {
      title: `${currentScenario.scenario.title} is live for OpenClaw`,
      body: `OpenClaw is currently pointed at the ${currentScenario.pack.name} active set. Keep this mode on, restart OpenClaw once, and test with one focused ask.`,
      status: "ready to test"
    };
  }

  if (managedLibrary && managedLibrary.activeSkillSlugs.length > 0) {
    return {
      title: "A managed skill set is active",
      body: "OpenClaw already has a small managed active set. Restart it once, then test with one prompt before switching again.",
      status: "ready to test"
    };
  }

  return {
    title: "No work mode is active yet",
    body: "Pick one task card or one managed mode first. We keep the active set intentionally small so OpenClaw stays focused.",
    status: "choose one mode"
  };
}

function managedActionNoun(mode: ManagedLibraryActivation["mode"]) {
  if (mode === "switch-pack" || mode === "switch-skill") return "switched";
  if (mode === "deactivate-all") return "cleared";
  return "enabled";
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
  const [copyNotice, setCopyNotice] = useState("");

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

  async function copyText(value: string, successLabel: string) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(successLabel);
      window.setTimeout(() => setCopyNotice(""), 2200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

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

  async function runManagedSkillSwitch(slug: string) {
    setBusy(true);
    setMessage("");
    setActionLabel(`Switch active mode to skill: ${slug}`);
    try {
      const result = await getJson<ManagedLibraryActivation>(`/api/library/skills/${slug}/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setManagedResult(result);
      setAttachResult(null);
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle(result.success ? "" : "Managed switch did not verify cleanly");
      setFailureBody(result.success ? "" : result.verify.findings.join(" "));
      setMessage(result.success ? "Managed skill switched. Restart OpenClaw to refresh its skill list." : result.nextStep);
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Managed skill switch failed");
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

  async function runManagedPackSwitch(packId: string) {
    setBusy(true);
    setMessage("");
    setActionLabel(`Switch active mode to pack: ${packId}`);
    try {
      const result = await getJson<ManagedLibraryActivation>(`/api/library/packs/${packId}/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setManagedResult(result);
      setAttachResult(null);
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle(result.success ? "" : "Managed switch did not verify cleanly");
      setFailureBody(result.success ? "" : result.verify.findings.join(" "));
      setMessage(result.success ? "Managed pack switched. Restart OpenClaw to refresh its skill list." : result.nextStep);
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("Managed pack switch failed");
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

  async function reapplyRecentAction(entry: ManagedLibrary["recentActions"][number]) {
    if (entry.mode === "deactivate-all") {
      await clearManagedSkills();
      return;
    }

    if (entry.mode === "pack") {
      await runManagedPackActivation(entry.targetId);
      return;
    }

    if (entry.mode === "switch-pack") {
      await runManagedPackSwitch(entry.targetId);
      return;
    }

    if (entry.mode === "switch-skill") {
      await runManagedSkillSwitch(entry.targetId);
      return;
    }

    await runManagedSkillActivation(entry.targetId);
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
  const featuredManagedPacks = useMemo(
    () =>
      featuredPackIds
        .map((id) => managedLibrary?.packs.find((pack) => pack.id === id))
        .filter(Boolean) as ManagedLibrary["packs"],
    [managedLibrary]
  );
  const featuredSkills = useMemo(
    () =>
      featuredSkillSlugs
        .map((slug) => catalog?.skills.find((skill) => skill.slug === slug))
        .filter(Boolean) as CatalogSkill[],
    [catalog]
  );
  const scenarioPacks = useMemo(
    () =>
      workScenarios
        .map((scenario) => ({
          scenario,
          pack: managedLibrary?.packs.find((entry) => entry.id === scenario.packId)
        }))
        .filter((entry): entry is { scenario: (typeof workScenarios)[number]; pack: NonNullable<ManagedLibrary["packs"][number]> } => Boolean(entry.pack)),
    [managedLibrary]
  );
  const taskCards = useMemo(
    () =>
      taskLaunchers
        .map((task) => ({
          task,
          pack: managedLibrary?.packs.find((entry) => entry.id === task.packId)
        }))
        .filter((entry): entry is { task: (typeof taskLaunchers)[number]; pack: NonNullable<ManagedLibrary["packs"][number]> } => Boolean(entry.pack)),
    [managedLibrary]
  );
  const currentScenario = useMemo(
    () => scenarioPacks.find(({ pack }) => pack.active) ?? null,
    [scenarioPacks]
  );
  const paperFactoryTask = useMemo(
    () => taskCards.find(({ task }) => task.packId === "paper-factory") ?? null,
    [taskCards]
  );
  const nextTaskAction = useMemo(() => {
    if (currentScenario) {
      const matchingTask = taskCards.find(({ pack }) => pack.id === currentScenario.pack.id);
      if (matchingTask) {
        return {
          title: `Stay in ${matchingTask.task.title}`,
          body: `OpenClaw is already pointed at ${matchingTask.pack.name}. The shortest path now is to restart OpenClaw once and test with one focused ask.`,
          buttonLabel: "Task mode already active",
          prompt: matchingTask.task.sampleAsk,
          packId: matchingTask.pack.id,
          isActive: true
        };
      }
    }

    const recommended = taskCards[0] ?? null;
    if (!recommended) {
      return null;
    }

    return {
      title: `Start with ${recommended.task.title}`,
      body: `If you want the fastest route to a useful result, switch into ${recommended.pack.name}, keep the active set small, and then test right away inside OpenClaw.`,
      buttonLabel: "Start recommended task",
      prompt: recommended.task.sampleAsk,
      packId: recommended.pack.id,
      isActive: false
    };
  }, [currentScenario, taskCards]);
  const repairCards = buildRepairCards(setupStatus);
  const prompt = buildPrompt(managedResult, attachResult);
  const promptCard = buildScenarioPromptCard(currentScenario, prompt);
  const modeRationale = buildModeRationale(currentScenario, managedLibrary);
  const guidedJourney = buildGuidedJourney(currentScenario);
  const modeReadiness = buildModeReadiness(currentScenario, managedLibrary);
  const previousModeAction = useMemo(() => {
    if (!managedLibrary?.recentActions.length) {
      return null;
    }

    const currentPackId = managedLibrary.activePackIds[0] ?? null;
    return (
      managedLibrary.recentActions.find((entry) => {
        if (entry.mode !== "switch-pack" && entry.mode !== "pack") {
          return false;
        }
        if (!currentPackId) {
          return true;
        }
        return entry.targetId !== currentPackId;
      }) ?? null
    );
  }, [managedLibrary]);
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
  const setupNeedsAttention = !setupStatus || setupStatus.status !== "ready";

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
          <button className="primary" disabled={busy} onClick={() => void runManagedPackSwitch("knowledge-work")}>Switch OpenClaw to Knowledge Work</button>
          <button disabled={busy} onClick={() => void refresh()}>Retry environment check</button>
          <button disabled={busy} onClick={() => void clearManagedSkills()}>Clear active skills</button>
          <button disabled={busy} onClick={() => void rollbackLatest()}>Undo last attach</button>
          <p className="subtle small">Current action: {actionLabel}</p>
        </div>
      </section>

      {message ? <section className="banner">{message}</section> : null}
      {copyNotice ? <section className="banner copy-banner">{copyNotice}</section> : null}

      {managedLibrary ? (
        <section className="panel active-strip">
          <div className="active-strip-copy">
            <span className="store-label">Active now</span>
            <h2>{managedLibrary.currentModeTitle}</h2>
            <p className="subtle">
              {managedLibrary.currentModeSummary} Keep the live skill set intentionally small, then test with one focused ask in OpenClaw.
            </p>
          </div>
          <div className="store-stats compact active-strip-stats">
            <div>
              <span className="store-label">Active skills</span>
              <strong>{managedLibrary.activeSkillSlugs.length}</strong>
            </div>
            <div>
              <span className="store-label">Active packs</span>
              <strong>{managedLibrary.activePackIds.length}</strong>
            </div>
            <div>
              <span className="store-label">Last change</span>
              <strong>{managedLibrary.recentActions[0]?.label ?? "No changes yet"}</strong>
            </div>
          </div>
          <div className="card-actions">
            <button disabled={busy} onClick={() => void copyText(managedLibrary.activeSkillsPath, "Managed active path copied")}>
              Copy active path
            </button>
            <button disabled={busy || !promptCard.prompt} onClick={() => void copyText(promptCard.prompt, "Current mode test ask copied")}>
              Copy test ask
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Your next three steps</h2>
            <p className="subtle">This keeps the workflow short: choose one task mode, keep the active set small, then verify the result inside OpenClaw.</p>
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="prompt-box compact-prompt">
            <span className="store-label">{guidedJourney.title}</span>
            <ol className="step-list compact-list">
              {guidedJourney.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
          {paperFactoryTask ? (
            <div className="prompt-box compact-prompt spotlight-box">
              <span className="store-label">Paper Factory spotlight</span>
              <p>{paperFactoryTask.task.summary}</p>
              <p className="catalog-meta"><strong>Best first ask:</strong> {paperFactoryTask.task.sampleAsk}</p>
              <div className="card-actions">
                <button className="primary" disabled={busy || paperFactoryTask.pack.active} onClick={() => void runManagedPackSwitch(paperFactoryTask.pack.id)}>
                  {paperFactoryTask.pack.active ? "Paper Factory active" : "Start Paper Factory mode"}
                </button>
                <button disabled={busy} onClick={() => void copyText(paperFactoryTask.task.sampleAsk, "Paper Factory sample ask copied")}>
                  Copy paper ask
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Start from the task you need right now</h2>
            <p className="subtle">
              Choose a real job to do. We will switch OpenClaw to the matching mode, keep the live skill set small, and give you a prompt to test.
            </p>
          </div>
        </div>
        <div className="card-grid">
          {taskCards.map(({ task, pack }) => (
            <article className={`catalog-card launcher-card ${pack.active ? "catalog-card-active" : ""}`} key={`task-${pack.id}`}>
              <div className="catalog-topline">
                <span className="chip chip-accent">Task-first</span>
                <span className={`chip ${pack.active ? "chip-accent" : ""}`}>{pack.active ? "active now" : "ready"}</span>
              </div>
              <h3>{task.title}</h3>
              <p>{task.summary}</p>
              <p className="catalog-meta"><strong>Switches to:</strong> {pack.name}</p>
              <div className="prompt-box compact-prompt">
                <span className="store-label">Try asking OpenClaw</span>
                <p>{task.sampleAsk}</p>
              </div>
              <div className="card-actions">
                <button className="primary" disabled={busy || pack.active} onClick={() => void runManagedPackSwitch(pack.id)}>
                  {pack.active ? "Current task mode" : "Start this task mode"}
                </button>
                <button disabled={busy} onClick={() => void copyText(task.sampleAsk, `${task.title} sample ask copied`)}>
                  Copy sample ask
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {nextTaskAction ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Do this next</h2>
              <p className="subtle">One focused mode, one restart, one prompt.</p>
            </div>
          </div>
          <div className="next-action-strip">
            <div className="prompt-box compact-prompt">
              <span className="store-label">{nextTaskAction.title}</span>
              <p>{nextTaskAction.body}</p>
              <code className="inline-prompt">{nextTaskAction.prompt}</code>
            </div>
            <div className="next-action-controls">
              <ol className="step-list compact-list">
                <li>{nextTaskAction.isActive ? "Keep the current task mode active." : "Switch to the recommended task mode."}</li>
                <li>Restart OpenClaw once.</li>
                <li>Paste the ask into OpenClaw.</li>
              </ol>
              <div className="card-actions">
                <button
                  className="primary"
                  disabled={busy || nextTaskAction.isActive}
                  onClick={() => void runManagedPackSwitch(nextTaskAction.packId)}
                >
                  {nextTaskAction.buttonLabel}
                </button>
                <button disabled={busy} onClick={() => void copyText(nextTaskAction.prompt, "Next ask copied")}>
                  Copy next ask
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <details className="library-details secondary-library-details" open={setupNeedsAttention}>
          <summary>
            <div>
              <strong>Setup and repair</strong>
              <span className="subtle">
                {setupNeedsAttention
                  ? "Your environment still needs attention before the smoothest OpenClaw flow."
                  : "Everything important looks ready. Open this only if you need to reconnect or repair setup."}
              </span>
            </div>
          </summary>
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
          <div className="grid setup-grid">
            <article className="panel compact-panel">
              <h2>Environment status</h2>
              <div className="stat"><span>Status</span><strong className={setupStatus?.status === "ready" ? "ok" : setupStatus?.status === "blocked" ? "fail" : ""}>{setupStatus?.status ?? "loading"}</strong></div>
              <div className="stat"><span>clawhub</span><strong className={setupStatus?.hasClawhub ? "ok" : "fail"}>{setupStatus?.hasClawhub ? "detected" : "not detected"}</strong></div>
              <div className="stat"><span>OpenClaw config</span><strong className={setupStatus?.hasOpenClawConfig ? "ok" : "fail"}>{setupStatus?.hasOpenClawConfig ? "detected" : "not detected"}</strong></div>
              <div className="stat"><span>Mode</span><strong>{setupStatus?.platformMode ?? "loading"}</strong></div>
            </article>

            <article className="panel compact-panel">
              <h2>{recommendationTitle(setupStatus)}</h2>
              <p className="subtle">{recommendationSummary(setupStatus)}</p>
              <ol className="step-list">{recommendationSteps(setupStatus).map((step) => <li key={step}>{step}</li>)}</ol>
            </article>
          </div>
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
        </details>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Current managed state</h2>
          <div className="mode-status-banner">
            <div>
              <span className="store-label">Now active for this kind of work</span>
              <h3>{modeReadiness.title}</h3>
              <p>{modeReadiness.body}</p>
            </div>
            <span className="mode-status-pill">{modeReadiness.status}</span>
          </div>
          <div className="prompt-box">
            <span className="store-label">{managedLibrary?.currentModeTitle ?? "Current mode: loading"}</span>
            <p>{managedLibrary?.currentModeSummary ?? "Checking the currently active managed mode."}</p>
          </div>
          <div className="dashboard-grid">
            <div className="prompt-box compact-prompt">
              <span className="store-label">{modeRationale.title}</span>
              <p>{modeRationale.body}</p>
              <ul className="mini-points">
                {modeRationale.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </div>
            <div className="prompt-box compact-prompt">
              <span className="store-label">Fast recovery</span>
              <p>
                {previousModeAction
                  ? `If this mode is not the right fit, you can jump back to ${previousModeAction.label.toLowerCase()}.`
                  : "As you switch more modes, this area will keep the last useful state one click away."}
              </p>
              <div className="card-actions">
                <button
                  type="button"
                  disabled={busy || !previousModeAction}
                  onClick={() => previousModeAction ? void reapplyRecentAction(previousModeAction) : undefined}
                >
                  {previousModeAction ? "Switch back to previous mode" : "No previous mode yet"}
                </button>
              </div>
            </div>
          </div>
          <div className="stat"><span>Active skills</span><strong>{managedLibrary?.activeSkillSlugs.length ? managedLibrary.activeSkillSlugs.join(", ") : "none"}</strong></div>
          <div className="stat"><span>Active packs</span><strong>{managedLibrary?.activePackIds.length ? managedLibrary.activePackIds.join(", ") : "none"}</strong></div>
          <div className="stat"><span>Directly enabled skills</span><strong>{managedLibrary?.manualSkillSlugs.length ? managedLibrary.manualSkillSlugs.join(", ") : "none"}</strong></div>
          <div className="stat"><span>Managed path</span><strong>{managedLibrary?.activeSkillsPath ?? "Will appear after first managed activation."}</strong></div>
          <div className="prompt-box">
            <span className="store-label">Activation proof</span>
            <p>
              {managedLibrary
                ? `Lock file ${managedLibrary.lockFileExists ? "detected" : "not detected"} · ${managedLibrary.skillMdCount} active skill folders currently include SKILL.md.`
                : "Checking whether the managed active set is fully present on disk."}
            </p>
          </div>
          <div className="card-actions">
            <button
              type="button"
              disabled={busy || !managedLibrary?.activeSkillsPath}
              onClick={() => void copyText(managedLibrary?.activeSkillsPath ?? "", "Managed path copied")}
            >
              Copy managed path
            </button>
            <button
              type="button"
              disabled={busy || !prompt}
              onClick={() => void copyText(prompt, "OpenClaw test prompt copied")}
            >
              Copy OpenClaw test prompt
            </button>
          </div>
          <div className="prompt-box">
            <span className="store-label">{promptCard.title}</span>
            <p>{promptCard.body}</p>
            <code className="inline-prompt">{promptCard.prompt}</code>
          </div>
          <ol className="step-list compact-list">
            <li>Switch one scenario or mode.</li>
            <li>Restart OpenClaw so it reloads the current active set.</li>
            <li>Paste the prompt above into OpenClaw and confirm it uses the active skill set.</li>
          </ol>
          {managedLibrary?.recentActions.length ? (
            <div className="history-box">
              <span className="store-label">Recent changes</span>
              {managedLibrary.recentActions.map((entry) => (
                <div key={`${entry.at}-${entry.label}`} className="history-entry">
                  <p>
                    {entry.label}
                    {entry.activeSkillSlugs.length > 0 ? ` -> ${entry.activeSkillSlugs.join(", ")}` : ""}
                  </p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => reapplyRecentAction(entry)}
                    disabled={busy}
                  >
                    Apply again
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel">
        <div className="section-head"><div><h2>Mode library</h2><p className="subtle">Recommended path. Enable only the packs OpenClaw should see right now.</p></div></div>
        <div className="scenario-lead">
          <div className="prompt-box">
            <span className="store-label">Current scenario</span>
            <p>
              {currentScenario
                ? `${currentScenario.scenario.title} is active through ${currentScenario.pack.name}.`
                : "No scenario is active yet. Choose one task mode above to keep OpenClaw focused."}
            </p>
          </div>
          <div className="prompt-box">
            <span className="store-label">How the mode library works</span>
            <p>Only the currently active mode is exposed to OpenClaw. You can still browse the full curated library below without dumping it all into the live skill set.</p>
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="prompt-box compact-prompt">
            <span className="store-label">Mode library at a glance</span>
            <p>Keep OpenClaw focused by switching one pack at a time, then only drop into single-skill tools when you need a narrower override.</p>
            <div className="store-stats compact">
              <div>
                <span className="store-label">Managed packs</span>
                <strong>{managedLibrary?.packs.length ?? 0}</strong>
              </div>
              <div>
                <span className="store-label">Managed skills</span>
                <strong>{managedLibrary?.skills.length ?? 0}</strong>
              </div>
              <div>
                <span className="store-label">Active now</span>
                <strong>{managedLibrary?.activeSkillSlugs.length ?? 0}</strong>
              </div>
              <div>
                <span className="store-label">Direct enables</span>
                <strong>{managedLibrary?.manualSkillSlugs.length ?? 0}</strong>
              </div>
            </div>
          </div>
          <div className="prompt-box compact-prompt">
            <span className="store-label">When to use single-skill tools</span>
            <p>Stay in pack mode for most work. Only open the single-skill layer if you want one narrow capability without bringing in a whole pack.</p>
            <ul className="mini-points">
              <li>Packs are better for full working sessions.</li>
              <li>Single-skill mode is better for one exact capability.</li>
              <li>You can always switch back to the previous pack.</li>
            </ul>
          </div>
        </div>
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
              <div className="tag-row">
                {pack.category ? <span className="chip chip-accent">{pack.category}</span> : null}
                {pack.skills.slice(0, 4).map((skill) => <span className="chip" key={skill}>{skill}</span>)}
              </div>
              {pack.audience ? <p className="catalog-meta"><strong>Best for:</strong> {pack.audience}</p> : null}
              {pack.outcome ? <p className="catalog-meta"><strong>Outcome:</strong> {pack.outcome}</p> : null}
              <div className="card-actions">
                <button className="primary" disabled={busy} onClick={() => void runManagedPackSwitch(pack.id)}>Use as current mode</button>
                <button disabled={busy || pack.active} onClick={() => void runManagedPackActivation(pack.id)}>
                  {pack.active ? "Already active" : "Add to current mode"}
                </button>
                {pack.active ? <button disabled={busy} onClick={() => void runManagedPackDeactivation(pack.id)}>Remove pack</button> : null}
              </div>
            </article>
          ))}
          {managedLibrary && filteredManagedPacks.length === 0 ? <p className="subtle">No managed packs match the current filter.</p> : null}
          {!managedLibrary ? <p className="subtle">Loading managed library...</p> : null}
        </div>
      </section>

      <section className="panel">
        <details className="library-details">
          <summary>
            <strong>Single-skill tools</strong>
            <span className="subtle">Use this when you want one skill at a time instead of a full pack.</span>
          </summary>
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
                  <button className="primary" disabled={busy} onClick={() => void runManagedSkillSwitch(skill.slug)}>Use this skill only</button>
                  <button disabled={busy || skill.active} onClick={() => void runManagedSkillActivation(skill.slug)}>
                    {skill.active ? "Already active" : "Add this skill"}
                  </button>
                  {skill.activationSource === "manual" || skill.activationSource === "both"
                    ? <button disabled={busy} onClick={() => void runManagedSkillDeactivation(skill.slug)}>Remove direct enable</button>
                    : null}
                </div>
              </article>
            ))}
            {managedLibrary && filteredManagedSkills.length === 0 ? <p className="subtle">No managed skills match the current filter.</p> : null}
            {!managedLibrary ? <p className="subtle">Loading managed library...</p> : null}
          </div>
        </details>
      </section>

      <section className="panel">
        <details className="library-details secondary-library-details">
          <summary>
            <div>
              <strong>Starter online installs</strong>
              <span className="subtle">Registry-backed starter flows remain available as an advanced option.</span>
            </div>
          </summary>
          <div className="card-grid">
            {featuredPacks.map((pack) => (
              <article className="catalog-card" key={pack.id}>
                <div className="catalog-topline"><span className="chip chip-accent">{pack.category ?? (pack.id === "demo-safe" ? "Starter" : pack.id)}</span><span className="subtle">{pack.skills.length} skills</span></div>
                <h3>{pack.name}</h3>
                <p>{pack.description}</p>
                <p className="catalog-meta"><strong>Best for:</strong> {pack.audience ?? "Users who want to extend OpenClaw quickly."}</p>
                <p className="catalog-meta"><strong>Outcome:</strong> {pack.outcome ?? pack.description}</p>
                <div className="card-actions">
                  {pack.id === "demo-safe"
                    ? <button className="primary" disabled={busy} onClick={() => void runAttach("demo-safe")}>Install and attach</button>
                    : <button className="primary" disabled={busy} onClick={() => void runPackInstall(pack)}>Install starter pack</button>}
                </div>
              </article>
            ))}
          </div>
        </details>
      </section>

      <section className="panel">
        <details className="library-details secondary-library-details">
          <summary>
            <div>
              <strong>Representative catalog skills</strong>
              <span className="subtle">A quick view of what exists in the catalog beyond the default starter path.</span>
            </div>
          </summary>
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
        </details>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Latest action details</h2>
            <p className="subtle">This keeps the last activation, result, and troubleshooting details in one place.</p>
          </div>
        </div>
        <div className="grid latest-action-grid">
          <article className="latest-action-card">
            <h3>Progress</h3>
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
                <p>Managed library mode was {managedActionNoun(managedResult.mode)}.</p>
                <p>Active skills: {managedResult.activeSkillSlugs.length > 0 ? managedResult.activeSkillSlugs.join(", ") : "none"}</p>
                <p>Verify result: {managedResult.success ? "passed" : "failed"}</p>
              </div>
            ) : (
              <p className="subtle">Run any action and this area will show the current progress.</p>
            )}
          </article>

          <article className="latest-action-card">
            <h3>Result</h3>
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

          <article className="latest-action-card">
            <h3>If something failed</h3>
            {failureTitle || failureBody ? (
              <>
                <p><strong>{failureTitle}</strong></p>
                <p>{failureBody}</p>
              </>
            ) : (
              <p className="subtle">Failure guidance only appears when you actually need to do something.</p>
            )}
          </article>
        </div>
        <div className="latest-action-footer">
          {advancedPayload ? (
            <details>
              <summary>Show raw result payload</summary>
              <pre>{JSON.stringify(advancedPayload, null, 2)}</pre>
            </details>
          ) : (
            <p className="subtle">Raw details stay folded away until they are needed.</p>
          )}
        </div>
      </section>
    </main>
  );
}
