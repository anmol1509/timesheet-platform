"use client";

import { useEffect } from "react";
import { EMAIL_MESSAGE, firstInvalidContact, isValidEmail } from "@/lib/validators";
import { MAX_REQUEST_BYTES } from "@/lib/compressImage";

/** A message that stays on screen and can't be missed, for a problem found before anything is sent. */
function notify(message: string) {
  let box = document.getElementById("form-guard-notice");
  if (!box) {
    box = document.createElement("div");
    box.id = "form-guard-notice";
    box.setAttribute("role", "alert");
    box.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:200;max-width:min(92vw,560px);padding:12px 16px;border-radius:10px;font-size:14px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.18);background:var(--warning-soft,#fff7e6);color:var(--warning,#92400e);border:1px solid var(--warning-border,#f5c26b);cursor:pointer";
    box.addEventListener("click", () => box?.remove());
    document.body.appendChild(box);
  }
  box.textContent = message;
  window.clearTimeout((box as HTMLElement & { _t?: number })._t);
  (box as HTMLElement & { _t?: number })._t = window.setTimeout(() => box?.remove(), 9000);
}

/** Puts the cursor in the field that needs fixing, using its visible control when the named one is a hidden carrier. */
function focusField(form: HTMLFormElement, name: string) {
  const named = form.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
  const target = named instanceof HTMLInputElement && named.type === "hidden" ? named.parentElement?.querySelector<HTMLElement>("input:not([type=hidden])") : named;
  target?.scrollIntoView({ block: "center", behavior: "smooth" });
  target?.focus({ preventScroll: true });
}

/**
 * App-wide pre-send checks. The server refuses a malformed phone, email, Emirates ID, IBAN or TRN, and
 * a request over the size limit, with a generic error page; so both are caught here first and explained.
 * Email check: Browsers accept "name@company" with no domain, so this marks
 * every email field invalid until it has a real domain, which stops the form from saving
 * and shows the message under the field. Phone and ID fields do the same inside their own components.
 * Mounted once in the root layout; renders nothing.
 */
export function FormValidation() {
  useEffect(() => {
    const check = (el: Element) => {
      if (!(el instanceof HTMLInputElement) || el.type !== "email") return;
      el.setCustomValidity(el.value.trim() !== "" && !isValidEmail(el.value) ? EMAIL_MESSAGE : "");
    };
    const onInput = (e: Event) => e.target instanceof Element && check(e.target);
    // Fields that arrive pre-filled are never typed in, so check every email field again as the form is submitted.
    const onSubmit = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.querySelectorAll("input[type=email]").forEach(check);
      if (!form.checkValidity()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        form.reportValidity();
        return;
      }
      if (form.hasAttribute("data-managed-checks")) return; // a form that does its own checks (the employee wizard)
      let data: FormData;
      try { data = new FormData(form, (e as SubmitEvent).submitter); } catch { return; }
      const bad = firstInvalidContact(data.entries());
      if (bad) {
        e.preventDefault();
        e.stopImmediatePropagation();
        notify(bad.message);
        focusField(form, bad.field);
        return;
      }
      let bytes = 0;
      for (const [, v] of data.entries()) if (v instanceof File) bytes += v.size;
      if (bytes > MAX_REQUEST_BYTES) {
        e.preventDefault();
        e.stopImmediatePropagation();
        notify(`These files add up to ${(bytes / 1048576).toFixed(1)} MB, but one save can carry at most ${(MAX_REQUEST_BYTES / 1048576).toFixed(1)} MB. Remove one, or use a smaller or compressed copy.`);
      }
    };
    // A file that can't be sent is refused the moment it is chosen, not after the wait.
    const onFile = (e: Event) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.form || input.form.hasAttribute("data-managed-checks")) return;
      let bytes = 0;
      for (const el of input.form.querySelectorAll<HTMLInputElement>("input[type=file]")) for (const f of el.files ?? []) bytes += f.size;
      if (bytes > MAX_REQUEST_BYTES) {
        input.value = "";
        e.stopImmediatePropagation();
        notify(`That file is too large: one save can carry at most ${(MAX_REQUEST_BYTES / 1048576).toFixed(1)} MB in total. Use a smaller or compressed copy.`);
      }
    };
    document.addEventListener("change", onFile, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("change", onFile, true);
    };
  }, []);
  return null;
}
