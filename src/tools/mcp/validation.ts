import { t } from '@/i18n';
import type { WebMCP } from 'webmcp-types';

const alreadyRegisteredTools = await document.modelContext?.getTools();

export const registerTool: WebMCP.ModelContext['registerTool'] = (tool, options) => {
    if (alreadyRegisteredTools?.find((otherTool) => otherTool.name === tool.name)) return undefined as any;
    const inputSchema = tool.inputSchema;
    const originalExecute = tool.execute;
    const required = inputSchema?.required ?? [];
    tool.execute = (inputObject, options) => {
        if (inputSchema) {
            for (const propertyName in inputSchema.properties) {
                const value = inputObject[propertyName];
                if (value == null) {
                    if (required.includes(propertyName)) {
                        throw new Error(t('mcp.common.errors.required', { propertyName }));
                    }
                    continue;
                }
                const property = inputSchema.properties[propertyName];
                switch (property?.type) {
                    case 'number':
                        if (typeof value !== 'number' || !Number.isFinite(value) || isNaN(value)) {
                            throw new Error(t('mcp.common.errors.notNumber', { propertyName }));
                        }
                        break;
                    case 'string':
                        if (typeof value !== 'string') {
                            throw new Error(t('mcp.common.errors.notString', { propertyName }));
                        } else if (property.enum && !property.enum.includes(value)) {
                            console.log(property.enum);
                            throw new Error(t('mcp.common.errors.notInEnumList', { propertyName }));
                        }
                        break;
                }
            }
        }
        return originalExecute(inputObject, options);
    };
    return document.modelContext?.registerTool(tool, options)!;
};
