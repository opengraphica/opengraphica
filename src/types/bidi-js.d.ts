declare module 'bidi-js' {
    interface EmbeddingLevels {
        levels: Uint8Array;
        paragraphs: Array<{
            start: number;
            end: number;
            level: number;
        }>;
    }

    interface Bidi {
        getEmbeddingLevels(
            text: string,
            explicitDirection?: 'ltr' | 'rtl'
        ): EmbeddingLevels;
        getReorderSegments(
            text: string,
            embeddingLevels: EmbeddingLevels,
            start?: number,
            end?: number
        ): Array<[ number, number ]>;
        getMirroredCharactersMap(
            text: string,
            embeddingLevels: EmbeddingLevels,
            start?: number,
            end?: number
        ): Map<number, string>;
        getMirroredCharacter(text: string): string | null;
    }
    type BidiFactory = () => Bidi;
    const bidiFactory: BidiFactory;
    export default bidiFactory;
}