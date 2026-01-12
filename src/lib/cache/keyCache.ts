export interface KeyCache {
  set(sessionId: string, encryptionKey: string, ttlSeconds: number): Promise<void>;
  get(sessionId: string): Promise<string | null>;
  delete(sessionId: string): Promise<void>;
  refresh(sessionId: string, ttlSeconds: number): Promise<boolean>;
}
