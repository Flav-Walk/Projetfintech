import { messageFor } from '@complice/shared';
import { CalendarClock, Check, CircleDashed, Hand, Pencil, Plus, RotateCcw, UserRoundCog, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmButton } from '@/components/confirm-button';
import { DateField } from '@/components/date-field';
import { Avatar } from '@/components/event-parts';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Chip, Field, ProgressBar, Row, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatEventDate } from '@/lib/format';
import { useEvent, useMembers, useProgress } from '@/lib/queries';
import { useAssignTask, useClaimTask, useCompleteTask, useCreateTask, useDeleteTask, useReleaseTask, useTasks, useUpdateTask } from '@/lib/tasks';
import type { MemberRow, TaskRow } from '@/lib/types';
import { useEventId } from '@/lib/use-event-context';
import { useNow } from '@/lib/use-now';
import { colors, gutter, radius, space } from '@/theme/tokens';

export default function Missions() {
  const id = useEventId();
  const { session } = useAuth();
  const me = session?.user.id;
  const now = useNow();
  const event = useEvent(id);
  const progress = useProgress(id);
  const tasks = useTasks(id);
  const members = useMembers(id);
  const claim = useClaimTask(id);
  const complete = useCompleteTask(id);
  const release = useReleaseTask(id);
  const assign = useAssignTask(id);
  const remove = useDeleteTask(id);
  const [notice, setNotice] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<TaskRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  if (event.isPending || progress.isPending || tasks.isPending) return <Loading />;
  if (!event.data || !progress.data || tasks.isError) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ErrorState error={tasks.error ?? event.error} onRetry={() => tasks.refetch()} />
      </SafeAreaView>
    );
  }
  if (progress.data.my_role === 'beneficiary') {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <EmptyState title="Chut…" text="Les missions sont l’affaire de ton groupe." />
      </SafeAreaView>
    );
  }

  const e = event.data;
  const isManager = progress.data.my_role === 'organizer' || progress.data.my_role === 'co_organizer';
  const list = tasks.data;
  const done = list.filter((t) => t.status === 'done').length;
  const preparers = (members.data ?? []).filter((m) => m.role !== 'beneficiary');
  const error = claim.error ?? complete.error ?? release.error ?? assign.error ?? remove.error;
  const locked = e.status !== 'active';

  const onClaim = (t: TaskRow) =>
    claim.mutate(t.id, {
      onSuccess: (r) => {
        if (r.status === 'taken') {
          const who = preparers.find((m) => m.user_id === r.assignee_id)?.profiles?.display_name ?? 'un autre membre';
          setNotice(`Trop tard : « ${t.title} » vient d’être prise par ${who}.`);
        } else setNotice(null);
      },
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={tasks.isRefetching} tintColor={colors.coral} onRefresh={() => void tasks.refetch()} />}
      >
        <View style={{ gap: 4 }}>
          <T v="h1" accessibilityRole="header">
            Missions
          </T>
          <T color={colors.inkSoft}>Chaque coup de main compte, quel que soit le montant donné.</T>
        </View>

        <Card tone="violet" style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h3" color={colors.white}>
              Avancement
            </T>
            <T v="label" color={colors.white}>
              {done}/{list.length} terminées
            </T>
          </Row>
          <ProgressBar value={list.length ? (done * 100) / list.length : 0} track="rgba(255,255,255,0.3)" fill={colors.white} label={`${done} missions terminées sur ${list.length}`} />
        </Card>

        {notice ? <Banner tone="warning">{notice}</Banner> : null}
        {error ? <Banner tone="error">{messageFor(error)}</Banner> : null}

        {isManager && !locked ? (
          <Button variant="secondary" label="Ajouter une mission" icon={<Plus size={20} color={colors.white} strokeWidth={2.5} />} onPress={() => setCreating(true)} />
        ) : null}

        {list.length === 0 ? <EmptyState title="Aucune mission" text="Ajoute ce qu’il reste à faire pour le jour J." /> : null}

        {list.map((t) => {
          const mine = t.assignee_id === me;
          const overdue = !!t.due_at && t.status !== 'done' && new Date(t.due_at).getTime() < now;
          const busy = [claim, complete, release, remove].some((m) => m.isPending && m.variables === t.id);
          return (
            <Card key={t.id} style={[{ gap: space.md }, t.status === 'done' && { backgroundColor: colors.mint, borderColor: colors.mint }]}>
              <Row style={{ alignItems: 'flex-start' }}>
                {t.status === 'done' ? (
                  <Check size={24} color={colors.success} strokeWidth={2.5} />
                ) : t.status === 'claimed' ? (
                  <Hand size={24} color={colors.violet} strokeWidth={1.75} />
                ) : (
                  <CircleDashed size={24} color={colors.inkSoft} strokeWidth={1.75} />
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="bodyBold" style={t.status === 'done' ? { textDecorationLine: 'line-through' } : undefined}>
                    {t.title}
                  </T>
                  <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
                    <Chip
                      label={t.status === 'done' ? 'Terminée' : t.status === 'claimed' ? (mine ? 'Ta mission' : 'Prise') : 'Libre'}
                      tone={t.status === 'done' ? 'mint' : t.status === 'claimed' ? 'lavender' : 'grey'}
                    />
                    {t.due_at ? <Chip label={`${overdue ? 'En retard · ' : ''}${formatEventDate(t.due_at, e.timezone, false)}`} tone={overdue ? 'sun' : 'grey'} /> : null}
                  </Row>
                </View>
              </Row>
              {t.assignee_id ? (
                <Row gap={space.sm}>
                  <Avatar name={t.assignee?.display_name ?? '?'} size={28} />
                  <T v="small" color={colors.inkSoft}>
                    {mine ? 'Toi' : (t.assignee?.display_name ?? 'Ancien membre')}
                  </T>
                </Row>
              ) : null}
              {!locked ? (
                <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
                  {t.status === 'open' ? <Button compact label="Prendre la mission" loading={busy} onPress={() => onClaim(t)} /> : null}
                  {t.status === 'claimed' && (mine || isManager) ? (
                    <Button compact variant="secondary" label="C’est fait" icon={<Check size={16} color={colors.white} strokeWidth={2.5} />} loading={busy} onPress={() => complete.mutate(t.id)} />
                  ) : null}
                  {t.status === 'claimed' && mine ? <Button compact variant="ghost" label="Libérer" onPress={() => release.mutate(t.id)} /> : null}
                  {isManager && t.status !== 'done' ? (
                    <Button compact variant="ghost" label={t.assignee_id ? 'Réattribuer' : 'Attribuer'} icon={<UserRoundCog size={16} color={colors.ink} />} onPress={() => setAssigning(t)} />
                  ) : null}
                  {isManager && t.status === 'done' ? (
                    <Button compact variant="ghost" label="Rouvrir" icon={<RotateCcw size={16} color={colors.ink} />} onPress={() => release.mutate(t.id)} />
                  ) : null}
                  {isManager && t.status !== 'done' ? (
                    <Button compact variant="ghost" label="Modifier" icon={<Pencil size={16} color={colors.ink} />} onPress={() => setEditing(t)} />
                  ) : null}
                  {isManager && t.kind === 'custom' && t.status !== 'done' ? (
                    <ConfirmButton variant="outline" label="Supprimer" confirmLabel="Confirmer" onConfirm={() => remove.mutate(t.id)} />
                  ) : null}
                </Row>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>

      <MemberPicker
        task={assigning}
        members={preparers}
        me={me}
        onClose={() => setAssigning(null)}
        onPick={(userId) => {
          if (assigning) assign.mutate({ taskId: assigning.id, userId });
          setAssigning(null);
        }}
      />
      <CreateTask eventId={id} visible={creating} members={preparers} onClose={() => setCreating(false)} />
      <EditTask eventId={id} task={editing} onClose={() => setEditing(null)} />
    </SafeAreaView>
  );
}

function EditTask({ eventId, task, onClose }: { eventId: string; task: TaskRow | null; onClose: () => void }) {
  const update = useUpdateTask(eventId);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<Date | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (task && loadedFor !== task.id) {
    setLoadedFor(task.id);
    setTitle(task.title);
    setDue(task.due_at ? new Date(task.due_at) : null);
  }
  const titleError = title.trim().length < 2 ? 'Donne un titre (2 caractères minimum).' : null;
  const close = () => {
    setLoadedFor(null);
    update.reset();
    onClose();
  };
  return (
    <Sheet visible={!!task} title="Modifier la mission" onClose={close}>
      <Field label="Titre" value={title} onChangeText={setTitle} maxLength={80} error={title ? titleError : null} />
      {due ? (
        <View style={{ gap: space.sm }}>
          <DateField label="Échéance" value={due} onChange={setDue} minimumDate={new Date()} />
          <Button compact variant="ghost" label="Sans échéance" onPress={() => setDue(null)} />
        </View>
      ) : (
        <Button compact variant="outline" label="Ajouter une échéance" icon={<CalendarClock size={16} color={colors.ink} />} onPress={() => setDue(new Date(Date.now() + 3 * 86400000))} />
      )}
      {update.isError ? <Banner tone="error">{messageFor(update.error)}</Banner> : null}
      <Button
        label="Enregistrer"
        loading={update.isPending}
        disabled={!!titleError}
        onPress={() => task && update.mutate({ taskId: task.id, title: title.trim(), dueAt: due }, { onSuccess: close })}
      />
    </Sheet>
  );
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(42,20,70,0.35)' }}>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, maxHeight: '85%' }}>
          <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} keyboardShouldPersistTaps="handled">
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2" accessibilityRole="header" style={{ flex: 1 }}>
                {title}
              </T>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} hitSlop={12} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <X size={24} color={colors.ink} />
              </Pressable>
            </Row>
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function MemberPicker({ task, members, me, onClose, onPick }: { task: TaskRow | null; members: MemberRow[]; me?: string; onClose: () => void; onPick: (userId: string) => void }) {
  return (
    <Sheet visible={!!task} title={`Confier « ${task?.title ?? ''} »`} onClose={onClose}>
      {members.map((m, i) => (
        <Card key={m.user_id} onPress={() => onPick(m.user_id)} accessibilityLabel={`Confier à ${m.profiles?.display_name ?? 'ce membre'}`} style={{ padding: space.md }}>
          <Row>
            <Avatar name={m.profiles?.display_name ?? '?'} index={i} />
            <T v="bodyBold" style={{ flex: 1 }}>
              {m.user_id === me ? 'Moi' : (m.profiles?.display_name ?? 'Membre')}
            </T>
            {task?.assignee_id === m.user_id ? <Chip label="Actuel" /> : null}
          </Row>
        </Card>
      ))}
    </Sheet>
  );
}

function CreateTask({ eventId, visible, members, onClose }: { eventId: string; visible: boolean; members: MemberRow[]; onClose: () => void }) {
  const create = useCreateTask(eventId);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const titleError = submitted && title.trim().length < 2 ? 'Donne un titre (2 caractères minimum).' : null;

  const close = () => {
    setTitle('');
    setDue(null);
    setAssignee(null);
    setSubmitted(false);
    create.reset();
    onClose();
  };

  return (
    <Sheet visible={visible} title="Nouvelle mission" onClose={close}>
      <Field label="Titre" value={title} onChangeText={setTitle} placeholder="Réserver le restaurant" maxLength={80} error={titleError} />
      {due ? (
        <View style={{ gap: space.sm }}>
          <DateField label="Échéance" value={due} onChange={setDue} minimumDate={new Date()} />
          <Button compact variant="ghost" label="Sans échéance" onPress={() => setDue(null)} />
        </View>
      ) : (
        <Button compact variant="outline" label="Ajouter une échéance" icon={<CalendarClock size={16} color={colors.ink} />} onPress={() => setDue(new Date(Date.now() + 3 * 86400000))} />
      )}
      <T v="label">Responsable (facultatif)</T>
      <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
        {[{ user_id: null as string | null, name: 'Personne' }, ...members.map((m) => ({ user_id: m.user_id as string | null, name: m.profiles?.display_name ?? 'Membre' }))].map((o) => {
          const selected = assignee === o.user_id;
          return (
            <Pressable
              key={o.user_id ?? 'none'}
              onPress={() => setAssignee(o.user_id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: selected ? colors.violet : colors.border, backgroundColor: selected ? colors.lavender : colors.surface, justifyContent: 'center' }}
            >
              <T v="label">{o.name}</T>
            </Pressable>
          );
        })}
      </Row>
      {create.isError ? <Banner tone="error">{messageFor(create.error)}</Banner> : null}
      <Button
        label="Créer la mission"
        loading={create.isPending}
        onPress={() => {
          setSubmitted(true);
          if (title.trim().length < 2) return;
          create.mutate({ title: title.trim(), dueAt: due, assignee }, { onSuccess: close });
        }}
      />
    </Sheet>
  );
}
