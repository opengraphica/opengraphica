import mitt, { Handler } from 'mitt';
import { ref } from 'vue';

export const top = ref<number>(0);
export const left = ref<number>(0);
export const width = ref<number>(200);
export const height = ref<number>(200);

export const cropResizeEmitter = mitt();

