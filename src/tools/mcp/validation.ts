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
                        throw new Error(t('mcp.common.error.required', { propertyName }));
                    }
                    continue;
                }
                const property = inputSchema.properties[propertyName];
                switch (property?.type) {
                    case 'array':
                        if (Object.prototype.toString.call(value) !== '[object Array]') {
                            throw new Error(t('mcp.common.error.notArray', { propertyName }));
                        }
                        const itemType = property.items?.type ?? 'any';
                        for (const itemValue of value) {
                            switch (itemType) {
                                case 'number':
                                    console.log(typeof itemValue);
                                    if (typeof itemValue !== 'number' || !Number.isFinite(itemValue) || isNaN(itemValue)) {
                                        throw new Error(t('mcp.common.error.notArrayNumber', { propertyName }));
                                    }
                                    break;
                                case 'string':
                                    if (typeof itemValue !== 'string') {
                                        throw new Error(t('mcp.common.error.notArrayString', { propertyName }));
                                    }
                                    break;
                            }
                        }
                        break;
                    case 'number':
                        if (typeof value !== 'number' || !Number.isFinite(value) || isNaN(value)) {
                            throw new Error(t('mcp.common.error.notNumber', { propertyName }));
                        }
                        break;
                    case 'string':
                        if (typeof value !== 'string') {
                            throw new Error(t('mcp.common.error.notString', { propertyName }));
                        } else if (property.enum && !property.enum.includes(value)) {
                            throw new Error(t('mcp.common.error.notInEnumList', { propertyName }));
                        }
                        break;
                }
            }
        }
        return originalExecute(inputObject, options);
    };
    try {
        return document.modelContext?.registerTool(tool, options)!;
    } catch (error) {
        return undefined as any;
    }
};
