/**
 * myHealth → shared `document` + `event` bridge (Stage C prompt 04 Phase 3).
 *
 * Medical documents and visits/appointments are placed on the suite's shared-entity spine
 * (sharedcorelib/entities): metadata only, keyed by `person_key`, written through the
 * co-owned `createEntitiesStore`.
 *
 * CRYPTO INVARIANT (hard): the document BYTES never touch this layer. They stay AES-GCM
 * under the per-device key in the encrypted vault; only the opaque `blob_ref` (a vault id /
 * path, never plaintext) and recipient-safe metadata (title/mime/person) land in
 * `common_document`. Nothing here egresses — all local SQLite.
 *
 * Pure DI over an injected SqlDb so it is unit-testable; live wiring is in sharedDb.ts.
 */
import {
  createEntitiesStore,
  type EntitiesStore,
  type DocumentRow as SharedDocument,
  type EventRow as SharedEvent,
} from "sharedcorelib/entities";
import type { SqlDb } from "sharedcorelib/db";
import { APP_ID } from "./healthFacet";

export interface HealthTimeline {
  entities: EntitiesStore;
  ensure(): Promise<void>;
  /**
   * Mirror a medical document onto the shared `document` spine. `blobRef` is the OPAQUE
   * vault reference — never the plaintext bytes (which stay AES-GCM under the per-device
   * key). Returns the shared document id.
   */
  linkDocument(input: {
    id: string;
    title: string;
    blobRef: string;
    mime?: string | null;
    personKey?: string | null;
  }): Promise<string>;
  /** Documents on the shared spine, optionally scoped to a person. */
  listDocuments(personKey?: string): Promise<SharedDocument[]>;
  /**
   * Place a visit/appointment on the shared `event` timeline (no bytes, just the dated
   * item linked to a person and optionally a document).
   */
  linkVisit(input: {
    id: string;
    date: string;
    title: string;
    personKey?: string | null;
    documentId?: string | null;
    notes?: string | null;
  }): Promise<string>;
  /** Events on the shared timeline, optionally scoped to a person. */
  listVisits(personKey?: string): Promise<SharedEvent[]>;
}

export function createHealthTimeline(db: SqlDb): HealthTimeline {
  const entities = createEntitiesStore(db, { appId: APP_ID });
  return {
    entities,
    async ensure() {
      await entities.ensure();
    },
    async linkDocument(input) {
      await entities.upsertDocument({
        id: input.id,
        title: input.title,
        blob_ref: input.blobRef, // OPAQUE vault ref — never plaintext bytes
        mime: input.mime ?? null,
        person_key: input.personKey ?? null,
      });
      return input.id;
    },
    listDocuments(personKey) {
      return entities.listDocuments(personKey ? { personKey } : undefined);
    },
    async linkVisit(input) {
      await entities.upsertEvent({
        id: input.id,
        date: input.date,
        title: input.title,
        person_key: input.personKey ?? null,
        document_id: input.documentId ?? null,
        notes: input.notes ?? null,
      });
      return input.id;
    },
    listVisits(personKey) {
      return entities.listEvents(personKey ? { personKey } : undefined);
    },
  };
}
