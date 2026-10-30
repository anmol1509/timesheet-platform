import test from "node:test";
import assert from "node:assert/strict";
import { uploadAttachment } from "./uploadAttachment";
import { ingestWorkmenComp } from "../app/(platform)/(app)/suppliers/[id]/workmen-comp-ingest";
import { MAX_UPLOAD_BYTES } from "./constants";

const big = () => new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "certificate.pdf", { type: "application/pdf" });

test("a file over the limit is refused with the size and the limit, before anything is sent", async () => {
  const fd = new FormData();
  fd.set("file", big());
  const r = await uploadAttachment(fd);
  assert.ok(r && "error" in r && r.error);
  assert.match(r.error!, /certificate\.pdf/);
  assert.match(r.error!, /3\.5 MB/);
});

test("a workmen compensation certificate over the limit is refused the same way", async () => {
  const r = await ingestWorkmenComp("supplier-1", big());
  assert.equal(r.id, undefined);
  assert.match(r.error ?? "", /3\.5 MB/);
});
