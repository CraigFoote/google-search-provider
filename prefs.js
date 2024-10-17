"use strict";

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class ServerStatusPreferences extends ExtensionPreferences {
    /**
     * Called by system when preferences are opened.
     *
     * @param {Gtk.Window} window
     */
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage();
        window.add(page);
        // Create a settings object and bind the row to the `show-indicator` key
        window._settings = this.getSettings(
            "org.gnome.shell.extensions.google-search-provider",
        );

        const group = new Adw.PreferencesGroup({});
        page.add(group);
        group.set_title("Google's Custom Search JSON API requires an API key.");

        const logo = new Gtk.Image({
            file: this.path + "/google.svg",
            pixel_size: 24,
        });
        group.set_header_suffix(logo);

        const actionRow = new Adw.ActionRow();
        group.add(actionRow);

        actionRow.set_title(
            `There is a limit of 100 searches per day, after which <i>Too Many Requests</i> will be returned.

Or you can set up a payment account with Google. 🤔

Other than calling its public search API, this extension is not affiliated with Google in any way.`,
        );

        const linkButton = new Gtk.LinkButton({
            label: "Get a key",
            uri: "https://developers.google.com/custom-search/v1/overview",
        });
        actionRow.add_suffix(linkButton);

        const apiKeyRow = new Adw.EntryRow({
            title: "API Key",
            show_apply_button: true,
        });
        group.add(apiKeyRow);

        window._settings.bind(
            "api-key",
            apiKeyRow,
            "text",
            Gio.SettingsBindFlags.DEFAULT,
        );
        
        const cxKeyRow = new Adw.EntryRow({
            title: "Search Context (cx)",
            show_apply_button: true,
        });
        group.add(cxKeyRow);
        
        window._settings.bind(
            "cx",
            cxKeyRow,
            "text",
            Gio.SettingsBindFlags.DEFAULT,
        );
    }
}
