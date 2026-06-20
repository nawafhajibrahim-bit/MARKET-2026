/**
 * Web Cryptography API implementation of AES-256-GCM.
 * Handles offline encryption and decryption of license data bound to the hardware fingerprint.
 */

async function getAesKey(passphrase: string): Promise<CryptoKey> {
  const passphraseBuffer = new TextEncoder().encode(passphrase);
  // Hash the passphrase with SHA-256 to ensure a 256-bit key
  const keyHash = await crypto.subtle.digest('SHA-256', passphraseBuffer);
  return await crypto.subtle.importKey(
    'raw',
    keyHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string of text using AES-256-GCM.
 * @param text Content to encrypt
 * @param passphrase Key string (e.g. hardware fingerprint)
 * @returns Base64 encoded string containing IV + encrypted payload
 */
export async function encryptData(text: string, passphrase: string): Promise<string> {
  const key = await getAesKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes is standard for AES-GCM
  const encodedText = new TextEncoder().encode(text);
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  );
  
  // Combine IV and ciphertext for single-string storage
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  
  // Convert binary to base64 string
  let binary = '';
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

/**
 * Decrypts a Base64 string payload using AES-256-GCM.
 * @param encryptedBase64 The combined IV + ciphertext string
 * @param passphrase Key string (e.g. hardware fingerprint)
 * @returns Decrypted string
 */
export async function decryptData(encryptedBase64: string, passphrase: string): Promise<string> {
  try {
    const key = await getAesKey(passphrase);
    
    // Decode base64 to binary array
    const binaryString = atob(encryptedBase64);
    const len = binaryString.length;
    const combined = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }
    
    if (combined.length < 13) {
      throw new Error('Invalid cipher payload');
    }
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    return new TextDecoder().decode(decryptedBuffer);
  } catch (e) {
    throw new Error('Decryption failed: ' + (e instanceof Error ? e.message : 'Invalid key'), {
      cause: e,
    });
  }
}
