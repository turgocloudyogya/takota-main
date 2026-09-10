// Minimal WebAuthn helpers over the raw browser API (no extra dependency).
// The backend sends go-webauthn option envelopes shaped { publicKey: {...} }
// with base64url-encoded binary fields; these helpers convert both ways.

export function webauthnSupported() {
  return typeof window !== 'undefined' && window.PublicKeyCredential !== undefined
}

export function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBuffer(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output.buffer
}

// Registration ceremony: returns the credential JSON to POST as-is.
export async function createPasskey(envelope) {
  const options = { ...(envelope.publicKey || envelope) }
  options.challenge = base64UrlToBuffer(options.challenge)
  options.user.id = base64UrlToBuffer(options.user.id)
  for (const cred of options.excludeCredentials || []) {
    cred.id = base64UrlToBuffer(cred.id)
  }
  const credential = await navigator.credentials.create({ publicKey: options })
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferToBase64Url(credential.response.attestationObject),
      clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
      transports: credential.response.getTransports ? credential.response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

// Authentication ceremony: returns the assertion JSON to POST as-is.
export async function getPasskey(envelope) {
  const options = { ...(envelope.publicKey || envelope) }
  options.challenge = base64UrlToBuffer(options.challenge)
  for (const cred of options.allowCredentials || []) {
    cred.id = base64UrlToBuffer(cred.id)
  }
  const credential = await navigator.credentials.get({ publicKey: options })
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64Url(credential.response.authenticatorData),
      clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
      signature: bufferToBase64Url(credential.response.signature),
      userHandle: credential.response.userHandle
        ? bufferToBase64Url(credential.response.userHandle)
        : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}
