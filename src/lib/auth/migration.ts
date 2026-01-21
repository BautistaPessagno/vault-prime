import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { usersTable, entriesTable } from "@/src/db/schema";
import { generateEncryptionKey } from "@/src/lib/auth/encryption";
import {
  encryptValue,
  encryptEntryFields,
  decryptEntryFields,
} from "@/src/lib/entries/crypto";

/**
 * Migrates a legacy user (without encryption_key) to the new encryption model.
 *
 * Old model: Entries encrypted directly with strechedMasterKey
 * New model: Entries encrypted with random encryptionKey, which is stored encrypted in DB
 *
 * @param userId - User ID to migrate
 * @param strechedMasterKey - Derived key from master password (HKDF)
 * @returns The new encryption key (unencrypted)
 */
export async function migrateLegacyUser(
  userId: string,
  strechedMasterKey: string,
): Promise<string> {
  // 1. Generate new encryption key
  const encryptionKey = await generateEncryptionKey();

  // 2. Get all user entries
  const entries = await db
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.user_id, userId));

  // 3. Re-encrypt each entry from old model to new model
  for (const entry of entries) {
    // Decrypt with strechedMasterKey (old model)
    const decrypted = await decryptEntryFields(
      {
        name: entry.name,
        username: entry.username,
        password: entry.password,
        url: entry.url,
      },
      strechedMasterKey,
    );

    // Re-encrypt with new encryptionKey (new model)
    const encrypted = await encryptEntryFields(decrypted, encryptionKey);

    // Update in database
    await db
      .update(entriesTable)
      .set(encrypted)
      .where(eq(entriesTable.id, entry.id));
  }

  // 4. Save encrypted encryption_key to database
  const encryptedKey = await encryptValue(encryptionKey, strechedMasterKey);
  await db
    .update(usersTable)
    .set({ encryption_key: encryptedKey })
    .where(eq(usersTable.id, userId));

  return encryptionKey;
}
