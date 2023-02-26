import { syntaxTree } from '@codemirror/language';
import { EditorState, TextIterator } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { SyntaxNode } from '@lezer/common';
import { fileTypeFromBuffer, FileTypeResult } from 'file-type';

import * as got from 'got';
import { PassThrough, Readable } from "node:stream";

import { Host } from 'main/Plugin';
import { TFile } from 'obsidian';

import { ImageSet } from './ImageSet';
import { TextRange } from 'derobst/view';

// generated images can be recognized from this prefix in their ![alt text](url)
export const ALT_TEXT_PREFIX = 'generated DALL-E ';

export class ImageReference {
	from: number;
	to: number;
	url: string;
	file: TFile | undefined;

	constructor(
		state: EditorState, public readonly generationId: string,
		public readonly prompt: string, altText: SyntaxNode, url: SyntaxNode,
		closeParen: SyntaxNode) {
		this.from = altText.from - 2;
		this.to = closeParen.to;
		if (state.doc.sliceString(closeParen.to, closeParen.to + 1) == ' ') {
			this.to++;
		}
		this.url = state.doc.sliceString(url.from, url.to);
	}

	erase(view: EditorView) {
		view.dispatch({ changes: { from: this.from, to: this.to } });
	}

	insertChosenImageReference(view: EditorView, width: number, url: string) {
		view.dispatch({
			changes:
				{ from: this.from, to: this.from, insert: `![chosen image|${width}](${url})` }
		});
	}

	insertLineBreak(view: EditorView) {
		view.dispatch({ changes: { from: this.from, to: this.from, insert: '\n' } });
	}

	private loadLocalFile(host: Host): Promise<TFile> {
		return host.loadFile(this.url).then((file: TFile) => {
			// cache this
			this.file = file;
			return file;
		});
	}

	private get isLocal(): boolean { return !this.url.startsWith('https://') }

	downloadRemoteImage(host: Host, view: EditorView): Promise<TFile> {
		if (this.file !== undefined) {
			return Promise.resolve(this.file);  // already downloaded
		}

		if (this.isLocal) {
			return this.loadLocalFile(host);
		}

		// download
		const url = new URL(this.url);
		return got.got(url, { responseType: 'buffer' })
			.then((response: got.Response<Buffer>) => {
				return response.body;
			})
			.then(this.getFileType)
			.then((results: { buffer: Buffer; fileType: FileTypeResult; }) => {
				return this.storeFile(host, url, results);
			})
			.then((file: TFile) => {
				// rescane the current document version to find any URL occurrences
				// that are still there
				this.replaceReferences(view, this.url, file);
				this.file = file;
				return file;
			});
	}

	getImageBuffer(host: Host, view: EditorView): Promise<ArrayBuffer> {
		return this.downloadRemoteImage(host, view).then((file: TFile) => {
			return host.readArrayBuffer(file);
		});
	}

	getImageStream(host: Host, _view: EditorView): Promise<Readable> {
		if (this.file === undefined && this.isLocal) {
			this.loadLocalFile(host);	
		}
		if (this.file !== undefined) {
			return host.readArrayBuffer(this.file)
				.then((buffer: ArrayBuffer) => {
					// How can we do this more directly without copying the buffer?
					return Readable.from(Buffer.from(buffer));
				});
		}
		const url = new URL(this.url);
		const buffer = new PassThrough();
		return Promise.resolve(got.got.stream(url).pipe(buffer));
	}

	static displayImages(
		host: Host, view: EditorView,
		location: TextRange | ImageReference | undefined, images: ImageSet): void {
		if (location === undefined) {
			return;
		}
		let prefix = '\n\n';
		let insertionLocation: number = location.to + 1;
		const walk: TextIterator = view.state.doc.iterRange(insertionLocation);
		// skip over entire line as enumeration
		walk.next();
		if (!walk.done) {
			if (walk.lineBreak) {
				// we don't know the size of a LF or CRLF sequence, so we have to
				// measure it like this
				const offset = walk.value.length;
				walk.next();
				if (!walk.done) {
					if (walk.lineBreak) {
						// reuse empty line following our command
						insertionLocation += offset;
						prefix = '\n';
					}
				}
			}
		}
		const chunks: string[] =
			[`${prefix}\`!image-set ${images.generationId} ${images.prompt}\` `];
		images.urls.forEach((url, imageIndex) => {
			chunks.push(`${imageIndex > 0 ? ' ' : ''}![${ALT_TEXT_PREFIX}${images.generationId} ${imageIndex + 1}|${host.settings.imagePresentationWidth}](${url})`);
		});

		view.dispatch({
			changes: {
				from: insertionLocation,
				to: insertionLocation,
				insert: chunks.join('')
			}
		});
	}

	private async getFileType(buffer: Buffer):
		Promise<{ buffer: Buffer, fileType: FileTypeResult }> {
		return fileTypeFromBuffer(buffer).then((fileType: FileTypeResult) => {
			return { buffer, fileType };
		});
	}

	private async storeFile(host: Host, url: URL, results: {
		buffer: Buffer; fileType: FileTypeResult;
	}): Promise<TFile> {
		if (results.fileType.ext !== 'png') {
			throw new Error('Unknown file type');
		}
		const fileName = url.pathname.split('/').last();
		if (fileName === undefined) {
			return Promise.reject('Invalid URL');
		}
		// REVISIT config
		// XXX also create markdown file with original meta information such as
		// prompt and all components of the URL other than authorization ones, or 
		// use library to put meta information in file
		return host.createFileFromBuffer(`DALL-E/${fileName}`, results.buffer);
	}

	private replaceReferences(view: EditorView, url: string, file: TFile) {
		const urls: SyntaxNode[] = [];
		syntaxTree(view.state).iterate({
			enter(scannedNode) {
				switch (scannedNode.type.name) {
					case 'string_url':
						if (view.state.doc.sliceString(scannedNode.from, scannedNode.to) ===
							url) {
							urls.unshift(scannedNode.node);
						}
						break;
				}
			}
		});
		if (urls.length === 0) {
			return;
		}
		// replace all image references, which are in reverse order
		for (const url of urls) {
			view.dispatch({ changes: { from: url.from, to: url.to, insert: file.path } });
			return url;
		}
	}
}
