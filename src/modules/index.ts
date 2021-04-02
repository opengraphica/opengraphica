import moduleGroupConfig from '@/config/module-groups.json';
import { ModuleGroupDefinition } from '@/types';
import appEmitter from '@/lib/emitter';

const moduleGroups: { [key: string]: ModuleGroupDefinition } = moduleGroupConfig as { [key: string]: ModuleGroupDefinition };

export async function runModule(moduleGroupName: string, moduleName: string) {
    if (moduleGroups[moduleGroupName]) {
        const module = moduleGroups[moduleGroupName].modules[moduleName];
        if (module) {
            if (module.action.type === 'ui') {
                appEmitter.emit('app.dialogs.openFromModule', { name: module.action.target });
            } else if (module.action.type === 'function') {
                // TODO
            }
        } else {
            throw new Error('Unknown module name');
        }
    } else {
        throw new Error('Unknown module group name');
    }
}
