import { HEADER_NODE_PREFIX, QUOTE_NODE_CONTAINING_COMMAND_PREFIX, QUOTE_NODE_PREFIX, QUOTE_TEXT_NODE_PREFIX } from "derobst/internals";
import { ViewPluginContext } from 'derobst/view';
import { Decoration, SyntaxNodeRef, SyntaxNode } from 'derobst/command';
import { DescriptorsCommand } from "main/DescriptorsCommand";
import { Host } from 'main/Plugin';
import { WidgetFormatter } from 'main/WidgetFormatter';

import { EditWidget } from "./EditWidget";

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

	buildWidget(context: ViewPluginContext<Host>, commandNodeRef: SyntaxNodeRef): void {
		let scan: SyntaxNode | null = commandNodeRef.node;
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

		const descriptors = this.createDescriptorsCollection();
		this.gatherDescriptionSection(descriptors, context, commandNodeRef);
		const text = new EditWidget(context, this, quoteStart, quoteEnd, descriptors);
		context.builder.add(quoteStart.from, commandNodeRef.from, Decoration.replace({ widget: text }));
		WidgetFormatter.markBasedOnParameters(context, this, commandNodeRef);
	}
}


