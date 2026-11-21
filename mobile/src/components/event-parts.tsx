import { formatCents, fundingStepLabel, STEP_LABELS, type EventFunding, type EventProgress } from '@complice/shared';
import { Check, Coins } from 'lucide-react-native';
import { View } from 'react-native';
import { initials } from '@/lib/format';
import { colors, fonts, space } from '@/theme/tokens';
import { ProgressBar, Row, T } from './ui';

const AVATAR_TINTS = ['#FFD8CC', '#DCD3FF', '#FFF1C7', '#D7F3E6', '#FFE1EC', '#D6ECFF'];

export function Avatar({ name, size = 36, index = 0 }: { name: string; size?: number; index?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: AVATAR_TINTS[index % AVATAR_TINTS.length],
        borderWidth: 2,
        borderColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T v="small" style={{ fontFamily: fonts.extraBold, fontSize: size * 0.36 }}>
        {initials(name)}
      </T>
    </View>
  );
}

export function AvatarStack({ names, max = 6 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <View style={{ flexDirection: 'row' }} accessibilityLabel={`${names.length} membres : ${names.join(', ')}`}>
      {shown.map((n, i) => (
        <View key={`${n}-${i}`} style={{ marginLeft: i === 0 ? 0 : -10 }}>
          <Avatar name={n} index={i} />
        </View>
      ))}
      {rest > 0 ? (
        <View style={{ marginLeft: -10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white }}>
            <T v="small" color={colors.white} style={{ fontFamily: fonts.extraBold }}>
              +{rest}
            </T>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Progression financière (corail). Jamais mélangée avec l'organisation.
 * Le groupe voit un palier collectif, jamais le total exact pendant la collecte : les montants
 * individuels restent privés. Le total exact n'est fourni qu'aux gestionnaires, collecte close.
 */
export function FundingCard({ funding, children }: { funding: EventFunding; children?: React.ReactNode }) {
  const step = funding.goal_reached ? 100 : funding.progress_step;
  const label = fundingStepLabel(funding.progress_step, funding.goal_reached);
  return (
    <View style={{ backgroundColor: colors.coral, borderRadius: 22, padding: space.xl, gap: space.md }}>
      <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
        <Coins color={colors.white} size={30} strokeWidth={1.75} />
        <View style={{ flex: 1 }}>
          <T v="small" color={colors.white} style={{ opacity: 0.92 }}>
            Cagnotte commune · objectif {formatCents(funding.target_cents)}
          </T>
          <T v="h2" color={colors.white}>
            {label}
          </T>
        </View>
      </Row>
      <ProgressBar value={step} track="rgba(255,255,255,0.35)" fill={colors.white} label={`Cagnotte : ${label.toLowerCase()}`} />
      {funding.collected_cents !== null ? (
        <T v="bodyBold" color={colors.white}>
          Total collecté : {formatCents(funding.collected_cents)} (visible des organisateurs, collecte close)
        </T>
      ) : null}
      <T v="small" color={colors.white}>
        {funding.my_confirmed_cents > 0 ? `Ta participation : ${formatCents(funding.my_confirmed_cents)}, visible de toi seul. ` : ''}
        Le groupe suit la cagnotte par paliers, sans les montants de chacun.
      </T>
      {children}
    </View>
  );
}

/** Étapes collectives (violet). Le compteur suit les étapes réellement faites. */
export function StepTracker({ progress, dark = false }: { progress: EventProgress; dark?: boolean }) {
  const current = progress.steps.findIndex((s) => !s.done);
  const fg = dark ? colors.white : colors.white;
  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        {progress.steps.map((s, i) => {
          const isCurrent = i === current;
          return (
            <View key={s.key} style={{ alignItems: 'center', flex: 1, gap: 4 }} accessibilityLabel={`${STEP_LABELS[s.key]} : ${s.done ? 'faite' : isCurrent ? 'en cours' : 'à venir'}`}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: s.done ? colors.white : 'transparent',
                  borderWidth: 2.5,
                  borderColor: s.done || isCurrent ? colors.white : 'rgba(255,255,255,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.done ? <Check size={18} color={colors.violet} strokeWidth={3} /> : isCurrent ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sun }} /> : null}
              </View>
              <T v="small" color={fg} style={{ fontFamily: isCurrent ? fonts.extraBold : fonts.semiBold, textAlign: 'center' }}>
                {STEP_LABELS[s.key]}
              </T>
              {isCurrent ? (
                <T v="small" color={fg} style={{ fontSize: 11, opacity: 0.85, marginTop: -4 }}>
                  (en cours)
                </T>
              ) : null}
            </View>
          );
        })}
      </Row>
    </View>
  );
}
