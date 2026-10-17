/**
 * Opens the chosen documents as one PDF in a new tab. Sent as a form post because a long list of ids would not
 * fit in a web address.
 */
export function printDocuments(ids: string[]) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/documents/print";
  form.target = "_blank";
  form.style.display = "none";
  const field = document.createElement("input");
  field.type = "hidden";
  field.name = "ids";
  field.value = ids.join(",");
  form.appendChild(field);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

/** The most documents one print can hold (the server enforces the same limit). */
export const PRINT_LIMIT = 300;
