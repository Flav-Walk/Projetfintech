import { formatCents, messageFor } from '@complice/shared';
import { router } from 'expo-router';
import { Lightbulb, Plus, Scale } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventTabHeader, HeaderMeta } from '@/components/headers';
import { ProposalCard } from '@/components/idea-parts';
import { ChoiceChip } from '@/components/kit';
import { hapticSuccess } from '@/lib/haptics';
import { useToast } from '@/lib/toast';
import { PrivateImage } from '@/components/private-image';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Row, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatEventDate, timeUntil } from '@/lib/format';
import { useCastVote, useIdeasRealtime, useMyVote, useProposals, useRanking, useReactions, useToggleReaction } from '@/lib/ideas';
import { useEvent, useProgress, useRevealedGift } from '@/lib/queries';
import type { ProposalRow } from '@/lib/types';
import { useEventId } from '@/lib/use-event-context';
import { useNow } from '@/lib/use-now';
import { colors, gutter, space } from '@/theme/tokens';

type ViewMode = 'discover' | 'ranking' | 'recent' | 'mine';
const MODE_LABELS: Record<ViewMode, string> = { discover: 'À découvrir', ranking: 'Classement', recent: 'Dernières', mine: 'Mes idées' };

/** Ordre neutre et stable : dépend du membre et de l'idée, jamais des voix. */
function neutralOrder(me: string | undefined, id: string): number {
  let h = 2166136261;
  for (const c of `${me ?? ''}:${id}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export default function Ideas() {
  const id = useEventId();
  const { session } = useAuth();
  const me = session?.user.id;
  const now = useNow();
  useIdeasRealtime(id);
  const event = useEvent(id);
  const progress = useProgress(id);
  const isBeneficiary = progress.data?.my_role === 'beneficiary';
  const proposals = useProposals(id);
  const ranking = useRanking(id, !isBeneficiary && !!progress.data);
  const myVote = useMyVote(id, !isBeneficiary && !!progress.data);
  const visible = useMemo(() => (proposals.data ?? []).filter((p) => p.status !== 'withdrawn'), [proposals.data]);
  const reactions = useReactions(id, visible.map((p) => p.id));
  const vote = useCastVote(id);
  const react = useToggleReaction(id);
  const toast = useToast();
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  // Bénéficiaire : le cadeau retenu sans prix ni lien (les idées et leurs prix lui sont fermées).
  const gift = useRevealedGift(id, isBeneficiary);

  if (event.isPending || progress.isPending || proposals.isPending) return <Loading />;
  if (event.isError || proposals.isError || !event.data || !progress.data) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ErrorState error={event.error ?? proposals.error} onRetry={() => (event.refetch(), proposals.refetch())} />
      </SafeAreaView>
    );
  }

  const e = event.data;
  const p = progress.data;
  const isManager = p.my_role === 'organizer' || p.my_role === 'co_organizer';
  const votesOpen = p.votes_open && !e.selected_proposal_id;
  const rankMap = new Map((ranking.data ?? []).map((r) => [r.proposal_id, r]));
  // Tant que je n'ai pas voté, les idées sont présentées dans un ordre neutre (propre à chaque membre,
  // stable) pour qu'elles soient découvertes avant d'être comparées. Les nombres de voix restent réels.
  const mode: ViewMode = viewMode ?? (votesOpen && !myVote.data ? 'discover' : 'ranking');
  const byMode = (a: ProposalRow, b: ProposalRow) => {
    if (mode === 'recent' || mode === 'mine') return b.created_at.localeCompare(a.created_at);
    if (mode === 'discover') return neutralOrder(me, a.id) - neutralOrder(me, b.id);
    return b.vote_count - a.vote_count || a.created_at.localeCompare(b.created_at);
  };
  const sorted = [...visible]
    .filter((x) => mode !== 'mine' || x.author_id === me)
    .sort((a, b) => {
      if (a.id === e.selected_proposal_id) return -1;
      if (b.id === e.selected_proposal_id) return 1;
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return byMode(a, b);
    });
  const totalVotes = visible.filter((x) => x.status === 'active').reduce((s, x) => s + x.vote_count, 0);
  const topTied = (ranking.data ?? []).some((r) => r.rank === 1 && r.tied);
  const mine = visible.find((x) => x.id === myVote.data);
  const selected = visible.find((x) => x.id === e.selected_proposal_id);
  const open = (pid: string) => router.push(`/event/${id}/idea/${pid}` as never);

  if (isBeneficiary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: gutter, gap: space.lg }}>
          <EventTabHeader event={e} title="Ton cadeau" />
          {gift.isPending ? (
            <Loading />
          ) : gift.data ? (
            <Card tone="sun" style={{ gap: space.sm }}>
              {gift.data.image_path ? (
                <PrivateImage path={gift.data.image_path} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16 }} label={`Photo du cadeau : ${gift.data.title}`} />
              ) : null}
              <T v="h2">{gift.data.title}</T>
              {gift.data.description ? <T color={colors.inkSoft}>{gift.data.description}</T> : null}
            </Card>
          ) : (
            <EmptyState title="Surprise !" text="Ton groupe garde le secret sur le cadeau." />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: space.xxxl }}
        refreshControl={
          <RefreshControl
            refreshing={proposals.isRefetching}
            tintColor={colors.coral}
            onRefresh={() => {
              proposals.refetch();
              ranking.refetch();
              myVote.refetch();
              reactions.refetch();
            }}
          />
        }
      >
        <EventTabHeader
          event={e}
          title="Choisir le cadeau"
          accent={colors.sun}
          meta={
            e.selected_proposal_id ? (
              <HeaderMeta dot={colors.success} text="Le cadeau est choisi. Merci pour vos idées !" />
            ) : p.votes_open ? (
              <HeaderMeta dot={colors.sun} text={`Vote ouvert · clôture le ${formatEventDate(e.votes_close_at, e.timezone, false)}, ${timeUntil(e.votes_close_at, now)}. Ta voix reste modifiable.`} />
            ) : (
              <HeaderMeta dot={colors.inkLine} text="Le vote est clos." />
            )
          }
        />

        {selected ? (
          <Card tone="ink" style={{ gap: 6 }}>
            <T v="small" color={colors.white}>
              Cadeau retenu
            </T>
            <T v="h2" color={colors.white}>
              {selected.title}
            </T>
            <T v="bodyBold" color={colors.white}>
              {formatCents(selected.price_cents)}
            </T>
          </Card>
        ) : null}

        {!e.selected_proposal_id && isManager && (topTied || !p.votes_open) && visible.some((x) => x.status === 'active') ? (
          <Banner tone="warning" title={topTied ? 'Égalité en tête' : 'Le vote est clos'} icon={<Scale size={22} color={colors.ink} />}>
            {topTied
              ? 'Plusieurs idées ont le même nombre de voix. Ouvre l’une d’elles pour confirmer le cadeau retenu. Rien n’est acheté automatiquement.'
              : 'Ouvre l’idée choisie pour confirmer le cadeau. Rien n’est acheté automatiquement.'}
          </Banner>
        ) : null}

        {votesOpen && mine ? (
          <Card tone="soft" style={{ gap: space.sm }}>
            <T v="small" color={colors.inkSoft}>
              Ta voix
            </T>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="bodyBold" style={{ flex: 1 }} numberOfLines={2}>
                {mine.title}
              </T>
              <Button compact variant="ghost" label="Retirer" loading={vote.isPending && vote.variables === null} onPress={() => vote.mutate(null)} />
            </Row>
          </Card>
        ) : null}

        {vote.isError ? <Banner tone="error">{messageFor(vote.error)}</Banner> : null}

        {p.votes_open && !e.selected_proposal_id ? (
          <Button
            label="Proposer une idée"
            variant="secondary"
            icon={<Plus size={20} color={colors.white} strokeWidth={2.5} />}
            onPress={() => router.push(`/event/${id}/idea/edit` as never)}
          />
        ) : null}

        {visible.length > 1 ? (
          <View style={{ gap: 6 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }} accessibilityRole="tablist">
              {(Object.keys(MODE_LABELS) as ViewMode[]).map((m) => (
                <ChoiceChip key={m} label={MODE_LABELS[m]} selected={mode === m} onPress={() => setViewMode(m)} />
              ))}
            </ScrollView>
            {mode === 'discover' ? (
              <T v="small" color={colors.inkSoft}>
                Ordre mélangé pour découvrir chaque idée avant de voter. Le classement reste consultable à tout moment.
              </T>
            ) : null}
          </View>
        ) : null}

        {sorted.length === 0 ? (
          mode === 'mine' ? (
            <EmptyState title="Tu n’as pas encore proposé d’idée" text="Une idée suffit : un nom, un prix, un lien si tu en as un." />
          ) : (
            <EmptyState
              title="Aucune idée pour l’instant"
              text={`Propose la première idée pour ${e.beneficiary_name} : un nom, un prix, un lien si tu en as un.`}
            />
          )
        ) : (
          sorted.map((x) => {
            const r = rankMap.get(x.id);
            return (
              <ProposalCard
                key={x.id}
                p={x}
                rank={mode === 'ranking' ? (r?.rank ?? null) : null}
                tied={r?.tied ?? false}
                totalVotes={totalVotes}
                isMyVote={myVote.data === x.id}
                isSelected={x.id === e.selected_proposal_id}
                votesOpen={votesOpen}
                voting={vote.isPending && vote.variables === x.id}
                onVote={() => {
                  const withdraw = myVote.data === x.id;
                  vote.mutate(withdraw ? null : x.id, {
                    onSuccess: () => {
                      hapticSuccess();
                      toast.show({ text: withdraw ? 'Ta voix est retirée' : myVote.data ? 'Ton vote a changé : c’est enregistré' : 'Ta voix est enregistrée', tone: 'success' });
                    },
                  });
                }}
                onOpen={() => open(x.id)}
                reactions={(reactions.data ?? []).filter((r) => r.proposal_id === x.id)}
                me={me}
                onReact={(emoji, current) => react.mutate({ proposalId: x.id, emoji, current })}
              />
            );
          })
        )}

        {sorted.length > 0 ? (
          <Row style={{ justifyContent: 'center' }} gap={space.sm}>
            <Lightbulb size={16} color={colors.inkSoft} />
            <T v="small" color={colors.inkSoft}>
              {e.vote_visibility === 'public' ? 'Les votes sont visibles par le groupe.' : 'Les votes sont anonymes : seuls les totaux sont visibles.'}
            </T>
          </Row>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
