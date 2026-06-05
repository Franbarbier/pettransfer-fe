"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeight?: string;
};

export function RichTextEditor({ value, onChange, disabled, minHeight = "10rem" }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "focus:outline-none px-3 py-2 text-sm text-zinc-800 leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_a]:text-blue-600 [&_a]:underline [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through",
        style: `min-height: ${minHeight};`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(editor.isEmpty ? "" : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (next !== current && !(editor.isEmpty && next === "")) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div
        className="rounded-lg border border-zinc-300 bg-zinc-50"
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className="rounded-lg border border-zinc-300 bg-white focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-300">
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}

type ToolbarProps = { editor: Editor; disabled?: boolean };

function Toolbar({ editor, disabled }: ToolbarProps) {
  const btn = (active: boolean) =>
    `inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-xs font-medium transition ${
      active
        ? "bg-zinc-800 text-white"
        : "text-zinc-700 hover:bg-zinc-100"
    } disabled:cursor-not-allowed disabled:opacity-40`;

  const promptLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del link", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-1.5 py-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        title="Negrita (Ctrl+B)"
        aria-label="Negrita"
      >
        <span className="font-bold">B</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
        title="Cursiva (Ctrl+I)"
        aria-label="Cursiva"
      >
        <span className="italic">I</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btn(editor.isActive("underline"))}
        title="Subrayado (Ctrl+U)"
        aria-label="Subrayado"
      >
        <span className="underline">U</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
        title="Tachado"
        aria-label="Tachado"
      >
        <span className="line-through">S</span>
      </button>
      <span className="mx-1 h-4 w-px bg-zinc-200" />
      <button
        type="button"
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        title="Lista"
        aria-label="Lista"
      >
        •
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
        title="Lista numerada"
        aria-label="Lista numerada"
      >
        1.
      </button>
      <span className="mx-1 h-4 w-px bg-zinc-200" />
      <button
        type="button"
        disabled={disabled}
        onClick={promptLink}
        className={btn(editor.isActive("link"))}
        title="Link"
        aria-label="Link"
      >
        <span className="underline">a</span>
      </button>
    </div>
  );
}
