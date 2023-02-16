import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { SyntaxNode } from "@lezer/common";
import { syntaxTree } from "@codemirror/language";

import { TFile } from "obsidian";

import * as got from "got";

import { fileTypeFromBuffer, FileTypeResult } from "file-type";

import { Host } from "main/Plugin";

export class ImageReference {
  from: number;
  to: number;
  url: string;
  file: TFile | undefined;

  constructor(
    state: EditorState,
    public readonly generationId: string,
    altText: SyntaxNode,
    url: SyntaxNode,
    closeParen: SyntaxNode
  ) {
    this.from = altText.from - 2;
    this.to = closeParen.to;
    if (state.doc.sliceString(closeParen.to, closeParen.to+1) == " ") {
      this.to++;
    }
    this.url = state.doc.sliceString(url.from, url.to);
  }

  erase(view: EditorView) {
    view.dispatch({
      changes: {
        from: this.from,
        to: this.to
      }
    });
  }

  insertReference(view: EditorView, url: string) {
    view.dispatch({
      changes: {
        from: this.from,
        to: this.from,
        insert: `![chosen image](${url})`
      }
    });
  }

  insertLineBreak(view: EditorView) {
    view.dispatch({
      changes: {
        from: this.from,
        to: this.from,
        insert: "\n"
      }
    });
  }

  downloadRemoteImage(host: Host, view: EditorView): Promise<TFile> {
    if (this.file !== undefined) {
      return Promise.resolve(this.file);  // already downloaded
    }

    if (!this.url.startsWith("https://")) {
      return host.loadFile(this.url);
    }
    const url = new URL(this.url);
    
    return got.got(url, { responseType: "buffer" })
      .then((response: got.Response<Buffer>) => {
        return response.body;
      })
      .then(this.getFileType)
      .then((results: { buffer: Buffer; fileType: FileTypeResult; }) => {
        return this.storeFile(host, url, results);
      })
      .then((file: TFile) => {
        // rescane the current document version to find any URL occurrences that are still there
        this.replaceReferences(view, this.url, file);
        this.file = file;
        return file;
      });
  }

  private async getFileType(buffer: Buffer): Promise<{ buffer: Buffer, fileType: FileTypeResult }> {
    return fileTypeFromBuffer(buffer)
      .then((fileType: FileTypeResult) => {
        return { buffer, fileType };
      });
  }

  private async storeFile(host: Host, url: URL, results: { buffer: Buffer; fileType: FileTypeResult; }): Promise<TFile> {
    if (results.fileType.ext !== "png") {
      throw new Error("Unknown file type");
    }
    const fileName = url.pathname.split('/').last();
    if (fileName === undefined) {
      return Promise.reject("Invalid URL");
    }
    // XXX config
    // XXX also create markdown file with original meta information such as prompt and all components of the URL other than authorization ones
    return host.createFileFromBuffer(`DALL-E/${fileName}`, results.buffer);
  }

  private replaceReferences(view: EditorView, url: string, file: TFile) {
    const urls: SyntaxNode[] = [];
    syntaxTree(view.state).iterate({
      enter(scannedNode) {
        switch (scannedNode.type.name) {
          case 'string_url':
            if (view.state.doc.sliceString(scannedNode.from, scannedNode.to) === url) {
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
    for (let url of urls) {
      view.dispatch({ changes: { from: url.from, to: url.to, insert: file.path } });
      return url;
    };
  }
}
