import { z } from "zod";

export const PlatformSchema = z.enum(["win32", "linux", "darwin"]);
export const ClawhubResolutionModeSchema = z.enum(["explicit-path", "env", "path", "wsl", "not-found"]);
export const SkillSourceTypeSchema = z.enum(["registry", "local", "github-reference"]);
export const PaperObjectTypeSchema = z.enum([
  "RawNote",
  "Transcript",
  "Draft",
  "DraftSet",
  "LiteratureNote",
  "ExperimentRecord",
  "ReviewComment",
  "VenueRequest"
]);
export const PaperStageSchema = z.enum([
  "scan",
  "problem_anchor",
  "litmap",
  "novelty",
  "scaffold_left_adjoint",
  "method",
  "experiment",
  "hostile_review",
  "drafting",
  "polish",
  "publish",
  "revision"
]);
export const PaperSupportLabelSchema = z.enum([
  "directly-supported",
  "reasonably-inferred",
  "placeholder-needs-validation"
]);
export const PaperEvidenceCategorySchema = z.enum([
  "citation-support",
  "main-experiment",
  "baseline-comparison",
  "ablation",
  "robustness-check",
  "generalization-check",
  "efficiency-measure",
  "error-analysis",
  "scope-limitation",
  "rewording-only"
]);
export const PaperExperimentTypeSchema = z.enum([
  "main",
  "baseline",
  "ablation",
  "robustness",
  "generalization",
  "efficiency",
  "analysis"
]);

export const CatalogSkillSourceRefSchema = z.object({
  repo: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  commit: z.string().min(1).optional(),
  license: z.string().min(1).optional()
});

export const CatalogSkillSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  homepage: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  trustLevel: z.enum(["official", "curated", "community"]),
  curated: z.boolean().default(true),
  free: z.boolean().default(true),
  notes: z.string().optional(),
  sourceType: SkillSourceTypeSchema.default("registry"),
  sourceRef: CatalogSkillSourceRefSchema.optional()
});

export const CatalogPackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  skills: z.array(z.string().min(1)).min(1),
  patchOpenClawConfig: z.boolean().default(false),
  notes: z.array(z.string()).default([])
});

export const CatalogSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string().datetime(),
  source: z.literal("local"),
  skills: z.array(CatalogSkillSchema),
  packs: z.array(CatalogPackSchema)
});

export const DoctorCheckSchema = z.object({
  name: z.string(),
  ok: z.boolean(),
  summary: z.string(),
  details: z.record(z.string(), z.string()).default({})
});

export const DoctorReportSchema = z.object({
  generatedAt: z.string().datetime(),
  platform: PlatformSchema,
  isWsl: z.boolean(),
  checks: z.array(DoctorCheckSchema),
  clawhubFound: z.boolean(),
  clawhubResolutionMode: ClawhubResolutionModeSchema,
  resolvedClawhubCommand: z.string(),
  wslAvailable: z.boolean(),
  openClawConfigPath: z.string(),
  openClawWorkspacePath: z.string(),
  clawhubBinary: z.string().nullable(),
  nodeVersion: z.string(),
  sidecarHome: z.string(),
  snapshotRoot: z.string(),
  defaultPackRoot: z.string()
});

export const SnapshotManifestSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  operation: z.enum(["install", "update", "config-patch", "rollback"]),
  packId: z.string().optional(),
  configPath: z.string(),
  copiedPackRoots: z.array(z.string()),
  statePath: z.string(),
  snapshotDir: z.string(),
  notes: z.array(z.string()).default([])
});

export const InstalledPackSchema = z.object({
  packId: z.string(),
  installedAt: z.string().datetime(),
  workdir: z.string(),
  skillsDir: z.string(),
  slugs: z.array(z.string()),
  snapshotId: z.string().optional()
});

export const AppStateSchema = z.object({
  installedPacks: z.array(InstalledPackSchema).default([]),
  snapshots: z.array(SnapshotManifestSchema).default([])
});

export const ConfigPatchRequestSchema = z.object({
  configPath: z.string(),
  extraDir: z.string()
});

export const ConfigPatchResultSchema = z.object({
  configPath: z.string(),
  extraDir: z.string(),
  dryRun: z.boolean().default(false),
  changed: z.boolean(),
  backupSnapshotId: z.string().optional(),
  diffSummary: z.array(z.string()).default([])
});

export const InstallPlanSkillSchema = z.object({
  slug: z.string(),
  allowed: z.boolean(),
  reason: z.string(),
  sourceType: SkillSourceTypeSchema.default("registry"),
  sourcePath: z.string().optional()
});

export const InstallDecisionSchema = z.enum([
  "install",
  "skip-suspicious",
  "skip-unknown",
  "fail-hard",
  "retry-later"
]);

export const InstallReportEntrySchema = z.object({
  slug: z.string(),
  decision: InstallDecisionSchema,
  reason: z.string()
});

export const InstallExecutionReportSchema = z.object({
  installed: z.array(InstallReportEntrySchema).default([]),
  skipped: z.array(InstallReportEntrySchema).default([]),
  failedPermanent: z.array(InstallReportEntrySchema).default([]),
  failedRetriable: z.array(InstallReportEntrySchema).default([]),
  reasons: z.array(z.string()).default([])
});

export const SkillValidationSchema = z.object({
  slug: z.string(),
  exists: z.boolean(),
  summary: z.string().default(""),
  suspiciousHint: z.boolean(),
  rawStatus: z.string()
});

export const PackValidationReportSchema = z.object({
  packId: z.string(),
  valid: z.array(SkillValidationSchema).default([]),
  suspicious: z.array(SkillValidationSchema).default([]),
  notFound: z.array(SkillValidationSchema).default([]),
  skipped: z.array(
    z.object({
      slug: z.string(),
      reason: z.string()
    })
  ).default([])
});

export const VerifySkillDetailSchema = z.object({
  slug: z.string(),
  skillRoot: z.string(),
  skillMdExists: z.boolean(),
  originJsonExists: z.boolean()
});

export const VerifyPackLayoutSchema = z.object({
  targetDir: z.string(),
  skillsDir: z.string(),
  rootExists: z.boolean(),
  skillsDirExists: z.boolean(),
  skillEntries: z.array(z.string()).default([]),
  lockFilePath: z.string().optional(),
  lockFileExists: z.boolean().optional(),
  skillDetails: z.array(VerifySkillDetailSchema).optional(),
  ok: z.boolean(),
  findings: z.array(z.string()).default([])
});

export const AttachFlowResultSchema = z.object({
  kind: z.enum(["skill", "pack"]).default("skill"),
  skillSlug: z.string(),
  packId: z.string(),
  targetDir: z.string(),
  skillsDir: z.string(),
  selectedExtraDir: z.string(),
  environmentMode: z.enum(["windows", "wsl", "unknown"]).default("unknown"),
  success: z.boolean(),
  stages: z.array(
    z.object({
      key: z.enum(["detect", "install", "attach", "verify"]),
      status: z.enum(["pending", "running", "success", "failed"]),
      summary: z.string()
    })
  ).default([]),
  failureCategory: z.enum([
    "clawhub-not-found",
    "suspicious-skipped",
    "verify-failed",
    "install-retriable",
    "install-failed",
    "attach-failed"
  ]).optional(),
  failureMessage: z.string().optional(),
  doctorSummary: z.object({
    clawhubFound: z.boolean(),
    openClawConfigPath: z.string(),
    resolutionMode: ClawhubResolutionModeSchema
  }),
  installReport: InstallExecutionReportSchema,
  verify: VerifyPackLayoutSchema,
  configPatch: ConfigPatchResultSchema.optional(),
  userSummary: z.array(z.string()).default([]),
  nextStep: z.string()
});

export const SetupRecommendationSchema = z.enum([
  "connect-existing",
  "install-clawhub",
  "install-openclaw",
  "check-wsl-path"
]);

export const SetupStatusSchema = z.object({
  generatedAt: z.string().datetime(),
  status: z.enum(["ready", "needs attention", "blocked"]),
  hasOpenClawConfig: z.boolean(),
  hasClawhub: z.boolean(),
  hasClawX: z.boolean(),
  platformMode: z.enum(["windows", "wsl", "unknown"]),
  recommendation: SetupRecommendationSchema,
  title: z.string(),
  summary: z.string(),
  nextSteps: z.array(z.string()).default([]),
  detectedPaths: z.object({
    openClawConfigPath: z.string(),
    openClawWorkspacePath: z.string(),
    clawhubBinary: z.string().nullable(),
    clawxBinary: z.string().nullable()
  }),
  docs: z.object({
    openClawInstallUrl: z.string().url(),
    clawhubUrl: z.string().url(),
    clawxUrl: z.string().url()
  })
});

export const InstallPlanSchema = z.object({
  packId: z.string(),
  packName: z.string(),
  installRoot: z.string(),
  patchConfig: z.boolean(),
  skills: z.array(InstallPlanSkillSchema),
  blockedSkills: z.array(z.string()),
  allowedSkills: z.array(z.string())
});

export const ReportRecordSchema = z.object({
  type: z.enum(["install", "update", "rollback"]),
  generatedAt: z.string().datetime(),
  path: z.string(),
  summary: z.string()
});

export const RollbackVerifySchema = z.object({
  stateRestored: z.boolean(),
  configRestored: z.boolean(),
  restoredPackRoots: z.array(
    z.object({
      path: z.string(),
      restored: z.boolean()
    })
  )
});

export const PaperEvidenceNoteSchema = z.object({
  label: z.string().min(1),
  detail: z.string().min(1).optional(),
  sourceFiles: z.array(z.string().min(1)).default([])
});

export const PaperActionSchema = z.object({
  action: z.string().min(1),
  rationale: z.string().min(1).optional(),
  priority: z.enum(["now", "soon", "later"]).default("soon")
});

export const PaperWorkflowRecordSchema = z.object({
  objectId: z.string().min(1),
  objectType: PaperObjectTypeSchema,
  currentStage: PaperStageSchema,
  confidence: z.number().min(0).max(1),
  sourceFiles: z.array(z.string().min(1)).min(1),
  facts: z.array(PaperEvidenceNoteSchema).default([]),
  inferences: z.array(PaperEvidenceNoteSchema).default([]),
  hypotheses: z.array(PaperEvidenceNoteSchema).default([]),
  blockingGaps: z.array(z.string().min(1)).default([]),
  recommendedNextStage: PaperStageSchema,
  actions: z.array(PaperActionSchema).default([]),
  writeTargets: z.array(z.string().min(1)).default([])
});

export const PaperManifestEntrySchema = PaperWorkflowRecordSchema.extend({
  topicCluster: z.string().min(1),
  stageGuess: PaperStageSchema,
  provenanceNotes: z.array(z.string().min(1)).default([]),
  deduplicationNotes: z.array(z.string().min(1)).default([])
});

export const PaperManifestSchema = z.object({
  generatedAt: z.string().datetime(),
  workspaceRoot: z.string().min(1),
  entries: z.array(PaperManifestEntrySchema).default([])
});

export const PaperScaffoldSectionSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  support: PaperSupportLabelSchema,
  content: z.string().min(1),
  sourceFiles: z.array(z.string().min(1)).default([]),
  notes: z.array(z.string().min(1)).default([])
});

export const PaperScaffoldSchema = z.object({
  objectId: z.string().min(1),
  generatedAt: z.string().datetime(),
  sourceFiles: z.array(z.string().min(1)).min(1),
  titleCandidates: z.array(PaperScaffoldSectionSchema).default([]),
  researchProblem: PaperScaffoldSectionSchema,
  motivation: PaperScaffoldSectionSchema,
  contributionCandidates: z.array(PaperScaffoldSectionSchema).default([]),
  methodOverview: PaperScaffoldSectionSchema,
  experimentGoals: z.array(PaperScaffoldSectionSchema).default([]),
  evaluationTargets: z.array(PaperScaffoldSectionSchema).default([]),
  likelyLimitations: z.array(PaperScaffoldSectionSchema).default([]),
  venueFitNote: PaperScaffoldSectionSchema,
  missingModules: z.array(z.string().min(1)).default([]),
  recommendedNextStage: PaperStageSchema
});

export const PaperClaimSchema = z.object({
  claimId: z.string().min(1),
  text: z.string().min(1),
  claimType: z.enum([
    "novelty",
    "effectiveness",
    "efficiency",
    "robustness",
    "generalization",
    "usability",
    "deployment",
    "theory",
    "other"
  ]),
  sourceFiles: z.array(z.string().min(1)).default([]),
  supportStatus: z.enum(["supported", "partially-supported", "unsupported"]).default("unsupported")
});

export const PaperEvidenceRequirementSchema = z.object({
  claimId: z.string().min(1),
  category: PaperEvidenceCategorySchema,
  requirement: z.string().min(1),
  rationale: z.string().min(1),
  blocking: z.boolean().default(true)
});

export const PaperEvidencePlanSchema = z.object({
  objectId: z.string().min(1),
  generatedAt: z.string().datetime(),
  sourceFiles: z.array(z.string().min(1)).min(1),
  claims: z.array(PaperClaimSchema).default([]),
  requiredEvidence: z.array(PaperEvidenceRequirementSchema).default([]),
  unsupportedClaims: z.array(z.string().min(1)).default([]),
  downgradeRecommendations: z.array(z.string().min(1)).default([]),
  recommendedNextStage: PaperStageSchema
});

export const PaperExperimentEntrySchema = z.object({
  experimentId: z.string().min(1),
  type: PaperExperimentTypeSchema,
  claimId: z.string().min(1),
  title: z.string().min(1),
  proofTarget: z.string().min(1),
  whyNecessary: z.string().min(1),
  reviewerAttackIfMissing: z.string().min(1),
  priority: z.enum(["critical", "important", "optional"]).default("important")
});

export const PaperExperimentPlanSchema = z.object({
  objectId: z.string().min(1),
  generatedAt: z.string().datetime(),
  sourceFiles: z.array(z.string().min(1)).min(1),
  claimsToValidate: z.array(z.string().min(1)).default([]),
  experiments: z.array(PaperExperimentEntrySchema).default([]),
  missingBaselineRisks: z.array(z.string().min(1)).default([]),
  fairnessRisks: z.array(z.string().min(1)).default([]),
  minimumPublishableBundle: z.array(z.string().min(1)).default([]),
  recommendedNextStage: PaperStageSchema
});

export type Catalog = z.infer<typeof CatalogSchema>;
export type CatalogPack = z.infer<typeof CatalogPackSchema>;
export type CatalogSkill = z.infer<typeof CatalogSkillSchema>;
export type ClawhubResolutionMode = z.infer<typeof ClawhubResolutionModeSchema>;
export type SkillSourceType = z.infer<typeof SkillSourceTypeSchema>;
export type PaperObjectType = z.infer<typeof PaperObjectTypeSchema>;
export type PaperStage = z.infer<typeof PaperStageSchema>;
export type PaperSupportLabel = z.infer<typeof PaperSupportLabelSchema>;
export type PaperEvidenceCategory = z.infer<typeof PaperEvidenceCategorySchema>;
export type PaperExperimentType = z.infer<typeof PaperExperimentTypeSchema>;
export type DoctorCheck = z.infer<typeof DoctorCheckSchema>;
export type DoctorReport = z.infer<typeof DoctorReportSchema>;
export type SnapshotManifest = z.infer<typeof SnapshotManifestSchema>;
export type AppState = z.infer<typeof AppStateSchema>;
export type ConfigPatchRequest = z.infer<typeof ConfigPatchRequestSchema>;
export type ConfigPatchResult = z.infer<typeof ConfigPatchResultSchema>;
export type InstallPlan = z.infer<typeof InstallPlanSchema>;
export type InstallDecision = z.infer<typeof InstallDecisionSchema>;
export type InstallExecutionReport = z.infer<typeof InstallExecutionReportSchema>;
export type InstalledPack = z.infer<typeof InstalledPackSchema>;
export type SkillValidation = z.infer<typeof SkillValidationSchema>;
export type PackValidationReport = z.infer<typeof PackValidationReportSchema>;
export type VerifyPackLayout = z.infer<typeof VerifyPackLayoutSchema>;
export type AttachFlowResult = z.infer<typeof AttachFlowResultSchema>;
export type SetupRecommendation = z.infer<typeof SetupRecommendationSchema>;
export type SetupStatus = z.infer<typeof SetupStatusSchema>;
export type ReportRecord = z.infer<typeof ReportRecordSchema>;
export type RollbackVerify = z.infer<typeof RollbackVerifySchema>;
export type PaperEvidenceNote = z.infer<typeof PaperEvidenceNoteSchema>;
export type PaperAction = z.infer<typeof PaperActionSchema>;
export type PaperWorkflowRecord = z.infer<typeof PaperWorkflowRecordSchema>;
export type PaperManifestEntry = z.infer<typeof PaperManifestEntrySchema>;
export type PaperManifest = z.infer<typeof PaperManifestSchema>;
export type PaperScaffoldSection = z.infer<typeof PaperScaffoldSectionSchema>;
export type PaperScaffold = z.infer<typeof PaperScaffoldSchema>;
export type PaperClaim = z.infer<typeof PaperClaimSchema>;
export type PaperEvidenceRequirement = z.infer<typeof PaperEvidenceRequirementSchema>;
export type PaperEvidencePlan = z.infer<typeof PaperEvidencePlanSchema>;
export type PaperExperimentEntry = z.infer<typeof PaperExperimentEntrySchema>;
export type PaperExperimentPlan = z.infer<typeof PaperExperimentPlanSchema>;
