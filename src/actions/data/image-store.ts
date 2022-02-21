import { v4 as uuidv4 } from 'uuid';

// Get a unique id to identify this tab's history in the database
let tabUuid: string | null = null;
try {
    tabUuid = sessionStorage.getItem('openGraphica_historyTabUuid');
} catch (error) {}
if (!tabUuid) {
    tabUuid = uuidv4();
    try {
        sessionStorage.setItem('openGraphica_historyTabUuid', tabUuid + '');
    } catch (error) {}
}

interface MemoryStore {
    isMemory: true;
    images: { [key: string]: string | typeof Image | ImageData | Blob };
}

interface IDBDatabaseEnhanced extends IDBDatabase {
    isMemory: false;
}

let imageIdCounter: number = 0;
let database: IDBDatabaseEnhanced | MemoryStore | null = null;
let databaseInitPromise: Promise<void> | null = null;
const tabPingInterval: number = 60000;
const assumeTabIsClosedTimeout: number = 300000; // Inactive tabs setInterval is slowed down in most browsers, this should be significantly higher than tabPingInterval

export default {
    /**
     * Initializes the database
     */
    async init() {
        if (!databaseInitPromise) {
            databaseInitPromise = new Promise<void>(async (resolveInit) => {
                try {
                    if (window.indexedDB) {
                        // Delete database from a previous page load, if no other tabs have notified that they're open in a while
                        let shouldDeleteDatabase = true;
                        try {
                            let lastDatabaseTabPing = localStorage.getItem('history_usage_ping');
                            shouldDeleteDatabase = (!lastDatabaseTabPing || parseInt(lastDatabaseTabPing, 10) < new Date().getTime() - assumeTabIsClosedTimeout);
                        } catch (error) {}
                        if (shouldDeleteDatabase) {
                            await new Promise<void>((resolve, reject) => {
                                let deleteRequest = window.indexedDB.deleteDatabase('undoHistoryImageStore');
                                deleteRequest.onerror = () => {
                                    reject(deleteRequest.error);
                                };
                                deleteRequest.onsuccess = () => {
                                    resolve();
                                };
                            });
                        }
                        // Initialize database
                        await new Promise<void>((resolve, reject) => {
                            let openRequest = window.indexedDB.open('undoHistoryImageStore', 1);
                            openRequest.onupgradeneeded = function(event) {
                                database = openRequest.result as IDBDatabaseEnhanced;
                                switch (event.oldVersion) {
                                    case 0:
                                        database.createObjectStore('images', { keyPath: 'id' });
                                        break;
                                }
                            };
                            openRequest.onerror = () => {
                                reject(openRequest.error);
                            }
                            openRequest.onsuccess = () => {
                                resolve();
                                database = openRequest.result as IDBDatabaseEnhanced;
                            }
                        });
                        if (!database) {
                            throw new Error('indexedDB not initialized');
                        }
                        database.isMemory = false;
                        // Delete history from previous session
                        try {
                            await this.deleteAll();
                        } catch (error) {}
                        // Ping localStorage for as long as this browser tab is open
                        localStorage.setItem('openGraphica_historyUsagePing', new Date().getTime() + '');
                        setInterval(() => {
                            localStorage.setItem('openGraphica_historyUsagePing', new Date().getTime() + '');
                        }, tabPingInterval);
                    }
                } catch (error) {
                    database = {
                        isMemory: true,
                        images: {}
                    };
                }
                resolveInit();
            });
            await databaseInitPromise;
        } else if (!database) {
            await databaseInitPromise;
        }
    },

    /**
     * Adds the specified image to the database. Returns a promise that is resolved with an id that can be used to retrieve it again.
     * 
     * @param {string | Image | ImageData | Blob} imageData the image data to store
     * @returns {Promise<string>} resolves with retrieval id
     */
    async add(imageData: string | typeof Image | ImageData | Blob): Promise<string> {
        await this.init();
        let imageId = tabUuid + '-' + (imageIdCounter++);
        if (database?.isMemory) {
            database.images[imageId] = imageData;
        } else {
            await new Promise<void>((resolve, reject) => {
                const transaction = (database as IDBDatabaseEnhanced).transaction('images', 'readwrite');
                const images = transaction.objectStore('images');
                const image = {
                    id: imageId,
                    tabUuid,
                    data: imageData
                }
                const request = images.add(image);
                request.onsuccess = function() {
                    resolve();
                };
                request.onerror = function() {
                    reject(request.error);
                };
            });
        }
        return imageId;
    },

    /**
     * Gets the specified image from the database, by imageId retrieved from "add()" method.
     * 
     * @param {string} imageId the id of the image to get
     * @returns {Promise<string | Image | ImageData | Blob>} resolves with the image
     */
    async get(imageId: string): Promise<string | typeof Image | ImageData | Blob> {
        await this.init();
        if (database?.isMemory) {
            return database.images[imageId];
        } else {
            return new Promise((resolve, reject) => {
                const transaction = (database as IDBDatabaseEnhanced).transaction('images', 'readonly');
                const images = transaction.objectStore('images');
                const request = images.get(imageId);
                request.onsuccess = function() {
                    resolve(request.result && request.result.data);
                };
                request.onerror = function() {
                    reject(request.error);
                };
            });
        }
    },

    /**
     * Deletes the specified image from the database, by imageId retrieved from "add()" method.
     * 
     * @param {string} imageId the id of the image to delete
     * @returns {Promise<void>} 
     */
    async delete(imageId: string): Promise<void> {
        await this.init();
        if (database?.isMemory) {
            delete database.images[imageId];
        } else {
            return new Promise((resolve, reject) => {
                const transaction = (database as IDBDatabaseEnhanced).transaction('images', 'readwrite');
                const images = transaction.objectStore('images');
                const request = images.delete(imageId);
                request.onsuccess = function() {
                    resolve();
                };
                request.onerror = function() {
                    reject(request.error);
                };
            });
        }
    },

    /**
     * Deletes all images associated with the current tab.
     * 
     * @returns {Promise<void>} 
     */
    async deleteAll() {
        await this.init();
        if (database?.isMemory) {
            database.images = {};
        } else {
            return new Promise<void>((resolve, reject) => {
                const transaction = (database as IDBDatabaseEnhanced).transaction('images', 'readwrite');
                const images = transaction.objectStore('images');
                const getAllImagesRequest = images.getAll();
                getAllImagesRequest.onsuccess = async function () {
                    const allImages = getAllImagesRequest.result;
                    let errorOccurred = false;
                    for (let image of allImages) {
                        if (image.tabUuid === tabUuid) {
                            try {
                                await new Promise<void>((deleteResolve, deleteReject) => {
                                    const request = images.delete(image.id);
                                    request.onsuccess = function() {
                                        deleteResolve();
                                    };
                                    request.onerror = function() {
                                        deleteReject(request.error);
                                    };
                                });
                            } catch (error) {
                                errorOccurred = true;
                                // Should eventually be deleted when database is deleted due to timeout
                            }
                        }
                    }
                    if (errorOccurred) {
                        // Use a different uuid to prevent conflicts
                        tabUuid = uuidv4();
                    }
                    resolve();
                };
                getAllImagesRequest.onerror = function() {
                    reject(getAllImagesRequest.error)
                };
            });
        }
    }
};