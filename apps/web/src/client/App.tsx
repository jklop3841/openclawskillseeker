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

  async function attachCalendar() {
    setBusy(true);
    setMessage("");
    try {
      const result = await getJson<AttachFlowResult>("/api/attach/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setAttachResult(result);
      setMessage(result.success ? "Calendar 已接入 OpenClaw。重启 OpenClaw 后可用。" : result.nextStep);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const demoPack = catalog?.packs.find((pack) => pack.id === "demo-safe");
  const installedCalendar = state?.installedPacks.find((pack) => pack.packId === "skill:calendar");

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">OpenClaw Skill Center</p>
          <h1>一键把安全技能接到 OpenClaw，不改本体。</h1>
          <p className="subtle lead">
            这是给普通用户用的任务中心。你不用管路径、配置文件或 `SKILL.md`。点击按钮后，系统会自动验证、
            安装、接入并检查 `calendar` 技能。
          </p>
          <div className="hero-points">
            <span>whitelist-first</span>
            <span>隔离目录安装</span>
            <span>自动接入 OpenClaw</span>
            <span>真实文件校验</span>
          </div>
        </div>

        <div className="hero-action-card">
          <h2>黄金路径</h2>
          <p>推荐演示对象：`calendar`</p>
          <button className="primary" disabled={busy} onClick={() => void attachCalendar()}>
            {busy ? "正在安装并接入..." : "一键安装并接入 Calendar"}
          </button>
          <p className="subtle small">成功后只需要重启 OpenClaw，然后直接让它使用 calendar skill。</p>
        </div>
      </section>

      {message ? <section className="banner">{message}</section> : null}

      <section className="grid">
        <article className="panel">
          <h2>环境状态</h2>
          <div className="stat">
            <span>clawhub</span>
            <strong className={doctor?.clawhubFound ? "ok" : "fail"}>
              {doctor?.clawhubFound ? "已找到" : "未找到"}
            </strong>
          </div>
          <div className="stat">
            <span>OpenClaw 配置</span>
            <strong>{doctor?.openClawConfigPath ?? "加载中..."}</strong>
          </div>
          <div className="stat">
            <span>调用模式</span>
            <strong>{doctor?.clawhubResolutionMode ?? "..."}</strong>
          </div>
        </article>

        <article className="panel">
          <h2>推荐包</h2>
          <div className="pack-card">
            <strong>{demoPack?.name ?? "Demo Safe Pack"}</strong>
            <p>{demoPack?.description ?? "最小可演示包，只包含已验证技能。"}</p>
            <p className="subtle">{demoPack?.skills.join(", ") ?? "calendar"}</p>
          </div>
        </article>

        <article className="panel">
          <h2>当前接入情况</h2>
          {installedCalendar ? (
            <>
              <div className="stat">
                <span>Pack ID</span>
                <strong>{installedCalendar.packId}</strong>
              </div>
              <div className="stat">
                <span>技能目录</span>
                <strong>{installedCalendar.skillsDir}</strong>
              </div>
            </>
          ) : (
            <p className="subtle">还没有检测到已接入的 calendar skill。</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>用户可读结果</h2>
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
          <p className="subtle">点击“一键安装并接入 Calendar”后，这里会显示用户可读结果。</p>
        )}
      </section>

      <section className="grid">
        <article className="panel">
          <h2>安装结果</h2>
          {attachResult ? (
            <>
              <div className="stat">
                <span>Installed</span>
                <strong>{attachResult.installReport.installed.map((entry) => entry.slug).join(", ") || "none"}</strong>
              </div>
              <div className="stat">
                <span>Skipped</span>
                <strong>{attachResult.installReport.skipped.length}</strong>
              </div>
              <div className="stat">
                <span>Retriable</span>
                <strong>{attachResult.installReport.failedRetriable.length}</strong>
              </div>
              <div className="stat">
                <span>Permanent</span>
                <strong>{attachResult.installReport.failedPermanent.length}</strong>
              </div>
            </>
          ) : (
            <p className="subtle">暂无安装结果。</p>
          )}
        </article>

        <article className="panel">
          <h2>验证证据</h2>
          {attachResult ? (
            <>
              <div className="stat">
                <span>lock.json</span>
                <strong className={attachResult.verify.lockFileExists ? "ok" : "fail"}>
                  {attachResult.verify.lockFileExists ? "已找到" : "未找到"}
                </strong>
              </div>
              {attachResult.verify.skillDetails?.map((detail) => (
                <div className="evidence" key={detail.slug}>
                  <strong>{detail.slug}</strong>
                  <span>SKILL.md: {detail.skillMdExists ? "yes" : "no"}</span>
                  <span>origin.json: {detail.originJsonExists ? "yes" : "no"}</span>
                </div>
              ))}
            </>
          ) : (
            <p className="subtle">暂无验证证据。</p>
          )}
        </article>
      </section>
    </main>
  );
}
