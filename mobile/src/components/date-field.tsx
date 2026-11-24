import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { T } from './ui';

/** Sélecteur date + heure natif (Android : deux boîtes de dialogue ; iOS : sélecteur compact). */
export function DateField({ label, value, onChange, minimumDate, error, hint }: { label: string; value: Date; onChange: (d: Date) => void; minimumDate?: Date; error?: string | null; hint?: string }) {
  const text = value.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function openAndroid() {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      onChange: (ev, date) => {
        if (ev.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (ev2, time) => {
            if (ev2.type === 'set' && time) onChange(time);
          },
        });
      },
    });
  }

  return (
    <View style={{ gap: 6 }}>
      <T v="label">{label}</T>
      {Platform.OS === 'ios' ? (
        <View style={{ alignItems: 'flex-start' }}>
          <DateTimePicker value={value} mode="datetime" display="compact" locale="fr-FR" minimumDate={minimumDate} onChange={(_e, d) => d && onChange(d)} accentColor={colors.ink} />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} : ${text}. Modifier`}
          onPress={openAndroid}
          style={{ minHeight: 52, borderRadius: radius.field, borderWidth: error ? 2 : 1.5, borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}
        >
          <CalendarDays size={20} color={colors.inkSoft} strokeWidth={1.75} />
          <T>{text}</T>
        </Pressable>
      )}
      {error ? <T v="small" color={colors.danger}>{error}</T> : hint ? <T v="small" color={colors.inkSoft}>{hint}</T> : null}
    </View>
  );
}
