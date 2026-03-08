import { useEffect, useMemo, useState } from "react";
import type {
  AppState,
  AttachFlowResult,
  Catalog,
  CatalogPack,
  CatalogSkill,
  DoctorCheck,
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
  "demo-safe": "第一次试装和演示验证",
  "knowledge-work": "创始人、运营、研究和文档工作者",
  "delivery-engine": "产品、研发和交付团队",
  "business-ops": "客服、运维和业务协同岗位"
};

const packOutcome: Record<string, string> = {
  "demo-safe": "快速验证 OpenClaw 是否已经具备一条稳定可用的技能接入链路。",
  "knowledge-work": "整理信息、写简报、沉淀会议结论、形成结构化文档。",
  "delivery-engine": "梳理 bug、推进发布、整理执行事项和 backlog。",
  "business-ops": "沉淀 runbook、统一客服回复、提升跨团队协作效率。"
};

const packTier: Record<string, string> = {
  "demo-safe": "Recommended",
  "knowledge-work": "Work Suite",
  "delivery-engine": "Shipping Suite",
  "business-ops": "Ops Suite"
};

type EnvironmentStatus = "ready" | "needs attention" | "blocked" | "loading";

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

function statusLabel(status: EnvironmentStatus) {
  switch (status) {
    case "ready":
      return "ready";
    case "needs attention":
      return "needs attention";
    case "blocked":
      return "blocked";
    default:
      return "loading";
  }
}

function failureHint(result: AttachFlowResult | null) {
  switch (result?.failureCategory) {
    case "clawhub-not-found":
      return "系统没有找到官方 clawhub 安装器。";
    case "suspicious-skipped":
      return "这个技能被上游标记为高风险，系统默认没有继续安装。";
    case "verify-failed":
      return "安装命令执行过，但系统没有在预期位置验证到完整技能文件。";
    case "install-retriable":
      return "上游仓库暂时限流，系统已经自动重试过。";
    case "install-failed":
      return "安装过程遇到了永久性错误，需要查看高级信息。";
    case "attach-failed":
      return "技能可能已经装好，但 OpenClaw 配置还没有成功写入。";
    default:
      return "";
  }
}

function summarizeInstall(pack: CatalogPack, report: InstallExecutionReport) {
  const lines = [
    `已处理能力包：${pack.name}`,
    `已安装 ${report.installed.length} 个技能`,
    `已跳过 ${report.skipped.length} 个技能`,
    `可重试失败 ${report.failedRetriable.length} 个，永久失败 ${report.failedPermanent.length} 个`
  ];

  if (report.installed.length > 0) {
    lines.push("系统已经尝试把这个能力包接入 OpenClaw，建议现在重启 OpenClaw。");
  }

  return lines;
}

function nextActionForEnvironment(report: DoctorReport | null, status: EnvironmentStatus) {
  if (!report || status === "loading") {
    return "正在检查当前环境，请稍等。";
  }

  if (!report.clawhubFound) {
    return "先把官方 clawhub 安装好，然后回到这里重新检测。";
  }

  const configCheck = report.checks.find((check) => check.name === "openclaw-config");
  if (configCheck && !configCheck.ok) {
    return "系统没有检测到可用的 OpenClaw 配置文件，请先确认 OpenClaw 已经正确安装并启动过。";
  }

  if (status === "ready") {
    return "环境已经就绪。现在可以直接点击 Install and attach Calendar。";
  }

  return "环境基本可用，但还有几项需要注意。先看下面的修复建议，再开始安装。";
}

function guidanceForCheck(check: DoctorCheck) {
  switch (check.name) {
    case "clawhub":
      return "缺少 clawhub 时，系统无法开始安装技能。";
    case "openclaw-config":
      return "没有找到 OpenClaw 配置时，系统无法把技能挂进去。";
    case "openclaw-workspace":
      return "找不到 workspace 不一定阻塞，但会影响默认路径判断。";
    case "wsl":
      return "如果你的 OpenClaw 跑在 WSL，这里会影响路径选择。";
    default:
      return check.summary;
  }
}

function buildRepairCards(report: DoctorReport | null, status: EnvironmentStatus) {
  if (!report || status === "loading") {
    return [];
  }

  const cards: Array<{ title: string; body: string; action: string; level: "blocked" | "warning" }> = [];
  const configCheck = report.checks.find((check) => check.name === "openclaw-config");

  if (!report.clawhubFound) {
    cards.push({
      title: "先安装 clawhub",
      body: "没有 clawhub，系统就不能真正下载和安装技能。",
      action: "先把官方 clawhub CLI 安装好，然后回到这里点 Retry environment check。",
      level: "blocked"
    });
  }

  if (configCheck && !configCheck.ok) {
    cards.push({
      title: "先让 OpenClaw 生成配置",
      body: "系统没有找到可写的 OpenClaw 配置文件，所以暂时无法自动接入。",
      action: "先启动一次 OpenClaw，确认 openclaw.json 已生成，然后再回来继续。",
      level: "blocked"
    });
  }

  if (report.platform === "win32" && report.wslAvailable && !report.isWsl) {
    cards.push({
      title: "确认你的 OpenClaw 运行位置",
      body: "这台机器同时具备 Windows 和 WSL 环境，路径格式会影响技能接入位置。",
      action: "如果你的 OpenClaw 跑在 Windows，就继续当前模式；如果跑在 WSL，后续请按提示选择 WSL 路径。",
      level: "warning"
    });
  }

  if (status === "ready") {
    cards.push({
      title: "环境已就绪",
      body: "现在可以直接开始一键接入，无需自己处理 paths、extraDirs 或 SKILL.md。",
      action: "点击 Install and attach Calendar，完成后重启 OpenClaw。",
      level: "warning"
    });
  }

  return cards;
}

function guidedPrompt(success: boolean) {
  if (!success) {
    return "";
  }

  return "请检查你当前是否已加载 calendar skill。如果已加载，请用它帮我查看今天的日程。";
}

export function App() {
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [attachResult, setAttachResult] = useState<AttachFlowResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultLines, setResultLines] = useState<string[]>([]);
  const [nextStep, setNextStep] = useState("");
  const [advancedPayload, setAdvancedPayload] = useState<unknown>(null);
  const [actionLabel, setActionLabel] = useState("尚未执行");
  const [failureTitle, setFailureTitle] = useState("");
  const [failureBody, setFailureBody] = useState("");

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
      setAdvancedPayload(result);
      setResultLines(result.userSummary);
      setNextStep(result.nextStep);
      setFailureTitle(result.failureCategory ? "需要处理" : "");
      setFailureBody(result.failureCategory ? `${failureHint(result)} ${result.failureMessage ?? ""}`.trim() : "");
      setMessage(result.success ? "已完成接入。重启 OpenClaw 后就可以开始使用。" : result.nextStep);
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("请求失败");
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
    setActionLabel(`安装能力包 ${pack.name}`);

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
          ? "有部分技能未完成安装。请展开高级信息查看明细。"
          : ""
      );
      setMessage(`已完成 ${pack.name} 的安装流程。`);
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("能力包安装失败");
      setFailureBody(text);
      setMessage(text);
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
      const text = error instanceof Error ? error.message : String(error);
      setFailureTitle("撤销失败");
      setFailureBody(text);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  const environmentStatus: EnvironmentStatus = !doctor
    ? "loading"
    : !doctor.clawhubFound
      ? "blocked"
      : doctor.checks.every((check) => check.ok)
        ? "ready"
        : "needs attention";

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
  const problematicChecks = doctor?.checks.filter((check) => !check.ok) ?? [];
  const successPrompt = guidedPrompt(Boolean(attachResult?.success));
  const repairCards = buildRepairCards(doctor, environmentStatus);

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">OpenClaw机械外骨骼</p>
          <h1>第一次打开，先用向导把 OpenClaw 接起来。</h1>
          <p className="subtle lead">
            你不需要理解 OpenClaw、clawhub、路径、extraDirs 或 SKILL.md。系统会先检查环境，再告诉你现在是直接开始，还是先修一点点问题。
          </p>
          <div className="hero-points">
            <span>先检测</span>
            <span>再安装</span>
            <span>自动接入</span>
            <span>自动验证</span>
          </div>
          <div className="hero-brand">
            <div className="hot-badge">HOT!</div>
            <div>
              <p className="brand-title">OpenClaw</p>
              <p className="brand-subtitle">机械外骨骼任务中心</p>
              <p className="brand-copy">让普通用户也能把精选技能安全地装进 OpenClaw。</p>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <ExoskeletonMascot />
        </div>

        <div className="hero-action-card">
          <h2>开始使用</h2>
          <p>{nextActionForEnvironment(doctor, environmentStatus)}</p>
          <button className="primary" disabled={busy || environmentStatus === "blocked"} onClick={() => void runAttach("calendar")}>
            {busy ? "执行中..." : "Install and attach Calendar"}
          </button>
          <button disabled={busy} onClick={() => void runAttach("demo-safe")}>
            {busy ? "执行中..." : "Install demo-safe"}
          </button>
          <button disabled={busy} onClick={() => void refresh()}>
            Retry environment check
          </button>
          <button disabled={busy} onClick={() => void rollbackLatest()}>
            Undo last attach
          </button>
          <p className="subtle small">主推荐入口仍然是 Calendar。先把这条黄金路径跑通，再扩更多能力包。</p>
        </div>
      </section>

      {message ? <section className="banner">{message}</section> : null}

      <section className="grid">
        <article className="panel">
          <h2>环境准备向导</h2>
          <div className="stat">
            <span>环境状态</span>
            <strong className={environmentStatus === "ready" ? "ok" : environmentStatus === "blocked" ? "fail" : ""}>
              {statusLabel(environmentStatus)}
            </strong>
          </div>
          <div className="stat">
            <span>clawhub</span>
            <strong className={doctor?.clawhubFound ? "ok" : "fail"}>{doctor?.clawhubFound ? "已检测到" : "未检测到"}</strong>
          </div>
          <div className="stat">
            <span>OpenClaw 配置</span>
            <strong>{doctor?.openClawConfigPath ?? "Loading..."}</strong>
          </div>
          <div className="stat">
            <span>环境模式</span>
            <strong>{attachResult?.environmentMode ?? doctor?.platform ?? "..."}</strong>
          </div>
          <div className="stat">
            <span>当前动作</span>
            <strong>{actionLabel}</strong>
          </div>
        </article>

        <article className="panel">
          <h2>需要注意什么</h2>
          {problematicChecks.length > 0 ? (
            problematicChecks.map((check) => (
              <div className="stat" key={check.name}>
                <span>{check.name}</span>
                <strong className="fail">{check.summary}</strong>
                <p className="subtle checklist-note">{guidanceForCheck(check)}</p>
              </div>
            ))
          ) : (
            <p className="subtle">环境已经达到可安装状态。现在可以直接开始一键接入。</p>
          )}
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
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>自动修复建议</h2>
            <p className="subtle">如果你看到 blocked 或 needs attention，先看这里。系统会先告诉你该修哪一步。</p>
          </div>
        </div>
        <div className="repair-grid">
          {repairCards.map((card) => (
            <article className={`repair-card repair-${card.level}`} key={card.title}>
              <div className="catalog-topline">
                <span className={`chip ${card.level === "blocked" ? "chip-danger" : "chip-warning"}`}>
                  {card.level === "blocked" ? "blocked" : "needs attention"}
                </span>
              </div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <p className="catalog-meta"><strong>下一步：</strong>{card.action}</p>
            </article>
          ))}
        </div>
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
              <p className="catalog-meta"><strong>适合谁：</strong>{packAudience[pack.id] ?? "需要快速增强 OpenClaw 的用户"}</p>
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
              {successPrompt ? (
                <div className="prompt-box">
                  <span className="store-label">成功后去 OpenClaw 里这样测</span>
                  <p>{successPrompt}</p>
                </div>
              ) : null}
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
            <p className="subtle">只有真的需要你处理时，这里才会显示失败解释和建议动作。</p>
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
