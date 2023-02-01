import { createI18n } from 'vue-i18n';
import i18nMessagesEn from '@/i18n/en.json';

const i18n = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
        en: i18nMessagesEn
    }
});

export const { t } = i18n.global;

export { useI18n } from 'vue-i18n';
export default i18n;
