import { Decoration, ParsedCommand } from "derobst/command";
import { ViewPluginContext } from "derobst/view";

import { Host } from "main/Plugin";
import { WidgetFormatter } from "main/WidgetFormatter";
import { ButtonWidget } from "./ButtonWidget";

export const IMAGE_SET_COMMAND_REGEX = /^\s*!image-set(?:\s([0-9-:TZ]+)\s(.*))?$/;

export class Command extends ParsedCommand<Host> {
	get regex(): RegExp {
		return IMAGE_SET_COMMAND_REGEX;
	}

	static match(text: string): boolean {
		return text.match(IMAGE_SET_COMMAND_REGEX) !== null;
	}

	buildWidget(context: ViewPluginContext<Host>): void {
		if (this.commandNode === undefined) {
			return;
		}
		const text = new ButtonWidget(context.plugin, this);
		context.builder.add(this.commandNode.from-1, this.commandNode.from-1, Decoration.widget({ widget: text }));
		WidgetFormatter.markBasedOnDefaults(context, this);
	}
}


