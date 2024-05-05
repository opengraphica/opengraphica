import { nextTick, type ObjectDirective } from 'vue';

function handleClick(el: HTMLElement) {
    nextTick(() => {
        let intervalHandle = setInterval(() => {
            if (!el.classList.contains('is-active')) {
                clearInterval(intervalHandle);
                return;
            }
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 16);
        setTimeout(() => {
            clearInterval(intervalHandle);
        }, 300);
    });
}

const ElCollapseItemSmartScrollDirective: ObjectDirective = {
    async mounted(el) {
        el.addEventListener('click', () => {
            handleClick(el);
        });
    },
    async unmounted(el, binding) {
        
    }
};

export default ElCollapseItemSmartScrollDirective;
