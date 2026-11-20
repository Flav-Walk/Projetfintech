import { formatCents, messageFor } from '@complice/shared';
import { router } from 'expo-router';
import { Lightbulb, Plus, Scale } from 'lucide-react-native';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProposalCard } from '@/components/idea-parts';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Row, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatEventDate, timeUntil } from '@/lib/format';
import { useCastVote, useIdeasRealtime, useMyVote, useProposals, useRanking, useReactions, useToggleReaction } from '@/lib/ideas';
import { useEvent, useProgress } from '@/lib/queries';
import { useEventId } from '@/lib/use-event-context';
import { useNow } from '@/lib/use-now';
import { colors, gutter, space } from '@/theme/tokens';

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
  const sorted = [...visible].sort((a, b) => {
    if (a.id === e.selected_proposal_id) return -1;
    if (b.id === e.selected_proposal_id) return 1;
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.vote_count - a.vote_count || a.created_at.localeCompare(b.created_at);
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
          <T v="h1" accessibilityRole="header">
            Ton cadeau
          </T>
          {selected ? (
            <Card tone="lavender" style={{ gap: space.sm }}>
              <T v="h2">{selected.title}</T>
              {selected.description ? <T color={colors.inkSoft}>{selected.description}</T> : null}
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
        <View style={{ gap: 4 }}>
          <T v="h1" accessibilityRole="header">
            Choisir le cadeau
          </T>
          <T color={colors.inkSoft}>
            {e.selected_proposal_id
              ? 'Le cadeau est choisi. Merci pour vos idées !'
              : p.votes_open
                ? `Vote ouvert jusqu’au ${formatEventDate(e.votes_close_at, e.timezone)} (${timeUntil(e.votes_close_at, now)}). Ta voix reste modifiable.`
                : 'Le vote est clos.'}
          </T>
        </View>

        {selected ? (
          <Card tone="violet" style={{ gap: 6 }}>
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
          <Card tone="lavender" style={{ gap: space.sm }}>
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

        {sorted.length === 0 ? (
          <EmptyState
            title="Aucune idée pour l’instant"
            text={`Propose la première idée pour ${e.beneficiary_name} : un nom, un prix, un lien si tu en as un.`}
          />
        ) : (
          sorted.map((x) => {
            const r = rankMap.get(x.id);
            return (
              <ProposalCard
                key={x.id}
                p={x}
                rank={r?.rank ?? null}
                tied={r?.tied ?? false}
                totalVotes={totalVotes}
                isMyVote={myVote.data === x.id}
                isSelected={x.id === e.selected_proposal_id}
                votesOpen={votesOpen}
                voting={vote.isPending && vote.variables === x.id}
                onVote={() => vote.mutate(myVote.data === x.id ? null : x.id)}
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
