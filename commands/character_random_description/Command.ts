import { Decoration, SyntaxNodeRef } from "derobst/command";

import { ButtonWidget } from "./ButtonWidget";
import { ViewPluginContext } from "derobst/view";
import { Host } from "main/Plugin";
import { WidgetFormatter } from "main/WidgetFormatter";
import { DescriptorsCommand } from "main/DescriptorsCommand";

const COMMAND_REGEX = /^\s*!character-random-description(?:\s(.*)|$)/;

export class Command extends DescriptorsCommand {
	constructor() {
		super("text");
	}
	
	get regex(): RegExp {
		return COMMAND_REGEX;
	}

	static match(text: string): boolean {
		return text.match(COMMAND_REGEX) !== null;
	}

	buildWidget(context: ViewPluginContext<Host>, commandNodeRef: SyntaxNodeRef): void {
		const descriptors = this.createDescriptorsCollection();
		this.gatherDescriptionSection(descriptors, context, commandNodeRef);

		// create button that will request more descriptors based on these
		const text = new ButtonWidget(context, this, descriptors);
		context.builder.add(commandNodeRef.from-1, commandNodeRef.from-1, Decoration.widget({ widget: text }));
		WidgetFormatter.markBasedOnParameters(context, this, commandNodeRef);
	}
}

