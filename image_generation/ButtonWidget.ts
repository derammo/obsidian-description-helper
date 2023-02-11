import { WidgetType } from "@codemirror/view";
import { EditorView } from "derobst/command";
import { Host } from "main/Plugin";
import { TFile } from "obsidian";
import { ImageReference } from "./ImageReference";
import { ImageSet } from "./ImageSet";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PNG = require("pngjs/lib/png").PNG;

export class ButtonWidget extends WidgetType {
	imageReference: ImageReference;

	constructor(public host: Host, public imageReferences: ImageReference[]) {
		super();
		if (imageReferences.last() === undefined) {
			throw new Error("Image buttons should always be attached to image references.")
		} 
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		this.imageReference = imageReferences.last()!;
	}

	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		span.classList.add("derammo-description-helper");
		span.classList.add("derammo-description-helper-auto-hide");
		// span.style.display = "inline-flex";
		span.style.flexDirection = "column";
		span.style.rowGap = "5px";
		span.style.padding = "5px";
		span.style.paddingBottom = "0px";
		span.style.verticalAlign = "top";
	
		span.style.width = "70px";
		span.style.marginLeft = "-70px";

		span.appendChild(this.buildChooseButton(view));
		span.appendChild(this.buildKeepButton(view));
		span.appendChild(this.buildZoomOutButton(view));
		span.appendChild(this.buildDiscardButton(view));
		return span;
	}

	buildKeepButton(view: EditorView): HTMLElement {
		const control = this.buildFlexButton();
		const imageReference = this.imageReference;
		const host = this.host;
		control.innerText = "Keep";
		if (imageReference.url.startsWith("https:")) {
			this.host.registerDomEvent(control, "click", async (_event: Event) => {
				imageReference.downloadRemoteImage(host, view);
			});
		} else {
			control.disabled = true;
			control.ariaDisabled = "true";
			control.style.backgroundColor = "gray";
		}
		return control;
	}

	buildZoomOutButton(view: EditorView): HTMLElement {
		const control = this.buildFlexButton();
		const host = this.host;
		control.innerText = "Widen";
		this.host.registerDomEvent(control, "click", async (_event: Event) => {
			this.widen(host, view);
		});
		return control;
	}

	widen(host: Host, view: EditorView) {
		// getting the images is also slow, so turn on the "busy" indicator
		host.incrementRunningRequestCount();
		this.imageReference.getImageStream(host, view)
		.then((small) => {
			if (!small.readable) {
				return;
			}

			const smallDecoded = new PNG({});
			const resize = new Promise<{ image: Buffer, mask: Buffer, width: number, height: number }>((resolve, reject) => {
				small.pipe(smallDecoded)
				.on("parsed", () => {
					console.log(smallDecoded.width, smallDecoded.height);

					// upscale by 2x, we assume this initializes to all 0s
					const largeEncoded = new PNG({ width: smallDecoded.width * 2, height: smallDecoded.height * 2, colorType: 6 });

					// copy original image to center
					smallDecoded.bitblt(largeEncoded, 0, 0, smallDecoded.width, smallDecoded.height, smallDecoded.width / 2, smallDecoded.height / 2);

					// return new, larger image
					largeEncoded.pack();
					const large = PNG.sync.write(largeEncoded, { colorType: 6 });
					resolve({ image: large, mask: large, width: largeEncoded.width, height: largeEncoded.height });
				})
				.on("error", (err: unknown) => {
					reject(err);
				});
			});

			return resize
				.then(({ image, mask, width, height }) => {
					// XXX temp, how do we not send mask?  the docs say optional but the API does not
					return this.host.generateWiderImage(image, mask, width, height, this.imageReference.prompt);
				});
		})
		.catch((err) => {
			console.log(err.response);
			console.error(err);
		})
		.then((images: ImageSet) => {
			if (images === undefined) {
				return;
			}
			ImageReference.displayImages(host, view, this.imageReference, images);
		})
		.finally(() => {
			host.incrementRunningRequestCount();
		});
	}

	buildChooseButton(view: EditorView): HTMLElement {
		const control = this.buildFlexButton();
		control.innerText = "Choose";
		const host = this.host;

		host.registerDomEvent(control, "click", async (_event: Event) => {
			if (this.imageReferences.length === 0) {
				return;
			}

			// erase all image references, in reverse order (REVISIT: why did reduceRight not work?)
			for (let i=this.imageReferences.length-1; i>=0; i--) {
				this.imageReferences[i].erase(view);
			}

			// make sure we secure the file
			const file: TFile = await this.imageReference.downloadRemoteImage(host, view);

			// create a new reference to the chosen image at the only undisturbed location, without UI
			this.imageReferences.first()?.insertChosenImageReference(view, host.settings.chosenImagePresentationWidth, file.path);

			// don't let this be on the same line as an image set, because we are about to destroy those
			this.imageReferences.first()?.insertLineBreak(view);

			// don't do this again if we somehow get called again
			this.imageReferences = [];
		});
		return control;
	}

	buildDiscardButton(view: EditorView): HTMLElement {
		const control = this.buildFlexButton();
		control.innerText = "Discard";

		this.host.registerDomEvent(control, "click", async (_event: Event) => {
			this.imageReference.erase(view);
		});
		return control;
	}

	buildFlexButton(): HTMLButtonElement {
		const control = document.createElement("button");
		control.style.display = "flex";
		control.style.flexGrow = "0";
		control.style.flexShrink = "0";
		control.style.flexBasis = "auto";
		return control;
	}
}
