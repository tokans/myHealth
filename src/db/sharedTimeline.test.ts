import { describe, it, expect } from "vitest";
import { memDb } from "./memDb";
import { createHealthTimeline } from "./sharedTimeline";

describe("createHealthTimeline — documents/events on the shared spine", () => {
  it("links a medical document with only an OPAQUE blob_ref (no plaintext bytes)", async () => {
    const t = createHealthTimeline(memDb());
    await t.ensure();
    await t.linkDocument({
      id: "doc1",
      title: "Lab report",
      blobRef: "vault://aes-gcm/abcd1234",
      mime: "application/pdf",
      personKey: "self",
    });
    const docs = await t.listDocuments("self");
    expect(docs).toHaveLength(1);
    expect(docs[0].blob_ref).toBe("vault://aes-gcm/abcd1234");
    // the shared document row carries NO plaintext byte field
    expect(Object.keys(docs[0])).not.toContain("bytes");
    expect(Object.keys(docs[0])).not.toContain("plaintext");
  });

  it("scopes documents by person", async () => {
    const t = createHealthTimeline(memDb());
    await t.ensure();
    await t.linkDocument({ id: "d1", title: "A", blobRef: "r1", personKey: "self" });
    await t.linkDocument({ id: "d2", title: "B", blobRef: "r2", personKey: "rex" });
    expect(await t.listDocuments("self")).toHaveLength(1);
    expect(await t.listDocuments("rex")).toHaveLength(1);
    expect(await t.listDocuments()).toHaveLength(2);
  });

  it("places a visit/appointment on the shared event timeline, linkable to a doc", async () => {
    const t = createHealthTimeline(memDb());
    await t.ensure();
    await t.linkDocument({ id: "d1", title: "Discharge", blobRef: "r1", personKey: "self" });
    await t.linkVisit({
      id: "v1",
      date: "2026-06-01",
      title: "Cardiology follow-up",
      personKey: "self",
      documentId: "d1",
      notes: "BP review",
    });
    const visits = await t.listVisits("self");
    expect(visits).toHaveLength(1);
    expect(visits[0].title).toBe("Cardiology follow-up");
    expect(visits[0].document_id).toBe("d1");
  });
});
