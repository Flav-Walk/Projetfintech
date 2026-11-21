/** Bridge used only by the native PKCE runtime. Hashing and entropy come from Expo. */
type NativeCrypto = {
  getRandomValues: Crypto['getRandomValues'];
  digest: (algorithm: 'SHA-256', data: BufferSource) => Promise<ArrayBuffer>;
};

export function installPkceCrypto(target: { crypto?: Crypto }, native: NativeCrypto) {
  // Keep a complete WebCrypto implementation (browsers, future native runtimes).
  const crypto = target.crypto ?? ({} as Crypto);
  if (!crypto.getRandomValues) crypto.getRandomValues = native.getRandomValues;
  if (!crypto.subtle) {
    // This is a PKCE digest adapter, not a complete SubtleCrypto implementation.
    Object.defineProperty(crypto, 'subtle', { configurable: true, value: {
      async digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        if (name.toUpperCase() !== 'SHA-256') throw new Error('Unsupported PKCE digest');
        return native.digest('SHA-256', data);
      },
    } as SubtleCrypto });
  }
  if (!target.crypto) target.crypto = crypto;
}
