"use client";

import { useMemo, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Node as TipNode, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import * as Popover from "@radix-ui/react-popover";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Eraser, Highlighter, Italic, Link2, List, ListOrdered,
  Minus, MessageSquareQuote, Plus, Redo2, Strikethrough, Table2, Type, Underline as UnderlineIcon, Undo2, IndentIncrease, IndentDecrease, HelpCircle,
} from "lucide-react";
import type { MergeField } from "@/lib/letterLayout";
import { ASK_PREFIX } from "@/lib/letterHtml";

const FONT_FAMILIES = [
  { label: "Sans Serif", value: "Arial, Helvetica, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Fixed width", value: "'Courier New', Courier, monospace" },
];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
const COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#b42318", "#e03131", "#f08c00", "#f2c94c", "#2f9e44", "#0b7285",
  "#1971c2", "#1d3a8a", "#6741d9", "#c2255c", "#ffe3e3", "#fff3bf",
  "#d3f9d8", "#d0ebff", "#e5dbff", "#ffdeeb",
];

/** A block the template author drops in: the client's worker table, filled in when the letter is made. */
const WorkerTable = TipNode.create({
  name: "workerTable",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  parseHTML: () => [{ tag: "div[data-worker-table]" }],
  renderHTML: () => ["div", { "data-worker-table": "true", class: "letter-worker-table" }],
});

/** Highlights %%FIELDS%% as pills: blue = known, amber = ask-when-generating, red = not a real field. */
const TokenPills = Extension.create<{ known: Set<string> }>({
  name: "tokenPills",
  addOptions: () => ({ known: new Set<string>() }),
  addProseMirrorPlugins() {
    const known = this.options.known;
    return [
      new Plugin({
        key: new PluginKey("tokenPills"),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const m of node.text.matchAll(/%%([^%\n]+?)%%/g)) {
                const key = m[1].trim();
                const cls = key.startsWith(ASK_PREFIX) ? "letter-token-ask" : known.has(key) ? "letter-token" : "letter-token-bad";
                decos.push(Decoration.inline(pos + (m.index ?? 0), pos + (m.index ?? 0) + m[0].length, { class: cls }));
              }
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-secondary transition hover:bg-surface-hover disabled:opacity-40";
const on = "bg-brand-soft text-[var(--brand-primary)]";
const sel = "h-8 rounded-md border border-default bg-surface px-1.5 text-xs text-secondary outline-none";

function Tool({ title, active, disabled, onClick, children }: { title: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`${btn} ${active ? on : ""}`}>
      {children}
    </button>
  );
}

function ColorButton({ title, icon, onPick, onClear }: { title: string; icon: React.ReactNode; onPick: (c: string) => void; onClear: () => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} className={btn}>{icon}</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="start" onOpenAutoFocus={(e) => e.preventDefault()} className="rx-popover z-50 w-56 rounded-card border border-default bg-surface p-2 shadow-popover">
          <div className="grid grid-cols-6 gap-1">
            {COLORS.map((c) => (
              <Popover.Close asChild key={c}>
                <button type="button" aria-label={c} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(c)} className="h-6 w-6 rounded border border-black/15" style={{ background: c }} />
              </Popover.Close>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
            <label className="flex items-center gap-1.5">Custom <input type="color" onChange={(e) => onPick(e.target.value)} className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" /></label>
            <Popover.Close asChild><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClear} className="rounded px-1.5 py-0.5 hover:bg-surface-hover">Reset</button></Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState("");
  return (
    <Popover.Root onOpenChange={(o) => o && setUrl(editor.getAttributes("link").href ?? "")}>
      <Popover.Trigger asChild>
        <button type="button" title="Link" aria-label="Link" onMouseDown={(e) => e.preventDefault()} className={`${btn} ${editor.isActive("link") ? on : ""}`}><Link2 className="h-4 w-4" /></button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="start" className="rx-popover z-50 w-72 rounded-card border border-default bg-surface p-3 shadow-popover">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="input w-full" aria-label="Link address" />
          <div className="mt-2 flex justify-end gap-2">
            <Popover.Close asChild><button type="button" className="btn btn-secondary" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}>Remove</button></Popover.Close>
            <Popover.Close asChild><button type="button" className="btn btn-primary" onClick={() => url && editor.chain().focus().extendMarkRange("link").setLink({ href: /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}` }).run()}>Apply</button></Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FieldMenu({ editor, fields, label, icon }: { editor: Editor; fields: MergeField[]; label: string; icon?: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--brand-primary)] px-2 text-xs font-medium text-[var(--brand-primary)] transition hover:bg-brand-soft">{icon ?? <Plus className="h-3.5 w-3.5" />}{label}</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="start" onOpenAutoFocus={(e) => e.preventDefault()} className="rx-popover z-50 max-h-80 w-72 overflow-y-auto rounded-card border border-default bg-surface p-1 shadow-popover">
          {fields.map((f) => (
            <Popover.Close asChild key={f.key}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().insertContent(`%%${f.key}%%`).run()} className="block w-full rounded-sm px-2.5 py-1.5 text-left transition hover:bg-surface-hover">
                <span className="block text-sm text-primary">{f.label}</span>
                <span className="block truncate text-xs text-muted">e.g. {f.example}</span>
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function AskButton({ editor }: { editor: Editor }) {
  const [label, setLabel] = useState("");
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-500 px-2 text-xs font-medium text-amber-700 transition hover:bg-amber-50"><HelpCircle className="h-3.5 w-3.5" /> Ask when issuing</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="start" className="rx-popover z-50 w-72 rounded-card border border-default bg-surface p-3 shadow-popover">
          <p className="mb-2 text-xs text-muted">Adds a blank the person issuing the letter fills in (e.g. &ldquo;Reason for warning&rdquo;).</p>
          <input value={label} onChange={(e) => setLabel(e.target.value.replace(/[%<>\n]/g, ""))} placeholder="What should we ask?" className="input w-full" aria-label="Question" />
          <div className="mt-2 flex justify-end">
            <Popover.Close asChild><button type="button" className="btn btn-primary" disabled={!label.trim()} onClick={() => { editor.chain().focus().insertContent(`%%${ASK_PREFIX}${label.trim()}%%`).run(); setLabel(""); }}>Insert</button></Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Toolbar({ editor, fields, audience }: { editor: Editor; fields: MergeField[]; audience: "SITE" | "EMPLOYEE" }) {
  const size = /^(\d+(?:\.\d+)?)pt$/.exec(editor.getAttributes("textStyle").fontSize ?? "")?.[1] ?? "";
  const family = FONT_FAMILIES.find((f) => f.value === editor.getAttributes("textStyle").fontFamily)?.value ?? "";
  const heading = editor.isActive("heading", { level: 1 }) ? "1" : editor.isActive("heading", { level: 2 }) ? "2" : editor.isActive("heading", { level: 3 }) ? "3" : "0";
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-default bg-surface-subtle px-2 py-1.5" role="toolbar" aria-label="Formatting">
      <Tool title="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 className="h-4 w-4" /></Tool>
      <Tool title="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 className="h-4 w-4" /></Tool>
      <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
      <select aria-label="Text style" className={sel} value={heading} onChange={(e) => { const v = e.target.value; if (v === "0") c().setParagraph().run(); else c().setHeading({ level: Number(v) as 1 | 2 | 3 }).run(); }}>
        <option value="0">Normal</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option>
      </select>
      <select aria-label="Font" className={sel} value={family} onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}>
        <option value="">Default font</option>
        {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <select aria-label="Font size" className={`${sel} w-[4.5rem]`} value={size} onChange={(e) => (e.target.value ? c().setFontSize(`${e.target.value}pt`).run() : c().unsetFontSize().run())}>
        <option value="">Size</option>
        {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
      <Tool title="Bold (⌘B)" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></Tool>
      <Tool title="Italic (⌘I)" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></Tool>
      <Tool title="Underline (⌘U)" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Tool>
      <Tool title="Strikethrough" active={editor.isActive("strike")} onClick={() => c().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Tool>
      <ColorButton title="Text colour" icon={<Type className="h-4 w-4" />} onPick={(col) => c().setColor(col).run()} onClear={() => c().unsetColor().run()} />
      <ColorButton title="Highlight colour" icon={<Highlighter className="h-4 w-4" />} onPick={(col) => c().setBackgroundColor(col).run()} onClear={() => c().unsetBackgroundColor().run()} />
      <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
      <Tool title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => c().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Tool>
      <Tool title="Align centre" active={editor.isActive({ textAlign: "center" })} onClick={() => c().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Tool>
      <Tool title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => c().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Tool>
      <Tool title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => c().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4" /></Tool>
      <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
      <Tool title="Bullet list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></Tool>
      <Tool title="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Tool>
      <Tool title="Increase indent" disabled={!editor.can().sinkListItem("listItem")} onClick={() => c().sinkListItem("listItem").run()}><IndentIncrease className="h-4 w-4" /></Tool>
      <Tool title="Decrease indent" disabled={!editor.can().liftListItem("listItem")} onClick={() => c().liftListItem("listItem").run()}><IndentDecrease className="h-4 w-4" /></Tool>
      <Tool title="Quote" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}><MessageSquareQuote className="h-4 w-4" /></Tool>
      <LinkButton editor={editor} />
      <Tool title="Horizontal line" onClick={() => c().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Tool>
      <Tool title="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}><Eraser className="h-4 w-4" /></Tool>
      <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
      <FieldMenu editor={editor} fields={fields} label="Insert field" />
      {audience === "SITE" && (
        <button type="button" disabled={editor.getHTML().includes("data-worker-table")} onMouseDown={(e) => e.preventDefault()} onClick={() => c().insertContent({ type: "workerTable" }).run()} className="inline-flex h-8 items-center gap-1 rounded-md border border-default px-2 text-xs font-medium text-secondary transition hover:bg-surface-hover disabled:opacity-40" title="Choose where the worker table goes (one per letter). Text below it prints under the table.">
          <Table2 className="h-3.5 w-3.5" /> Worker table
        </button>
      )}
      {audience === "EMPLOYEE" && <AskButton editor={editor} />}
    </div>
  );
}

export function LetterEditor({
  html,
  onChange,
  fields,
  audience,
}: {
  html: string;
  onChange: (html: string) => void;
  fields: MergeField[];
  audience: "SITE" | "EMPLOYEE";
}) {
  const known = useMemo(() => new Set(fields.map((f) => f.key).concat(audience === "SITE" ? ["SPONSORSHIPCOMPANYNAME"] : [])), [fields, audience]);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: false } }),
      TextStyleKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      WorkerTable,
      TokenPills.configure({ known }),
    ],
    content: html,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: { attributes: { "aria-label": "Letter body", spellcheck: "true" } },
  });

  if (!editor) return <div className="h-96 animate-pulse rounded-lg bg-surface-sunken" />;
  return (
    <div className="letter-editor overflow-hidden rounded-lg border border-default">
      <Toolbar editor={editor} fields={fields} audience={audience} />
      <EditorContent editor={editor} />
    </div>
  );
}
