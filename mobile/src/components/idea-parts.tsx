import { formatCents, REACTIONS } from '@complice/shared';
import { Check, ExternalLink, Trophy } from 'lucide-react-native';
import { Linking, Pressable, View } from 'react-native';
import type { ProposalRow, ReactionRow } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { PrivateImage } from './private-image';
import { Button, Card, Chip, ProgressBar, Row, T } from './ui';

export function openProductLink(url: string) {
  // Lien saisi par un membre : ouverture explicite dans le navigateur, jamais d'achat automatique.
  Linking.openURL(url).catch(() => undefined);
}

export function PriceLine({ p }: { p: ProposalRow }) {
  const changed = p.previous_price_cents !== null && p.previous_price_cents !== p.price_cents;
  return (
    <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
      <T v="h3">{formatCents(p.price_cents)}</T>
      {changed ? (
        <T v="small" color={colors.inkSoft} accessibilityLabel={`Prix modifié, ancien prix ${formatCents(p.previous_price_cents!)}`}>
          <T v="small" color={colors.inkSoft} style={{ textDecorationLine: 'line-through' }}>
            {formatCents(p.previous_price_cents!)}
          </T>{' '}
          · prix mis à jour
        </T>
      ) : null}
    </Row>
  );
}

export function ReactionBar({
  reactions,
  me,
  onToggle,
  disabled,
}: {
  reactions: ReactionRow[];
  me: string | undefined;
  onToggle: (emoji: string, current: string | null) => void;
  disabled?: boolean;
}) {
  const mine = reactions.find((r) => r.user_id === me)?.emoji ?? null;
  return (
    <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
      {REACTIONS.map((e) => {
        const count = reactions.filter((r) => r.emoji === e).length;
        const selected = mine === e;
        return (
          <Pressable
            key={e}
            disabled={disabled}
            onPress={() => onToggle(e, mine)}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`Réaction ${e}${count ? `, ${count}` : ''}${selected ? ', la tienne' : ''}`}
            style={{
              minHeight: 36,
              minWidth: 44,
              paddingHorizontal: 8,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: selected ? colors.violet : colors.border,
              backgroundColor: selected ? colors.lavender : colors.surface,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <T style={{ fontSize: 16 }}>{e}</T>
            {count ? (
              <T v="small" style={{ fontFamily: fonts.bold }}>
                {count}
              </T>
            ) : null}
          </Pressable>
        );
      })}
    </Row>
  );
}

export function ProposalCard({
  p,
  rank,
  tied,
  totalVotes,
  isMyVote,
  isSelected,
  votesOpen,
  voting,
  onVote,
  onOpen,
  reactions,
  me,
  onReact,
}: {
  p: ProposalRow;
  rank: number | null;
  tied: boolean;
  totalVotes: number;
  isMyVote: boolean;
  isSelected: boolean;
  votesOpen: boolean;
  voting: boolean;
  onVote: () => void;
  onOpen: () => void;
  reactions: ReactionRow[];
  me: string | undefined;
  onReact: (emoji: string, current: string | null) => void;
}) {
  const unavailable = p.status === 'unavailable';
  const share = totalVotes > 0 ? Math.round((p.vote_count * 100) / totalVotes) : 0;
  return (
    <Card style={[{ gap: space.md }, isSelected && { borderColor: colors.violet, borderWidth: 2 }, unavailable && { opacity: 0.75 }]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${p.title}, ${formatCents(p.price_cents)}. Voir le détail`} style={{ gap: space.md }}>
        <Row style={{ alignItems: 'flex-start' }}>
          {p.image_path ? <PrivateImage path={p.image_path} style={{ width: 76, height: 76, borderRadius: 14 }} label={`Photo de ${p.title}`} /> : null}
          <View style={{ flex: 1, gap: 4 }}>
            <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
              {isSelected ? <Chip label="Cadeau retenu" tone="lavender" /> : null}
              {rank === 1 && !tied && p.vote_count > 0 && !isSelected ? <Chip label="En tête" tone="sun" /> : null}
              {tied && p.vote_count > 0 ? <Chip label="Égalité" tone="sun" /> : null}
              {unavailable ? <Chip label="Indisponible" tone="grey" /> : null}
            </Row>
            <T v="h3" numberOfLines={2}>
              {p.title}
            </T>
            <PriceLine p={p} />
            <T v="small" color={colors.inkSoft} numberOfLines={1}>
              Proposé par {p.profiles?.display_name ?? 'un ancien membre'}
            </T>
          </View>
        </Row>
        {p.description ? (
          <T v="small" color={colors.inkSoft} numberOfLines={3}>
            {p.description}
          </T>
        ) : null}
      </Pressable>

      {!unavailable ? (
        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="small" color={colors.inkSoft}>
              {p.vote_count} voix{rank ? ` · ${rank}${rank === 1 ? 're' : 'e'}` : ''}
            </T>
            <T v="small" color={colors.inkSoft}>
              {share} %
            </T>
          </Row>
          <ProgressBar value={share} track={colors.lavender} fill={colors.violet} height={8} label={`${p.title} : ${share} % des voix`} />
        </View>
      ) : null}

      <ReactionBar reactions={reactions} me={me} onToggle={onReact} />

      <Row style={{ flexWrap: 'wrap' }}>
        {p.product_url ? (
          <Button
            compact
            variant="ghost"
            label="Voir le produit"
            icon={<ExternalLink size={18} color={colors.ink} strokeWidth={1.75} />}
            onPress={() => openProductLink(p.product_url!)}
            accessibilityHint="Ouvre le lien dans le navigateur"
          />
        ) : null}
        <View style={{ flex: 1 }} />
        {votesOpen && !unavailable ? (
          <Button
            compact
            variant={isMyVote ? 'secondary' : 'outline'}
            label={isMyVote ? 'Ma voix' : 'Voter'}
            icon={isMyVote ? <Check size={18} color={colors.white} strokeWidth={2.5} /> : undefined}
            loading={voting}
            onPress={onVote}
            accessibilityHint={isMyVote ? 'Appuie pour retirer ta voix' : 'Ta voix reste modifiable jusqu’à la clôture'}
          />
        ) : isSelected ? (
          <Row gap={4}>
            <Trophy size={18} color={colors.violet} />
            <T v="label" color={colors.violet}>
              Choisi par le groupe
            </T>
          </Row>
        ) : null}
      </Row>
    </Card>
  );
}
