"use client";

import { useEffect } from "react";
import { EMAIL_MESSAGE, isValidEmail } from "@/lib/validators";

/**
 * App-wide email check. Browsers accept "name@company" with no domain, so this marks
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
      }
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);
  return null;
}
