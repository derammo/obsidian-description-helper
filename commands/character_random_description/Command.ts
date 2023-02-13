import { Decoration } from "derobst/command";

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

	buildWidget(context: ViewPluginContext<Host>): void {
		let descriptors = this.createDescriptorsCollection();
		this.gatherDescriptionSection(descriptors, context);

		// create button that will request more descriptors based on these
		const text = new ButtonWidget(context.plugin, this, descriptors);
		context.builder.add(this.commandNode.from-1, this.commandNode.from-1, Decoration.widget({ widget: text }));
		WidgetFormatter.markBasedOnParameters(context, this);
	}
}

