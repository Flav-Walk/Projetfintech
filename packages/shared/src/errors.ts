/**
 * Codes métier levés par les fonctions SQL (RAISE EXCEPTION '<code>') et par l'API.
 * Propriétaire du contrat : la branche `backend` (voir docs/CONTRATS.md).
 */
export const ERROR_MESSAGES = {
  not_authenticated: 'Connecte-toi pour continuer.',
  forbidden: "Tu n'as pas les droits pour cette action.",
  not_member: "Tu ne fais pas partie de cet événement.",
  protected_column: 'Cette information ne peut pas être modifiée.',
  event_locked: 'Cet événement est terminé : les réglages sont figés.',
  votes_already_closed: 'Le vote est déjà clos : sa date ne peut plus changer.',
  contributions_already_closed: 'Les participations sont closes : leur date ne peut plus changer.',
  already_revealed: 'La capsule est déjà ouverte.',
  reveal_in_past: "La date d'ouverture doit être dans le futur.",
  invalid_cover_path: "L'image de couverture est invalide.",
  invalid_role: 'Rôle invalide.',
  invalid_expiry: "Durée de validité invalide (1 h à 30 jours).",
  invalid_target_amount: 'Objectif invalide (entre 1 € et 100 000 €).',
  invalid_target: 'Ce membre ne peut pas recevoir ce changement.',
  transfer_required: "Transmets d'abord l'organisation à un autre membre.",
  votes_closed: 'Le vote est clos.',
  proposal_not_active: "Cette idée n'est plus disponible au vote.",
  invalid_proposal: 'Proposition invalide.',
  contributions_closed: 'Les participations sont closes.',
  invalid_amount: 'Montant invalide (entre 1 € et 1 000 €).',
  idempotency_conflict: 'Cette demande a déjà été envoyée avec un autre montant.',
  too_many_pending: 'Plusieurs participations sont encore en attente. Patiente un peu avant de réessayer.',
  not_assignee: "Cette mission est assignée à quelqu'un d'autre.",
  capsule_sealed: 'La capsule est ouverte : les mots ne peuvent plus être modifiés.',
  invalid_photo_path: 'Photo invalide.',
  invalid_image_path: 'Image invalide.',
  proposal_withdrawn: 'Cette idée a été retirée : propose-la de nouveau si besoin.',
  api_not_configured: 'Le serveur de paiement n’est pas configuré dans l’app (EXPO_PUBLIC_API_URL).',
  rate_limited: 'Trop de demandes d’un coup. Patiente une minute.',
  invalid_request: 'Demande invalide.',
  network: 'Connexion impossible. Vérifie ton réseau et réessaie.',
  service_unavailable: 'Le service Complice n’est pas encore prêt (base de données à initialiser). Réessaie plus tard.',
  unknown: 'Une erreur est survenue. Réessaie dans un instant.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

/** Extrait le code métier d'un message d'erreur Postgres / PostgREST / API. */
export function errorCodeFrom(err: unknown): ErrorCode {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object'
        ? String((err as { code?: string; message?: string }).message ?? (err as { code?: string }).code ?? '')
        : '';
  if (/network|fetch failed|Failed to fetch|Network request failed/i.test(raw)) return 'network';
  if (/Could not find the (function|table)|schema cache|PGRST20[02]/i.test(raw)) return 'service_unavailable';
  if (/row-level security|permission denied/i.test(raw)) return 'forbidden';
  const match = Object.keys(ERROR_MESSAGES).find((code) => new RegExp(`\\b${code}\\b`).test(raw));
  return (match as ErrorCode | undefined) ?? 'unknown';
}

export function messageFor(err: unknown): string {
  return ERROR_MESSAGES[errorCodeFrom(err)];
}

/** Statuts renvoyés par preview_invitation / accept_invitation. */
export type InvitationStatus =
  | 'valid'
  | 'joined'
  | 'already_member'
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'exhausted'
  | 'removed'
  | 'event_closed'
  | 'beneficiary_taken';

export const INVITATION_MESSAGES: Record<InvitationStatus, string> = {
  valid: 'Invitation valide.',
  joined: 'Bienvenue dans le groupe !',
  already_member: 'Tu fais déjà partie de ce groupe.',
  invalid: "Ce lien d'invitation n'existe pas. Vérifie qu'il est complet.",
  expired: "Ce lien a expiré. Demande un nouveau lien à l'organisateur.",
  revoked: "Ce lien a été désactivé par l'organisateur.",
  exhausted: 'Ce lien a déjà été utilisé le nombre de fois prévu.',
  removed: "L'organisateur t'a retiré de ce groupe.",
  event_closed: 'Cet événement est terminé.',
  beneficiary_taken: 'Le bénéficiaire a déjà rejoint cet événement.',
};
