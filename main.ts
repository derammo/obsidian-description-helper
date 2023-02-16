import { Notice, TFile } from 'obsidian';

import { CommandDispatcher, CommandViewPlugin, createCommandRemovalPostProcessor } from 'derobst/command';
import { DEFAULT_SETTINGS, getImageRequestSize, Host, Settings } from 'main/Plugin';
import { DerAmmoKnownTagsAPI, getDerAmmoKnownTagsAPI } from 'obsidian-derammo-knowntags-api';

import { ReadStream } from 'fs';
import { Configuration, ImagesResponseDataInner, OpenAIApi } from "openai";

// various commands and extensions
import * as CharacterRandomDescription from "commands/character_random_description/Command";
import * as ImagePromptFromTags from "commands/image_prompt_from_tags/Command";
import * as ImageSetCommand from "commands/image_set/Command";

import { ObsidianPluginBase } from 'derobst/main';
import { ImageSet } from 'image_generation/ImageSet';
import { createGeneratedImagesDecorationsStateField } from "image_generation/StateField";
import { SettingTab } from 'main/SettingTab';

// openai support

// XXX remove and only take from config
const openaiConfiguration = new Configuration({
	apiKey: "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" // process.env.OPENAI_API_KEY,
});

/**
 * Override the Axios selection for the HTTP adapter, because the xhr adapter fails to serialize the streams in a post for some reason.
 */
class HackedOpenAI extends OpenAIApi {
	constructor(configuration: Configuration) {
		super(configuration);
		this.axios.defaults.adapter = require("axios/lib/adapters/http");
	}
}

export const openai = new HackedOpenAI(openaiConfiguration);

export default class DescriptionHelperPlugin extends ObsidianPluginBase<Settings> implements Host {
	info: DerAmmoKnownTagsAPI;
	commands: CommandDispatcher<Host> = new CommandDispatcher<Host>();

	get metadataCache() {
		return this.app.metadataCache;
	}

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});

		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.addSettingTab(new SettingTab(this.app, this, this));

		getDerAmmoKnownTagsAPI(5000).then((info) => {
			this.info = info;

			this.buildCommands();
			this.registerViewPlugin(createCommandViewPlugin(this));
			this.registerEditorExtension(createGeneratedImagesDecorationsStateField(this));
			this.registerMarkdownPostProcessor(createCommandRemovalPostProcessor(this.commands));
		});
	}

	onunload() {
		// no code
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// XXX check options for Axios config to suppress user agent errors (may be resolved since we switched adapter to http)
	generateImages(prompt: string): Promise<ImageSet> {
		// XXX config number
		return openai.createImage({ prompt: prompt,	n: 1, size: getImageRequestSize(this.settings), response_format: "url"})
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

	generateWiderImage(image: ReadStream | Buffer, mask: ReadStream | Buffer, prompt: string): Promise<ImageSet> {
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

		// XXX config separate size presets and number
		return openai.createImageEdit(image_hack, mask_hack, prompt, 1,	getImageRequestSize(this.settings))
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
