import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { SplashScreen } from '@capacitor/splash-screen';
import { App, type AppState } from '@capacitor/app';

import editorStore from '@/store/editor';
import preferencesStore from '@/store/preferences';

import { t } from '@/i18n';

import appEmitter from '@/lib/emitter';

import type { NotificationHandle } from 'element-plus/lib/components/notification/src/notification.d';

export async function updateApp() {
    const buildInfo = editorStore.state.availableLiveUpdateBuild;
    if (!buildInfo) return;

    let notificationHandle = null as NotificationHandle | null;
    appEmitter.emit('app.notify', {
        type: 'info',
        title: t('module.appUpdate.notificationTitle'),
        message: t('module.appUpdate.notificationMessage') + `
            <div class="el-progress-bar mt-4!">
                <div class="el-progress-bar__outer" style="height: 6px;">
                    <div class="el-progress-bar__inner el-progress-bar__inner--indeterminate" style="width: 50%; animation-duration: 3s;">
                    </div>
                </div>
            </div>
        `,
        dangerouslyUseHTMLString: true,
        duration: 0,
        showClose: false,
        onCreated(handle) {
            notificationHandle = handle;
        },
    });

    try {
        if (!buildInfo.checksum || !buildInfo.signature) {
            throw new Error('Missing checksum or signature.');
        }
        if (!(await verifyChecksumSignature(buildInfo.checksum, buildInfo.signature))) {
            throw new Error('Signature validation failed');
        }

        const data = await CapacitorUpdater.download({
            version: buildInfo.version!,
            url: buildInfo.url!,
            checksum: buildInfo.checksum,
        });
        if (!data.version) {
            throw new Error('Update not found.');
        }

        notificationHandle?.close();

        appEmitter.emit('app.notify', {
            type: 'info',
            title: t('module.appUpdate.notificationReadyTitle'),
            message: t('module.appUpdate.notificationReadyMessage'),
            duration: 6000,
        });

        let isInstalling = false;
        async function installUpdateOnStateChange(state: AppState) {
            if (!state.isActive && !isInstalling) {
                listenerHandle.remove();
                isInstalling = true;
                try {
                    SplashScreen.show();
                    await CapacitorUpdater.set(data);
                } catch(error) {
                    appEmitter.emit('app.notify', {
                        type: 'error',
                        title: t('module.appUpdate.notificationErrorTitle'),
                        message: t('module.appUpdate.notificationErrorMessage'),
                        duration: 6000,
                    });
                } finally {
                    SplashScreen.hide();
                }
            }
        }

        const listenerHandle = await App.addListener('appStateChange', installUpdateOnStateChange);
    } catch (error) {
        console.error('[src/modules/app/update.ts]', error);
        notificationHandle?.close();
        setTimeout(() => {
            appEmitter.emit('app.notify', {
                type: 'error',
                title: t('module.appUpdate.notificationErrorTitle'),
                message: t('module.appUpdate.notificationErrorMessage'),
                duration: 6000,
            });
        }, 50);
    }
}

async function verifyChecksumSignature(
    checksum: string,
    signatureBase64: string,
) {
    const publicKeyPem = preferencesStore.state.appUpdateSigningEd25519PublicKey;
    const publicKeyDer = pemToArrayBuffer(publicKeyPem);
    const publicKey = await crypto.subtle.importKey(
        'spki',
        publicKeyDer,
        { name: 'Ed25519' },
        false,
        ['verify'],
    );

    const checksumBytes = hexToUint8Array(checksum);
    const signatureBytes = base64ToUint8Array(signatureBase64);
    return crypto.subtle.verify(
        { name: "Ed25519" },
        publicKey,
        signatureBytes,
        checksumBytes
    );
}

function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
    if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
        throw new Error("Invalid hexadecimal checksum");
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function pemToArrayBuffer(pem: string) {
    const base64 = pem
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s/g, '');
    return base64ToUint8Array(base64).buffer;
}

function base64ToUint8Array(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
