import { api, loadSession, storeSession, type WalletSession } from "./api";

// Wallet sign-in: the server issues a challenge naming this wallet and a
// one-time nonce, the wallet signs those exact bytes, and the server hands
// back a session. Nothing is signed that could move funds — the message says
// so in words the wallet displays.
//
// The API's shared key proves only that a caller read it out of the bundle.
// A session proves which wallet is calling, which is what ownership checks
// need (see backend/src/auth.ts requireWallet).

interface SignMessageCapable {
  wallet: { signMessage: (message: Uint8Array) => Promise<Uint8Array> };
}

/** The stored session, if it is for this wallet and has not expired. */
export function sessionFor(wallet: string | null | undefined): WalletSession | null {
  const session = loadSession();
  return session && wallet && session.wallet === wallet ? session : null;
}

export async function signIn(client: unknown, wallet: string): Promise<WalletSession> {
  const signMessage = (client as SignMessageCapable | null)?.wallet?.signMessage;
  if (typeof signMessage !== "function") {
    throw new Error("This wallet cannot sign messages, so it cannot sign in.");
  }
  const { nonce, message } = await api.authNonce(wallet);
  const signature = await signMessage(new TextEncoder().encode(message));
  const session = await api.authVerify({
    wallet,
    nonce,
    signature: btoa(String.fromCharCode(...signature)),
  });
  storeSession(session);
  return session;
}

export function signOut(): void {
  storeSession(null);
}
