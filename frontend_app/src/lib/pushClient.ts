// pushClient — orchestrates the Web Push subscribe / unsubscribe / category
// preferences flow. Used by the permission-priming modal and the settings card.
//
// iOS PWA push only works when:
//   1) The app is installed via "Add to Home Screen" (display-mode standalone), and
//   2) The user's iOS is 16.4+
// This file detects (1) and surfaces a tab-mode fallback so we never silently
// swallow a permission-denied state.

import { api } from './api.ts';

export interface SubscriptionCategories {
  pre_class: boolean;
  intention_check: boolean;
  drive_home_log: boolean;
}

export interface SubscriptionState {
  subscribed: boolean;
  categories: SubscriptionCategories;
}

interface VapidKeyResponse { vapidPublicKey: string }
interface SubscribeResponse { subscription: { id: string } & SubscriptionCategories }

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isStandaloneInstall(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS uses navigator.standalone; everywhere else uses display-mode.
  const navStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  return navStandalone || displayMode;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function getPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Convert a Base64URL-encoded VAPID public key to the Uint8Array shape
// pushManager.subscribe() expects.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) buf[i] = raw.charCodeAt(i);
  return buf;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.ready;
  return reg;
}

export async function fetchSubscriptionState(): Promise<SubscriptionState> {
  return api.get<SubscriptionState>('/api/push-subscriptions/me');
}

// Subscribe this device. Requests permission (which only works inside a user
// gesture), creates the Web Push subscription, and POSTs it to the backend.
export async function subscribeThisDevice(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (isIOS() && !isStandaloneInstall()) return { ok: false, reason: 'ios-requires-install' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: `permission-${permission}` };

  const { vapidPublicKey } = await api.get<VapidKeyResponse>('/api/push-subscriptions/vapid-public-key');
  const reg = await getRegistration();

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
  }

  const json = sub.toJSON();
  await api.post<SubscribeResponse>('/api/push-subscriptions', {
    endpoint: json.endpoint,
    keys: json.keys,
    user_agent: navigator.userAgent,
  });
  return { ok: true };
}

export async function unsubscribeThisDevice(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {/* swallow */});
  await api.delete<void>('/api/push-subscriptions', { endpoint }).catch(() => {/* server cleanup */});
}

export async function setCategories(flags: Partial<SubscriptionCategories>): Promise<SubscriptionCategories> {
  const res = await api.patch<{ categories: SubscriptionCategories }>('/api/push-subscriptions/categories', flags);
  return res.categories;
}
