import { uploadAttachmentAction } from "@/lib/attachments";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";

/**
 * The upload every screen uses to file a document. A file over the limit is refused here with a plain message, before it is sent:
 * the server drops a request that is too large without saying why, and the person is left on an error page. Anything else that
 * goes wrong in transit comes back as a message too, so a screen never has to handle a thrown error.
 */
export async function uploadAttachment(formData: FormData): Promise<{ error?: string } | void> {
  const file = formData.get("file");
  if (file instanceof File && file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return { error: `${file.name ? `“${file.name}” is` : "That file is"} ${mb} MB, and the most that can be uploaded is ${MAX_UPLOAD_LABEL}. Reduce its size (a lower-quality scan or a compressed PDF) and try again.` };
  }
  try {
    return await uploadAttachmentAction(formData);
  } catch {
    return { error: `The file couldn't be uploaded. It may be larger than ${MAX_UPLOAD_LABEL}, or the connection dropped. Try again.` };
  }
}
