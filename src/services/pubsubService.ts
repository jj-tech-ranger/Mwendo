import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type PubSubTopic = 'vehicle-events' | 'safety-alerts' | 'system-notifications';

export interface PubSubMessage<T = unknown> {
  messageId: string;
  topic: PubSubTopic;
  payload: T;
  timestamp: string;
  publishAttempts?: number;
}

export const pubsubService = {
  /**
   * Publish a message to a named Pub/Sub topic with exponential retry policy
   */
  async publish<T = unknown>(topic: PubSubTopic, payload: T): Promise<PubSubMessage<T>> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const message: PubSubMessage<T> = {
      messageId,
      topic,
      payload,
      timestamp: new Date().toISOString(),
      publishAttempts: 1,
    };

    let attempt = 1;
    const maxAttempts = 5;
    let delayMs = 10000; // 10s initial backoff

    while (attempt <= maxAttempts) {
      try {
        // Record published message event in PubSub topics collection
        await setDoc(doc(db, `pubsub_topics_${topic.replace('-', '_')}`, messageId), {
          ...message,
          publishAttempts: attempt,
          status: 'published',
        });
        return message;
      } catch (err) {
        console.warn(`[PubSub] Publish attempt ${attempt} for topic ${topic} failed:`, err);
        if (attempt === maxAttempts) {
          // Route to Dead Letter Queue (DLQ)
          await this.routeToDLQ(message, err);
          throw new Error(`PubSub message publish failed after ${maxAttempts} attempts. Routed to DLQ.`);
        }
        await new Promise((res) => setTimeout(res, Math.min(delayMs, 600000))); // Max 600s
        delayMs *= 2; // Exponential backoff
        attempt++;
      }
    }

    return message;
  },

  /**
   * Route failed message to Dead Letter Queue (DLQ)
   */
  async routeToDLQ(message: PubSubMessage, error: unknown): Promise<void> {
    try {
      const dlqRef = doc(db, 'dlq_notifications', message.messageId);
      await setDoc(dlqRef, {
        ...message,
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`[PubSub DLQ] Message ${message.messageId} successfully written to dlq_notifications/`);
    } catch (dlqErr) {
      console.error('[PubSub DLQ] Critical: Failed to record message to DLQ:', dlqErr);
    }
  },
};
