import { Decoration } from '@codemirror/view';
import { SyntaxNode } from '@lezer/common/dist/tree';

import { HEADER_NODE_PREFIX, QUOTE_NODE_CONTAINING_COMMAND_PREFIX, QUOTE_NODE_PREFIX, QUOTE_TEXT_NODE_PREFIX } from "derobst/internals";
import { ViewPluginContext } from 'derobst/view';
import { DescriptorsCommand } from "main/DescriptorsCommand";
import { Host } from 'main/Plugin';
import { WidgetFormatter } from 'main/WidgetFormatter';

import { EditWidget } from "./EditWidget";

// generated images can be recognized from this prefix in their ![alt text](url)
export const ALT_TEXT_PREFIX = "generated DALL-E ";

const COMMAND_REGEX = /^\s*!image-prompt-from-tags(?:\s(.*)|$)/;

export class Command extends DescriptorsCommand {
	constructor() {
		super("image");
	}
	
	get regex(): RegExp {
		return COMMAND_REGEX;
	}

	static match(text: string): boolean {
		return text.match(COMMAND_REGEX) !== null;
	}

	buildWidget(context: ViewPluginContext<Host>): void {
		let scan: SyntaxNode | null = this.commandNode;
		let quoteEnd: SyntaxNode | null = null;
		while (scan !== null) {
			if (scan.type.name.startsWith(HEADER_NODE_PREFIX)) {
				// gone too far
				scan = null;
				break;
			}
			if (scan.type.name.startsWith(QUOTE_TEXT_NODE_PREFIX)) {
				// text inside quote block, keep searching for quote start
				quoteEnd = scan;
			} else {
				if (scan.type.name.startsWith(QUOTE_NODE_PREFIX)) {
					// found what we want
					break;
				}
				if (scan.type.name.startsWith(QUOTE_NODE_CONTAINING_COMMAND_PREFIX)) {
					// found what we want, we are inside the quote
					break;
				}
			}

			scan = scan.prevSibling;
		}
		
		if (scan === null) {
			// no quote text to work on, do nothing
			return;
		}

		const quoteStart = scan;
		if (quoteEnd === null) {
			quoteEnd = quoteStart;
		}
		const quoteText = context.state.doc.sliceString(quoteStart.from, quoteEnd.to);
		if (!quoteText.startsWith("> ")) {
			// don't work on stuff that has been disturbed too much
			return;
		}

		let descriptors = this.createDescriptorsCollection();
		this.gatherDescriptionSection(descriptors, context);

		const text = new EditWidget(context.plugin, this, quoteStart, quoteEnd, descriptors);
		context.builder.add(quoteStart.from, this.commandNode.from, Decoration.replace({ widget: text }));
		WidgetFormatter.markBasedOnParameters(context, this);
	}
}


