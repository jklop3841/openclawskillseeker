import { useEffect, useState } from "react";
import type { AppState, Catalog, DoctorReport } from "@openclaw-skill-center/shared";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }

  return body as T;
}

export function App() {
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<AppState | null>(null);
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

  async function installPack(packId: string) {
    setBusy(true);
    try {
      const result = await getJson<{ reportPath: string }>(`/api/packs/${packId}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patchConfig: true })
      });
      setMessage(`Installed ${packId}. Report: ${result.reportPath}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateSkills() {
    setBusy(true);
    try {
      const result = await getJson<{ reportPath: string }>("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setMessage(`Updated curated skills. Report: ${result.reportPath}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function rollbackLatest() {
    const latest = state?.snapshots.at(-1);
    if (!latest) {
      setMessage("No snapshots available.");
      return;
    }

    setBusy(true);
    try {
      const result = await getJson<{ reportPath: string }>("/api/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: latest.id })
      });
      setMessage(`Rolled back ${latest.id}. Report: ${result.reportPath}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">OpenClaw Skill Center</p>
        <h1>Curated local skill management without touching OpenClaw core.</h1>
        <p className="subtle">
          Sidecar UI for doctor checks, whitelisted installs, rollback snapshots, and config patching.
        </p>
        <div className="actions">
          <button disabled={busy} onClick={() => void refresh()}>
            Refresh
          </button>
          <button disabled={busy} onClick={() => void updateSkills()}>
            Update installed
          </button>
          <button disabled={busy} onClick={() => void rollbackLatest()}>
            Roll back latest
          </button>
        </div>
        {message ? <p className="message">{message}</p> : null}
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Doctor</h2>
          {doctor?.checks.map((check) => (
            <div className="row" key={check.name}>
              <strong>{check.name}</strong>
              <span className={check.ok ? "ok" : "fail"}>{check.summary}</span>
            </div>
          ))}
        </article>

        <article className="panel">
          <h2>Installed packs</h2>
          {state?.installedPacks.length ? (
            state.installedPacks.map((pack) => (
              <div className="row" key={pack.packId}>
                <strong>{pack.packId}</strong>
                <span>{pack.slugs.join(", ")}</span>
              </div>
            ))
          ) : (
            <p className="subtle">No curated packs installed yet.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Curated packs</h2>
        <div className="packs">
          {catalog?.packs.map((pack) => (
            <article className="pack" key={pack.id}>
              <h3>{pack.name}</h3>
              <p>{pack.description}</p>
              <p className="subtle">{pack.skills.join(", ")}</p>
              <button disabled={busy} onClick={() => void installPack(pack.id)}>
                Install {pack.id}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Snapshots</h2>
        {state?.snapshots.length ? (
          state.snapshots
            .slice()
            .reverse()
            .map((snapshot) => (
              <div className="row" key={snapshot.id}>
                <strong>{snapshot.operation}</strong>
                <span>{snapshot.id}</span>
              </div>
            ))
        ) : (
          <p className="subtle">No snapshots recorded yet.</p>
        )}
      </section>
    </main>
  );
}
