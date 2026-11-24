/** Couvertures de cagnotte : photo privée, sinon illustration COMPLICE (migration 12). Logique pure, testée. */
export const COVER_ARTS = ['anniversaire', 'soiree', 'depart', 'mariage', 'amis', 'autre'] as const;
export type CoverArt = (typeof COVER_ARTS)[number];

export const COVER_LABELS: Record<CoverArt, string> = {
  anniversaire: 'Anniversaire',
  soiree: 'Soirée',
  depart: 'Départ',
  mariage: 'Mariage',
  amis: 'Entre amis',
  autre: 'Autre occasion',
};

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Illustration par défaut selon l'occasion saisie (texte libre). */
export function artForOccasion(occasion: string | null | undefined): CoverArt {
  const o = strip(occasion ?? '');
  if (o.includes('anniv')) return 'anniversaire';
  if (o.includes('depart') || o.includes('retraite') || o.includes('pot')) return 'depart';
  if (o.includes('mariage') || o.includes('pacs') || o.includes('fiancailles')) return 'mariage';
  if (o.includes('soiree') || o.includes('fete') || o.includes('nouvel an')) return 'soiree';
  if (o.includes('ami')) return 'amis';
  return 'autre';
}

export type CoverSource = { kind: 'photo'; path: string; fallback: CoverArt } | { kind: 'art'; art: CoverArt };

export function coverFor(e: { cover_path: string | null; cover_art?: string | null; occasion: string }): CoverSource {
  const art = (COVER_ARTS as readonly string[]).includes(e.cover_art ?? '') ? (e.cover_art as CoverArt) : artForOccasion(e.occasion);
  if (e.cover_path) return { kind: 'photo', path: e.cover_path, fallback: art };
  return { kind: 'art', art };
}
