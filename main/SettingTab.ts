import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Host } from './Plugin';

import { CreateImageRequestSizeEnum } from 'openai';

export class SettingTab extends PluginSettingTab {
	constructor(app: App, plugin: Plugin, private host: Host) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Settings for Description Helper Plugin' });

		new Setting(containerEl)
			.setName('Default Hide')
			.setDesc('If set, recognized inline commands are hidden when not being edited.  Can be overridden by "hide" or "nohide" keywords in command string.')
			.addToggle(value => value
				.setValue(this.host.settings.defaultHide)
				.onChange(async (value) => {
					this.host.settings.defaultHide = value;
					await this.host.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Default Dim')
			.setDesc('If set, recognized and unhidden inline commands are shown dim when not being edited.  Can be overridden by "dim" or "nodim" keywords in command string.')
			.addToggle(value => value
				.setValue(this.host.settings.defaultDim)
				.onChange(async (value) => {
					this.host.settings.defaultDim = value;
					await this.host.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Image Request Size")
			.setDesc("Larger sizes take longer and cost more money.")
			.addDropdown(dropdown => dropdown
				.addOptions(CreateImageRequestSizeEnum)
				.setValue(this.host.settings.imageRequestSize)
				.onChange(async (value) => {
					this.host.settings.imageRequestSize = value as CreateImageRequestSizeEnum;
					await this.host.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Image Presentation Size")
			.setDesc("The width in pixels at which generated images will be embedded.  This size is written into the markdown and can be changed there after the fact.")
			.addSlider((slider) =>
				slider
					.setLimits(64, 1024, 16)
					.setValue(this.host.settings.imagePresentationWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.host.settings.imagePresentationWidth = value;
						await this.host.saveSettings();
					}));				

		new Setting(containerEl)
			.setName("Chosen Image Presentation Size")
			.setDesc("The width in pixels at which chosen images will be embedded.  This size is written into the markdown and can be changed there after the fact.")
			.addSlider((slider) =>
				slider
					.setLimits(64, 1024, 16)
					.setValue(this.host.settings.chosenImagePresentationWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.host.settings.chosenImagePresentationWidth = value;
						await this.host.saveSettings();
					}));				
	}
		
}
