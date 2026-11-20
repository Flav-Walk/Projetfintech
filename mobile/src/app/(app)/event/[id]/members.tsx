import { INVITATION_EXPIRY_CHOICES, ROLE_LABELS, messageFor, type MemberRole } from '@complice/shared';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, Link2, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, Switch, View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { ConfirmButton } from '@/components/confirm-button';
import { Avatar } from '@/components/event-parts';
import { ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Chip, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { invitationShareUrl, isApiConfigured } from '@/lib/env';
import { formatShortDate } from '@/lib/format';
import {
  useCreateInvitation,
  useEvent,
  useInvitations,
  useLeaveEvent,
  useMembers,
  useProgress,
  useRemoveMember,
  useRevokeInvitation,
  useSetMemberRole,
  useTransferOwnership,
} from '@/lib/queries';
import type { InvitationRow, MemberRow } from '@/lib/types';
import { useEventId } from '@/lib/use-event-context';
import { useNow } from '@/lib/use-now';
import { colors, space } from '@/theme/tokens';

const EXPIRY_LABELS: Record<number, string> = { 24: '24 h', 72: '3 jours', 168: '7 jours', 720: '30 jours' };

export default function Members() {
  const id = useEventId();
  const { session } = useAuth();
  const event = useEvent(id);
  const progress = useProgress(id);
  const members = useMembers(id);
  const myRole = progress.data?.my_role;
  const isOrganizer = myRole === 'organizer';
  const isManager = isOrganizer || myRole === 'co_organizer';
  const invitations = useInvitations(id, isManager);
  const leave = useLeaveEvent(id);
  const [error, setError] = useState<string | null>(null);

  if (members.isPending || progress.isPending) return <Loading />;
  if (members.isError) return <Screen><ErrorState error={members.error} onRetry={() => members.refetch()} /></Screen>;

  const list = members.data ?? [];

  return (
    <Screen>
      <BackHeader title="Membres et invitations" subtitle={event.data?.title} fallback={`/event/${id}`} />
      {error ? <Banner tone="error">{error}</Banner> : null}

      {isManager ? <InvitePanel eventId={id} isOrganizer={isOrganizer} hasBeneficiary={!!event.data?.beneficiary_user_id} /> : null}

      <T v="h2">Le groupe ({list.filter((m) => m.role !== 'beneficiary').length})</T>
      {list.map((m, i) => (
        <MemberLine key={m.user_id} member={m} index={i} me={session?.user.id} eventId={id} myRole={myRole} onError={setError} />
      ))}

      {isManager && invitations.data && invitations.data.length > 0 ? (
        <>
          <T v="h2">Liens créés</T>
          {invitations.data.map((inv) => (
            <InvitationLine key={inv.id} inv={inv} eventId={id} onError={setError} />
          ))}
        </>
      ) : null}

      {myRole && myRole !== 'organizer' ? (
        <Card style={{ gap: space.sm }}>
          <T v="h3">Quitter le groupe</T>
          <T v="small" color={colors.inkSoft}>
            Tu n’auras plus accès à l’événement. Tes messages restent visibles pour le groupe ; ta participation financière reste enregistrée.
          </T>
          <ConfirmButton
            label="Quitter l’événement"
            confirmLabel="Confirmer : quitter"
            loading={leave.isPending}
            onConfirm={async () => {
              try {
                await leave.mutateAsync(undefined);
                router.replace('/events');
              } catch (e) {
                setError(messageFor(e));
              }
            }}
          />
        </Card>
      ) : isOrganizer ? (
        <Banner tone="info" title="Tu es l’organisateur">
          Pour quitter l’événement, transmets d’abord l’organisation à un membre (bouton « Transmettre » sur sa ligne).
        </Banner>
      ) : null}
    </Screen>
  );
}

function InvitePanel({ eventId, isOrganizer, hasBeneficiary }: { eventId: string; isOrganizer: boolean; hasBeneficiary: boolean }) {
  const create = useCreateInvitation(eventId);
  const [role, setRole] = useState<MemberRole>('participant');
  const [hours, setHours] = useState<number>(168);
  const [singleUse, setSingleUse] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles: MemberRole[] = ['participant', ...(isOrganizer ? (['co_organizer'] as const) : []), ...(!hasBeneficiary ? (['beneficiary'] as const) : [])];

  async function generate() {
    setError(null);
    setCopied(false);
    try {
      const inv = await create.mutateAsync({ role, hours, maxUses: singleUse || role === 'beneficiary' ? 1 : null });
      setLink(invitationShareUrl(inv.token));
    } catch (e) {
      setError(messageFor(e));
    }
  }

  return (
    <Card tone="lavender" style={{ gap: space.md }}>
      <Row gap={space.sm}>
        <Link2 size={22} color={colors.violet} strokeWidth={1.75} />
        <T v="h3">Inviter avec un lien</T>
      </Row>
      <View style={{ gap: 6 }}>
        <T v="label">Rôle</T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {roles.map((r) => (
            <Choice key={r} label={ROLE_LABELS[r]} selected={role === r} onPress={() => setRole(r)} />
          ))}
        </Row>
        {role === 'beneficiary' ? (
          <T v="small" color={colors.inkSoft}>
            Lien à usage unique pour la personne fêtée. Elle ne verra rien avant l’ouverture de la capsule.
          </T>
        ) : role === 'co_organizer' ? (
          <T v="small" color={colors.inkSoft}>
            Un coorganisateur peut inviter, modifier les réglages, choisir le cadeau et gérer les missions.
          </T>
        ) : null}
      </View>
      <View style={{ gap: 6 }}>
        <T v="label">Valable</T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {INVITATION_EXPIRY_CHOICES.map((h) => (
            <Choice key={h} label={EXPIRY_LABELS[h]!} selected={hours === h} onPress={() => setHours(h)} />
          ))}
        </Row>
      </View>
      {role !== 'beneficiary' ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <T style={{ flex: 1 }}>Usage unique</T>
          <Switch value={singleUse} onValueChange={setSingleUse} trackColor={{ true: colors.violet, false: colors.border }} accessibilityLabel="Lien à usage unique" />
        </Row>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button label="Créer le lien" variant="secondary" onPress={generate} loading={create.isPending} />
      {link ? (
        <View style={{ gap: space.sm }}>
          <Banner tone="warning" title="Lien affiché une seule fois">
            Partage-le maintenant. Tu pourras le désactiver à tout moment ci-dessous.
          </Banner>
          <T v="small" selectable style={{ backgroundColor: colors.surface, padding: space.md, borderRadius: 12 }}>
            {link}
          </T>
          {!isApiConfigured ? (
            <T v="small" color={colors.inkSoft}>
              API non configurée : le lien ouvre directement l’app. En Expo Go, le destinataire colle ce lien dans « Rejoindre un groupe ».
            </T>
          ) : null}
          <Row>
            <Button
              compact
              style={{ flex: 1 }}
              label="Partager"
              icon={<Share2 size={18} color={colors.white} />}
              onPress={() => Share.share({ message: `Rejoins-moi sur Complice pour préparer le cadeau : ${link}` })}
            />
            <Button
              compact
              variant="outline"
              style={{ flex: 1 }}
              label={copied ? 'Copié' : 'Copier'}
              icon={<Copy size={18} color={colors.ink} />}
              onPress={async () => {
                await Clipboard.setStringAsync(link);
                setCopied(true);
              }}
            />
          </Row>
        </View>
      ) : null}
    </Card>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: selected ? colors.violet : colors.border, backgroundColor: selected ? colors.violet : colors.surface }}
    >
      <T v="label" color={selected ? colors.white : colors.ink}>
        {label}
      </T>
    </Pressable>
  );
}

function MemberLine({ member, index, me, eventId, myRole, onError }: { member: MemberRow; index: number; me?: string; eventId: string; myRole?: MemberRole; onError: (m: string | null) => void }) {
  const setRole = useSetMemberRole(eventId);
  const remove = useRemoveMember(eventId);
  const transfer = useTransferOwnership(eventId);
  const name = member.profiles?.display_name ?? 'Membre';
  const isMe = member.user_id === me;
  const canPromote = myRole === 'organizer' && !isMe && (member.role === 'participant' || member.role === 'co_organizer');
  const canRemove = !isMe && member.role !== 'organizer' && (myRole === 'organizer' || (myRole === 'co_organizer' && (member.role === 'participant' || member.role === 'beneficiary')));
  const run = async (fn: () => Promise<unknown>) => {
    onError(null);
    try {
      await fn();
    } catch (e) {
      onError(messageFor(e));
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <Row>
        <Avatar name={name} index={index} size={42} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold">
            {name}
            {isMe ? ' (toi)' : ''}
          </T>
          <T v="small" color={colors.inkSoft}>
            Depuis le {formatShortDate(member.joined_at)}
          </T>
        </View>
        <Chip label={ROLE_LABELS[member.role]} tone={member.role === 'organizer' ? 'coral' : member.role === 'beneficiary' ? 'sun' : 'lavender'} />
      </Row>
      {canPromote || canRemove ? (
        <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
          {canPromote ? (
            <Button
              compact
              variant="outline"
              label={member.role === 'co_organizer' ? 'Retirer coorganisateur' : 'Nommer coorganisateur'}
              loading={setRole.isPending}
              onPress={() => run(() => setRole.mutateAsync({ userId: member.user_id, role: member.role === 'co_organizer' ? 'participant' : 'co_organizer' }))}
            />
          ) : null}
          {canPromote ? (
            <ConfirmButton variant="outline" label="Transmettre" confirmLabel={`Confirmer : ${name} organise`} loading={transfer.isPending} onConfirm={() => run(() => transfer.mutateAsync(member.user_id))} />
          ) : null}
          {canRemove ? <ConfirmButton label="Retirer" confirmLabel="Confirmer le retrait" loading={remove.isPending} onConfirm={() => run(() => remove.mutateAsync(member.user_id))} /> : null}
        </Row>
      ) : null}
    </Card>
  );
}

function InvitationLine({ inv, eventId, onError }: { inv: InvitationRow; eventId: string; onError: (m: string | null) => void }) {
  const revoke = useRevokeInvitation(eventId);
  const now = useNow();
  const expired = new Date(inv.expires_at).getTime() <= now;
  const exhausted = inv.max_uses !== null && inv.use_count >= inv.max_uses;
  const status = inv.revoked_at ? 'Désactivé' : expired ? 'Expiré' : exhausted ? 'Utilisé' : 'Actif';
  const active = status === 'Actif';
  return (
    <Card style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="bodyBold">{ROLE_LABELS[inv.role]}</T>
        <Chip label={status} tone={active ? 'mint' : 'grey'} />
      </Row>
      <T v="small" color={colors.inkSoft}>
        Créé le {formatShortDate(inv.created_at)} · {active ? `expire le ${formatShortDate(inv.expires_at)}` : `expirait le ${formatShortDate(inv.expires_at)}`} · {inv.use_count} utilisation{inv.use_count > 1 ? 's' : ''}
        {inv.max_uses ? ` sur ${inv.max_uses}` : ''}
      </T>
      {active ? (
        <ConfirmButton
          label="Désactiver ce lien"
          confirmLabel="Confirmer la désactivation"
          loading={revoke.isPending}
          onConfirm={async () => {
            onError(null);
            try {
              await revoke.mutateAsync(inv.id);
            } catch (e) {
              onError(messageFor(e));
            }
          }}
        />
      ) : null}
    </Card>
  );
}
