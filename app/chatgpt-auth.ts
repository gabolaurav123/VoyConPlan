import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getNodeDb } from '@/db/node';
import {
  createAuthService,
  safeReturnPath,
  type SessionUser,
} from '@/lib/auth';

// Compatibility name: identity comes only from opaque cookie sessions in SQLite.
// No inbound identity header is trusted.
export type ChatGPTUser = SessionUser;
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  return createAuthService({ db: getNodeDb(), env: process.env }).session(
    await headers(),
  );
}
export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo = '/viajes'): string {
  return '/entrar?return_to=' + encodeURIComponent(safeReturnPath(returnTo));
}
export function chatGPTSignOutPath(): string {
  // Sign out is a POST from the account screen.
  return '/cuenta';
}
