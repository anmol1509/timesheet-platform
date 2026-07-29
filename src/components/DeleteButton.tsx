"use client";

export function DeleteButton({
  action,
  hiddenFields,
  confirmMessage,
  label = "Delete",
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  confirmMessage: string;
  label?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className={
          className ||
          "text-xs font-medium text-red-600 hover:underline"
        }
      >
        {label}
      </button>
    </form>
  );
}
