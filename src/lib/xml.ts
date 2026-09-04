export function indentXml(xml: string, size = 4) {
    const tokens =
        xml.match(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g) || [];

    let depth = 0;
    const lines: string[] = [];

    for (const token of tokens) {
        const part = token.trim();
        if (!part) continue;

        if (/^<\/.*>$/.test(part)) depth--;

        lines.push(' '.repeat(depth * size) + part);

        if (
            /^<[^!?/][^>]*[^/]?>$/.test(part) &&
            !/^<[^>]+\s*\/>$/.test(part)
        ) {
            depth++;
        }
    }

    return lines.join('\n');
}