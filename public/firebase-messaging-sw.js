// Firebase Cloud Messaging Service Worker for background push delivery

// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Handle background push event
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const payload = event.data.json();
      const notification = payload.notification || {};
      const data = payload.data || {};
      const title = notification.title || data.title || '🚨 Mwendo Salama Alert';
      const options = {
        body: notification.body || data.body || 'New safety alert or trip event received.',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: data.alertId || `mwendo_alert_${Date.now()}`,
        renotify: true,
        data: {
          url: data.tripId ? `/track/${data.tripId}` : '/alerts',
          ...data,
        },
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification('Mwendo Salama Safety Alert', {
          body: text,
          icon: '/icon.svg',
        })
      );
    }
  }
});

// Focus or open application window when user clicks push notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
