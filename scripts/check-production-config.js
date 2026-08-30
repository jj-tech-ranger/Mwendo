#!/usr/bin/env node

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const optional = [
  'VITE_RECAPTCHA_SITE_KEY',
  'VITE_FIREBASE_VAPID_KEY',
  'VITE_MAP_TILE_URL',
];

for (const name of required) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Required production configuration ${name} is missing.`);
  }
}

const expected = {
  VITE_FIREBASE_PROJECT_ID: 'mwendo-salama-prod',
  VITE_FIREBASE_AUTH_DOMAIN: 'mwendo-salama-prod.firebaseapp.com',
  VITE_FIREBASE_STORAGE_BUCKET: 'mwendo-salama-prod.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1004280240722',
  VITE_FIREBASE_APP_ID: '1:1004280240722:web:e339c20b645e839b3c5d8b',
};

for (const [name, value] of Object.entries(expected)) {
  if (process.env[name] !== value) {
    throw new Error(`Production configuration ${name} must equal ${value}.`);
  }
}

if (process.env.VITE_MAP_TILE_URL?.trim()) {
  const tileUrl = process.env.VITE_MAP_TILE_URL;
  if (!/^https?:\/\//.test(tileUrl)) {
    throw new Error('Production configuration VITE_MAP_TILE_URL must identify an HTTPS endpoint.');
  }
  if (!tileUrl.includes('{z}') || !tileUrl.includes('{x}') || !tileUrl.includes('{y}')) {
    throw new Error('VITE_MAP_TILE_URL must be a tile template containing {z}, {x}, and {y}.');
  }
}

for (const name of optional) {
  if (process.env[name]?.trim()) {
    console.log(`Optional production configuration ${name} supplied.`);
  }
}

console.log('Production frontend configuration verified for mwendo-salama-prod.');
