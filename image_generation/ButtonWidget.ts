import { WidgetType } from "@codemirror/view";
import { EditorView } from "derobst/command";
import { Host } from "main/Plugin";
import { TFile } from "obsidian";
import { PassThrough, Readable } from "node:stream";
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
		span.style.display = "inline-flex";
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
		const imageReference = this.imageReference;
		const host = this.host;
		control.innerText = "Widen";
		let enabled = false;
		if (imageReference.url.startsWith("https:")) {
			enabled = true;
		} else {
			// XXX check and cache size of local image
			enabled = true;
		}
		if (enabled) {
			this.host.registerDomEvent(control, "click", async (_event: Event) => {
				this.widen(host, view);
			});
		} else {
			control.disabled = true;
			control.ariaDisabled = "true";
			control.style.backgroundColor = "gray";
		}
	return control;
	}

	widen(host: Host, view: EditorView) {
		this.imageReference.getImageBuffer(host, view)
		.then((small) => {
			const smallDecoded = new PNG({});
			const resize = new Promise<{ image: Buffer, mask: Buffer }>((resolve, reject) => {
				smallDecoded.parse(Buffer.from(small))
				.on("parsed", () => {
					// upscale by 2x, we assume this initializes to all 0s
					const largeEncoded = new PNG({ width: smallDecoded.width * 2, height: smallDecoded.height * 2, colorType: 6 });

					// copy original image to center
					smallDecoded.bitblt(largeEncoded, 0, 0, smallDecoded.width, smallDecoded.height, smallDecoded.width / 2, smallDecoded.height / 2);

					// return new, larger image
					largeEncoded.pack();
					const large = PNG.sync.write(largeEncoded, { colorType: 6 });
					resolve({ image: large, mask: large });
				})
				.on("error", (err: unknown) => {
					reject(err);
				});
			});

			return resize
				.then(({ image, mask }) => {
					// REVISIT how do we not send mask?  the docs say optional but the API does not
					return this.host.generateWiderImage(image, mask, this.imageReference.prompt);
				});
		})
		.catch((err) => {
			// http response can be seen here
			console.log(err.response);
			console.error(err);
		})
		.then((images: ImageSet) => {
			if (images === undefined) {
				return;
			}
			ImageReference.displayImages(host, view, this.imageReference, images);
		});
	}

	// XXX this is fixed probably with the http adapter change, so get it to work again
	// XXX also make this work directly from the web without saving the remote image if we don't click keep
	// Axios doesn't like my Readable, returns 400 no image data
	widen2(host: Host, view: EditorView) {
		this.imageReference.getImageStream(host, view)
		.then((small) => {
			if (!small.readable) {
				return;
			}

			const smallDecoded = new PNG({});
			const resize = new Promise<{ image: Readable, mask: Readable }>((resolve, reject) => {
				small.pipe(smallDecoded)
				.on("parsed", () => {
					console.log(smallDecoded.width, smallDecoded.height);

					// upscale by 2x, we assume this initializes to all 0s
					const largeEncoded = new PNG({ width: smallDecoded.width * 2, height: smallDecoded.height * 2, colorType: 6 });

					// copy original image to center
					smallDecoded.bitblt(largeEncoded, 0, 0, smallDecoded.width, smallDecoded.height, smallDecoded.width / 2, smallDecoded.height / 2);

					// return new, larger image
					const imageBuffer = new PassThrough();
					const maskBuffer = new PassThrough();
					largeEncoded.pack().pipe(imageBuffer);
					largeEncoded.pipe(maskBuffer);
					resolve({ image: imageBuffer, mask: maskBuffer });
				})
				.on("error", (err: unknown) => {
					reject(err);
				});
			});

			return resize
				.then(({ image, mask }) => {
					// XXX temp, how do we not send mask?  the docs say optional but the API does not
					return this.host.generateWiderImage(image, mask, this.imageReference.prompt);
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
