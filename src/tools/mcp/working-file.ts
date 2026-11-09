import { t } from '@/i18n';

document.modelContext?.registerTool({
    name: 'get-editor-guide',
    description: t('mcp.getEditorGuide.description'),
    execute() {
        return t('mcp.getEditorGuide.summary');
    }
});
