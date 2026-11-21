import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';
import { installPkceCrypto } from './pkce-crypto';

// Evaluated before createClient. getRandomValues uses the native CSPRNG directly,
// unlike getRandomBytes, whose development fallback can use Math.random.
installPkceCrypto(globalThis, {
  getRandomValues: getRandomValues as Crypto['getRandomValues'],
  digest: (_algorithm, data) => digest(CryptoDigestAlgorithm.SHA256, data),
});
