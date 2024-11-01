"strict";

import GLib from "gi://GLib";
import St from "gi://St";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {
    Extension,
    gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import Soup from "gi://Soup?version=3.0";

export class GoogleSearchProvider {
    constructor(extension, gicon, key, cx) {
        this._extension = extension;
        this._gicon = gicon;
        this._key = key;
        this._cx = cx;
        this._itemMap = new Map();
        this._too_many_requests = false;
    }

    /**
     * The application of the provider.
     *
     * Applications will return a `Gio.AppInfo` representing themselves.
     * Extensions will usually return `null`.
     *
     * @type {Gio.AppInfo}
     */
    get appInfo() {
        const defaultAppInfo = Gio.AppInfo.get_default_for_uri_scheme("http");
        const appId = defaultAppInfo.get_id();

        const appInfo = {
            get_name: () => `Google Search`,
            get_icon: () => this._gicon,
            get_id: () => appId,
            should_show: () => true,
        };
        return appInfo;
    }

    /**
     * Whether the provider offers detailed results.
     *
     * Applications will return `true` if they have a way to display more
     * detailed or complete results. Extensions will usually return `false`.
     *
     * @type {boolean}
     */
    get canLaunchSearch() {
        return true;
    }

    /**
     * The unique ID of the provider.
     *
     * Applications will return their application ID. Extensions will usually
     * return their UUID.
     *
     * @type {string}
     */
    get id() {
        return this._extension.uuid;
    }

    /**
     * Launch the search result.
     *
     * This method is called when a search provider result is activated.
     *
     * @param {string} result - The result identifier
     * @param {string[]} terms - The search terms
     */
    activateResult(result, terms) {
        log(`in activateResult`);
        const url = this._itemMap.get(result).link;
        Main.overview.toggle();
        Gio.AppInfo.launch_default_for_uri_async(url, null, null, null);
    }

    /**
     * Launch the search provider.
     *
     * This method is called when a search provider is activated. A provider can
     * only be activated if the `appInfo` property holds a valid `Gio.AppInfo`
     * and the `canLaunchSearch` property is `true`.
     *
     * Applications will typically open a window to display more detailed or
     * complete results.
     *
     * @param {string[]} terms - The search terms
     */
    launchSearch(terms) {
        const query = terms.map(encodeURIComponent).join("+");
        const url = `https://www.google.com/search?q=${query}`;
        Main.overview.toggle();
        Gio.AppInfo.launch_default_for_uri_async(url, null, null, null);
    }

    /**
     * Create a result object.
     *
     * This method is called to create an actor to represent a search result.
     *
     * Implementations may return any `Clutter.Actor` to serve as the display
     * result, or `null` for the default implementation.
     *
     * @param {ResultMeta} meta - A result metadata object
     * @returns {Clutter.Actor|null} An actor for the result
     */
    createResultObject(meta) {
        const item = this._itemMap.get(meta.id);
        const box = St.BoxLayout.new();

        box.add_style_class_name("result-box");

        if (this._too_many_requests) {
            const errorLabel = St.Label.new(meta.name);
            errorLabel.add_style_class_name("result-label padded");
            box.add_child(errorLabel);
        } else {
            box.set_reactive(true);
            box.set_can_focus(true);
            box.set_track_hover(true);

            box.connect("button-press-event", (event, actor) => {
                console.log("@@@ clicked");
                Gio.AppInfo.launch_default_for_uri_async(
                    item.link,
                    null,
                    null,
                    null,
                );
                Main.overview.toggle();
            });

            try {
                const thumbnailUrl = item.pagemap.cse_thumbnail[0].src;
                const thumbnail = Gio.icon_new_for_string(thumbnailUrl);
                const size = 24;
                const { scaleFactor } = St.ThemeContext.get_for_stage(
                    global.stage,
                );
                const icon = new St.Icon({
                    gicon: thumbnail,
                    width: size * scaleFactor,
                    height: size * scaleFactor,
                });
                icon.add_style_class_name("padded");
                box.add_child(icon);
            } catch (error) {
                // ignore
            }

            const nameLabel = St.Label.new(meta.name);
            nameLabel.add_style_class_name("padded");
            box.add_child(nameLabel);

            const link = item.link;
            const linkLabel = St.Label.new(link);
            linkLabel.add_style_class_name("result-link padded");
            box.add_child(linkLabel);
        }
        return box;
    }

    /**
     * Get result metadata.
     *
     * This method is called to get a `ResultMeta` for each identifier.
     *
     * If @cancellable is triggered, this method should throw an error.
     *
     * @async
     * @param {string[]} results - The result identifiers
     * @param {Gio.Cancellable} cancellable - A cancellable for the operation
     * @returns {Promise<ResultMeta[]>} A list of result metadata objects
     */
    getResultMetas(results, cancellable) {
        return new Promise((resolve, reject) => {
            const cancelledId = cancellable.connect(() =>
                reject(Error("Operation Cancelled")),
            );

            const resultMetas = [];

            if (this._too_many_requests) {
                const meta = {
                    id: results[0], // "Too many requests."
                    name: results[0],
                    createIcon: (size) => {
                        return null;
                    },
                };
                resultMetas.push(meta);
            } else {
                let i = 0;
                for (let resultId of results) {
                    const item = this._itemMap.get(resultId);
                    const meta = {
                        id: resultId,
                        name: item.title,
                        createIcon: (size) => {
                            return null;
                        },
                    };
                    resultMetas.push(meta);
                }
            }

            cancellable.disconnect(cancelledId);
            if (!cancellable.is_cancelled()) {
                resolve(resultMetas);
            }
        }).catch((error) => {
            reject(error);
        });
    }

    /**
     * Initiate a new search.
     *
     * This method is called to start a new search and should return a list of
     * unique identifiers for the results.
     *
     * If @cancellable is triggered, this method should throw an error.
     *
     * @async
     * @param {string[]} terms - The search terms
     * @param {Gio.Cancellable} cancellable - A cancellable for the operation
     * @returns {Promise<string[]>} A list of result identifiers
     */
    getInitialResultSet(terms, cancellable) {
        return new Promise((resolve, reject) => {
            const cancelledId = cancellable.connect(() =>
                reject(Error("Search Cancelled.")),
            );

            const ids = [];

            if (this._too_many_requests) {
                ids[0] = "Too many requests.";
                resolve(ids);
            } else {
                let session = new Soup.Session({
                    timeout: 10, //seconds
                });

                const query = terms.map(encodeURIComponent).join("+");

                const url = `https://customsearch.googleapis.com/customsearch/v1?cx=${this._cx}&key=${this._key}&q=${query}`;

                let message = Soup.Message.new("GET", url);
                if (message) {
                    session.send_and_read_async(
                        message,
                        GLib.PRIORITY_DEFAULT,
                        null,
                        (session, result) => {
                            try {
                                let bytes =
                                    session.send_and_read_finish(result);

                                let status;
                                try {
                                    // 429 causes a bad Soup enum error 🤬
                                    status = message.get_status();
                                } catch (error) {
                                    if (error.message.includes(429)) {
                                        // there it is
                                        this._too_many_requests = true;
                                        const error_msg = "Too many requests.";
                                        ids[0] = error_msg;
                                        resolve(ids);
                                        throw new Error(error_msg);
                                    } else {
                                        throw error;
                                    }
                                }
                                if (status === Soup.Status.OK) {
                                    const data = new TextDecoder().decode(
                                        bytes.get_data(),
                                    );
                                    const json = JSON.parse(data);
                                    this._items = json.items;

                                    let id;
                                    for (let item of this._items) {
                                        id = this.createUID();
                                        ids.push(id);
                                        this._itemMap.set(id, item);
                                    }

                                    if (!cancellable.is_cancelled()) {
                                        resolve(ids);
                                    }
                                }
                            } catch (error) {
                                // reject(error);
                                console.log(
                                    `${this._extension.uuid}: ${error.message}`,
                                );
                            }
                        },
                    );
                }
            }
        });
        cancellable.disconnect(cancelledId);
    }

    /**
     * Refine the current search.
     *
     * This method is called to refine the current search results with
     * expanded terms and should return a subset of the original result set.
     *
     * Implementations may use this method to refine the search results more
     * efficiently than running a new search, or simply pass the terms to the
     * implementation of `getInitialResultSet()`.
     *
     * If @cancellable is triggered, this method should throw an error.
     *
     * @async
     * @param {string[]} results - The original result set
     * @param {string[]} terms - The search terms
     * @param {Gio.Cancellable} cancellable - A cancellable for the operation
     * @returns {Promise<string[]>}
     */
    getSubsearchResultSet(results, terms, cancellable) {
        if (cancellable.is_cancelled()) throw Error("Search Cancelled");
        return this.getInitialResultSet(terms, cancellable);
    }

    /**
     * Filter the current search.
     *
     * This method is called to truncate the number of search results.
     *
     * Implementations may use their own criteria for discarding results, or
     * simply return the first n-items.
     *
     * @param {string[]} results - The original result set
     * @param {number} maxResults - The maximum amount of results
     * @returns {string[]} The filtered results
     */
    filterResults(results, maxResults) {
        if (results.length <= maxResults) return results;
        return results.slice(0, maxResults);
    }

    /**
     * Generate a unique id.
     *
     * @returns {string}
     */
    createUID() {
        const buf = [];
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const charlen = chars.length;
        for (let i = 0; i < 32; i++) {
            buf[i] = chars.charAt(Math.floor(Math.random() * charlen));
        }
        return buf.join("");
    }
}
