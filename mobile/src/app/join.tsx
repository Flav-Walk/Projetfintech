import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, Link2 } from 'lucide-react-native';
import { useState } from 'react';
import { BackHeader } from '@/components/back-header';
import { Button, Field, Screen } from '@/components/ui';
import { extractInviteToken } from '@/lib/pending-invite';
import { colors } from '@/theme/tokens';

/** Saisie manuelle d'un lien ou d'un code d'invitation (utile quand le lien profond ne s'ouvre pas). */
export default function Join() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(input = value) {
    const token = extractInviteToken(input);
    if (!token) return setError('Lien ou code non reconnu. Copie le lien complet reçu de l’organisateur.');
    setError(null);
    router.replace({ pathname: '/invite/[token]', params: { token } });
  }

  async function paste() {
    const text = await Clipboard.getStringAsync();
    setValue(text);
    submit(text);
  }

  return (
    <Screen>
      <BackHeader title="Rejoindre un groupe" subtitle="Colle le lien d’invitation reçu (ou le code qu’il contient)." />
      <Field label="Lien ou code d’invitation" value={value} onChangeText={setValue} autoCapitalize="none" autoCorrect={false} placeholder="https://…/i/…" error={error} icon={<Link2 size={20} color={colors.inkSoft} strokeWidth={1.75} />} onSubmitEditing={() => submit()} />
      <Button label="Continuer" onPress={() => submit()} />
      <Button label="Coller depuis le presse-papiers" variant="outline" icon={<ClipboardPaste size={20} color={colors.ink} strokeWidth={1.75} />} onPress={paste} />
    </Screen>
  );
}
