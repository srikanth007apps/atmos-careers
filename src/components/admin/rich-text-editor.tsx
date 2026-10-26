"use client";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Pilcrow, Quote, Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

function ToolButton({ label, active, onClick, disabled, children }: { label: string; active?: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 [&_svg]:size-4", active && "bg-accent text-canopy")}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b bg-muted/50 px-2 py-1.5">
      <ToolButton label="Paragraph" active={editor.isActive("paragraph")} onClick={() => c().setParagraph().run()}><Pilcrow /></ToolButton>
      <ToolButton label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolButton>
      <ToolButton label="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 /></ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}><Bold /></ToolButton>
      <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}><Italic /></ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}><List /></ToolButton>
      <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}><ListOrdered /></ToolButton>
      <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}><Quote /></ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton label="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 /></ToolButton>
      <ToolButton label="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 /></ToolButton>
    </div>
  );
}

export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: "Describe the role: responsibilities, requirements, what you offer…" }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        id,
        class: "tiptap prose-job max-w-none",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": `${id}-label`,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
    onBlur: () => onBlur?.(),
  });

  return (
    <div className={cn("overflow-hidden rounded-md border bg-card focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring", invalid ? "border-destructive" : "border-input")}>
      {editor ? <Toolbar editor={editor} /> : <div className="h-10 border-b bg-muted/50" />}
      <EditorContent editor={editor} />
    </div>
  );
}
