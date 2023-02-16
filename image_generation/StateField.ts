import { syntaxTree } from "@codemirror/language";
import {
	EditorState, Extension,
	RangeSetBuilder,
	StateField, Text, Transaction, Line
} from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView
} from "@codemirror/view";
import { SyntaxNode } from "@lezer/common";
import { IMAGE_SET_COMMAND_REGEX } from "commands/image_set/Command";
import { IMAGE_ALT_TEXT_NODE, INLINE_CODE_IN_QUOTE_NODE, INLINE_CODE_NODE, STRING_URL_NODE } from "derobst/internals";
import { Host } from "main/Plugin";
import { editorLivePreviewField } from "obsidian";
import { ButtonWidget } from "./ButtonWidget";
import { ALT_TEXT_PREFIX, ImageReference } from "./ImageReference";

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
	let generationId: string = "";
	let prompt: string = "";
	let promptLine: Line;
	syntaxTree(state).iterate({
		enter(scannedNode) {
			switch (scannedNode.type.name) {
				case 'Document':
					break;
				case INLINE_CODE_NODE:
				case INLINE_CODE_IN_QUOTE_NODE: {
					const text = state.doc.sliceString(scannedNode.from, scannedNode.to);
					const match = text.match(IMAGE_SET_COMMAND_REGEX);
					if (match !== null) {
						prompt = match[2];
						promptLine = state.doc.lineAt(scannedNode.to);
					}
					break;
				}
				case IMAGE_ALT_TEXT_NODE: {
					const text = state.doc.sliceString(scannedNode.from, scannedNode.to);
					const match = text.match(ALT_TEXT_REGEX);
					if (match !== null) {
						altText = scannedNode.node;
						generationId = match[1];
					} else {
						altText = null;
					}
					break;
				}
				case STRING_URL_NODE: {
					const closeParen = scannedNode.node.nextSibling;
					if (altText === null) {
						break;
					}
					if (closeParen === null) {
						console.log("STATE_UPDATE missing url close parenthesis");
						break;
					}
					const urlLine = state.doc.lineAt(scannedNode.from);
					if (prompt.length > 0 && urlLine.number > (promptLine?.number ?? 0) + 2) {
						// too far away to count as this image being in the image set
						prompt = "";
						break;
					}
					imageReferences.push(new ImageReference(state, generationId, prompt, altText, scannedNode.node, closeParen));
					builder.add(closeParen.to, closeParen.to, Decoration.widget({ widget: new ButtonWidget(host, imageReferences) }));
					break;
				}
			}
		}
	});
}
