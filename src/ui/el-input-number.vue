<template>
    <el-input
        v-model="displayValue"
        ref="input"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        formnovalidate="formnovalidate"
        :maxlength="maxlength"
        :minlength="minlength"
        :show-word-limit="showWordLimit"
        :placeholder="placeholder"
        :clearable="clearable"
        :show-password="showPassword"
        :disabled="disabled"
        :size="size"
        :prefix-icon="prefixIcon"
        :suffix-icon="suffixIcon"
        :rows="rows"
        :autosize="autosize"
        :autocomplete="autocomplete"
        :name="name"
        :readonly="readonly"
        :max="max"
        :min="min"
        :step="step"
        :resize="resize"
        :autofocus="autofocus"
        :form="form"
        :label="label"
        :tabindex="tabindex"
        :validate-event="validateEvent"
        @blur="onBlur($event)"
        @focus="onFocus($event)"
        @change="onChange($event)"
        @input="onInput($event)"
        @keydown="onKeyDown($event)"
        @clear="onClear($event)"
    >
        <template v-if="$slots['prefix']" v-slot:prefix>
            <slot name="prefix" />
        </template>
        <template v-if="$slots['suffix']" v-slot:suffix>
            <slot name="suffix" />
        </template>
        <template v-if="$slots['prepend']" v-slot:prepend>
            <slot name="prepend" />
        </template>
        <template v-if="$slots['append']" v-slot:append>
            <slot name="append" />
        </template>
    </el-input>
</template>

<script lang="ts">
import { defineComponent, ref, watch, PropType, onMounted } from 'vue';
import ElInput from 'element-plus/lib/el-input';
import { Parser as MathExpressionParser } from 'expr-eval';

export default defineComponent({
    name: 'ElInputNumber',
    components: {
        ElInput
    },
    props: {
        modelValue: {
            type: Number
        },
        modelModifiers: {
            type: Object as PropType<any>,
            default: () => ({})
        },
        maxlength: {
            type: Number
        },
        minlength: {
            type: Number
        },
        showWordLimit: {
            type: Boolean,
            default: false
        },
        placeholder: {
            type: String
        },
        clearable: {
            type: Boolean,
            default: false
        },
        showPassword: {
            type: Boolean,
            default: false
        },
        disabled: {
            type: Boolean,
            default: false
        },
        size: {
            type: String
        },
        prefixIcon: {
            type: String
        },
        suffixIcon: {
            type: String
        },
        rows: {
            type: Number,
            default: 2
        },
        autosize: {
            type: Boolean,
            default: false
        },
        autocomplete: {
            type: String,
            default: 'off'
        },
        name: {
            type: String
        },
        readonly: {
            type: Boolean,
            default: false
        },
        max: {
            type: Number,
            default: Infinity
        },
        min: {
            type: Number,
            default: -Infinity
        },
        step: {
            type: Number,
            default: 1
        },
        resize: {
            type: String
        },
        autofocus: {
            type: Boolean,
            default: false
        },
        form: {
            type: String
        },
        label: {
            type: String
        },
        tabindex: {
            type: String
        },
        validateEvent: {
            type: Boolean,
            default: true
        },
        precision: {
            type: Number
        }
    },
    emits: [
        'blur',
        'focus',
        'change',
        'input',
        'clear',
        'update:modelValue'
    ],
    setup(props, { emit }) {
        const input = ref();
        const displayValue = ref<string>('');
        let lastEvaluatedValue: number = 0;

        watch(() => props.modelValue, (modelValue) => {
            if (modelValue != null && modelValue !== lastEvaluatedValue) {
                updateModelValue(modelValue);
            }
        });

        onMounted(() => {
            updateModelValue(props.modelValue || 0);
        });

        function updateModelValue(modelValue: number) {
            lastEvaluatedValue = modelValue;
            lastEvaluatedValue = Math.max(props.min, Math.min(props.max, lastEvaluatedValue));
            displayValue.value = '' + modelValue;
        }

        function onBlur(e: Event) {
            emit('blur', e);
        }
        function onFocus(e: Event) {
            emit('focus', e);
        }
        function onChange() {
            try {
                lastEvaluatedValue = MathExpressionParser.evaluate(displayValue.value);
            } catch (error) {
                // Do nothing.
            }
            if (props.precision != null) {
                lastEvaluatedValue = Math.round(Math.pow(10, props.precision) * lastEvaluatedValue) / Math.pow(10, props.precision);
            }
            lastEvaluatedValue = Math.max(props.min, Math.min(props.max, lastEvaluatedValue));
            displayValue.value = lastEvaluatedValue + '';
            emit('change', lastEvaluatedValue);
            emit('update:modelValue', lastEvaluatedValue);
        }
        function onInput(e: number) {
            try {
                lastEvaluatedValue = MathExpressionParser.evaluate(displayValue.value);
                emit('input', lastEvaluatedValue);
                if (!(props.modelModifiers as any).lazy) {
                    emit('update:modelValue', lastEvaluatedValue);
                }
            } catch (error) {
                // Do nothing.
            }
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Enter') {
                if (lastEvaluatedValue !== parseFloat(displayValue.value)) {
                    e.preventDefault();
                }
                onChange();
            }
        }
        function onClear() {
            emit('clear');
        }

        function focus() {
            if (input.value) {
                return input.value.focus();
            }
        }
        function blur() {
            if (input.value) {
                return input.value.blur();
            }
        }
        function select() {
            if (input.value) {
                return input.value.select(...arguments);
            }
        }

        return {
            displayValue,
            input,
            focus,
            blur,
            select,
            onBlur,
            onFocus,
            onChange,
            onInput,
            onKeyDown,
            onClear
        };
    }
});
</script>
