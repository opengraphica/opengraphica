import { format, BaseFormatChain, FormatChain } from './index';

(BaseFormatChain.prototype as FormatChain<any>).asTitleCase = function(): FormatChain<string> {
    let phrase: string = (this.value + '').toLowerCase();
    let words = phrase.split(' ');
    for (let [index, word] of words.entries()) {
        words[index] = word.charAt(0).toUpperCase() + word.slice(1); 
    }
    this.value = words.join(' ');
    return this as unknown as FormatChain<string>;
}

