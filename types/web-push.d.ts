declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys?: {
      p256dh: string;
      auth: string;
    };
  }

  interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  interface RequestOptions {
    headers?: Record<string, string>;
    topic?: string;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    TTL?: number;
    contentEncoding?: 'aesgcm' | 'aes128gcm';
    proxy?: string;
    agent?: unknown;
  }

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions
  ): Promise<{ statusCode: number; body: string; headers: Record<string, string> }>;
  function generateVAPIDKeys(): VapidKeys;

  export { setVapidDetails, sendNotification, generateVAPIDKeys };
  export type { PushSubscription, VapidKeys, RequestOptions };
}
