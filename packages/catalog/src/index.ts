import catalogJson from "../catalog/catalog.json" with { type: "json" };
import { CatalogSchema, type Catalog } from "@openclaw-skill-center/shared";

export function loadLocalCatalog(): Catalog {
  return CatalogSchema.parse(catalogJson);
}

export function findPack(packId: string) {
  return loadLocalCatalog().packs.find((pack) => pack.id === packId) ?? null;
}

export function findSkill(slug: string) {
  return loadLocalCatalog().skills.find((skill) => skill.slug === slug) ?? null;
}
