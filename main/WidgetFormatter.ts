import { Decoration, ParsedCommand, ParsedCommandWithParameters } from "derobst/command";
import { ExtensionContext } from "derobst/main";
import { Host } from "./Plugin";

export class WidgetFormatter {
    static calculateUnfocusedStyle(context: ExtensionContext<Host>, command: ParsedCommandWithParameters<Host>): { hide: boolean; dim: boolean; } {
        const settings = context.plugin.settings;

        // get default behavior from settings
        let hide = settings.defaultHide;
        let dim = settings.defaultDim;

        // process overrides, including conflicting ones
        if (command.parameters.dim) {
            dim = true;
        }
        if (command.parameters.hide) {
            hide = true;
        }
        if (command.parameters.nodim) {
            dim = false;
        }
        if (command.parameters.nohide) {
            hide = false;
        }
        return { hide, dim };
    }

    static markBasedOnParameters(context: ExtensionContext<Host>, command: ParsedCommandWithParameters<Host>) {
        WidgetFormatter.autoDimOrHide(context, command, WidgetFormatter.calculateUnfocusedStyle(context, command));
    }

    static markBasedOnDefaults(context: ExtensionContext<Host>, command: ParsedCommand<Host>) {
        // get default behavior from settings
        WidgetFormatter.autoDimOrHide(context, command, { dim: context.plugin.settings.defaultDim, hide: context.plugin.settings.defaultHide });
    }

    // use style that implements the selected behavior when not focused
    private static autoDimOrHide(context: ExtensionContext<Host>, command: ParsedCommand<Host>, { dim, hide }: { dim: boolean; hide: boolean; }) {
        if (hide) {
            context.builder.add(command.commandNode.from, command.commandNode.to, Decoration.mark({ attributes: { "class": "known-tags known-tags-auto-hide" } }));
        } else if (dim) {
            context.builder.add(command.commandNode.from, command.commandNode.to, Decoration.mark({ attributes: { "class": "known-tags known-tags-auto-dim" } }));
        } else {
            context.builder.add(command.commandNode.from, command.commandNode.to, Decoration.mark({ attributes: { "class": "known-tags" } }));
        }
    }
}
