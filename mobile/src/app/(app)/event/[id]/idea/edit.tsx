import { formatCents, messageFor, parseAmountToCents } from '@complice/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ImagePlus, Link2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { PrivateImage } from '@/components/private-image';
import { Loading } from '@/components/states';
import { Banner, Button, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { normalizeUrl, useProposals, useSaveProposal } from '@/lib/ideas';
import { pickImage, uploadImage, type PickedImage } from '@/lib/media';
import type { ProposalRow } from '@/lib/types';
import { useEventId } from '@/lib/use-event-context';
import { colors, space } from '@/theme/tokens';

export default function EditIdea() {
  const id = useEventId();
  const { pid } = useLocalSearchParams<{ pid?: string }>();
  const proposals = useProposals(id);
  if (pid && proposals.isPending) return <Loading />;
  const existing = pid ? proposals.data?.find((p) => p.id === pid) ?? null : null;
  return <IdeaForm key={existing?.id ?? 'new'} eventId={id} existing={existing} />;
}

function IdeaForm({ eventId, existing }: { eventId: string; existing: ProposalRow | null }) {
  const { session } = useAuth();
  const save = useSaveProposal(eventId);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price_cents / 100).replace('.', ',') : '');
  const [url, setUrl] = useState(existing?.product_url ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [imagePath, setImagePath] = useState<string | null>(existing?.image_path ?? null);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const priceCents = parseAmountToCents(price);
  const normalizedUrl = normalizeUrl(url);
  const errors = {
    title: title.trim().length < 2 ? 'Donne un nom à l’idée (2 caractères minimum).' : null,
    price: priceCents === null ? 'Indique un prix, par exemple 49 ou 49,90.' : priceCents > 10_000_000 ? 'Prix trop élevé.' : null,
    url: normalizedUrl === 'invalid' ? 'Lien invalide. Colle l’adresse complète du produit.' : null,
  };
  const valid = !errors.title && !errors.price && !errors.url;

  const choosePhoto = async () => {
    setUploadError(null);
    try {
      const img = await pickImage([4, 3]);
      if (img) setPicked(img);
    } catch {
      setUploadError('Impossible d’ouvrir la galerie.');
    }
  };

  const submit = async () => {
    setSubmitted(true);
    if (!valid || !session) return;
    let path = imagePath;
    if (picked) {
      setUploading(true);
      try {
        path = await uploadImage('event-media', `${eventId}/proposals/${session.user.id}`, picked);
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Envoi de la photo impossible.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    save.mutate(
      {
        id: existing?.id,
        input: {
          title: title.trim(),
          price_cents: priceCents!,
          product_url: normalizedUrl === 'invalid' ? null : normalizedUrl,
          description: description.trim() || null,
          image_path: path,
        },
      },
      { onSuccess: (newId) => router.replace(`/event/${eventId}/idea/${newId}` as never) },
    );
  };

  return (
    <Screen footer={<Button label={existing ? 'Enregistrer' : 'Proposer cette idée'} loading={uploading || save.isPending} onPress={submit} />}>
      <BackHeader title={existing ? 'Modifier l’idée' : 'Nouvelle idée'} subtitle="Le groupe pourra réagir, commenter et voter." />
      <Field label="Nom du cadeau" value={title} onChangeText={setTitle} placeholder="Platine vinyle" maxLength={80} error={submitted ? errors.title : null} />
      <Field
        label="Prix"
        value={price}
        onChangeText={setPrice}
        placeholder="129"
        keyboardType="decimal-pad"
        suffix="€"
        error={submitted ? errors.price : null}
        hint={existing && priceCents !== null && priceCents !== existing.price_cents ? `Ancien prix : ${formatCents(existing.price_cents)}. Le groupe verra le changement.` : undefined}
      />
      <Field
        label="Lien vers le produit (facultatif)"
        value={url}
        onChangeText={setUrl}
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        icon={<Link2 size={18} color={colors.inkSoft} />}
        error={submitted ? errors.url : null}
      />
      <Field label="Pourquoi c’est une bonne idée ? (facultatif)" value={description} onChangeText={setDescription} multiline maxLength={400} placeholder="Elle en parle depuis des mois…" />

      <View style={{ gap: space.sm }}>
        <T v="label">Photo (facultative)</T>
        {picked || imagePath ? (
          <View>
            <PrivateImage path={imagePath} localUri={picked?.uri} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 20 }} label="Aperçu de la photo" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retirer la photo"
              onPress={() => {
                setPicked(null);
                setImagePath(null);
              }}
              style={{ position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>
        ) : (
          <Button variant="outline" compact label="Ajouter une photo" icon={<ImagePlus size={18} color={colors.ink} />} onPress={choosePhoto} />
        )}
        <T v="small" color={colors.inkSoft}>
          Photo privée : visible par le groupe uniquement.
        </T>
      </View>

      {uploadError ? <Banner tone="error">{uploadError}</Banner> : null}
      {save.isError ? <Banner tone="error">{messageFor(save.error)}</Banner> : null}
    </Screen>
  );
}
