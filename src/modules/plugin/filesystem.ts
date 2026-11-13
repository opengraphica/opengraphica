import * as fflate from 'fflate';
import { v4 as uuidv4 } from 'uuid';

import { storePlugin } from '@/store/data/plugin-database';

import { runModuleByDefinition } from '@/modules';

export interface InstallZipOptions {
    zip: Blob;
}

export async function installZip({ zip }: InstallZipOptions) {
    const zipArrayBuffer = new Uint8Array(await zip.arrayBuffer());
    const archive = await new Promise<fflate.Unzipped>((resolve, reject) => {
        fflate.unzip(zipArrayBuffer, {}, (error, data) => {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });

    if (!archive['package.json']) throw new Error('Missing package.json');
    const pluginId = uuidv4();
    const textDecoder = new TextDecoder();
    const packageJson = JSON.parse(textDecoder.decode(archive['package.json']));
    packageJson.pluginId = pluginId;

    const blobs: Record<string, Blob> = {};
    for (const key in archive) {
        let mimeType = 'application/javascript';
        if (key.endsWith('.json')) {
            mimeType = 'application/json';
        }
        const blob = new Blob([archive[key]], { type: mimeType });
        blobs['plugins/' + pluginId + '/' + key] = blob;
    }

    const isStored = await storePlugin(packageJson, blobs);

    if (isStored) {
        runModuleByDefinition({
            action: {
                type: 'ui',
                target: 'plugin-install-reload-confirm',
            },
        });
    }
}
