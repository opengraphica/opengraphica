import { ref } from 'vue';

export const selectionMode = ref<'rectangle' | 'ellipse' | 'free' | 'tonalArea'>('rectangle');

export const workingSelectionPath: any = [];
