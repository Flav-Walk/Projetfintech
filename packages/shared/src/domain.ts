/** Types du domaine, alignés sur supabase/migrations (source de vérité : le SQL). */

export type MemberRole = 'organizer' | 'co_organizer' | 'participant' | 'beneficiary';
export type EventStatus = 'active' | 'revealed' | 'archived' | 'cancelled';
export type VoteVisibility = 'private' | 'public';
export type ContributionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';
export type TaskStatus = 'open' | 'claimed' | 'done';
export type BadgeKind = 'proposer' | 'voter' | 'helper' | 'wordsmith' | 'contributor' | 'host';
export type StepKey = 'group' | 'vote' | 'purchase' | 'capsule' | 'reveal';
export type NextAction =
  | 'invite'
  | 'vote'
  | 'select_gift'
  | 'contribute'
  | 'finish_task'
  | 'write_capsule'
  | 'wait_reveal'
  | 'open_capsule'
  | 'view_memories';

export const ROLE_LABELS: Record<MemberRole, string> = {
  organizer: 'Organisateur',
  co_organizer: 'Coorganisateur',
  participant: 'Participant',
  beneficiary: 'Bénéficiaire',
};

export const STEP_LABELS: Record<StepKey, string> = {
  group: 'Groupe',
  vote: 'Vote',
  purchase: 'Achat',
  capsule: 'Capsule',
  reveal: 'Jour J',
};

export const BADGE_LABELS: Record<BadgeKind, { title: string; hint: string }> = {
  proposer: { title: 'Idée', hint: 'Proposer une idée de cadeau' },
  voter: { title: 'Voix', hint: 'Voter pour une idée' },
  helper: { title: 'Coup de main', hint: 'Terminer une mission' },
  wordsmith: { title: 'Plume', hint: 'Ajouter un mot à la capsule' },
  contributor: { title: 'Complice', hint: 'Participer à la cagnotte' },
  host: { title: 'Chef d’orchestre', hint: 'Organiser un événement' },
};

export interface EventProgress {
  steps: { key: StepKey; done: boolean }[];
  steps_done: number;
  tasks_done: number;
  tasks_total: number;
  next_action: NextAction;
  my_role: MemberRole;
  votes_open: boolean;
  contributions_open: boolean;
  revealed: boolean;
}

/**
 * Progression collective par paliers : les membres ne voient jamais le total exact pendant la collecte,
 * pour que les montants individuels restent privés (réduit les déductions, sans les rendre impossibles).
 */
export type FundingStep = 0 | 25 | 50 | 75 | 100;

/** event_funding : préparateurs uniquement (null pour le bénéficiaire et les non-membres). */
export interface EventFunding {
  target_cents: number;
  progress_step: FundingStep;
  goal_reached: boolean;
  contributions_open: boolean;
  /** Montant confirmé de l'utilisateur courant (visible de lui seul). */
  my_confirmed_cents: number;
  /** Total exact : gestionnaires seulement, une fois la collecte close (achat du cadeau). Sinon null. */
  collected_cents: number | null;
}

/** my_events_funding : un palier par événement préparé. */
export interface EventFundingSummary {
  event_id: string;
  progress_step: FundingStep;
  goal_reached: boolean;
}

export function fundingStepLabel(step: FundingStep, goalReached: boolean): string {
  if (goalReached) return 'Objectif atteint';
  switch (step) {
    case 75:
    case 100:
      return 'Plus des trois quarts de l’objectif';
    case 50:
      return 'Plus de la moitié de l’objectif';
    case 25:
      return 'Plus d’un quart de l’objectif';
    default:
      return 'La cagnotte démarre';
  }
}

/** revealed_gift : le cadeau retenu, sans prix ni lien (bénéficiaire après l'ouverture). */
export interface RevealedGift {
  id: string;
  title: string;
  description: string | null;
  image_path: string | null;
}

export interface InvitationPreview {
  status: import('./errors.js').InvitationStatus;
  /** Absent pour un lien inutilisable ; nul pour un visiteur non connecté. */
  event_id?: string | null;
  title?: string;
  beneficiary_name?: string;
  occasion?: string;
  gift_at?: string;
  timezone?: string;
  organizer_name?: string | null;
  member_count?: number;
  role?: MemberRole;
  expires_at?: string;
}

/** Contrat REST du backend pour les contributions simulées. */
export interface CreateContributionRequest {
  event_id: string;
  amount_cents: number;
  /** Généré côté client (UUID) une fois par tentative ; renvoyé à l'identique en cas de nouvel essai réseau. */
  idempotency_key: string;
  /** Mode simulation uniquement : force l'issue pour tester échec et nouvelle tentative. */
  simulate?: 'success' | 'failure';
}

export interface ContributionResponse {
  id: string;
  event_id: string;
  amount_cents: number;
  fee_cents: number;
  total_cents: number;
  status: ContributionStatus;
  is_simulated: boolean;
  failure_reason: string | null;
  created_at: string;
  settled_at: string | null;
}

export type ProposalStatus = 'active' | 'withdrawn' | 'unavailable';
export type CapsuleStatus = 'draft' | 'published';
export type NotificationKind = 'invitation' | 'vote_closing' | 'task_assigned' | 'capsule_open' | 'gift_selected' | 'member_joined' | 'message';

/** Réactions autorisées par la base (proposal_reactions.emoji). */
export const REACTIONS = ['❤️', '😍', '😂', '🤔', '👎'] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface CapsuleStats {
  words: number;
  photos: number;
  authors: number;
}

export interface ClaimResult {
  status: 'claimed' | 'taken' | 'already_yours';
  assignee_id?: string | null;
}

/** Durées de validité proposées pour un lien d'invitation (heures). */
export const INVITATION_EXPIRY_CHOICES = [24, 72, 168, 720] as const;
