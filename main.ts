import { TFile } from 'obsidian';

import { CommandDispatcher, CommandViewPlugin, createCommandRemovalPostProcessor } from 'derobst/command';
import { DEFAULT_SETTINGS, getImageRequestSize, Host, Settings } from 'main/Plugin';
import { DerAmmoKnownTagsAPI, getDerAmmoKnownTagsAPI } from 'obsidian-derammo-knowntags-api';

import { ReadStream } from 'fs';
import { Configuration, CreateImageRequestSizeEnum, ImagesResponseDataInner, OpenAIApi } from "openai";

// various commands and extensions
import * as CharacterRandomDescription from "commands/character_random_description/Command";
import * as ImagePromptFromTags from "commands/image_prompt_from_tags/Command";
import * as ImageSetCommand from "commands/image_set/Command";

import { ObsidianPluginBase } from 'derobst/main';
import { ImageSet } from 'image_generation/ImageSet';
import { createGeneratedImagesDecorationsStateField } from "image_generation/StateField";
import { SettingTab } from 'main/SettingTab';

/**
 * Override the Axios selection for the HTTP adapter, because the xhr adapter fails to serialize the streams in a post for some reason.
 */
class HackedOpenAI extends OpenAIApi {
	constructor(configuration: Configuration) {
		super(configuration);
		this.axios.defaults.adapter = require("axios/lib/adapters/http");
	}
}

export default class DescriptionHelperPlugin extends ObsidianPluginBase<Settings> implements Host {
	info: DerAmmoKnownTagsAPI;
	commands: CommandDispatcher<Host> = new CommandDispatcher<Host>();
	private statusBar: HTMLElement;
	private runningRequestCount = 0;
	
	openai: OpenAIApi;

	get metadataCache() {
		return this.app.metadataCache;
	}

	async onload() {
		await this.loadSettings();
		const settingsTab = new SettingTab(this.app, this, this)
		this.addSettingTab(settingsTab);

		this.openaiReload(settingsTab);
		
		this.statusBar = this.addStatusBarItem();
		this.statusBar.setText('');
		this.registerContextMenuDeleteElement();
		this.registerTextRangeTracker();

		getDerAmmoKnownTagsAPI(5000)
			.then(this.onApiReady.bind(this));
	}

	private async onApiReady(info: DerAmmoKnownTagsAPI) {
		this.info = info;

		this.buildCommands();
		this.registerViewPlugin(createCommandViewPlugin(this));
		this.registerEditorExtension(createGeneratedImagesDecorationsStateField(this));
		this.registerMarkdownPostProcessor(createCommandRemovalPostProcessor(this.commands));
	}

	onunload() {
		// no code
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	openaiReload(settingTab: SettingTab) {
		const openaiConfiguration = new Configuration({
			apiKey: settingTab.decryptApiKey()
		});
		this.openai = new HackedOpenAI(openaiConfiguration);
	}

	generateImages(prompt: string): Promise<ImageSet> {
		// XXX config number
		return this.openai.createImage({ prompt: prompt, n: 4, size: getImageRequestSize(this.settings), response_format: "url"})
			.then((response) => {
				let generationId: string | undefined = undefined;
				const urls: string[] = [];
				response.data.data.forEach((image: ImagesResponseDataInner) => {
					if (image.url === undefined) {
						return;
					}
					urls.push(image.url);
					const match = (image.url ?? "").match(/st=([0-9-T%AZ]+)(?:&|$)/);
					if (match !== null) {
						if (generationId === undefined) {
							// unescape URL
							generationId = decodeURIComponent(match[1]);
						} else {
							if (generationId !== decodeURIComponent(match[1])) {
								console.log(`ERROR: mismatched generation id '${generationId}' vs '${decodeURIComponent(match[1])}'`);
							}
						}
					}
				});
				return { generationId: generationId ?? "", prompt: prompt, urls: urls };
			}, (error) => {
				// can see HTTP response here
				console.log(error.response);
				console.error(`failed to generate images: ${error}`);
				return { generationId: `${error}`, prompt: prompt, urls: [] }
			});
	}
	
	generateWiderImage(image: ReadStream | Buffer, mask: ReadStream | Buffer, width: number, height: number, prompt: string): Promise<ImageSet> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the openai API requires name on buffers also
		const image_hack = image as any;
		if (image instanceof Buffer) {
			image_hack.name = "image.png";
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the openai API requires name on buffers also
		const mask_hack = mask as any;
		if (mask instanceof Buffer) {
			mask_hack.name = "mask.png";
		}

		// we may have upscaled to the point where we need to make larger images
		let requestSize: CreateImageRequestSizeEnum
		if (width > 512 || height > 512) { 
			requestSize = "1024x1024";
		} else {
			requestSize = "512x512";
		}

		console.log(`requesting ${requestSize} image outpainting with prompt '${prompt}'`);

		// XXX config number?
		return this.openai.createImageEdit(image_hack, mask_hack, prompt, 1, requestSize)
			.then((response) => {
				let generationId: string | undefined = undefined;
				const urls: string[] = [];
				response.data.data.forEach((image: ImagesResponseDataInner) => {
					if (image.url === undefined) {
						return;
					}
					urls.push(image.url);
					const match = (image.url ?? "").match(/st=([0-9-T%AZ]+)(?:&|$)/);
					if (match !== null) {
						if (generationId === undefined) {
							// unescape URL
							generationId = decodeURIComponent(match[1]);
						} else {
							if (generationId !== decodeURIComponent(match[1])) {
								console.log(`ERROR: mismatched generation id '${generationId}' vs '${decodeURIComponent(match[1])}'`);
							}
						}
					}
				});
				return { generationId: generationId ?? "", prompt: prompt, urls: urls };
			}, (error) => {
				// can see HTTP response here
				console.log(error.response);
				console.error(`failed to widen image: ${error}`);
				return { generationId: `${error}`, prompt: prompt, urls: [] }
			});
	}

	async createFileFromBuffer(path: string, buffer: Buffer): Promise<TFile> {
		const existing = app.vault.getAbstractFileByPath(path);
		if (existing !== null) {
			await app.vault.delete(existing);
		}
		return app.vault.createBinary(path, buffer);
	}

	async readArrayBuffer(file: TFile): Promise<ArrayBuffer> {
		return this.app.vault.readBinary(file);
	}

	loadFile(path: string): Promise<TFile> {
		const maybe = app.vault.getAbstractFileByPath(path);
		if (maybe === null) {
			return Promise.reject(`File not found: '${path}'`);
		}
		if (!(maybe instanceof TFile)) {
			return Promise.reject(`Path does not identify a file: '${path}'`);
		}
		return Promise.resolve(maybe as TFile);
	}

	private buildCommands() {
		this.commands.registerCommand(ImagePromptFromTags.Command);
		this.commands.registerCommand(CharacterRandomDescription.Command);
		this.commands.registerCommand(ImageSetCommand.Command);
	}

	incrementRunningRequestCount(): number {
		this.runningRequestCount++;
		this.updateStatusBar();
		return this.runningRequestCount;
	}

	decrementRunningRequestCount(): number {
		this.runningRequestCount--;
		this.updateStatusBar();
		return this.runningRequestCount;
	}

	private updateStatusBar() {
		if (this.runningRequestCount < 0) {
			// fix this up
			this.runningRequestCount = 0;
		}
		switch (this.runningRequestCount) {
				// fall through
			case 0:
				this.statusBar?.setText("");
				this.statusBar?.hide();
				break;
			case 1:
				this.statusBar?.setText("⚒ AI Busy");
				this.statusBar?.show();
				break;
			default:
				this.statusBar?.setText(`⚒ AI Busy (${this.runningRequestCount} requests)`);
				this.statusBar?.show();
				break;
		}
	}
}

function createCommandViewPlugin(host: Host) {
	// create a unique class to identify the view plugin, which has access to this Obsidian plugin through capture
	return class extends
		CommandViewPlugin<Host> {
		getPlugin(): Host {
			return host;
		}
	};
}
