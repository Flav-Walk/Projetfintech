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

export interface EventFunding {
  collected_cents: number;
  target_cents: number;
  contributor_count: number;
  my_confirmed_cents: number;
}

export interface InvitationPreview {
  status: import('./errors.js').InvitationStatus;
  event_id?: string;
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

/** Durées de validité proposées pour un lien d'invitation (heures). */
export const INVITATION_EXPIRY_CHOICES = [24, 72, 168, 720] as const;
