import { useEffect, useMemo, useState } from "react";
import type {
  AppState,
  AttachFlowResult,
  Catalog,
  CatalogPack,
  CatalogSkill,
  DoctorReport,
  InstallExecutionReport
} from "@openclaw-skill-center/shared";
import { ExoskeletonMascot } from "./ExoskeletonMascot.js";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }

  return body as T;
}

const featuredPackIds = ["demo-safe", "knowledge-work", "delivery-engine", "business-ops"] as const;
const featuredSkillSlugs = [
  "calendar",
  "research-first-decider",
  "product-brief-writer",
  "doc-systematizer",
  "meeting-note-synthesizer",
  "bug-triage-investigator",
  "release-readiness-checker",
  "customer-support-replier",
  "ops-runbook-copilot",
  "repo-triage-coordinator"
] as const;

const packAudience: Record<string, string> = {
  "demo-safe": "适合第一次试装和演示验证",
  "knowledge-work": "适合创始人、运营和知识工作者",
  "delivery-engine": "适合产品、研发和交付团队",
  "business-ops": "适合客服、运维和业务协同"
};

const packOutcome: Record<string, string> = {
  "demo-safe": "帮你快速验证 OpenClaw 是否能完成一条稳定接入链路。",
  "knowledge-work": "帮你更快做研究、写简报、整理文档、沉淀会议结论。",
  "delivery-engine": "帮你梳理 bug、把关发布、推进执行和排 backlog。",
  "business-ops": "帮你更快回复客户、沉淀 runbook、提升跨团队协作效率。"
};

const packTier: Record<string, string> = {
  "demo-safe": "Recommended",
  "knowledge-work": "Work Suite",
  "delivery-engine": "Shipping Suite",
  "business-ops": "Ops Suite"
};

function failureHint(result: AttachFlowResult | null) {
  switch (result?.failureCategory) {
    case "clawhub-not-found":
      return "系统没找到官方 clawhub 安装器，请先把 clawhub 装好。";
    case "suspicious-skipped":
      return "这个技能被上游标记为高风险，所以默认没有继续安装。";
    case "verify-failed":
      return "安装命令已经返回，但系统没有在预期位置验证到完整技能文件。";
    case "install-retriable":
      return "上游仓库当前限流，系统已经重试过，建议稍后再试。";
    case "install-failed":
      return "安装过程遇到了永久性错误，需要检查具体技能或环境。";
    case "attach-failed":
      return "技能可能已经安装，但 OpenClaw 配置还没有成功写入。";
    default:
      return "";
  }
}

function sourceLabel(skill: CatalogSkill) {
  if (skill.sourceType === "local") {
    return "local curated";
  }

  if (skill.trustLevel === "official") {
    return "official registry";
  }

  return "registry";
}

function trustLabel(skill: CatalogSkill) {
  switch (skill.trustLevel) {
    case "official":
      return "官方";
    case "curated":
      return "精选";
    case "community":
      return "社区";
    default:
      return "未知";
  }
}

function summarizeInstall(pack: CatalogPack, report: InstallExecutionReport) {
  const lines = [
    `已处理 ${pack.name}。`,
    `已安装 ${report.installed.length} 个技能。`,
    `已跳过 ${report.skipped.length} 个技能。`,
    `可重试失败 ${report.failedRetriable.length} 个，永久失败 ${report.failedPermanent.length} 个。`
  ];

  if (report.installed.length > 0) {
    lines.push("已尝试把这个能力包接入 OpenClaw，建议现在重启 OpenClaw。");
  }

  return lines;
}

export function App() {
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [attachResult, setAttachResult] = useState<AttachFlowResult | null>(null);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [resultLines, setResultLines] = useState<string[]>([]);
  const [nextStep, setNextStep] = useState<string>("");
  const [advancedPayload, setAdvancedPayload] = useState<unknown>(null);
  const [actionLabel, setActionLabel] = useState<string>("尚未执行");
  const [failureTitle, setFailureTitle] = useState<string>("");
  const [failureBody, setFailureBody] = useState<string>("");

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
    setActionLabel(kind === "calendar" ? "安装并接入 Calendar" : "安装并接入 demo-safe");

    try {
      const result = await getJson<AttachFlowResult>(`/api/attach/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      setAttachResult(result);
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle(result.failureCategory ? "需要处理" : "");
      setFailureBody(result.failureCategory ? `${failureHint(result)} ${result.failureMessage ?? ""}`.trim() : "");
      setMessage(result.success ? "已完成接入。重启 OpenClaw 后就可以开始使用。" : result.nextStep);
      await refresh();
    } catch (error) {
      setFailureTitle("请求失败");
      setFailureBody(error instanceof Error ? error.message : String(error));
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function runPackInstall(pack: CatalogPack) {
    setBusy(true);
    setMessage("");
    setAttachResult(null);
    setActionLabel(`安装能力包: ${pack.name}`);

    try {
      const result = await getJson<{
        packId: string;
        installReport: InstallExecutionReport;
        reportPath: string;
      }>(`/api/packs/${pack.id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patchConfig: true })
      });
      setAdvancedPayload(result);
      setResultLines(summarizeInstall(pack, result.installReport));
      setNextStep("如果已经安装成功，请重启 OpenClaw 让新能力包生效。");
      setFailureTitle(
        result.installReport.failedPermanent.length > 0 || result.installReport.failedRetriable.length > 0
          ? "安装结果包含异常"
          : ""
      );
      setFailureBody(
        result.installReport.failedPermanent.length > 0 || result.installReport.failedRetriable.length > 0
          ? "有部分技能未完成安装，请展开高级信息查看明细。"
          : ""
      );
      setMessage(`已完成 ${pack.name} 的安装流程。`);
      await refresh();
    } catch (error) {
      setFailureTitle("能力包安装失败");
      setFailureBody(error instanceof Error ? error.message : String(error));
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function rollbackLatest() {
    const latest = state?.snapshots.at(-1);
    if (!latest) {
      setMessage("当前还没有可回滚的快照。");
      return;
    }

    setBusy(true);
    setActionLabel("撤销上次接入");
    try {
      const result = await getJson("/api/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: latest.id })
      });
      setAttachResult(null);
      setAdvancedPayload(result);
      setResultLines(["已执行撤销。", "请检查 OpenClaw 当前加载状态。"]);
      setNextStep("如果 OpenClaw 正在运行，请重启一次。");
      setFailureTitle("");
      setFailureBody("");
      setMessage("上次接入已撤销。");
      await refresh();
    } catch (error) {
      setFailureTitle("撤销失败");
      setFailureBody(error instanceof Error ? error.message : String(error));
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const environmentStatus = !doctor
    ? "loading"
    : !doctor.clawhubFound
      ? "blocked"
      : doctor.checks.every((check) => check.ok)
        ? "ready"
        : "needs attention";

  const statusLabel =
    environmentStatus === "ready"
      ? "ready"
      : environmentStatus === "blocked"
        ? "blocked"
        : environmentStatus === "needs attention"
          ? "needs attention"
          : "loading";

  const featuredPacks = useMemo(
    () => featuredPackIds.map((id) => catalog?.packs.find((pack) => pack.id === id)).filter(Boolean) as CatalogPack[],
    [catalog]
  );

  const curatedSkills = useMemo(
    () =>
      featuredSkillSlugs
        .map((slug) => catalog?.skills.find((skill) => skill.slug === slug))
        .filter(Boolean) as CatalogSkill[],
    [catalog]
  );

  const installedSummary = state?.installedPacks ?? [];

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">OpenClaw机械外骨骼</p>
          <h1>给 OpenClaw 装上一层真正能干活的精选能力包。</h1>
          <p className="subtle lead">
            这不是另一个 OpenClaw，而是面向 OpenClaw 的精选技能发行与增强层。你不需要理解路径、
            extraDirs、SKILL.md 或命令行，只要点一次，系统就会自动完成检测、安装、接入和验证。
          </p>
          <div className="hero-points">
            <span>whitelist-first</span>
            <span>隔离安装</span>
            <span>自动接入</span>
            <span>落盘验证</span>
          </div>
          <div className="hero-brand">
            <div className="hot-badge">HOT!</div>
            <div>
              <p className="brand-title">OpenClaw</p>
              <p className="brand-subtitle">机械外骨骼任务中心</p>
              <p className="brand-copy">把开放技能生态变成可安装、可接入、可验证的增强系统。</p>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <ExoskeletonMascot />
        </div>

        <div className="hero-action-card">
          <h2>主入口</h2>
          <p>如果你只想先验证一条最稳的链路，先装 Calendar。它是当前最稳定的单技能演示对象。</p>
          <button className="primary" disabled={busy} onClick={() => void runAttach("calendar")}>
            {busy ? "执行中..." : "Install and attach Calendar"}
          </button>
          <button disabled={busy} onClick={() => void runAttach("demo-safe")}>
            {busy ? "执行中..." : "Install demo-safe"}
          </button>
          <button disabled={busy} onClick={() => void rollbackLatest()}>
            Undo last attach
          </button>
          <p className="subtle small">安装完成后，这里会明确告诉你是否需要重启 OpenClaw。</p>
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
            <span>环境模式</span>
            <strong>{attachResult?.environmentMode ?? doctor?.platform ?? "..."}</strong>
          </div>
        </article>

        <article className="panel">
          <h2>当前接入</h2>
          {installedSummary.length > 0 ? (
            installedSummary.map((pack) => (
              <div className="stat" key={`${pack.packId}-${pack.installedAt}`}>
                <span>{pack.packId}</span>
                <strong>{pack.skillsDir}</strong>
              </div>
            ))
          ) : (
            <p className="subtle">当前还没有检测到已接入的精选能力包。</p>
          )}
        </article>

        <article className="panel">
          <h2>最近动作</h2>
          <div className="stat">
            <span>动作</span>
            <strong>{actionLabel}</strong>
          </div>
          <div className="stat">
            <span>下一步</span>
            <strong>{nextStep || "等待你点击安装。"}</strong>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>精选能力包</h2>
            <p className="subtle">不要一口气塞几百个技能。先用按场景组织的能力包，把 OpenClaw 提升到中等以上干活水平。</p>
          </div>
        </div>
        <div className="card-grid">
          {featuredPacks.map((pack) => (
            <article className="catalog-card" key={pack.id}>
              <div className="catalog-topline">
                <span className="chip chip-accent">{packTier[pack.id] ?? "Pack"}</span>
                <span className="subtle">{pack.skills.length} skills</span>
              </div>
              <h3>{pack.name}</h3>
              <p>{pack.description}</p>
              <p className="catalog-meta"><strong>适合谁：</strong>{packAudience[pack.id] ?? "适合需要快速增强 OpenClaw 的用户"}</p>
              <p className="catalog-meta"><strong>能帮你做什么：</strong>{packOutcome[pack.id] ?? pack.description}</p>
              <div className="store-stats">
                <div>
                  <span className="store-label">评级</span>
                  <strong>精选</strong>
                </div>
                <div>
                  <span className="store-label">接入方式</span>
                  <strong>{pack.patchOpenClawConfig ? "自动接入" : "仅安装"}</strong>
                </div>
              </div>
              <div className="tag-row">
                {pack.skills.slice(0, 4).map((skill) => (
                  <span className="chip" key={skill}>{skill}</span>
                ))}
              </div>
              <div className="card-actions">
                {pack.id === "demo-safe" ? (
                  <button className="primary" disabled={busy} onClick={() => void runAttach("demo-safe")}>
                    一键安装并接入
                  </button>
                ) : (
                  <button className="primary" disabled={busy} onClick={() => void runPackInstall(pack)}>
                    安装这个能力包
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>精选技能</h2>
            <p className="subtle">这些是当前已经进入 catalog 的代表性技能。主文案面向用途，而不是让用户直接记 slug。</p>
          </div>
        </div>
        <div className="card-grid">
          {curatedSkills.map((skill) => (
            <article className="catalog-card skill-card" key={skill.slug}>
              <div className="catalog-topline">
                <span className={`chip ${skill.sourceType === "local" ? "chip-local" : ""}`}>{sourceLabel(skill)}</span>
                <span className="subtle">{trustLabel(skill)}</span>
              </div>
              <h3>{skill.name}</h3>
              <p>{skill.description}</p>
              <div className="store-stats compact">
                <div>
                  <span className="store-label">来源</span>
                  <strong>{skill.curated ? "精选收录" : "开放来源"}</strong>
                </div>
                <div>
                  <span className="store-label">价格</span>
                  <strong>{skill.free ? "Free" : "Paid"}</strong>
                </div>
              </div>
              <div className="tag-row">
                {skill.tags.slice(0, 4).map((tag) => (
                  <span className="chip" key={tag}>{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
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
          <p className="subtle">点击主入口后，这里会显示 detect、install、attach、verify 四个阶段。</p>
        )}
      </section>

      <section className="grid">
        <article className="panel">
          <h2>用户结果</h2>
          {resultLines.length > 0 ? (
            <div className="summary-list">
              {resultLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                下一步：<strong>{nextStep}</strong>
              </p>
            </div>
          ) : (
            <p className="subtle">安装完成后，这里会用普通用户能看懂的话说明结果。</p>
          )}
        </article>

        <article className="panel">
          <h2>失败时怎么处理</h2>
          {failureTitle || failureBody ? (
            <>
              {failureTitle ? <p><strong>{failureTitle}</strong></p> : null}
              {failureBody ? <p>{failureBody}</p> : null}
            </>
          ) : (
            <p className="subtle">只有真的需要用户处理时，这里才会显示失败解释和建议动作。</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>高级信息</h2>
        {advancedPayload ? (
          <details>
            <summary>显示原始结果</summary>
            <pre>{JSON.stringify(advancedPayload, null, 2)}</pre>
          </details>
        ) : (
          <p className="subtle">技术细节默认折叠，不打扰普通用户。</p>
        )}
      </section>
    </main>
  );
}
