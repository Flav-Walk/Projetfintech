import { INVITATION_EXPIRY_CHOICES, INVITE_FRIEND_MESSAGES, ROLE_LABELS, messageFor, type InviteOverviewRow, type MemberRole } from '@complice/shared';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, Link2, Mail, Share2, UserPlus, Users, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Share, Switch, View } from 'react-native';
import { UserAvatar } from '@/components/avatar';
import { BackHeader } from '@/components/back-header';
import { ConfirmButton } from '@/components/confirm-button';
import { CheckDot, ChoiceChip, Divider, Group, ListRow, SectionHeader, Segmented, Sheet, SkeletonList } from '@/components/kit';
import { ErrorState } from '@/components/states';
import { Banner, Button, Chip, Field, Row, Screen, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isEmail } from '@/lib/auth-errors';
import { invitationShareUrl, isApiConfigured } from '@/lib/env';
import { formatShortDate } from '@/lib/format';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
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
import { useCancelInvite, useFriends, useInviteFriends, useInvitesOverview } from '@/lib/social';
import { useToast } from '@/lib/toast';
import type { InvitationRow, MemberRow } from '@/lib/types';
import { useEventId } from '@/lib/use-event-context';
import { useNow } from '@/lib/use-now';
import { colors, space } from '@/theme/tokens';

const EXPIRY_LABELS: Record<number, string> = { 24: '24 h', 72: '3 jours', 168: '7 jours', 720: '30 jours' };
const STATUS: Record<InviteOverviewRow['status'], { label: string; tone: 'lavender' | 'mint' | 'grey' | 'coral' }> = {
  pending: { label: 'Envoyée', tone: 'lavender' },
  accepted: { label: 'A rejoint', tone: 'mint' },
  declined: { label: 'Refusée', tone: 'grey' },
  cancelled: { label: 'Annulée', tone: 'grey' },
  expired: { label: 'Expirée', tone: 'grey' },
};

type InviteRole = 'participant' | 'co_organizer' | 'beneficiary';

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
  const overview = useInvitesOverview(id, isManager);
  const leave = useLeaveEvent(id);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (members.isError) return <Screen><ErrorState error={members.error} onRetry={() => members.refetch()} /></Screen>;

  const list = members.data ?? [];
  const preparers = list.filter((m) => m.role !== 'beneficiary');
  const beneficiary = list.find((m) => m.role === 'beneficiary');
  const hasBeneficiary = !!event.data?.beneficiary_user_id || (overview.data ?? []).some((o) => o.role === 'beneficiary' && o.status === 'pending');
  const pending = (overview.data ?? []).filter((o) => o.status === 'pending');
  const history = (overview.data ?? []).filter((o) => o.status !== 'pending').slice(0, 10);

  return (
    <Screen>
      <BackHeader title="Le groupe" subtitle={event.data?.title} fallback={`/event/${id}`} />
      {error ? <Banner tone="error">{error}</Banner> : null}

      {isManager ? (
        <Button label="Inviter des personnes" icon={<UserPlus size={20} color={colors.white} strokeWidth={2.25} />} onPress={() => setInviteOpen(true)} />
      ) : null}

      <SectionHeader title="Préparent le cadeau" count={preparers.length} />
      {members.isPending ? (
        <SkeletonList rows={3} />
      ) : (
        <Group>
          {preparers.map((m, i) => (
            <View key={m.user_id}>
              {i > 0 ? <Divider /> : null}
              <MemberLine member={m} me={session?.user.id} eventId={id} myRole={myRole} onError={setError} />
            </View>
          ))}
        </Group>
      )}

      <SectionHeader title="Personne fêtée" />
      <Group>
        {beneficiary ? (
          <MemberLine member={beneficiary} me={session?.user.id} eventId={id} myRole={myRole} onError={setError} />
        ) : (
          <ListRow
            title={event.data?.beneficiary_name ?? 'Bénéficiaire'}
            subtitle={pending.some((p) => p.role === 'beneficiary') ? 'Invitation envoyée : elle ne verra rien avant l’ouverture.' : 'Pas encore invitée. Elle ne verra rien avant l’ouverture de la capsule.'}
            left={<UserAvatar name={event.data?.beneficiary_name ?? '?'} size={44} ring={null} />}
          />
        )}
      </Group>

      {isManager && pending.length > 0 ? (
        <>
          <SectionHeader title="Invitations en attente" count={pending.length} />
          <Group>
            {pending.map((o, i) => (
              <View key={o.id}>
                {i > 0 ? <Divider /> : null}
                <InviteLine row={o} eventId={id} />
              </View>
            ))}
          </Group>
        </>
      ) : null}

      {isManager && history.length > 0 ? (
        <>
          <SectionHeader title="Réponses récentes" />
          <Group>
            {history.map((o, i) => (
              <View key={o.id}>
                {i > 0 ? <Divider /> : null}
                <InviteLine row={o} eventId={id} />
              </View>
            ))}
          </Group>
        </>
      ) : null}

      {isManager && invitations.data && invitations.data.length > 0 ? (
        <>
          <SectionHeader title="Liens de partage" />
          <T v="small" color={colors.inkSoft}>
            Un lien de partage fonctionne pour toute personne qui le reçoit, dans la limite fixée. Désactive-le s’il circule trop.
          </T>
          <Group>
            {invitations.data.map((inv, i) => (
              <View key={inv.id}>
                {i > 0 ? <Divider /> : null}
                <LinkLine inv={inv} eventId={id} onError={setError} />
              </View>
            ))}
          </Group>
        </>
      ) : null}

      {myRole && myRole !== 'organizer' ? (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <T v="small" color={colors.inkSoft}>
            Quitter le groupe : tu n’auras plus accès à la cagnotte. Tes messages restent visibles ; ta participation reste comptée dans le total.
          </T>
          <ConfirmButton
            label="Quitter la cagnotte"
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
        </View>
      ) : isOrganizer ? (
        <Banner tone="info" title="Tu organises cette cagnotte">
          Pour quitter le groupe, transmets d’abord l’organisation à un membre (touche sa ligne).
        </Banner>
      ) : null}

      {isManager ? (
        <InviteSheet
          visible={inviteOpen}
          onClose={() => setInviteOpen(false)}
          eventId={id}
          isOrganizer={isOrganizer}
          hasBeneficiary={hasBeneficiary}
          memberIds={new Set(list.map((m) => m.user_id))}
          pendingIds={new Set(pending.map((p) => p.invitee_id).filter((x): x is string => !!x))}
        />
      ) : null}
    </Screen>
  );
}

// ------------------------------------------------------------------ Feuille d'invitation
function InviteSheet({
  visible,
  onClose,
  eventId,
  isOrganizer,
  hasBeneficiary,
  memberIds,
  pendingIds,
}: {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  isOrganizer: boolean;
  hasBeneficiary: boolean;
  memberIds: Set<string>;
  pendingIds: Set<string>;
}) {
  const [mode, setMode] = useState<'friends' | 'email' | 'link'>('friends');
  const roles: InviteRole[] = ['participant', ...(isOrganizer ? (['co_organizer'] as const) : []), ...(!hasBeneficiary ? (['beneficiary'] as const) : [])];
  const [role, setRole] = useState<InviteRole>('participant');
  const safeRole = roles.includes(role) ? role : 'participant';
  return (
    <Sheet visible={visible} onClose={onClose} title="Inviter" subtitle="Chaque personne choisit de rejoindre ou non : personne n’est ajouté en silence.">
      <Segmented
        label="Façon d’inviter"
        value={mode}
        onChange={setMode}
        options={[
          { key: 'friends', label: 'Amis' },
          { key: 'email', label: 'E-mail' },
          { key: 'link', label: 'Lien' },
        ]}
      />
      <View style={{ gap: 6 }}>
        <T v="label">Rôle</T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {roles.map((r) => (
            <ChoiceChip key={r} label={ROLE_LABELS[r]} selected={safeRole === r} onPress={() => setRole(r)} />
          ))}
        </Row>
        <T v="small" color={colors.inkSoft}>
          {safeRole === 'beneficiary'
            ? 'La personne fêtée ne voit ni le cadeau, ni la cagnotte, ni la discussion avant l’ouverture de la capsule. Une seule invitation possible.'
            : safeRole === 'co_organizer'
              ? 'Un coorganisateur peut inviter, régler la cagnotte, choisir le cadeau et répartir les missions.'
              : 'Un participant propose, vote, participe, prend des missions et écrit dans la capsule.'}
        </T>
      </View>
      {mode === 'friends' ? (
        <FriendPicker eventId={eventId} role={safeRole} memberIds={memberIds} pendingIds={pendingIds} onDone={onClose} />
      ) : mode === 'email' ? (
        <EmailInvite eventId={eventId} role={safeRole} />
      ) : (
        <LinkInvite eventId={eventId} role={safeRole} />
      )}
    </Sheet>
  );
}

function FriendPicker({ eventId, role, memberIds, pendingIds, onDone }: { eventId: string; role: InviteRole; memberIds: Set<string>; pendingIds: Set<string>; onDone: () => void }) {
  const friends = useFriends();
  const invite = useInviteFriends(eventId);
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const list = useMemo(() => (friends.data ?? []).filter((f) => f.relation === 'friend'), [friends.data]);
  const single = role === 'beneficiary';

  function toggle(id: string) {
    hapticTap();
    setSelected((cur) => {
      const next = new Set(single ? [] : cur);
      if (cur.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    try {
      const res = await invite.mutateAsync({ users: [...selected], role });
      const ok = res.filter((r) => r.status === 'invited').length;
      const others = res.filter((r) => r.status !== 'invited');
      hapticSuccess();
      toast.show({
        text: ok ? `${ok} invitation${ok > 1 ? 's' : ''} envoyée${ok > 1 ? 's' : ''}${others.length ? ` · ${others.length} ignorée${others.length > 1 ? 's' : ''}` : ''}` : INVITE_FRIEND_MESSAGES[others[0]?.status ?? 'invalid'],
        tone: ok ? 'success' : 'error',
      });
      setSelected(new Set());
      if (ok) onDone();
    } catch (e) {
      toast.show({ text: messageFor(e), tone: 'error' });
    }
  }

  if (friends.isPending) return <SkeletonList rows={3} />;
  if (list.length === 0) {
    return (
      <View style={{ gap: space.md, alignItems: 'flex-start' }}>
        <T color={colors.inkSoft}>Tu n’as pas encore d’amis sur COMPLICE. Ajoute-les par leur pseudo, ou invite-les par e-mail ou avec un lien.</T>
        <Button compact variant="outline" label="Trouver des amis" icon={<Users size={18} color={colors.ink} />} onPress={() => (onDone(), router.push('/friends'))} />
      </View>
    );
  }
  return (
    <View style={{ gap: space.md }}>
      <Group>
        {list.map((f, i) => {
          const member = memberIds.has(f.user_id);
          const invited = pendingIds.has(f.user_id);
          const disabled = member || invited;
          const checked = selected.has(f.user_id);
          return (
            <View key={f.user_id}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled }}
                accessibilityLabel={`${f.display_name}${member ? ', déjà membre' : invited ? ', déjà invité' : ''}`}
                disabled={disabled}
                onPress={() => toggle(f.user_id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, opacity: disabled ? 0.5 : 1 }}
              >
                <UserAvatar name={f.display_name} path={f.avatar_path} seed={f.user_id} size={40} ring={null} />
                <View style={{ flex: 1 }}>
                  <T v="bodyBold" numberOfLines={1}>
                    {f.display_name}
                  </T>
                  <T v="small" color={colors.inkSoft}>
                    {member ? 'Déjà dans le groupe' : invited ? 'Invitation envoyée' : `@${f.username}`}
                  </T>
                </View>
                {!disabled ? <CheckDot checked={checked} /> : null}
              </Pressable>
            </View>
          );
        })}
      </Group>
      <Button
        label={selected.size ? `Inviter ${selected.size} ami${selected.size > 1 ? 's' : ''}` : 'Choisis tes amis'}
        variant="secondary"
        disabled={selected.size === 0}
        loading={invite.isPending}
        onPress={send}
      />
    </View>
  );
}

function EmailInvite({ eventId, role }: { eventId: string; role: InviteRole }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const qcOverview = useInvitesOverview(eventId, false);

  if (!isApiConfigured) {
    return <Banner tone="warning">L’envoi d’e-mails passe par le serveur COMPLICE, qui n’est pas configuré dans cette version : utilise plutôt un lien.</Banner>;
  }

  async function send() {
    if (sending) return;
    setState(null);
    if (!isEmail(email)) return setState({ tone: 'error', text: 'Adresse e-mail invalide.' });
    setSending(true);
    try {
      const r = await api.inviteByEmail(eventId, email.trim(), role);
      if (r.status === 'already_sent') setState({ tone: 'info', text: 'Une invitation est déjà partie vers cette adresse il y a moins d’une heure.' });
      else if ((r.status as string) === 'already_member') setState({ tone: 'info', text: 'Cette personne fait déjà partie du groupe.' });
      else {
        hapticSuccess();
        toast.show({ text: 'Invitation envoyée par e-mail', tone: 'success' });
        setEmail('');
        setState({ tone: 'info', text: 'Le lien est personnel : seul le compte vérifié de cette adresse peut l’utiliser. Valable 7 jours. Si la personne a déjà un compte, l’invitation apparaît aussi dans son app.' });
      }
      void qcOverview.refetch();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setState({ tone: 'error', text: code === 'network' ? 'Connexion impossible. Vérifie ton réseau et réessaie.' : messageFor(code || e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <Field label="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="ami@exemple.fr" icon={<Mail size={20} color={colors.inkSoft} />} onSubmitEditing={send} />
      {state ? <Banner tone={state.tone}>{state.text}</Banner> : null}
      <Button label="Envoyer l’invitation" variant="secondary" onPress={send} loading={sending} />
      <T v="small" color={colors.inkSoft}>
        L’adresse sert uniquement à cet envoi et n’est jamais montrée au groupe (seulement masquée dans ton suivi). Aucun compte n’est créé sans l’accord de la personne.
      </T>
    </View>
  );
}

function LinkInvite({ eventId, role }: { eventId: string; role: InviteRole }) {
  const create = useCreateInvitation(eventId);
  const [hours, setHours] = useState<number>(168);
  const [singleUse, setSingleUse] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <View style={{ gap: space.md }}>
      <View style={{ gap: 6 }}>
        <T v="label">Valable</T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {INVITATION_EXPIRY_CHOICES.map((h) => (
            <ChoiceChip key={h} label={EXPIRY_LABELS[h]!} selected={hours === h} onPress={() => setHours(h)} />
          ))}
        </Row>
      </View>
      {role !== 'beneficiary' ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T v="bodyBold">Usage unique</T>
            <T v="small" color={colors.inkSoft}>
              Sinon, le lien sert à plusieurs personnes.
            </T>
          </View>
          <Switch value={singleUse} onValueChange={setSingleUse} trackColor={{ true: colors.violet, false: colors.border }} accessibilityLabel="Lien à usage unique" />
        </Row>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {!link ? (
        <Button label="Créer le lien" variant="secondary" icon={<Link2 size={18} color={colors.white} />} onPress={generate} loading={create.isPending} />
      ) : (
        <View style={{ gap: space.sm }}>
          <T v="small" selectable style={{ backgroundColor: colors.surface, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
            {link}
          </T>
          <T v="small" color={colors.inkSoft}>
            Le lien n’est affiché qu’une fois. Tu pourras le désactiver dans « Liens de partage ».
          </T>
          <Row>
            <Button compact style={{ flex: 1 }} label="Partager" icon={<Share2 size={18} color={colors.white} />} onPress={() => Share.share({ message: `Rejoins-moi sur COMPLICE pour préparer le cadeau : ${link}` })} />
            <Button
              compact
              variant="outline"
              style={{ flex: 1 }}
              label={copied ? 'Copié !' : 'Copier'}
              icon={<Copy size={18} color={colors.ink} />}
              onPress={async () => {
                await Clipboard.setStringAsync(link);
                hapticSuccess();
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
            />
          </Row>
          <Button compact variant="ghost" label="Créer un autre lien" onPress={() => setLink(null)} />
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ Lignes
function InviteLine({ row, eventId }: { row: InviteOverviewRow; eventId: string }) {
  const cancel = useCancelInvite(eventId);
  const toast = useToast();
  const status = STATUS[row.status];
  const name = row.display_name ?? row.email_hint ?? 'Invitation par e-mail';
  return (
    <ListRow
      title={name}
      subtitle={`${ROLE_LABELS[row.role]} · ${row.kind === 'email' ? 'par e-mail' : 'entre amis'} · ${row.status === 'pending' ? `expire le ${formatShortDate(row.expires_at)}` : formatShortDate(row.responded_at ?? row.created_at)}`}
      left={row.display_name ? <UserAvatar name={row.display_name} path={row.avatar_path} seed={row.invitee_id ?? undefined} size={40} ring={null} /> : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' }}><Mail size={18} color={colors.violet} /></View>}
      right={
        row.status === 'pending' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Annuler l’invitation de ${name}`}
            hitSlop={8}
            onPress={() =>
              cancel.mutate(
                { id: row.id, kind: row.kind, attached: !!row.invitee_id },
                { onSuccess: () => toast.show({ text: 'Invitation annulée', tone: 'info' }), onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }) },
              )
            }
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft }}
          >
            <X size={18} color={colors.ink} />
          </Pressable>
        ) : (
          <Chip label={status.label} tone={status.tone} />
        )
      }
    />
  );
}

function MemberLine({ member, me, eventId, myRole, onError }: { member: MemberRow; me?: string; eventId: string; myRole?: MemberRole; onError: (m: string | null) => void }) {
  const setRole = useSetMemberRole(eventId);
  const remove = useRemoveMember(eventId);
  const transfer = useTransferOwnership(eventId);
  const [open, setOpen] = useState(false);
  const name = member.profiles?.display_name ?? 'Membre';
  const isMe = member.user_id === me;
  const canPromote = myRole === 'organizer' && !isMe && (member.role === 'participant' || member.role === 'co_organizer');
  const canRemove = !isMe && member.role !== 'organizer' && (myRole === 'organizer' || (myRole === 'co_organizer' && (member.role === 'participant' || member.role === 'beneficiary')));
  const run = async (fn: () => Promise<unknown>) => {
    onError(null);
    try {
      await fn();
      setOpen(false);
    } catch (e) {
      onError(messageFor(e));
    }
  };

  return (
    <>
      <ListRow
        title={`${name}${isMe ? ' (toi)' : ''}`}
        subtitle={`${ROLE_LABELS[member.role]} · depuis le ${formatShortDate(member.joined_at)}`}
        left={<UserAvatar name={name} path={member.profiles?.avatar_path} seed={member.user_id} size={44} ring={null} />}
        right={member.role === 'organizer' ? <Chip label="Organise" tone="coral" /> : member.role === 'co_organizer' ? <Chip label="Coorganise" tone="lavender" /> : null}
        onPress={canPromote || canRemove ? () => setOpen(true) : undefined}
        chevron={canPromote || canRemove}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title={name} subtitle={ROLE_LABELS[member.role]}>
        <View style={{ gap: space.md }}>
          {canPromote ? (
            <Button
              variant="outline"
              label={member.role === 'co_organizer' ? 'Retirer le rôle de coorganisateur' : 'Nommer coorganisateur'}
              loading={setRole.isPending}
              onPress={() => run(() => setRole.mutateAsync({ userId: member.user_id, role: member.role === 'co_organizer' ? 'participant' : 'co_organizer' }))}
            />
          ) : null}
          {canPromote ? <ConfirmButton variant="outline" label="Transmettre l’organisation" confirmLabel={`Confirmer : ${name} organise`} loading={transfer.isPending} onConfirm={() => run(() => transfer.mutateAsync(member.user_id))} /> : null}
          {canRemove ? <ConfirmButton label="Retirer du groupe" confirmLabel="Confirmer le retrait" loading={remove.isPending} onConfirm={() => run(() => remove.mutateAsync(member.user_id))} /> : null}
          <T v="small" color={colors.inkSoft}>
            Retirer quelqu’un coupe son accès immédiatement ; sa participation reste comptée dans le total.
          </T>
        </View>
      </Sheet>
    </>
  );
}

function LinkLine({ inv, eventId, onError }: { inv: InvitationRow; eventId: string; onError: (m: string | null) => void }) {
  const revoke = useRevokeInvitation(eventId);
  const now = useNow();
  const expired = new Date(inv.expires_at).getTime() <= now;
  const exhausted = inv.max_uses !== null && inv.use_count >= inv.max_uses;
  const status = inv.revoked_at ? 'Désactivé' : expired ? 'Expiré' : exhausted ? 'Épuisé' : 'Actif';
  const active = status === 'Actif';
  return (
    <View style={{ paddingVertical: space.md, gap: space.sm }}>
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
    </View>
  );
}
