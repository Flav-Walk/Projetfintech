import { formatCents, fundingLabel, type EventFunding } from '@complice/shared';
import { Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { formatEventDate, timeUntil } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { UserAvatar } from './avatar';
import { Row, T } from './ui';

/** Compatibilité : avatar par initiales (préférer UserAvatar avec la photo). */
export function Avatar({ name, size = 36, index = 0, path }: { name: string; size?: number; index?: number; path?: string | null }) {
  return <UserAvatar name={name} size={size} path={path} seed={`${name}-${index}`} />;
}

/** Jauge animée (remplissage doux, désactivé si « Réduire les animations »). */
export function Meter({ value, track, fill, height = 10, label }: { value: number; track: string; fill: string; height?: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const reduce = useReducedMotion();
  const w = useSharedValue(reduce ? pct : 0);
  useEffect(() => {
    w.value = reduce ? pct : withTiming(pct, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [pct, reduce, w]);
  const anim = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: height, backgroundColor: fill }, anim]} />
    </View>
  );
}

/**
 * Cagnotte (corail) : total du groupe, objectif, progression, reste, part personnelle, clôture.
 * Jamais les montants des autres membres, jamais de classement. Le bénéficiaire ne la voit pas (RPC nulle).
 */
export function FundingCard({ funding, children }: { funding: EventFunding; children?: React.ReactNode }) {
  const now = useNow();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const label = fundingLabel(funding.percent, funding.goal_reached);
  const closeAt = new Date(funding.contributions_close_at).getTime();
  return (
    <View style={{ backgroundColor: colors.coral, borderRadius: radius.cover, padding: space.xl, gap: space.md, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.10)' }} />
      <T v="overline" color={colors.white} style={{ opacity: 0.9 }}>
        Cagnotte commune
      </T>
      <View accessible accessibilityLabel={`${formatCents(funding.collected_cents)} collectés sur un objectif de ${formatCents(funding.target_cents)}. ${label}.`}>
        <Row gap={6} style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
          <T v="money" color={colors.white}>
            {formatCents(funding.collected_cents)}
          </T>
          <T v="moneySmall" color={colors.white} style={{ opacity: 0.85 }}>
            / {formatCents(funding.target_cents)}
          </T>
        </Row>
      </View>
      <Meter value={funding.percent} track="rgba(255,255,255,0.32)" fill={colors.white} height={12} label={`Cagnotte : ${label}`} />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }} gap={space.sm}>
        <T v="label" color={colors.white}>
          {label}
        </T>
        <T v="label" color={colors.white}>
          {funding.goal_reached ? 'Bravo à tout le groupe' : `Reste ${formatCents(funding.remaining_cents)}`}
        </T>
      </Row>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.field, padding: space.md, gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="small" color={colors.white}>
            Ta participation
          </T>
          <T v="label" color={colors.white} style={{ fontVariant: ['tabular-nums'] }}>
            {funding.my_confirmed_cents > 0 ? formatCents(funding.my_confirmed_cents) : '—'}
          </T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="small" color={colors.white}>
            {funding.contributions_open ? 'Clôture' : 'Collecte'}
          </T>
          <T v="label" color={colors.white}>
            {funding.contributions_open ? `${formatEventDate(funding.contributions_close_at, undefined, false)} · ${timeUntil(funding.contributions_close_at, now)}` : closeAt <= now ? 'close' : 'fermée'}
          </T>
        </Row>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: privacyOpen }}
        accessibilityLabel="Parts individuelles privées. Plus d’informations"
        onPress={() => setPrivacyOpen((o) => !o)}
        hitSlop={8}
        style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start', minHeight: 24 }}
      >
        <Lock size={14} color={colors.white} style={{ marginTop: 2 }} />
        <T v="small" color={colors.white} style={{ flex: 1 }}>
          {privacyOpen
            ? 'Seul le total est partagé : personne ne voit combien chacun a donné. Dans un petit groupe, le total peut tout de même laisser deviner certaines parts.'
            : 'Parts individuelles privées'}
          {privacyOpen ? null : <T v="small" color={colors.white} style={{ textDecorationLine: 'underline' }}>{'  En savoir plus'}</T>}
        </T>
      </Pressable>
      {children}
    </View>
  );
}

/** Version compacte (liste de l'accueil) : total / objectif et jauge. */
export function FundingMini({ collected, target, percent, goalReached }: { collected: number; target: number; percent: number; goalReached: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="moneySmall" color={colors.coralInk}>
          {formatCents(collected)}
          <T v="small" color={colors.inkSoft} style={{ fontFamily: fonts.bold }}>
            {`  sur ${formatCents(target)}`}
          </T>
        </T>
        <T v="label" color={goalReached ? colors.success : colors.inkSoft}>
          {goalReached ? 'Objectif atteint' : `${Math.min(percent, 99)} %`}
        </T>
      </Row>
      <Meter value={percent} track={colors.coralSoft} fill={colors.coral} height={8} label={`Cagnotte : ${fundingLabel(percent, goalReached)}`} />
    </View>
  );
}
