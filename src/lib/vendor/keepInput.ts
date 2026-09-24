"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submit handler for forms driven by useActionState. Passing the action to
 * <form action=…> makes React clear every field once the action finishes —
 * even when it returned an error — so a supplier who mistypes one field loses
 * the whole form. Calling the action from onSubmit keeps what they typed.
 */
export function keepInput(action: (formData: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  };
}
