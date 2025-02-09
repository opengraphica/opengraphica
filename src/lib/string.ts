
export function camelCaseToKebabCase(str: string) {
    return str.split('').map((letter, idx) => {
        return /[a-z]/i.test(letter) && letter.toUpperCase() === letter
            ? `${idx !== 0 ? '-' : ''}${letter.toLowerCase()}`
            : letter;
    }).join('');
}
