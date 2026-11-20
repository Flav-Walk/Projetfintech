import { formatCents, messageFor } from '@complice/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ExternalLink, Pencil, Send, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { ConfirmButton } from '@/components/confirm-button';
import { openProductLink, PriceLine, ReactionBar } from '@/components/idea-parts';
import { PrivateImage } from '@/components/private-image';
import { ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Chip, Field, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import {
  useAddComment,
  useCastVote,
  useComments,
  useDeleteComment,
  useMyVote,
  useProposals,
  useReactions,
  useSelectGift,
  useSetProposalStatus,
  useToggleReaction,
} from '@/lib/ideas';
import { useEvent, useProgress } from '@/lib/queries';
import { useEventId } from '@/lib/use-event-context';
import { colors, space } from '@/theme/tokens';

export default function IdeaDetail() {
  const id = useEventId();
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const event = useEvent(id);
  const progress = useProgress(id);
  const proposals = useProposals(id);
  const myVote = useMyVote(id);
  const reactions = useReactions(id, pid ? [pid] : []);
  const comments = useComments(pid);
  const vote = useCastVote(id);
  const react = useToggleReaction(id);
  const setStatus = useSetProposalStatus(id);
  const select = useSelectGift(id);
  const addComment = useAddComment(pid);
  const delComment = useDeleteComment(pid);
  const [draft, setDraft] = useState('');

  if (event.isPending || proposals.isPending || progress.isPending) return <Loading />;
  const p = proposals.data?.find((x) => x.id === pid);
  if (!event.data || !progress.data || !p) {
    return (
      <Screen>
        <BackHeader title="Idée" />
        {proposals.isError ? <ErrorState error={proposals.error} onRetry={() => proposals.refetch()} /> : <Banner tone="error">Cette idée n’existe plus.</Banner>}
      </Screen>
    );
  }

  const e = event.data;
  const isManager = progress.data.my_role === 'organizer' || progress.data.my_role === 'co_organizer';
  const isAuthor = p.author_id === me;
  const isSelected = e.selected_proposal_id === p.id;
  const votesOpen = progress.data.votes_open && !e.selected_proposal_id;
  const isMine = myVote.data === p.id;
  const error = vote.error ?? setStatus.error ?? select.error ?? addComment.error ?? delComment.error;

  const sendComment = () => {
    const body = draft.trim();
    if (!body) return;
    addComment.mutate(body, { onSuccess: () => setDraft('') });
  };

  return (
    <Screen
      footer={
        p.status === 'active' && votesOpen ? (
          <Button
            variant={isMine ? 'secondary' : 'primary'}
            label={isMine ? 'Ma voix · retirer' : 'Voter pour cette idée'}
            icon={isMine ? <Check size={20} color={colors.white} strokeWidth={2.5} /> : undefined}
            loading={vote.isPending}
            onPress={() => vote.mutate(isMine ? null : p.id)}
          />
        ) : null
      }
    >
      <BackHeader
        title={p.title}
        right={
          isAuthor && p.status !== 'withdrawn' && !isSelected ? (
            <Button compact variant="outline" label="Modifier" icon={<Pencil size={16} color={colors.ink} />} onPress={() => router.push(`/event/${id}/idea/edit?pid=${p.id}` as never)} />
          ) : null
        }
      />
      <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
        {isSelected ? <Chip label="Cadeau retenu" /> : null}
        {p.status === 'unavailable' ? <Chip label="Indisponible" tone="grey" /> : null}
        {p.status === 'withdrawn' ? <Chip label="Retirée" tone="grey" /> : null}
        <Chip label={`${p.vote_count} voix`} tone="lavender" />
      </Row>

      {p.image_path ? <PrivateImage path={p.image_path} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 20 }} label={`Photo de ${p.title}`} /> : null}

      <Card style={{ gap: space.sm }}>
        <PriceLine p={p} />
        <T v="small" color={colors.inkSoft}>
          Proposé par {p.profiles?.display_name ?? 'un ancien membre'} · {timeAgo(p.created_at)}
        </T>
        {p.description ? <T>{p.description}</T> : null}
        {p.product_url ? (
          <Button compact variant="outline" label="Voir le produit" icon={<ExternalLink size={18} color={colors.ink} />} onPress={() => openProductLink(p.product_url!)} />
        ) : null}
      </Card>

      {p.previous_price_cents !== null && p.previous_price_cents !== p.price_cents ? (
        <Banner tone="warning" title="Le prix a changé">
          {`Avant : ${formatCents(p.previous_price_cents)}. Maintenant : ${formatCents(p.price_cents)}. Les voix restent valables : changez-les si besoin.`}
        </Banner>
      ) : null}

      <ReactionBar reactions={reactions.data ?? []} me={me} onToggle={(emoji, current) => react.mutate({ proposalId: p.id, emoji, current })} />

      {error ? <Banner tone="error">{messageFor(error)}</Banner> : null}

      {isManager && p.status !== 'withdrawn' ? (
        <Card tone="lavender" style={{ gap: space.md }}>
          <T v="h3">Organisation</T>
          {isSelected ? (
            <ConfirmButton variant="outline" label="Annuler ce choix" confirmLabel="Confirmer l’annulation" loading={select.isPending} onConfirm={() => select.mutate(null)} />
          ) : p.status === 'active' ? (
            <>
              <T v="small" color={colors.inkSoft}>
                Confirmer ce cadeau prévient le groupe. Rien n’est acheté automatiquement : la mission « Commander le cadeau » s’en charge.
              </T>
              <ConfirmButton variant="secondary" compact={false} label="Choisir ce cadeau" confirmLabel="Oui, c’est celui-là" loading={select.isPending} onConfirm={() => select.mutate(p.id)} />
            </>
          ) : null}
          {!isSelected ? (
            p.status === 'unavailable' ? (
              <Button compact variant="outline" label="Remettre au vote" loading={setStatus.isPending} onPress={() => setStatus.mutate({ id: p.id, status: 'active' })} />
            ) : (
              <ConfirmButton
                variant="outline"
                label="Marquer indisponible"
                confirmLabel="Les voix seront libérées"
                loading={setStatus.isPending}
                onConfirm={() => setStatus.mutate({ id: p.id, status: 'unavailable' })}
              />
            )
          ) : null}
        </Card>
      ) : null}

      {isAuthor && p.status !== 'withdrawn' && !isSelected ? (
        <ConfirmButton
          label="Retirer mon idée"
          confirmLabel="Retirer définitivement"
          loading={setStatus.isPending}
          onConfirm={() => setStatus.mutate({ id: p.id, status: 'withdrawn' }, { onSuccess: () => router.back() })}
        />
      ) : null}

      <View style={{ gap: space.md }}>
        <T v="h3">Commentaires</T>
        {comments.isPending ? (
          <T color={colors.inkSoft}>Chargement…</T>
        ) : comments.isError ? (
          <ErrorState error={comments.error} onRetry={() => comments.refetch()} />
        ) : (comments.data ?? []).length === 0 ? (
          <T color={colors.inkSoft}>Pas encore de commentaire.</T>
        ) : (
          comments.data!.map((c) => (
            <Card key={c.id} style={{ gap: 4, padding: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="label">{c.profiles?.display_name ?? 'Ancien membre'}</T>
                <Row gap={space.sm}>
                  <T v="small" color={colors.inkSoft}>
                    {timeAgo(c.created_at)}
                  </T>
                  {c.author_id === me ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Supprimer mon commentaire" hitSlop={12} onPress={() => delComment.mutate(c.id)}>
                      <Trash2 size={16} color={colors.inkSoft} />
                    </Pressable>
                  ) : null}
                </Row>
              </Row>
              <T>{c.body}</T>
            </Card>
          ))
        )}
        <Field
          label="Ajouter un commentaire"
          value={draft}
          onChangeText={setDraft}
          placeholder="Ton avis sur cette idée"
          maxLength={500}
          multiline
          returnKeyType="send"
        />
        <Button compact variant="outline" label="Publier" icon={<Send size={16} color={colors.ink} />} disabled={!draft.trim()} loading={addComment.isPending} onPress={sendComment} />
      </View>
    </Screen>
  );
}
