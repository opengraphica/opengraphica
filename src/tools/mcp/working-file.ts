import { t } from '@/i18n';
import { registerTool } from './validation';

registerTool({
    name: 'get-editor-guide',
    description: t('mcp.getEditorGuide.description'),
    execute() {
        return t('mcp.getEditorGuide.summary');
    }
});
