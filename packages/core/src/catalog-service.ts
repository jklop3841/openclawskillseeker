import { findPack, findSkill, loadLocalCatalog } from "@openclaw-skill-center/catalog";

export class CatalogService {
  listCatalog() {
    return loadLocalCatalog();
  }

  getPack(packId: string) {
    return findPack(packId);
  }

  getSkill(slug: string) {
    return findSkill(slug);
  }
}
