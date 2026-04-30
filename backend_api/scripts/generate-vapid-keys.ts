// One-shot helper: generates a VAPID keypair and prints it ready to paste
// into Railway env vars. Run with:
//
//   npx tsx scripts/generate-vapid-keys.ts
//
// then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT (a mailto: URL
// that Apple/Google can contact if there's a problem) on the API service.
//
// The same VAPID public key must be exposed to the frontend via the public
// GET /api/push-subscriptions/vapid-public-key endpoint — already wired.

import webPush from 'web-push';

const keys = webPush.generateVAPIDKeys();

console.log('───────────────────────────────────────────────────────────────');
console.log(' VAPID keys generated. Copy into Railway env vars:');
console.log('───────────────────────────────────────────────────────────────');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:robertdgelin@gmail.com`);
console.log('───────────────────────────────────────────────────────────────');
console.log(' Keep VAPID_PRIVATE_KEY secret — never commit to source control.');
console.log('───────────────────────────────────────────────────────────────');
