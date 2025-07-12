/**
 * wasavi: vi clone implemented in javascript
 * Background Service Worker for Manifest V3
 *
 * @author akahuku@gmail.com
 */
/**
 * Copyright 2012-2017 akahuku, akahuku@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Service worker for Wasavi MV3
// Simplified implementation without external dependencies to avoid module system issues

// Global variables for service worker context
let config;
let isInitializing = true;
let blockedEvents = [];

// Initialize the service worker
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Wasavi MV3 installed!', details);
    
    // Handle different installation reasons
    if (details.reason === 'install') {
        // First time installation
        console.log('First time installation');
    } else if (details.reason === 'update') {
        // Extension updated
        console.log('Extension updated from', details.previousVersion);
    }
});

// Handle service worker startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Chrome started and extension loaded');
});

// Handle extension messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    // Handle messages from content scripts
    if (request && request.type) {
        let lateResponse = handleRequest(request, request.data || {}, sender, sendResponse);
        return lateResponse; // Indicates whether we will send a response asynchronously
    }
    
    return false;
});

// Handle port connections
chrome.runtime.onConnect.addListener((port) => {
    console.log('Port connected:', port.name);
    
    port.onMessage.addListener((msg) => {
        console.log('Port message received:', msg);
        
        switch (port.name) {
            case 'fsctl':
                // Handle filesystem control messages
                if (msg.type && fsctlMap[msg.type]) {
                    fsctlMap[msg.type](port, msg);
                }
                break;
        }
    });
    
    port.onDisconnect.addListener(() => {
        console.log('Port disconnected:', port.name);
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log('Context menu clicked:', info);
    
    if (info.menuItemId === 'edit_with_wasavi') {
        let options = {};
        if ('frameId' in info) {
            options = { frameId: info.frameId };
        }
        
        chrome.tabs.sendMessage(tab.id, { type: 'request-run' }, options);
    }
});

// Handle tab updates for cleanup
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        console.log('Tab updated:', tabId, tab.url);
    }
});

// Handle tab removal for cleanup
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log('Tab removed:', tabId);
});

// Core functionality based on original main.js
let commandMap = {};
let fsctlMap = {};

// Configuration object
function Config(info, opts) {
    let self = this;
    let values = {};
    
    function init() {
        return Promise.all([
            new Promise(resolve => {
                let defaults = {};
                for (let i in info.sync) {
                    defaults[i] = typeof info.sync[i].def === 'function' ? info.sync[i].def() : info.sync[i].def;
                }
                chrome.storage.sync.get(defaults, items => {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to retrieve sync storage:', chrome.runtime.lastError.message);
                    } else {
                        for (let i in items) {
                            values[i] = items[i];
                        }
                    }
                    resolve();
                });
            }),
            new Promise(resolve => {
                let defaults = {};
                for (let i in info.local) {
                    defaults[i] = typeof info.local[i].def === 'function' ? info.local[i].def() : info.local[i].def;
                }
                chrome.storage.local.get(defaults, items => {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to retrieve local storage:', chrome.runtime.lastError.message);
                    } else {
                        for (let i in items) {
                            values[i] = items[i];
                        }
                    }
                    resolve();
                });
            })
        ]);
    }
    
    function get(name) {
        return values[name];
    }
    
    function set(name, value) {
        values[name] = value;
        let payload = {};
        payload[name] = value;
        if (name in info.sync) {
            chrome.storage.sync.set(payload);
        } else if (name in info.local) {
            chrome.storage.local.set(payload);
        }
    }
    
    function clear() {
        return Promise.all([
            new Promise(resolve => {
                chrome.storage.sync.clear(() => {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to clear sync storage:', chrome.runtime.lastError.message);
                    }
                    resolve();
                });
            }),
            new Promise(resolve => {
                chrome.storage.local.clear(() => {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to clear local storage:', chrome.runtime.lastError.message);
                    }
                    resolve();
                });
            })
        ]);
    }
    
    this.init = init;
    this.get = get;
    this.set = set;
    this.clear = clear;
    
    // Storage change listener
    chrome.storage.onChanged.addListener((changes, areaName) => {
        for (let name in changes) {
            let value = changes[name].newValue;
            values[name] = value;
            if (opts.onupdate) {
                opts.onupdate.call(self, name, value);
            }
        }
    });
}

// Command handlers
function handleInit(command, data, sender, respond) {
    console.log('Handling init:', command.type);
    
    let tabId = sender.tab ? sender.tab.id : null;
    let response = {
        extensionId: chrome.runtime.id,
        tabId: tabId,
        version: chrome.runtime.getManifest().version,
        devMode: false,
        logMode: false,
        testMode: false,
        targets: config ? config.get('targets') : {
            enableTextArea: true,
            enableText: false,
            enableSearch: false,
            enableTel: false,
            enableUrl: false,
            enableEmail: false,
            enablePassword: false,
            enableNumber: false,
            enableContentEditable: true,
            enablePage: false
        },
        shortcut: config ? config.get('shortcut') : '',
        shortcutCode: {},
        fontFamily: config ? config.get('fontFamily') : '"Consolas","Monaco","Courier New","Courier",monospace',
        quickActivation: config ? config.get('quickActivation') : false,
        statusLineHeight: 16,
        exrc: config ? config.get('exrc') : '" exrc for wasavi',
        messageCatalog: {},
        fstab: []
    };
    
    respond(response);
}

function handleGetStorage(command, data, sender, respond) {
    if ('key' in data) {
        respond({
            key: data.key,
            value: config ? config.get(data.key) : undefined
        });
    } else {
        respond({
            key: data.key,
            value: undefined
        });
    }
}

function handleSetStorage(command, data, sender, respond) {
    if (!config) {
        respond();
        return;
    }
    
    let items;
    if ('key' in data && 'value' in data) {
        items = [{key: data.key, value: data.value}];
    } else if ('items' in data) {
        items = data.items;
    }
    
    if (items) {
        items.forEach(item => {
            if ('key' in item && 'value' in item) {
                config.set(item.key, item.value);
            }
        });
    }
    
    respond();
}

function handleSetClipboard(command, data, sender, respond) {
    if ('data' in data) {
        // Use the modern clipboard API for MV3
        chrome.scripting.executeScript({
            target: {tabId: sender.tab.id},
            func: (text) => {
                navigator.clipboard.writeText(text).catch(console.error);
            },
            args: [data.data]
        });
    }
    respond();
}

function handleGetClipboard(command, data, sender, respond) {
    // Use the modern clipboard API for MV3
    chrome.scripting.executeScript({
        target: {tabId: sender.tab.id},
        func: () => {
            return navigator.clipboard.readText().catch(() => '');
        }
    }, (results) => {
        respond({data: results && results[0] && results[0].result || ''});
    });
    return true; // Async response
}

function handleOpenOptions(command, data, sender, respond) {
    chrome.tabs.create({url: chrome.runtime.getURL('options.html')});
    respond();
}

function handleTerminated(command, data, sender, respond) {
    // Handle cleanup when editor terminates
    if (data.payload && data.payload.isTopFrame) {
        chrome.tabs.remove(sender.tab.id);
    }
    respond();
}

// Command map
commandMap = {
    'init-agent': handleInit,
    'init-options': handleInit,
    'init': handleInit,
    'get-storage': handleGetStorage,
    'set-storage': handleSetStorage,
    'set-clipboard': handleSetClipboard,
    'get-clipboard': handleGetClipboard,
    'open-options': handleOpenOptions,
    'terminated': handleTerminated
};

function handleRequest(command, data, sender, respond) {
    console.log('Handling request:', command, data);
    
    function res(arg) {
        if (respond) {
            try {
                respond(arg);
            } catch (e) {
                console.error('Error sending response:', e);
            }
            respond = null;
        }
    }
    
    try {
        let lateResponse = false;
        
        if (command && command.type) {
            let handler = commandMap[command.type];
            if (handler) {
                lateResponse = handler(command, data, sender, res);
            } else {
                console.warn('No handler for command type:', command.type);
            }
        }
        
        if (!lateResponse) {
            res();
        }
        return lateResponse;
    } catch (error) {
        console.error('Error in handleRequest:', error);
        res({ error: error.message });
        return false;
    }
}

// Initialize context menu
function initializeContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'edit_with_wasavi',
            title: chrome.i18n.getMessage('edit_with_wasavi') || 'Edit with Wasavi',
            contexts: ['page', 'editable']
        });
    });
}

// Configuration info
const configInfo = {
    sync: {
        targets: {
            def: {
                enableTextArea: true,
                enableText: false,
                enableSearch: false,
                enableTel: false,
                enableUrl: false,
                enableEmail: false,
                enablePassword: false,
                enableNumber: false,
                enableContentEditable: true,
                enablePage: false
            }
        },
        exrc: {
            def: '" exrc for wasavi'
        },
        shortcut: {
            def: ''
        },
        fontFamily: {
            def: '"Consolas","Monaco","Courier New","Courier",monospace'
        },
        quickActivation: {
            def: false
        },
        siteOverrides: {
            def: false
        },
        logMode: {
            def: false
        },
        upgradeNotify: {
            def: true
        }
    },
    local: {
        version: {def: ''},
        wasavi_lineinput_histories: {def: {}},
        wasavi_registers: {def: {}}
    }
};

// Initialize the extension
function initialize() {
    console.log('Initializing Wasavi background...');
    
    // Set up context menu
    initializeContextMenu();
    
    // Initialize configuration
    config = new Config(configInfo, {
        onupdate: function(key, value) {
            console.log('Config updated:', key, value);
        }
    });
    
    // Initialize config and then finalize setup
    config.init().then(() => {
        console.log('Configuration initialized');
        
        // Check for version updates
        const currentVersion = chrome.runtime.getManifest().version;
        if (currentVersion !== config.get('version')) {
            console.log('Version updated from', config.get('version'), 'to', currentVersion);
            config.set('version', currentVersion);
        }
        
        isInitializing = false;
        
        // Process any blocked events
        blockedEvents.forEach(callback => {
            try {
                callback();
            } catch (e) {
                console.error('Error processing blocked event:', e);
            }
        });
        blockedEvents = [];
        
        console.log('Wasavi background initialized');
    }).catch(error => {
        console.error('Failed to initialize configuration:', error);
        isInitializing = false;
    });
}

// Start initialization
initialize(); 