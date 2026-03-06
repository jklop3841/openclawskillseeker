import { useEffect, useState } from "react";
import type { AppState, AttachFlowResult, Catalog, DoctorReport } from "@openclaw-skill-center/shared";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }

  return body as T;
}

function failureHint(result: AttachFlowResult | null) {
  switch (result?.failureCategory) {
    case "clawhub-not-found":
      return "OpenClaw Skill Center could not find clawhub. Install the official clawhub CLI first.";
    case "suspicious-skipped":
      return "The requested skill was marked suspicious and was skipped by default policy.";
    case "verify-failed":
      return "The install returned, but the expected skill files were not verified on disk.";
    case "install-retriable":
      return "The upstream registry was reachable, but asked us to retry later.";
    case "install-failed":
      return "The upstream install failed with a permanent error.";
    case "attach-failed":
      return "The skill installed, but OpenClaw config could not be updated.";
    default:
      return "";
  }
}

export function App() {
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [attachResult, setAttachResult] = useState<AttachFlowResult | null>(null);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [doctorData, catalogData, stateData] = await Promise.all([
      getJson<DoctorReport>("/api/doctor"),
      getJson<Catalog>("/api/catalog"),
      getJson<AppState>("/api/state")
    ]);
    setDoctor(doctorData);
    setCatalog(catalogData);
    setState(stateData);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);

  async function runAttach(kind: "calendar" | "demo-safe") {
    setBusy(true);
    setMessage("");
    try {
      const result = await getJson<AttachFlowResult>(`/api/attach/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setAttachResult(result);
      setMessage(result.success ? "Connected successfully. Restart OpenClaw to use the new skill." : result.nextStep);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const demoPack = catalog?.packs.find((pack) => pack.id === "demo-safe");
  const installedCalendar = state?.installedPacks.find((pack) => pack.packId === "skill:calendar");
  const installedDemoPack = state?.installedPacks.find((pack) => pack.packId === "demo-safe");

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">OpenClaw Skill Center</p>
          <h1>One-click skill attach for OpenClaw.</h1>
          <p className="subtle lead">
            This task center hides the path work, config patching, and verification details. Choose a safe install target,
            click once, and let the sidecar handle the rest.
          </p>
          <div className="hero-points">
            <span>whitelist-first</span>
            <span>isolated install</span>
            <span>auto attach</span>
            <span>file verification</span>
          </div>
        </div>

        <div className="hero-action-card">
          <h2>Recommended action</h2>
          <p>Primary entry: install and attach the verified `calendar` skill.</p>
          <button className="primary" disabled={busy} onClick={() => void runAttach("calendar")}>
            {busy ? "Working..." : "Install and attach Calendar"}
          </button>
          <button disabled={busy} onClick={() => void runAttach("demo-safe")}>
            {busy ? "Working..." : "Install demo-safe pack"}
          </button>
          <p className="subtle small">When the flow finishes, this page tells the user whether a restart is needed.</p>
        </div>
      </section>

      {message ? <section className="banner">{message}</section> : null}

      <section className="grid">
        <article className="panel">
          <h2>Environment</h2>
          <div className="stat">
            <span>clawhub</span>
            <strong className={doctor?.clawhubFound ? "ok" : "fail"}>{doctor?.clawhubFound ? "Ready" : "Missing"}</strong>
          </div>
          <div className="stat">
            <span>OpenClaw config</span>
            <strong>{doctor?.openClawConfigPath ?? "Loading..."}</strong>
          </div>
          <div className="stat">
            <span>Mode</span>
            <strong>{attachResult?.environmentMode ?? doctor?.platform ?? "..."}</strong>
          </div>
        </article>

        <article className="panel">
          <h2>Recommended pack</h2>
          <div className="pack-card">
            <strong>{demoPack?.name ?? "Demo Safe Pack"}</strong>
            <p>{demoPack?.description ?? "Minimal verified pack for demos."}</p>
            <p className="subtle">{demoPack?.skills.join(", ") ?? "calendar"}</p>
          </div>
        </article>

        <article className="panel">
          <h2>Current state</h2>
          {installedCalendar || installedDemoPack ? (
            <>
              {installedCalendar ? (
                <div className="stat">
                  <span>Calendar skill</span>
                  <strong>{installedCalendar.skillsDir}</strong>
                </div>
              ) : null}
              {installedDemoPack ? (
                <div className="stat">
                  <span>demo-safe pack</span>
                  <strong>{installedDemoPack.skillsDir}</strong>
                </div>
              ) : null}
            </>
          ) : (
            <p className="subtle">No attached safe skill has been detected yet.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Progress</h2>
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
        ) : (
          <p className="subtle">Stages appear here after the one-click flow starts.</p>
        )}
      </section>

      <section className="grid">
        <article className="panel">
          <h2>User result</h2>
          {attachResult ? (
            <div className="summary-list">
              {attachResult.userSummary.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                Next step: <strong>{attachResult.nextStep}</strong>
              </p>
            </div>
          ) : (
            <p className="subtle">After installation, this card explains the result in plain language.</p>
          )}
        </article>

        <article className="panel">
          <h2>If it fails</h2>
          {attachResult?.failureCategory ? (
            <>
              <p>{failureHint(attachResult)}</p>
              <p className="subtle">{attachResult.failureMessage}</p>
            </>
          ) : (
            <p className="subtle">Failure guidance appears here only when the flow needs user action.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Advanced details</h2>
        {attachResult ? (
          <details>
            <summary>Show raw result</summary>
            <pre>{JSON.stringify(attachResult, null, 2)}</pre>
          </details>
        ) : (
          <p className="subtle">Raw technical output stays hidden unless someone opens advanced details.</p>
        )}
      </section>
    </main>
  );
}
