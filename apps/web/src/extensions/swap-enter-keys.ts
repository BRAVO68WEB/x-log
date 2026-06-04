import { Extension } from "@tiptap/core";

const SwapEnterKeys = Extension.create({
  name: "swapEnterKeys",
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => editor.commands.setHardBreak(),
      "Mod-Enter": ({ editor }) => editor.commands.splitBlock(),
    };
  },
});

export { SwapEnterKeys };
