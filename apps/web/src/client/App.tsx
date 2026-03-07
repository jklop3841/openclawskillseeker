import { useEffect, useState } from "react";
import type { AppState, AttachFlowResult, Catalog, DoctorReport } from "@openclaw-skill-center/shared";
import { ExoskeletonMascot } from "./ExoskeletonMascot.js";

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

  async function rollbackLatest() {
    const latest = state?.snapshots.at(-1);
    if (!latest) {
      setMessage("No rollback snapshot is available yet.");
      return;
    }

    setBusy(true);
    try {
      await getJson("/api/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: latest.id })
      });
      setAttachResult(null);
      setMessage("Last attach was rolled back. Refresh OpenClaw after checking the result.");
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
  const environmentStatus = !doctor
    ? "loading"
    : !doctor.clawhubFound
      ? "blocked"
      : doctor.checks.every((check) => check.ok)
        ? "ready"
        : "needs attention";
  const statusLabel =
    environmentStatus === "ready"
      ? "已就绪"
      : environmentStatus === "blocked"
        ? "阻塞"
        : environmentStatus === "needs attention"
          ? "需处理"
          : "检测中";

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">OpenClaw机械外骨骼</p>
          <h1>给 OpenClaw 穿上一层真正可用的机械外骨骼。</h1>
          <p className="subtle lead">
            这是面向普通用户的技能任务中心。你不需要理解路径、配置或命令行，只需要点一次，
            系统就会自动完成检测、安装、接入与验证。
          </p>
          <div className="hero-points">
            <span>白名单优先</span>
            <span>隔离安装</span>
            <span>自动接入</span>
            <span>落盘验证</span>
          </div>
          <div className="hero-brand">
            <div className="hot-badge">HOT!</div>
            <div>
              <p className="brand-title">OpenClaw</p>
              <p className="brand-subtitle">机械外骨骼任务中心</p>
              <p className="brand-copy">让 OpenClaw 真正装得上、接得进、验得到。</p>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <ExoskeletonMascot />
        </div>

        <div className="hero-action-card">
          <h2>推荐动作</h2>
          <p>主入口是经过验证的 `calendar`，适合直接演示和交付给测试用户。</p>
          <button className="primary" disabled={busy} onClick={() => void runAttach("calendar")}>
            {busy ? "执行中..." : "一键安装并接入 Calendar"}
          </button>
          <button disabled={busy} onClick={() => void runAttach("demo-safe")}>
            {busy ? "执行中..." : "安装 demo-safe 演示包"}
          </button>
          <button disabled={busy} onClick={() => void rollbackLatest()}>
            撤销上次接入
          </button>
          <p className="subtle small">执行结束后，这里会直接告诉用户是否需要重启 OpenClaw。</p>
        </div>
      </section>

      {message ? <section className="banner">{message}</section> : null}

      <section className="grid">
        <article className="panel">
          <h2>环境状态</h2>
          <div className="stat">
            <span>状态</span>
            <strong className={environmentStatus === "ready" ? "ok" : environmentStatus === "blocked" ? "fail" : ""}>
              {statusLabel}
            </strong>
          </div>
          <div className="stat">
            <span>clawhub</span>
            <strong className={doctor?.clawhubFound ? "ok" : "fail"}>{doctor?.clawhubFound ? "已就绪" : "缺失"}</strong>
          </div>
          <div className="stat">
            <span>OpenClaw 配置</span>
            <strong>{doctor?.openClawConfigPath ?? "Loading..."}</strong>
          </div>
          <div className="stat">
            <span>模式</span>
            <strong>{attachResult?.environmentMode ?? doctor?.platform ?? "..."}</strong>
          </div>
        </article>

        <article className="panel">
          <h2>演示包</h2>
          <div className="pack-card">
            <strong>{demoPack?.name ?? "Demo Safe Pack"}</strong>
            <p>{demoPack?.description ?? "用于演示的最小安全包。"}</p>
            <p className="subtle">{demoPack?.skills.join(", ") ?? "calendar"}</p>
          </div>
        </article>

        <article className="panel">
          <h2>当前接入</h2>
          {installedCalendar || installedDemoPack ? (
            <>
              {installedCalendar ? (
                <div className="stat">
                  <span>Calendar 技能</span>
                  <strong>{installedCalendar.skillsDir}</strong>
                </div>
              ) : null}
              {installedDemoPack ? (
                <div className="stat">
                  <span>demo-safe 包</span>
                  <strong>{installedDemoPack.skillsDir}</strong>
                </div>
              ) : null}
            </>
          ) : (
            <p className="subtle">当前还没有检测到已接入的安全技能。</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>执行进度</h2>
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
          <p className="subtle">点击一键接入后，这里会展示 detect、install、attach、verify 四个阶段。</p>
        )}
      </section>

      <section className="grid">
        <article className="panel">
          <h2>用户结果</h2>
          {attachResult ? (
            <div className="summary-list">
              {attachResult.userSummary.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                下一步：<strong>{attachResult.nextStep}</strong>
              </p>
            </div>
          ) : (
            <p className="subtle">安装完成后，这里会用普通用户能看懂的话说明结果。</p>
          )}
        </article>

        <article className="panel">
          <h2>失败时怎么处理</h2>
          {attachResult?.failureCategory ? (
            <>
              <p>{failureHint(attachResult)}</p>
              <p className="subtle">{attachResult.failureMessage}</p>
            </>
          ) : (
            <p className="subtle">只有需要用户处理时，这里才会显示失败解释和建议动作。</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>高级信息</h2>
        {attachResult ? (
          <details>
            <summary>显示原始结果</summary>
            <pre>{JSON.stringify(attachResult, null, 2)}</pre>
          </details>
        ) : (
          <p className="subtle">技术细节默认折叠，不会打扰普通用户。</p>
        )}
      </section>
    </main>
  );
}
