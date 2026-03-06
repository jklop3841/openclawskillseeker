import path from "node:path";
import { InstallPlanSchema, type CatalogPack, type CatalogSkill } from "@openclaw-skill-center/shared";

export function buildInstallPlan(input: {
  pack: CatalogPack;
  catalogSkills: CatalogSkill[];
  packsRoot: string;
  installRoot?: string;
  patchConfig?: boolean;
}) {
  const installRoot = input.installRoot ?? path.join(input.packsRoot, input.pack.id);
  const skillMap = new Map(input.catalogSkills.map((skill) => [skill.slug, skill]));
  const skills = input.pack.skills.map((slug) => {
    const skill = skillMap.get(slug);
    if (!skill) {
      return { slug, allowed: false, reason: "Not found in local curated catalog." };
    }

    if (!skill.curated) {
      return { slug, allowed: false, reason: "Third-party skill is not whitelisted." };
    }

    return {
      slug,
      allowed: true,
      reason: `${skill.trustLevel} catalog entry`
    };
  });

  return InstallPlanSchema.parse({
    packId: input.pack.id,
    packName: input.pack.name,
    installRoot,
    patchConfig: input.patchConfig ?? input.pack.patchOpenClawConfig,
    skills,
    blockedSkills: skills.filter((skill) => !skill.allowed).map((skill) => skill.slug),
    allowedSkills: skills.filter((skill) => skill.allowed).map((skill) => skill.slug)
  });
}
