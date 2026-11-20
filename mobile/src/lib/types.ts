import type { EventStatus, MemberRole, VoteVisibility } from '@complice/shared';

/** Lignes de tables lues par l'app (alignées sur supabase/migrations). */
export interface EventRow {
  id: string;
  title: string;
  beneficiary_name: string;
  beneficiary_user_id: string | null;
  occasion: string;
  description: string | null;
  cover_path: string | null;
  target_cents: number;
  currency: 'EUR';
  collected_cents: number;
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

export interface NotificationPrefs {
  user_id: string;
  invitations: boolean;
  votes: boolean;
  tasks: boolean;
  capsule: boolean;
  messages: boolean;
}
