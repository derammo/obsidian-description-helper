import { CommandWidgetBase, EditorView, ParsedCommand, SyntaxNode } from "derobst/command";
import { WidgetContext } from "derobst/interfaces";
import { UpdatedTextRange } from "derobst/view";
import { ImageReference } from "image_generation/ImageReference";
import { ImageSet } from "image_generation/ImageSet";
import { Host } from "main/Plugin";

export class EditWidget extends CommandWidgetBase<Host> {
	generated: string;
	previousValue: string | undefined;
	currentValue: string = "";
	quoteStart: UpdatedTextRange;
	quoteEnd: UpdatedTextRange;

	constructor(
		context: WidgetContext<Host>,
		command: ParsedCommand<Host>,
		quoteStart: SyntaxNode,
		quoteEnd: SyntaxNode,
		public descriptors: Set<string>) {
		super(context, command);
		this.quoteStart = context.plugin.tracking.register(context.state, quoteStart);
		this.quoteEnd = context.plugin.tracking.register(context.state, quoteEnd);
	}

	toDOM(view: EditorView): HTMLElement {
		const line = document.createElement("div");
		line.classList.add("derammo-imageprompt-container");
		line.appendChild(this.buildTextEdit(view));
		line.appendChild(this.buildButton(view));
		return line;
	}

	buildTextEdit(view: EditorView): HTMLElement {
		const promptParts: string[] = Array.from(this.descriptors);

		// promptParts.push("medium shot");
		// promptParts.push("mid-shot");
		// promptParts.push("head & shoulders shot");
		// promptParts.push("face");
		// promptParts.push("portrait");
		// promptParts.push("long shot");
		// promptParts.push("wide shot");
		// promptParts.push("full shot");
		// promptParts.push("field journal line art");

		// REVISIT: these could be a style preset
		promptParts.push("colored pencil");
		promptParts.push("realistic");
		promptParts.push("surrounded by white background");

		let prefix = this.host.settings.imagePromptPrefix ?? ""
		if (prefix.match(/^ +$/)) {
			// empty string chooses default, so all spaces can be used to specify "no prefix"
			prefix = "";
		} else {
			if (prefix.length < 1) {
				prefix = "medieval ";
			} else {
				prefix = `${prefix} `;
			}
		}
		this.generated = `${prefix}${promptParts.join(", ")}`;

		const control = document.createElement("textarea");
		control.classList.add("derammo-imageprompt-control");

		control.placeholder = this.generated;
		this.loadContent(view, control);

		this.host.registerDomEvent(control, "change", async (event: Event) => {
			let input: string = ((event.target as HTMLTextAreaElement)?.value ?? "").trim();

			// if set back to default, store nothing
			if (input == this.generated) {
				input = "";
			}

			this.previousValue = undefined;
			this.currentValue = input;
			await this.replaceQuote(view, input);
		});

		this.host.registerDomEvent(control, "focusin", async (_event: Event) => {
			this.previousValue = control.value;
			if (control.value.length < 1) {
				control.value = this.generated;
			}
		});

		this.host.registerDomEvent(control, "focusout", async (_event: Event) => {
			if (this.previousValue !== undefined) {
				control.value = this.previousValue;
				this.previousValue = undefined;
			}
		});

		this.host.registerDomContextMenuTarget(control, this.command);
		return control;
	}

	// XXX on download, use meta-png or similar library to add prompt used as metadata to the PNG?

	buildButton(view: EditorView): HTMLElement {
		const control = document.createElement("button");
		control.classList.add("derammo-imageprompt-button", "derammo-button");
		const prompt = (this.currentValue.length > 0) ? this.currentValue : this.generated;

		control.innerText = "AI draw";

		this.host.registerDomEvent(control, "click", async (_event: Event) => {
			this.host.incrementRunningRequestCount();
			this.host.generateImages(prompt)
				.then((images: ImageSet) => {
					for (const range of this.fetchCurrentRanges()) {
						ImageReference.displayImages(this.host, view, range, images);
					}
				})
				.then(() => {
					// XXX optionally, create an obsidian vault file /DALL-E/${generationId}.md containing the prompt info and links to the images
					this.command.handleUsed(view);
				})
				.finally(() => {
					this.host.decrementRunningRequestCount();
				});
		});
		this.host.registerDomContextMenuTarget(control, this.command);
		return control;
	}

	private loadContent(view: EditorView, control: HTMLTextAreaElement) {
		const start = this.quoteStart.fetchCurrentRange();
		const end = this.quoteEnd.fetchCurrentRange();
		if (start === null || end === null || end.to <= (start.from + 2)) {
			return;
		}
		const content = view.state.doc.sliceString(start.from + 2, end.to);
		this.currentValue = content;
		control.value = content;
	}

	async replaceQuote(view: EditorView, value: string) {
		for (const range of this.fetchCurrentRanges()) {
			view.dispatch({
				changes: { from: range.from + 2, to: range.to, insert: value }
			});
		}
	}
}

