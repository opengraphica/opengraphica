
export function camelCaseToKebabCase(str: string) {
    return str.split('').map((letter, idx) => {
        return /[a-z]/i.test(letter) && letter.toUpperCase() === letter
            ? `${idx !== 0 ? '-' : ''}${letter.toLowerCase()}`
            : letter;
    }).join('');
}

export function toTitleCase(str: string) {
    return str
        .toLocaleLowerCase()
        .replace(/(^|[\s-])(\p{L})/gu, (_, separator, letter) =>
            separator + letter.toLocaleUpperCase()
        );
}
