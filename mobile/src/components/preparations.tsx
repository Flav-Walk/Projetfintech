import type { EventProgress } from '@complice/shared';
import { Check, ChevronRight, Gift, ListChecks, Mailbox, Ribbon, UsersRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { formatEventDate, timeUntil } from '@/lib/format';
import { buildTracks, type Track, type TrackKey, type TrackState } from '@/lib/preparation';
import { useNow } from '@/lib/use-now';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { T } from './ui';

/**
 * Les préparatifs d'une surprise : quatre chantiers parallèles (logique dans lib/preparation), puis le jour J.
 * Repères : fait = tampon menthe coché ; en cours = soleil ; pas commencé = pointillés. « À toi » = ta prochaine action.
 */
const ICONS: Record<TrackKey, LucideIcon> = { group: UsersRound, gift: Gift, missions: ListChecks, capsule: Mailbox };

export function Preparations({ progress: p, giftAt, timezone, onOpen }: { progress: EventProgress; giftAt: string; timezone: string; onOpen: (route: string) => void }) {
  const now = useNow();
  const tracks = buildTracks(p);
  const doneCount = tracks.filter((t) => t.state === 'done').length;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' }}>
        <T v="h1" accessibilityRole="header">
          Les préparatifs
        </T>
        <T v="label" color={colors.inkSoft}>
          {doneCount === 0 ? 'Rien de bouclé' : `${doneCount} sur 4 bouclé${doneCount > 1 ? 's' : ''}`}
        </T>
      </View>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        {tracks.map((t, i) => (
          <TrackRow key={t.key} track={t} first={i === 0} onPress={() => onOpen(t.route)} />
        ))}
        <View
          accessible
          accessibilityLabel={p.revealed ? 'Jour J passé : la capsule est ouverte' : `Jour J le ${formatEventDate(giftAt, timezone, false)}, ${timeUntil(giftAt, now)}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: colors.sunSoft }}
        >
          <Ribbon size={18} color={colors.sunInk} strokeWidth={2} />
          <T v="label" color={colors.sunInk} style={{ flex: 1 }}>
            {p.revealed ? 'Jour J passé · la capsule est ouverte' : `Jour J · ${formatEventDate(giftAt, timezone, false)} · ${timeUntil(giftAt, now)}`}
          </T>
        </View>
      </View>
    </View>
  );
}

const STATE_LABEL: Record<TrackState, string> = { done: 'fait', active: 'en cours', todo: 'pas commencé' };

function TrackRow({ track: t, first, onPress }: { track: Track; first: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.title} : ${STATE_LABEL[t.state]}. ${t.status}${t.mine ? '. À toi de jouer' : ''}`}
      onPress={onPress}
      android_ripple={{ color: colors.sand }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        minHeight: 68,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
        backgroundColor: pressed ? colors.surfaceSoft : 'transparent',
      })}
    >
      <Marker state={t.state} Icon={ICONS[t.key]} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <T v="bodyBold" color={t.state === 'todo' ? colors.inkSoft : colors.ink}>
            {t.title}
          </T>
          {t.mine ? (
            <View style={{ backgroundColor: colors.ink, borderRadius: radius.tag, paddingHorizontal: 6, paddingVertical: 1 }}>
              <T v="small" color={colors.white} style={{ fontFamily: fonts.extraBold, fontSize: 12, lineHeight: 16 }}>
                À toi
              </T>
            </View>
          ) : null}
        </View>
        <T v="small" color={t.state === 'done' ? colors.success : colors.inkSoft} style={{ fontFamily: t.state === 'done' ? fonts.bold : fonts.semiBold }}>
          {t.status}
        </T>
        {t.ratio !== undefined && t.ratio > 0 && t.state !== 'done' ? (
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.sand, overflow: 'hidden', maxWidth: 160, marginTop: 2 }}>
            <View style={{ width: `${Math.round(t.ratio * 100)}%`, height: '100%', backgroundColor: colors.ink, borderRadius: 2 }} />
          </View>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

/** Repère d'état : tampon coché (fait), pastille soleil (en cours), pointillés (pas commencé). */
function Marker({ state, Icon }: { state: TrackState; Icon: LucideIcon }) {
  if (state === 'done') {
    return (
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }}>
        <Check size={22} color={colors.success} strokeWidth={3} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: state === 'active' ? colors.sunSoft : 'transparent',
        borderWidth: state === 'todo' ? 1.5 : 0,
        borderStyle: 'dashed',
        borderColor: colors.inkLine,
      }}
    >
      <Icon size={20} color={state === 'active' ? colors.sunInk : colors.inkFaint} strokeWidth={2} />
    </View>
  );
}
