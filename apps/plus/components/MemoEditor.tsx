"use client";

import { PointerEvent as ReactPointerEvent, useEffect, useImperativeHandle, Ref } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, markInputRule, markPasteRule } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import HardBreak from "@tiptap/extension-hard-break";
import StarterKit from "@tiptap/starter-kit";

const InlineMarkdownInputRules = Extension.create({
  name: "inlineMarkdownInputRules",

  addInputRules() {
    const marks = this.editor.schema.marks;

    return [
      markInputRule({
        find: /\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*)$/,
        type: marks.bold,
      }),
      markInputRule({
        find: /__(?!\s+__)((?:[^_]+))__(?!\s+__)$/,
        type: marks.bold,
      }),
      markInputRule({
        find: /(?<!\*)\*(?!\*)((?:[^*]+))(?<!\*)\*(?!\*)$/,
        type: marks.italic,
      }),
      markInputRule({
        find: /_(?!\s+_)((?:[^_]+))_(?!\s+_)$/,
        type: marks.italic,
      }),
      markInputRule({
        find: /~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~)$/,
        type: marks.strike,
      }),
      markInputRule({
        find: /`([^`]+)`(?!`)$/,
        type: marks.code,
      }),
      markInputRule({
        find: /==(?!\s+==)((?:[^=]+))==(?!\s+==)$/,
        type: marks.highlight,
      }),
    ];
  },

  addPasteRules() {
    const marks = this.editor.schema.marks;

    return [
      markPasteRule({
        find: /\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*)/g,
        type: marks.bold,
      }),
      markPasteRule({
        find: /__(?!\s+__)((?:[^_]+))__(?!\s+__)/g,
        type: marks.bold,
      }),
      markPasteRule({
        find: /(?<!\*)\*(?!\*)((?:[^*]+))(?<!\*)\*(?!\*)/g,
        type: marks.italic,
      }),
      markPasteRule({
        find: /_(?!\s+_)((?:[^_]+))_(?!\s+_)/g,
        type: marks.italic,
      }),
      markPasteRule({
        find: /~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~)/g,
        type: marks.strike,
      }),
      markPasteRule({
        find: /`([^`]+)`(?!`)/g,
        type: marks.code,
      }),
      markPasteRule({
        find: /==(?!\s+==)((?:[^=]+))==(?!\s+==)/g,
        type: marks.highlight,
      }),
    ];
  },
});

export type MemoEditorHandle = {
  toggleCodeBlock: () => void;
  toggleBlockQuote: () => void;
  toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleStrike: () => void;
  setHorizontalRule: () => void;
  toggleHighlight: () => void;
};

// 메모 에디터 컴포넌트 - TipTap 리치 텍스트를 적용
export default function MemoEditor({
  ref,
  content,
  onChange,
}: {
  ref?:  Ref<MemoEditorHandle>;
  content: string;
  onChange: (content: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        hardBreak: false,
      }),

      HardBreak.extend({
        addKeyboardShortcuts() {
          return {
            "Shift-Enter": () => this.editor.commands.setHardBreak(),
          };
        },
      }),

      Highlight.configure({
        multicolor: true,
      }),

      InlineMarkdownInputRules,
    ],
    content: content,
    editorProps: {
      attributes: {
        class: "memo-editor-content",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useImperativeHandle(ref, () => ({
    toggleCodeBlock: () => {
      editor?.chain().focus().toggleCodeBlock().run();
    },
    toggleBlockQuote: () => {
      editor?.chain().focus().toggleBlockquote().run();
    },
    toggleHeading: (level) => {
      editor?.chain().focus().toggleHeading({ level }).run();
    },
    toggleBold: () => {
      editor?.chain().focus().toggleBold().run();
    },
    toggleItalic: () => {
      editor?.chain().focus().toggleItalic().run();
    },
    toggleStrike: () => {
      editor?.chain().focus().toggleStrike().run();
    },
    setHorizontalRule: () => {
      editor?.chain().focus().setHorizontalRule().run();
    },
    toggleHighlight: () => {
      editor?.chain().focus().toggleHighlight({ color: "#fbca93" }).run();
    },
  }), [editor]);

  useEffect(() => {
    if (!editor || editor.getHTML() === content) return;

    editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;

    window.setTimeout(() => {
      editor.commands.focus("end");
    }, 0);
  }, [editor]);

  const handleEditorPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!editor || (event.pointerType !== "touch" && event.pointerType !== "mouse")) {
      return;
    }

    if (!editor.isFocused) {
      editor.commands.focus("end");
    }
  };
  
  return (
    <EditorContent
      className="h-full w-full"
      editor={editor}
      onPointerUp={handleEditorPointerUp}
    />
  );
}
