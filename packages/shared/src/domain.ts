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
  | 'propose'
  | 'vote'
  | 'claim_task'
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
  tasks_open: number;
  proposals: number;
  my_proposals: number;
  capsule_published: number;
  preparers: number;
  my_capsule: 'none' | 'draft' | 'published';
  voted: boolean;
  next_action: NextAction;
  my_role: MemberRole;
  votes_open: boolean;
  contributions_open: boolean;
  revealed: boolean;
}

/**
 * event_funding (migration 11) : préparateurs uniquement (null pour le bénéficiaire et les non-membres).
 * Le total du groupe est visible ; les montants des autres membres ne le sont jamais.
 */
export interface EventFunding {
  target_cents: number;
  collected_cents: number;
  remaining_cents: number;
  /** Arrondi inférieur ; peut dépasser 100 si l'objectif est dépassé. */
  percent: number;
  goal_reached: boolean;
  contributions_open: boolean;
  contributions_close_at: string;
  /** Montant confirmé de l'utilisateur courant (visible de lui seul). */
  my_confirmed_cents: number;
}

/** my_events_funding : total et objectif par événement préparé. */
export interface EventFundingSummary {
  event_id: string;
  collected_cents: number;
  target_cents: number;
  percent: number;
  goal_reached: boolean;
}

/** Libellé court d'avancement, sans jamais de montant individuel. */
export function fundingLabel(percent: number, goalReached: boolean): string {
  if (goalReached) return percent > 100 ? 'Objectif dépassé' : 'Objectif atteint';
  if (percent <= 0) return 'La cagnotte démarre';
  return `${Math.min(percent, 99)} % de l’objectif`;
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
  /** Lien personnel envoyé par e-mail : seul le compte vérifié de cette adresse peut l'utiliser. */
  personal?: boolean;
  email_hint?: string | null;
  /** Nuls pour un lien bénéficiaire (la surprise reste entière). */
  title?: string | null;
  beneficiary_name?: string | null;
  occasion?: string | null;
  gift_at?: string;
  timezone?: string;
  organizer_name?: string | null;
  member_count?: number | null;
  role?: MemberRole;
  expires_at?: string;
}

// ------------------------------------------------------------------ amis et invitations nominatives
export type FriendRelation = 'friend' | 'incoming' | 'outgoing';

/** my_friends : amis et demandes en cours (jamais d'e-mail). */
export interface FriendRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  relation: FriendRelation;
  since: string;
}

/** search_profiles : 10 résultats au plus, photo seulement si une relation l'autorise. */
export interface ProfileSearchRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  relation: FriendRelation | 'none';
}

export interface BlockedRow {
  user_id: string;
  username: string;
  display_name: string;
  blocked_at: string;
}

export type FriendRequestStatus = 'sent' | 'accepted' | 'already_friends' | 'already_pending';

/** my_event_invites : titre et détails nuls pour une invitation de bénéficiaire. */
export interface ReceivedInvite {
  id: string;
  event_id: string;
  role: MemberRole;
  source: 'friend' | 'email';
  inviter_name: string | null;
  inviter_avatar: string | null;
  title: string | null;
  occasion: string | null;
  gift_at: string | null;
  member_count: number | null;
  created_at: string;
  expires_at: string;
}

export type InviteDeliveryStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

/** event_invites_overview : suivi des invitations nominatives d'une cagnotte (gestionnaires). */
export interface InviteOverviewRow {
  id: string;
  kind: 'friend' | 'email';
  invitee_id: string | null;
  display_name: string | null;
  username: string | null;
  avatar_path: string | null;
  email_hint: string | null;
  role: MemberRole;
  status: InviteDeliveryStatus;
  created_at: string;
  responded_at: string | null;
  expires_at: string;
}

export type InviteFriendStatus = 'invited' | 'not_friend' | 'already_member' | 'removed' | 'already_invited' | 'declined' | 'invalid';

export const INVITE_FRIEND_MESSAGES: Record<InviteFriendStatus, string> = {
  invited: 'Invitation envoyée',
  not_friend: 'Plus dans tes amis',
  already_member: 'Déjà dans le groupe',
  removed: 'Retiré du groupe',
  already_invited: 'Déjà invité',
  declined: 'A refusé récemment',
  invalid: 'Impossible',
};

/** my_surprises : bénéficiaire avant l'ouverture, la date et l'organisateur seulement. */
export interface SurpriseRow {
  event_id: string;
  reveal_at: string;
  organizer_name: string | null;
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
export type NotificationKind =
  | 'invitation'
  | 'vote_closing'
  | 'task_assigned'
  | 'capsule_open'
  | 'gift_selected'
  | 'member_joined'
  | 'message'
  | 'thanks'
  | 'friend_request'
  | 'friend_accepted'
  | 'event_invite';

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
