import { createI18n } from 'vue-i18n';
import preferencesStore from '@/store/preferences';
import i18nMessagesEn from '@/i18n/en.json';

async function loadLanguage(language: string) {
    if (language === 'en') {
        return i18nMessagesEn;
    } else {
        try {
            return (await import(/* webpackChunkName: 'i18n-language-[request]' */ `@/i18n/${language}.json`)).default;
        } catch (error) {
            return {};
        }
    }
}

const i18n = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    fallbackWarn: false,
    missingWarn: false,
    messages: {
        en: i18nMessagesEn,
    }
});

export async function initializeI18n() {
    const userLanguage = preferencesStore.state.languageOverride ?? (window.navigator?.language ?? 'en').split('-')[0].toLowerCase() ?? 'en';
    if (userLanguage != '') {
        await setEditorLanguage(userLanguage);
    }
}

export async function setEditorLanguage(language: string) {
    if (language !== 'en') {
        i18n.global.setLocaleMessage(language, await loadLanguage(language));
    }
    i18n.global.locale = language;
}

export const { t, tm, rt } = i18n.global;

export { useI18n } from 'vue-i18n';
export default i18n;
