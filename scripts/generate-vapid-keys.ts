/**
 * Generates a VAPID key pair for Web Push.
 *
 *   npm run push:keys
 *
 * Copy the printed values into your environment. The private key is a secret:
 * never commit it, and never expose it to the browser. Only the public key is
 * safe to publish as NEXT_PUBLIC_PUSH_PUBLIC_KEY.
 */

import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('Add these to your environment (.env locally, project settings in production):\n');
console.log(`PUSH_PUBLIC_KEY=${keys.publicKey}`);
console.log(`PUSH_PRIVATE_KEY=${keys.privateKey}`);
console.log(`NEXT_PUBLIC_PUSH_PUBLIC_KEY=${keys.publicKey}`);
console.log('\nAlso set PUSH_SUBJECT to a mailto: or https: URL you control.');
console.log('Rotating these keys invalidates every existing push subscription.');
