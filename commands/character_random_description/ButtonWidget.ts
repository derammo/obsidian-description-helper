import { CommandWidgetBase, EditorView, ParsedCommand } from "derobst/command";
import { Host } from "main/Plugin";

import { openai } from "main";
import { CreateCompletionResponseChoicesInner } from "openai";

export class ButtonWidget extends CommandWidgetBase<Host> {
	generated: string;
	previousValue: string | undefined;

	constructor(host: Host, command: ParsedCommand<Host>, public descriptors: Set<string>) {
		super(host, command);
	}

	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		span.appendChild(this.buildButton(view));
		return span;
	}

	buildButton(view: EditorView): HTMLElement {
		const control = document.createElement("button");
		control.innerText = "AI describe";
		this.host.registerDomEvent(control, "click", async (_event: Event) => {
			this.queryDavinci3(view)
			.then(() => {
				this.command.handleUsed(view);
			});
		});
		return control;
	}

	private async queryDavinci3(view: EditorView) {
		// XXX configure number to generate
		// XXX configure max number of unique ones to offer up
		const generateNumber = 16;
		const returnNumber = 8;
		const promptParts: string[] = Array.from(this.descriptors);
		promptParts.push("using 2 words for each attribute");

		const prompt: string = `list ${generateNumber} physical attributes or articles of clothing or equipment of a medieval ${promptParts.join(", ")}`;
		console.log(`PROMPT '${prompt}'`);

		return openai.createCompletion({
			model: "text-davinci-003",
			prompt: prompt,
			// XXX config
			temperature: 0.9,
			max_tokens: 100,
			presence_penalty: 1
		})
		.then((response) => {
			let lines: string[] = [];
			response.data.choices.forEach((value: CreateCompletionResponseChoicesInner) => {
				if (value.text === undefined) {
					return;
				}
				
				value.text.split(/[\n,;]/g).forEach((line: string) => {
					let text = line.trim();
					if (text.length < 1) {
						return;
					}
					const match = text.match(/^\s*[1-9][0-9]*\.\s(.*)$/);
					if (match !== null) {
						text = match[1];
					}
					if (text.length < 1) {
						return;
					}
					text = text.toLowerCase();
					if (this.descriptors.has(text)) {
						// don't allow duplicates
						return;
					} 
					lines.push(`> ${text} \`!erase-quote\``);
				})
			})

			if (lines.length < 1) {
				console.log("GENERATE no new descriptions generated");
				return;
			}

			// randomly reduce down to the requested amount
			while (lines.length > returnNumber) {
				lines.splice(Math.floor(Math.random() * lines.length), 1);
			}

			const generated = `${lines.join("\n")}\n\n`;
			view.dispatch({ 
				changes: { 
					from: this.command.commandNode.from-1, 
					to: this.command.commandNode.from-1, 
					insert: generated }
			});			
		});
	}
}
