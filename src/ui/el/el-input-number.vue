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
        :aria-label="ariaLabel"
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
// @ts-nocheck
import { defineComponent, ref, watch, PropType, onMounted, nextTick } from 'vue';
import ElInput from 'element-plus/lib/components/input/index';
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
        prefixText: {
            type: String
        },
        suffixText: {
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
        },
        blurOnEnter: {
            type: Boolean,
            default: false
        },
        ariaLabel: {
            type: String,
            default: ''
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
        let isFocused: boolean = false;

        watch(() => props.modelValue, (modelValue) => {
            if (modelValue !== lastEvaluatedValue) {
                updateModelValue(modelValue);
            }
        });

        watch(() => props.prefixText, (newValue, oldValue) => {
            removeTextPrefixSuffix(oldValue);
            if (!isFocused) {
                addTextPrefixSuffix();
            }
        });

        watch(() => props.suffixText, (newValue, oldValue) => {
            removeTextPrefixSuffix(undefined, oldValue);
            if (!isFocused) {
                addTextPrefixSuffix();
            }
        });

        onMounted(() => {
            updateModelValue(props.modelValue);
        });

        function updateModelValue(modelValue: number | null) {
            lastEvaluatedValue = modelValue ?? 0;
            lastEvaluatedValue = Math.max(props.min, Math.min(props.max, lastEvaluatedValue));
            displayValue.value = '' + (modelValue ?? '');
            if (!isFocused) {
                addTextPrefixSuffix();
            }
        }

        function addTextPrefixSuffix() {
            if (props.prefixText || props.suffixText) {
                removeTextPrefixSuffix();
                displayValue.value = (props.prefixText || '') + displayValue.value + (props.suffixText || '');
            }
        }

        function removeTextPrefixSuffix(oldPrefix?: string, oldSuffix?: string) {
            if (props.prefixText || props.suffixText) {
                const innerInput = input.value.$el.querySelector('input');
                const selectionStart: number = (innerInput && innerInput.selectionStart) || 0;
                const suffixText = oldSuffix || props.suffixText;
                const prefixText = oldPrefix || props.prefixText;
                if (prefixText && displayValue.value.slice(0, prefixText.length) === prefixText) {
                    displayValue.value = displayValue.value.slice(0, prefixText.length);
                }
                if (suffixText && displayValue.value.slice(-suffixText.length) === suffixText) {
                    displayValue.value = displayValue.value.slice(0, -suffixText.length);
                }
                if (!isFocused) {
                    nextTick(() => {
                        // TODO - This line freezes Safari. Need to know what it fixes, and how to mitigate.
                        // innerInput.setSelectionRange(selectionStart, selectionStart);
                    });
                }
            }
        }

        function onBlur(e: Event) {
            addTextPrefixSuffix();
            isFocused = false;
            emit('blur', e);
        }
        function onFocus(e: Event) {
            removeTextPrefixSuffix();
            isFocused = true;
            emit('focus', e);
        }
        function onChange() {
            try {
                lastEvaluatedValue = MathExpressionParser.evaluate(displayValue.value);
            } catch (error: any) {
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
            } catch (error: any) {
                // Do nothing.
            }
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Enter') {
                if (lastEvaluatedValue !== parseFloat(displayValue.value)) {
                    e.preventDefault();
                }
                onChange();
                if (props.blurOnEnter) {
                    blur();
                }
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
