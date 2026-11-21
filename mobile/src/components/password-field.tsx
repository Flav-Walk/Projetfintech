import { Check, Eye, EyeOff, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View, type TextInputProps } from 'react-native';
import { PASSWORD_RULES } from '@/lib/auth-errors';
import { colors, space } from '@/theme/tokens';
import { Field, Row, T } from './ui';

/**
 * Mot de passe avec bouton afficher / masquer et, à la création, les règles cochées pendant la saisie.
 * Les règles sont les mêmes que la validation (lib/auth-errors) : ce qui est coché est accepté.
 */
export function PasswordField({
  label = 'Mot de passe',
  value,
  onChangeText,
  showRules = false,
  error,
  ...rest
}: Omit<TextInputProps, 'secureTextEntry'> & { label?: string; value: string; onChangeText: (v: string) => void; showRules?: boolean; error?: string | null }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <View>
        <Field
          label={label}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
          icon={<Lock size={20} color={colors.inkSoft} strokeWidth={1.75} />}
          style={{ paddingRight: 44 }}
          {...rest}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          style={{ position: 'absolute', right: 8, top: 26, width: 44, height: 52, alignItems: 'center', justifyContent: 'center' }}
        >
          {visible ? <EyeOff size={20} color={colors.inkSoft} strokeWidth={1.75} /> : <Eye size={20} color={colors.inkSoft} strokeWidth={1.75} />}
        </Pressable>
      </View>
      {showRules ? (
        <View style={{ gap: 4 }} accessibilityLabel="Règles du mot de passe">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(value);
            return (
              <Row key={r.label} gap={6}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: ok ? colors.success : 'transparent',
                    borderWidth: ok ? 0 : 1.5,
                    borderColor: colors.inkFaint,
                  }}
                >
                  {ok ? <Check size={12} color={colors.white} strokeWidth={3} /> : null}
                </View>
                <T v="small" color={ok ? colors.success : colors.inkSoft} accessibilityLabel={`${r.label} : ${ok ? 'respecté' : 'pas encore'}`}>
                  {r.label}
                </T>
              </Row>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
