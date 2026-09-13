import mitt from 'mitt';
import { ref } from 'vue';

export const effectEmitter = mitt();

export const isToolbarVisible = ref(false);

export const effectSettingsDockTop = ref(0);
export const effectSettingsDockLeft = ref(0);
export const effectSettingsDockVisible = ref<boolean>(false);