import { ref } from 'vue';
import moduleGroupConfig from '@/config/module-groups.json';
import { ModuleGroupDefinition, ModuleDefinition } from '@/types';
import appEmitter from '@/lib/emitter';

interface RunModuleOptions {
    hideWaitAnimation?: boolean;
}

const moduleGroups: { [key: string]: ModuleGroupDefinition } = moduleGroupConfig as { [key: string]: ModuleGroupDefinition };

export async function preloadModules() {
    const moduleLoadPromises: Promise<any>[] = [];
    for (let groupName in moduleGroups) {
        const group = moduleGroups[groupName];
        for (let moduleName in group.modules) {
            const module = group.modules[moduleName];
            if (module.preload && module.action.type === 'function') {
                const moduleIdentifierSplit = module.action.target.split('.');
                const modulePath = moduleIdentifierSplit[0];
                const modulePathSplit = modulePath.split('/');
                const moduleGroup = modulePathSplit[0];
                const moduleName = modulePathSplit[1];
                if (moduleGroup && moduleName) {
                    moduleLoadPromises.push(
                        import(/* webpackChunkName: 'module-preload-[request]' */ `./${moduleGroup}/${moduleName}`)
                    );
                }
            }
        }
    }
    await Promise.allSettled(moduleLoadPromises);
}

export function getModuleDefinition(moduleGroupName: string, moduleName: string): ModuleDefinition | null {
    if (moduleGroups[moduleGroupName]) {
        return moduleGroups[moduleGroupName].modules[moduleName] || null;
    }
    return null;
}

async function runModuleByDefinition(module: ModuleDefinition, moduleProperties?: Record<string, unknown>, options: RunModuleOptions = {}) {
    if (module.action.type === 'ui') {
        appEmitter.emit('app.dialogs.openFromModule', {
            name: module.action.target,
            props: moduleProperties
        });
    } else if (module.action.type === 'function') {
        const moduleIdentifierSplit = module.action.target.split('.');
        const modulePath = moduleIdentifierSplit[0];
        const methodName = moduleIdentifierSplit[1];
        const modulePathSplit = modulePath.split('/');
        const moduleGroup = modulePathSplit[0];
        const moduleName = modulePathSplit[1];
        if (moduleGroup && moduleName && methodName) {
            const importedModule = (await import(/* webpackChunkName: 'module-[request]' */ `./${moduleGroup}/${moduleName}`));
            const moduleRunId = 'runModule_' + moduleGroup + '_' + moduleName;
            const cancelable = module.cancelable || false;
            const cancelRef = ref<boolean>(false);
            const cancelBlocking = (event?: any) => {
                if (event && event.id === moduleRunId) {
                    cancelRef.value = true;
                }
            };
            const moduleRunArgs: any = {
                ...(moduleProperties ?? {})
            };
            if (cancelable) {
                appEmitter.on('app.wait.cancelBlocking', cancelBlocking);
                moduleRunArgs.cancelRef = cancelRef;
            }
            if (!options.hideWaitAnimation) {
                const moduleIdentifiers = findModuleIdentifiers(module);
                appEmitter.emit('app.wait.startBlocking', {
                    id: moduleRunId,
                    label: moduleIdentifiers
                        ? `moduleGroup.${ moduleIdentifiers.group }.modules.${ moduleIdentifiers.module }.name`
                        : 'app.wait.pleaseWait',
                    cancelable: module.cancelable || false
                });
            }
            let runModuleError;
            try {
                await importedModule[methodName](moduleRunArgs);
            } catch (error: any) {
                runModuleError = error;
            }
            if (cancelable) {
                appEmitter.off('app.wait.cancelBlocking', cancelBlocking);
            }
            if (!options.hideWaitAnimation) {
                appEmitter.emit('app.wait.stopBlocking', {
                    id: moduleRunId
                });
            }
            if (runModuleError) {
                throw runModuleError;
            }
        } else {
            throw new Error('Module function identifier was malformed.');        
        }
    }
}

export async function runModule(moduleGroupName: string, moduleName: string, moduleProperties?: Record<string, unknown>, options: RunModuleOptions = {}) {
    if (moduleGroups[moduleGroupName]) {
        const module = moduleGroups[moduleGroupName].modules[moduleName];
        if (module) {
            if (moduleGroupName === 'history') {
                options.hideWaitAnimation = true;
            }
            await runModuleByDefinition(module, moduleProperties, options);
        } else {
            throw new Error('Unknown module name.');
        }
    } else {
        throw new Error('Unknown module group name.');
    }
}

function findModuleIdentifiers(module: ModuleDefinition): { group: string, module: string } | null {
    for (const moduleGroupName in moduleGroups) {
        const moduleGroup = moduleGroups[moduleGroupName];
        for (const moduleName in moduleGroup.modules) {
            if (moduleGroup.modules[moduleName] === module) {
                return {
                    group: moduleGroupName,
                    module: moduleName,
                }
            }
        }
    }
    return null;
}

appEmitter.on('app.runModule', (event) => {
    if (!event) return;
    const { action, groupName, moduleName, props, onSuccess, onError } = event;
    if (action) {
        runModuleByDefinition({
            action,
        }, props).then((result) => {
            onSuccess?.(result);
        }).catch((error) => {
            onError?.(error);
        });
    } else if (groupName && moduleName) {
        runModule(groupName, moduleName, props).then((result) => {
            onSuccess?.(result);
        }).catch((error) => {
            onError?.(error);
        });
    }
});
