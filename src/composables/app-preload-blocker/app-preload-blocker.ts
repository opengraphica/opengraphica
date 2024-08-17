/**
 * This returns a loading variable that will allow the app's preload
 * animation to hide when set to false. This allows multiple components
 * to independently notify the app that they are ready for first display.
 */

import { computed, nextTick, ref, watch } from 'vue';

const appPreloadBlockerCount = ref(0);

export const isAppPreloading = computed(() => {
    return appPreloadBlockerCount.value > 0;
});

export function useAppPreloadBlocker() {
    appPreloadBlockerCount.value += 1;

    let hasStoppedLoading = false;
    const loading = ref(true);

    watch(() => loading.value, (isLoading) => {
        if (!isLoading && !hasStoppedLoading) {
            hasStoppedLoading = true;
            nextTick(() => {
                requestAnimationFrame(() => {
                    nextTick(() => {
                        appPreloadBlockerCount.value -= 1;
                    });
                })
            });
        }
    });

    return {
        loading,
    };
}
