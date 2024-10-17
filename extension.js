/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { GoogleSearchProvider } from "./google-search-provider.js";
import Gio from "gi://Gio";

export default class GooogleSearchExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        log("@@@ in extension constructor");
    }

    enable() {
        const iconPath = this.path + "/google.svg";
        const gicon = Gio.icon_new_for_string(iconPath);

        this._settings = this.getSettings(
            "org.gnome.shell.extensions.google-search-provider",
        );

        let apiKey = this._settings.get_string("api-key");
        this._settings.connect("changed::api-key", (settings, key) => {
            apiKey = settings.get_string(key);
        });
        
        let cxKey = this._settings.get_string("cx");
        this._settings.connect("changed::cx", (settings, key) => {
            cxKey = settings.get_string(key);
        });

        this._provider = new GoogleSearchProvider(this, gicon, apiKey, cxKey);
        Main.overview.searchController.addProvider(this._provider);
    }

    disable() {
        Main.overview.searchController.removeProvider(this._provider);
        this._provider = null;
    }
}
