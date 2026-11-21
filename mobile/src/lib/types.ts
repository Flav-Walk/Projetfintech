import type { BadgeKind, CapsuleStatus, EventStatus, MemberRole, ProposalStatus, TaskStatus, VoteVisibility } from '@complice/shared';

/** Lignes de tables lues par l'app (alignées sur supabase/migrations). */
export interface EventRow {
  id: string;
  title: string;
  beneficiary_name: string;
  beneficiary_user_id: string | null;
  occasion: string;
  description: string | null;
  cover_path: string | null;
  currency: 'EUR';
  // Aucun montant ici : objectif et total sont dans event_finances (migration 8), lus via event_funding.
  gift_at: string;
  votes_close_at: string;
  contributions_close_at: string;
  reveal_at: string;
  timezone: string;
  vote_visibility: VoteVisibility;
  status: EventStatus;
  selected_proposal_id: string | null;
  gift_confirmed_at: string | null;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  username: string;
  avatar_path: string | null;
}

export interface MemberRow {
  event_id: string;
  user_id: string;
  role: MemberRole;
  status: 'active' | 'left' | 'removed';
  joined_at: string;
  profiles: Pick<Profile, 'display_name' | 'avatar_path'> | null;
}

export interface InvitationRow {
  id: string;
  event_id: string;
  role: MemberRole;
  expires_at: string;
  revoked_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_at: string;
  /** Lien de partage ou lien personnel envoyé par e-mail (migration 11). */
  kind?: 'link' | 'email';
}

export interface ActivityRow {
  id: number;
  event_id: string;
  actor_id: string | null;
  kind: string;
  data: Record<string, unknown>;
  created_at: string;
  profiles: Pick<Profile, 'display_name'> | null;
}

export interface NotificationRow {
  id: number;
  event_id: string | null;
  kind: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface ProposalRow {
  id: string;
  event_id: string;
  author_id: string | null;
  title: string;
  price_cents: number;
  previous_price_cents: number | null;
  price_changed_at: string | null;
  product_url: string | null;
  description: string | null;
  image_path: string | null;
  status: ProposalStatus;
  vote_count: number;
  created_at: string;
  profiles: Pick<Profile, 'display_name'> | null;
}

export interface RankingRow {
  proposal_id: string;
  vote_count: number;
  rank: number;
  tied: boolean;
}

export interface ReactionRow {
  proposal_id: string;
  user_id: string;
  emoji: string;
}

export interface CommentRow {
  id: string;
  proposal_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  profiles: Pick<Profile, 'display_name'> | null;
}

export interface TaskRow {
  id: string;
  event_id: string;
  title: string;
  kind: 'order' | 'pickup' | 'wrap' | 'card' | 'handover' | 'custom';
  due_at: string | null;
  assignee_id: string | null;
  status: TaskStatus;
  position: number;
  completed_at: string | null;
  assignee: Pick<Profile, 'display_name'> | null;
}

export interface MessageRow {
  id: string;
  event_id: string;
  author_id: string | null;
  body: string;
  client_id: string | null;
  created_at: string;
  profiles: Pick<Profile, 'display_name'> | null;
}

export interface CapsuleEntryRow {
  id: string;
  event_id: string;
  author_id: string;
  body: string | null;
  photo_path: string | null;
  status: CapsuleStatus;
  published_at: string | null;
  updated_at: string;
  profiles: Pick<Profile, 'display_name'> | null;
}

export interface BadgeRow {
  event_id: string;
  user_id: string;
  badge: BadgeKind;
  awarded_at: string;
}

export interface NotificationPrefs {
  user_id: string;
  invitations: boolean;
  votes: boolean;
  tasks: boolean;
  capsule: boolean;
  messages: boolean;
  /** Recevoir aussi l'ouverture de la capsule par e-mail (migration 10). */
  emails: boolean;
  /** Demandes d'ami et acceptations (migration 11). */
  friends: boolean;
}

export interface ThanksRow {
  event_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}
