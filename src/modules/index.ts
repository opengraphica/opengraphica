import moduleGroupConfig from '@/config/module-groups.json';
import { ModuleGroupDefinition } from '@/types';
import appEmitter from '@/lib/emitter';

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

export async function runModule(moduleGroupName: string, moduleName: string) {
    if (moduleGroups[moduleGroupName]) {
        const module = moduleGroups[moduleGroupName].modules[moduleName];
        if (module) {
            if (module.action.type === 'ui') {
                appEmitter.emit('app.dialogs.openFromModule', { name: module.action.target });
            } else if (module.action.type === 'function') {
                const moduleIdentifierSplit = module.action.target.split('.');
                const modulePath = moduleIdentifierSplit[0];
                const methodName = moduleIdentifierSplit[1];
                const modulePathSplit = modulePath.split('/');
                const moduleGroup = modulePathSplit[0];
                const moduleName = modulePathSplit[1];
                if (moduleGroup && moduleName && methodName) {
                    const importedModule = (await import(/* webpackChunkName: 'module-[request]' */ `./${moduleGroup}/${moduleName}`));
                    appEmitter.emit('app.wait.startBlocking', {
                        id: 'runModule_' + moduleGroupName + '_' + moduleName,
                        label: module.name
                    });
                    let runModuleError;
                    try {
                        await importedModule[methodName]();
                    } catch (error) {
                        runModuleError = error;
                    }
                    appEmitter.emit('app.wait.stopBlocking', {
                        id: 'runModule_' + moduleGroupName + '_' + moduleName
                    });
                    if (runModuleError) {
                        throw runModuleError;
                    }
                } else {
                    throw new Error('Module function identifier was malformed.');        
                }
            }
        } else {
            throw new Error('Unknown module name.');
        }
    } else {
        throw new Error('Unknown module group name.');
    }
}
