import { CommandWidgetBase, EditorView, ParsedCommand } from "derobst/command";
import { WidgetContext } from "derobst/interfaces";
import { Host } from "main/Plugin";
import { CreateCompletionResponseChoicesInner } from "openai";

export class ButtonWidget extends CommandWidgetBase<Host> {
	generated: string;
	previousValue: string | undefined;

	constructor(context: WidgetContext<Host>, command: ParsedCommand<Host>, public descriptors: Set<string>) {
		super(context, command);
	}

	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		span.classList.add("derammo-describe-container");
		span.appendChild(this.buildButton(view));
		return span;
	}

	buildButton(view: EditorView): HTMLElement {
		const control = document.createElement("button");
		control.classList.add("derammo-describe-button", "derammo-button");
		control.innerText = "AI describe";
		this.host.registerDomEvent(control, "click", async (_event: Event) => {
			this.queryDavinci3(view)
			.then(() => {
				this.command.handleUsed(view);
			});
		});
		this.host.registerDomContextMenuTarget(control, this.command);
		return control;
	}

	private async queryDavinci3(view: EditorView) {
		// REVISIT: configure these if we make this general
		const generateNumber = 16;
		const returnNumber = 8;
		const temperature = 0.9;
		const presencePenalty = 1.0;

		const promptParts: string[] = Array.from(this.descriptors);
		promptParts.push("using 2 words for each attribute");

		const prompt: string = `list ${generateNumber} physical attributes or articles of clothing or equipment of a medieval ${promptParts.join(", ")}`;
		console.log(`PROMPT '${prompt}'`);

		this.host.incrementRunningRequestCount();
		return this.host.openai.createCompletion({
			model: "text-davinci-003",
			prompt: prompt,
			temperature: temperature,
			max_tokens: 100,
			presence_penalty: presencePenalty
		})
		.then((response) => {
			const lines: string[] = [];
			for (const value of response.data.choices) {
				this.parseChoice(lines, value);
			}

			if (lines.length < 1) {
				console.log("GENERATE no new descriptions generated");
				return;
			}

			// randomly reduce down to the requested amount
			while (lines.length > returnNumber) {
				lines.splice(Math.floor(Math.random() * lines.length), 1);
			}

			const generated = `${lines.join("\n")}\n\n`;
			for (const range of this.fetchCurrentRanges()) {
				view.dispatch({ 
					changes: { 
						from: range.from-1, 
						to: range.from-1, 
						insert: generated }
				});			
			}
		})
		.finally(() => {
			this.host.decrementRunningRequestCount();
		});
	}

	private parseChoice(lines: string[], value: CreateCompletionResponseChoicesInner) {
	if (value.text === undefined) {
		return;
	}
	
		for (const line of value.text.split(/[\n,;]/g)) {
		let text = line.trim();
		if (text.length < 1) {
				continue;
		}
		const match = text.match(/^\s*[1-9][0-9]*\.\s(.*)$/);
		if (match !== null) {
			text = match[1];
		}
		if (text.length < 1) {
				continue;
		}
		text = text.toLowerCase();
		if (this.descriptors.has(text)) {
			// don't allow duplicates
				continue;
		} 
		lines.push(`> ${text} \`!erase-quote\``);
		}
	}	
}

