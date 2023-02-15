import { syntaxTree } from "@codemirror/language";
import {
  EditorState, Extension,
  RangeSetBuilder,
  StateField, Text, Transaction
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView
} from "@codemirror/view";
import { SyntaxNode } from "@lezer/common";
import { ALT_TEXT_PREFIX } from "commands/image_prompt_from_tags/Command";
import { Host } from "main/Plugin";
import { editorLivePreviewField } from "obsidian";
import { ButtonWidget } from "./ButtonWidget";
import { ImageReference } from "./ImageReference";

const ALT_TEXT_REGEX = new RegExp(`^${ALT_TEXT_PREFIX}([0-9-:TZ]+)\\s`);

export function createGeneratedImagesDecorationsStateField(host: Host): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create(state): DecorationSet {
      if (state.doc.length < 1) {
        // document is empty, no need to scan it (this happens every time on initialization)
        return Decoration.none;
      }
      if (!state.field(editorLivePreviewField)) {
        // source mode
        return Decoration.none;
      }
      const builder = new RangeSetBuilder<Decoration>();
      walkTree(host, builder, state);
      return builder.finish();
    },

    update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
      if (!transaction.state.field(editorLivePreviewField)) {
        // source mode
        return Decoration.none;
      }
      const builder = new RangeSetBuilder<Decoration>();
      if (!transaction.docChanged) {
        // document not changed and we have already scannned it initially
        return oldState;
      }
      walkTree(host, builder, transaction.state);
      return builder.finish();
    },

    provide(field: StateField<DecorationSet>): Extension {
      return EditorView.decorations.from(field);
    },
  });
}

// XXX consider using this to detect when changes are relevant to our decorations, but how are ranges meaningful if we DON'T recreate decorations?
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function walkChanges(transaction: Transaction): void {
  transaction.changes.iterChanges((fromOld: number, toOld: number, fromNew: number, toNew: number, _inserted: Text) => {
    console.log(`STATE_UPDATE CHANGE OLD ${fromOld}..${toOld} '${transaction.state.doc.sliceString(fromOld, toOld)}'`);
    console.log(`STATE_UPDATE CHANGE NEW ${fromNew}..${toNew} '${transaction.state.doc.sliceString(fromNew, toNew)}'`);
  });
}

function walkTree(host: Host, builder: RangeSetBuilder<Decoration>, state: EditorState) {
  // accumulate all image references so that our buttons can share the collection
  const imageReferences: ImageReference[] = [];

  let altText: SyntaxNode | null = null;
  let generationId: string;
  syntaxTree(state).iterate({
    enter(scannedNode) {
      switch (scannedNode.type.name) {
        case 'Document':
          break;
        case 'image_image-alt-text_link': {
          const text = state.doc.sliceString(scannedNode.from, scannedNode.to)
          const match = text.match(ALT_TEXT_REGEX);
          if (match !== null) {
            altText = scannedNode.node;
            generationId = match[1];
          } else {
            altText = null;
          }
          break;
        }
        case 'string_url': {
          const closeParen = scannedNode.node.nextSibling;
          if (altText === null) {
            break;
          }
          if (closeParen === null) {
            console.log("STATE_UPDATE missing url close parenthesis");
            break;
          }
          imageReferences.push(new ImageReference(state, generationId, altText, scannedNode.node, closeParen));
          builder.add(closeParen.to, closeParen.to, Decoration.widget({ widget: new ButtonWidget(host, imageReferences) }));
          break;
        }
      }
    },
  });
}
