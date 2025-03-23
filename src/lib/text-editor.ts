/**
 * Much of the code here I created first for use in MiniPaint. I ported much of it over because it is
 * still applicable for general text editing, with modifications to support more advanced features.
 */

import { textMetaDefaults } from './text-common';

import type { TextDocument, TextDocumentLine, TextDocumentSpan, TextDocumentSpanMeta, TextDocumentSelectionState } from '@/types';

/**
 * This class's job is to modify the internal JSON format of a text layer.
 */
export class TextDocumentEditor {
    public document: TextDocument;
    public queuedMetaChanges: Partial<TextDocumentSpanMeta> | null = null;
	private notifyChangeHandlers: Array<() => void> = [];

    constructor(document: TextDocument) {
        this.document = document;
    }

	public setDocument(document: TextDocument) {
		this.document = document;
	}

	public onNotifyChange(handler: () => void) {
		this.notifyChangeHandlers.push(handler);
	}

    public notifyChange() {
        for (const handler of this.notifyChangeHandlers) {
			try {
				handler();
			} catch (error) { /* Ignore */ }
		}
    }

    /**
     * Get the number of lines in the document.
     */
    public getLineCount() {
        return this.document.lines.length;
    }

    /**
     * Returns the character length of the given line. This is not glyph count.
     * @param lineNumber - The number of the line to get the length of
     */
    public getLineCharacterCount(lineNumber: number) {
        return this.getLineText(lineNumber).length;
    }

    /**
     * Returns the text string at a given line (ignores formatting).
	 * @param lineNumber - The number of the line to get the text from
     */
    public getLineText(lineNumber: number) {
        let lineText = '';
		for (let i = 0; i < this.document.lines[lineNumber].spans.length; i++) {
			lineText += this.document.lines[lineNumber].spans[i].text;
		}
		return lineText;
    }

    /**
	 * Returns the position of the end of the the word at the line/character provided
	 * @param line - The reference line number (0 indexed) 
	 * @param character - The reference character position (0 indexed)
	 * @param noJump - Don't jump to the next word if at the end of current one
	 */
	public getWordEndPosition(line: number, character: number, noJump?: boolean): { line: number, character: number } {
		let newLine = line;
		let newCharacter = character;
		let fullText = this.getLineText(newLine);
		if (character === fullText.length && newLine < this.document.lines.length - 1) {
			if (noJump) {
				return { line, character };
			}
			newLine += 1;
			character = 0;
			fullText = this.getLineText(newLine);
		}
		const text = fullText.slice(character);
		if (noJump && text[0] === ' ') {
			return { line, character };
		}
		for (let i = 1; i < text.length; i++) {
			if (text[i] === ' ') {
				newCharacter = character + i;
				break;
			}
		}
		if (newCharacter === character) {
			newCharacter = fullText.length + 1;
		}
		return {
			line: newLine,
			character: newCharacter
		}
	}

    /**
	 * Returns the position of the start of the the word at the line/character provided
	 * @param line - The reference line number (0 indexed) 
	 * @param character - The reference character position (0 indexed)
	 * @param noJump - Don't jump to the next word if at the end of current one
	 */
	public getWordStartPosition(line: number, character: number, noJump?: boolean) {
		let newLine = line;
		let newCharacter = character;
		let isWrap = false;
		if (character === 0 && newLine > 0) {
			if (noJump) {
				return { line, character };
			}
			isWrap = true;
			newLine -= 1;
		}
		const fullText = this.getLineText(newLine);
		if (isWrap) {
			character = fullText.length;
		}
		const text = fullText.slice(0, character);
		if (noJump && text[text.length - 1] === ' ') {
			return { line, character };
		}
		for (let i = -1; i >= -text.length; i--) {
			if (text[i + text.length - 1] === ' ') {
				newCharacter = character + i;
				break;
			}
		}
		if (newCharacter === character) {
			newCharacter = 0;
		}
		return {
			line: newLine,
			character: newCharacter
		}
	}

    /**
	 * Determine if the metadata (formatting) of two text spans is the same, usually used to determine if the spans can be merged together.
	 */
	public isSameSpanMeta(meta1?: Partial<TextDocumentSpanMeta>, meta2?: Partial<TextDocumentSpanMeta>) {
        if (!meta1 || !meta2) return meta1 === meta2;
		const meta1Keys = Object.keys(meta1);
		const meta2Keys = Object.keys(meta2);
		if (meta1Keys.length !== meta2Keys.length) {
			return false;
		}
        meta1Keys.sort();
        meta2Keys.sort();
		for (let i = 0; i < meta1Keys.length; i++) {
			if (meta1Keys[i] !== meta2Keys[i]) {
				return false;
			}
			const meta1Value = meta1[meta1Keys[i] as keyof typeof meta1];
			const meta2Value = meta2[meta2Keys[i] as keyof typeof meta2];
			if (JSON.stringify(meta1Value) !== JSON.stringify(meta2Value)) {
				return false;
			}
		}
		return true;
	}

    /**
	 * Inserts a span with empty text in the document at the specified line and character position
	 * @param line - The line number to insert at (0 indexed) 
	 * @param character - The character position to insert at (0 indexed)
	 * @param meta - Metadata to associate with span
	 */
	private insertEmptySpan(line: number, character: number, meta: Partial<TextDocumentSpanMeta>): TextDocumentSpan | null {
		let insertedSpan: TextDocumentSpan | null = null;
		const lineDef = this.document.lines[line];
		let newLineSpans: TextDocumentSpan[] = [];
		let spanStartCharacter = 0;
		let wasInserted = false;
		for (let span of lineDef.spans) {
			if (!wasInserted && character >= spanStartCharacter && character <= spanStartCharacter + span.text.length) {
				let textBefore = span.text.slice(0, character - spanStartCharacter);
				let textAfter = span.text.slice(character - spanStartCharacter);
				if (textBefore.length > 0) {
					newLineSpans.push({
						text: textBefore,
						meta: JSON.parse(JSON.stringify(span.meta))
					});
				}
				const newMeta = JSON.parse(JSON.stringify(span.meta));
				for (let metaKey in meta) {
					newMeta[metaKey] = meta[metaKey as keyof typeof meta];
				}
				insertedSpan = {
					text: '',
					meta: newMeta
				};
				newLineSpans.push(insertedSpan);
				if (textAfter.length > 0) {
					newLineSpans.push({
						text: textAfter,
						meta: JSON.parse(JSON.stringify(span.meta))
					});
				}
				wasInserted = true;
			} else {
				newLineSpans.push(span);
			}
			spanStartCharacter += span.text.length;
		}
		this.document.lines[line].spans = newLineSpans;
		return insertedSpan;
	}

    /**
	 * Inserts a text string in the document at the specified line and character position
	 * @param text - The text string to insert
	 * @param line - The line number to insert at (0 indexed) 
	 * @param character - The character position to insert at (0 indexed)
	 */
	public insertText(text: string, line: number, character: number): { line: number, character: number } {

		let insertedSpan: TextDocumentSpan | null;
		if (this.queuedMetaChanges) {
			insertedSpan = this.insertEmptySpan(line, character, this.queuedMetaChanges);
			this.queuedMetaChanges = null;
		}

		const insertLine: TextDocumentLine = this.document.lines[line];
		const textHasNewline: boolean = text.includes('\n');
		let characterCount: number = 0;
		let modifyingSpan: TextDocumentSpan | null = null;
		let previousSpans: TextDocumentSpan[] = [];
		let nextSpans: TextDocumentSpan[] = [];
		let newLine: number = line;
		let newCharacter: number = character;

		// Insert text into span at specified line/character
		for (let i = 0; i < insertLine.spans.length; i++) {
			const span: TextDocumentSpan = insertLine.spans[i];
			const spanLength: number = span.text.length;
			if (!modifyingSpan && (character > characterCount || character === 0) && character <= characterCount + spanLength) {
				if (insertLine.spans[i + 1] && insertLine.spans[i + 1].text === '') {
					modifyingSpan = insertLine.spans[i + 1];
				} else {
					modifyingSpan = span;
				}
				const textIdx: number = character - characterCount;
				modifyingSpan.text = modifyingSpan.text.slice(0, textIdx) + text + modifyingSpan.text.slice(textIdx);
				if (!textHasNewline) {
					newCharacter = characterCount + textIdx + text.length;
					break;
				}
			} else if (textHasNewline) {
				if (modifyingSpan) {
					nextSpans.push(span);
				} else {
					previousSpans.push(span);
				}
			}
			characterCount += spanLength;
		}

		// Create new lines if newline character was used
		if (textHasNewline && modifyingSpan) {
			const modifiedSpans: TextDocumentSpan[] = [];
			const textLines: string[] = modifyingSpan.text.split('\n');
			for (let i = 0; i < textLines.length; i++) {
				modifiedSpans.push({
					meta: JSON.parse(JSON.stringify(modifyingSpan.meta)),
					text: textLines[i]
				});
			}
            const firstModifiedSpan = modifiedSpans.shift();
			this.document.lines[line].spans = [...previousSpans];
            if (firstModifiedSpan) this.document.lines[line].spans.push(firstModifiedSpan);
			for (let i = 0; i < modifiedSpans.length; i++) {
				if (i === modifiedSpans.length - 1) {
					if (!modifiedSpans[i].text && nextSpans.length > 0) {
						this.document.lines.splice(line + i + 1, 0, { spans: nextSpans });
					} else {
						this.document.lines.splice(line + i + 1, 0, { spans: [modifiedSpans[i], ...nextSpans] });
					}
					newLine = line + i + 1;
					newCharacter = text.length - 1 - text.lastIndexOf('\n');
				} else {
					this.document.lines.splice(line + i + 1, 0, { spans: [modifiedSpans[i]] });
				}
			}
		}

		// Notify change
        this.notifyChange();

		// Return end position
		return {
			line: newLine,
			character: newCharacter
		};
	}

    /**
	 * Deletes text within the specified range
	 * @param startLine - The starting line of the text range
	 * @param startCharacter - The character position at the starting line of the text range
	 * @param endLine - The ending line of the text range
	 * @param endCharacter - The character position at the ending line of the text range
	 */
	public deleteRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): { line: number, character: number } {
		// Check bounds
		startLine >= 0 || (startLine = 0);
		startCharacter >= 0 || (startCharacter = 0);
		endLine < this.document.lines.length || (endLine = this.document.lines.length - 1);
		const endLineCharacterCount = this.getLineCharacterCount(endLine);
		endCharacter <= endLineCharacterCount || (
			endCharacter = endLineCharacterCount
		);

		// Early return if there's nothing to delete
		if (startLine === endLine && startCharacter === endCharacter) {
			return {
				line: startLine,
				character: startCharacter
			};
		}

		// Get spans in start line before range
		const beforeSpans: TextDocumentSpan[] = [];
		const afterSpans: TextDocumentSpan[] = [];
		let characterCount: number = 0;
		let startSpan: TextDocumentSpan | null = null;
		let startSpanDeleteIndex: number = 0;
		for (let i = 0; i < this.document.lines[startLine].spans.length; i++) {
			const span: TextDocumentSpan = this.document.lines[startLine].spans[i];
			const spanLength: number = span.text.length;
			if (!startSpan && (startCharacter > characterCount || startCharacter === 0) && startCharacter <= characterCount + spanLength) {
				startSpan = span;
				startSpanDeleteIndex = Math.max(0, startCharacter - characterCount);
				break;
			}
			if (!startSpan) {
				beforeSpans.push(span);
			}
			characterCount += spanLength;
		}

		// Get spans in end line after range
		characterCount = 0;
		let endSpan: TextDocumentSpan | null = null;    
		let endSpanDeleteIndex: number = 0;
		for (let i = 0; i < this.document.lines[endLine].spans.length; i++) {
			const span: TextDocumentSpan = this.document.lines[endLine].spans[i];
			const spanLength: number = span.text.length;
			if (!endSpan && (endCharacter > characterCount || endCharacter === 0) && endCharacter <= characterCount + spanLength) {
				endSpan = span;
				endSpanDeleteIndex = Math.max(0, endCharacter - characterCount);
			} else if (endSpan) {
				afterSpans.push(span);
			}
			characterCount += spanLength;
		}

		// Merge start and end lines
		this.document.lines[startLine].spans = [...beforeSpans];

        if (startSpan && endSpan) {
            if (startSpan === endSpan || this.isSameSpanMeta(startSpan.meta, endSpan.meta)) {
                const combinedSpans: TextDocumentSpan = {
                    text: startSpan.text.slice(0, startSpanDeleteIndex) + endSpan.text.slice(endSpanDeleteIndex),
                    meta: startSpan.meta,
                };
                if (combinedSpans.text || (beforeSpans.length === 0 && afterSpans.length === 0)) {
                    this.document.lines[startLine].spans.push(combinedSpans);
                }
            } else {
                const middleSpans: TextDocumentSpan[] = [];
                let isAddedStartSpan: boolean = false;
                let isAddedEndSpan: boolean = false;
                if (startSpan) {
                    startSpan.text = startSpan.text.slice(0, startSpanDeleteIndex);
                    if (startSpan.text) {
                        middleSpans.push(startSpan);
                        isAddedStartSpan = true;
                    }
                }
                if (endSpan) {
                    endSpan.text = endSpan.text.slice(endSpanDeleteIndex)
                    if (endSpan.text || middleSpans.length === 0) {
                        middleSpans.push(endSpan);
                        isAddedEndSpan = true;
                    }
                }
                if (isAddedStartSpan && !isAddedEndSpan) {
                    const afterSpan = afterSpans[0];
                    if (afterSpan && this.isSameSpanMeta(startSpan.meta, afterSpan.meta)) {
                        afterSpans.shift();
                        startSpan.text += afterSpan.text;
                    }
                }
                else if (isAddedEndSpan && !isAddedStartSpan) {
                    const beforeSpan = beforeSpans[beforeSpans.length - 1];
                    if (beforeSpan && this.isSameSpanMeta(beforeSpan.meta, endSpan.meta)) {
                        beforeSpans.pop();
                        beforeSpan.text += endSpan.text;
                    }
                }
                else if (middleSpans.length === 0) {
                    const beforeSpan = beforeSpans[beforeSpans.length - 1];
                    const afterSpan = afterSpans[0];
                    if (beforeSpan && afterSpan && this.isSameSpanMeta(beforeSpan.meta, afterSpan.meta)) {
                        afterSpans.shift();
                        beforeSpan.text += afterSpan.text;
                    }
                }
                this.document.lines[startLine].spans = this.document.lines[startLine].spans.concat(middleSpans);
            }
        }
		this.document.lines[startLine].spans = this.document.lines[startLine].spans.concat(afterSpans);

		// Delete lines in-between range
		this.document.lines.splice(startLine + 1, endLine - startLine);

		// Notify change
        this.notifyChange();

		// Return new position
		return {
			line: startLine,
			character: startCharacter
		};
	}

    /**
	 * Deletes a single character in front or behind the specified character position, handling deleting new lines, etc.
	 * @param forward - True if deleting the next character, otherwise deletes the previous character
	 * @param startLine - The line number to delete from
	 * @param startCharacter - The character position to delete from
	 */
	public deleteCharacter(forward: boolean, startLine: number, startCharacter: number): { line: number, character: number } {
		let endLine: number = startLine;
		let endCharacter: number = startCharacter;
		
		// Delete forwards
		if (forward) {
			// If there are characters after cursor on this line we remove one
			if (startCharacter < this.getLineCharacterCount(startLine)) {
				++endCharacter;
			}
			// if there are Lines after this one we append it
			else if (startLine < this.document.lines.length - 1) {
				++endLine;
				endCharacter = 0;
			}
		}
		// Delete backwards
		else {
			// If there are characters before the cursor on this line we remove one
			if (startCharacter > 0) {
				--startCharacter;
			}
			// if there are rows before we append current to previous one
			else if (startLine > 0) {
				--startLine;
				startCharacter = this.getLineCharacterCount(startLine);
			}
		}

		return this.deleteRange(startLine, startCharacter, endLine, endCharacter);
	}

    /**
	 * Retrieves a metadata summary object for the specified range of text. 
	 * @param startLine - The starting line of the text range
	 * @param startCharacter - The character position at the starting line of the text range
	 * @param endLine - The ending line of the text range
	 * @param endCharacter - The character position at the ending line of the text range
	 */
	public getMetaRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): { [key: string]: any[] } {
		// Check bounds
		startLine >= 0 || (startLine = 0);
		startCharacter >= 0 || (startCharacter = 0);
		endLine < this.document.lines.length || (endLine = this.document.lines.length - 1);
		const endLineCharacterCount = this.getLineCharacterCount(endLine);
		endCharacter <= endLineCharacterCount || (
			endCharacter = endLineCharacterCount
		);
		const isEmpty = startLine === endLine && startCharacter === endCharacter;

		// Loop through all spans in range and collect meta values
		const metaCollection: { [key: string]: any[] } = {};
		for (const metaKey in textMetaDefaults) {
			metaCollection[metaKey] = [];
		}
		let isInsideRange = false;
		for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
			const line = this.document.lines[lineIndex];
			let spanStartCharacter = 0;
			let startSpan = null;
			let endSpan = null;
			for (let spanIndex = 0; spanIndex < line.spans.length; spanIndex++) {
				const span = line.spans[spanIndex];
				if (lineIndex === startLine) {
					if (
						(!isEmpty && startCharacter >= spanStartCharacter && startCharacter < spanStartCharacter + span.text.length) ||
						(isEmpty && startCharacter > spanStartCharacter && startCharacter <= spanStartCharacter + span.text.length) ||
						(startCharacter === 0 && spanStartCharacter === 0)
					) {
						isInsideRange = true;
						startSpan = span;
					}
				}
				if (lineIndex === endLine && isInsideRange) {
					if (
						(!isEmpty && endCharacter <= spanStartCharacter + span.text.length) ||
						(isEmpty && endCharacter < spanStartCharacter + span.text.length)
					) {
						endSpan = span;
						isInsideRange = false;
					}
				}
				if (isInsideRange || startSpan === span || (!isEmpty && endSpan === span)) {
					for (const metaKey in metaCollection) {
						let metaValue = span.meta[metaKey as keyof TextDocumentSpanMeta];
						if (metaValue == null) {
							metaValue = textMetaDefaults[metaKey as keyof TextDocumentSpanMeta];
						}
						let isInCollection = false;
						for (const existingValue of metaCollection[metaKey]) {
							if (existingValue?.is === 'color' && (metaValue as any)?.is == 'color') {
								isInCollection = existingValue?.style === (metaValue as any)?.style;
							} else {
								isInCollection = existingValue === metaValue;
							}
							if (isInCollection) break;
						}
						if (!isInCollection) {
							metaCollection[metaKey].push(metaValue);
						}
					}
				}
				spanStartCharacter += span.text.length;
			}
		}

		// Fill in default values for undefined meta keys
		for (const metaKey in textMetaDefaults) {
			if (metaCollection[metaKey].length === 0) {
				metaCollection[metaKey] = [textMetaDefaults[metaKey as keyof TextDocumentSpanMeta]];
			}
		}
		return metaCollection;
	}

    /**
	 * Sets styling metadata for the specified range of text. 
	 * @param startLine - The starting line of the text range
	 * @param startCharacter - The character position at the starting line of the text range
	 * @param endLine - The ending line of the text range
	 * @param endCharacter - The character position at the ending line of the text range
	 * @param meta - The meta to set
	 */
	public setMetaRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number, meta: Partial<TextDocumentSpanMeta>) {
		// Check bounds
		startLine >= 0 || (startLine = 0);
		startCharacter >= 0 || (startCharacter = 0);
		endLine < this.document.lines.length || (endLine = this.document.lines.length - 1);
		const endLineCharacterCount = this.getLineCharacterCount(endLine);
		endCharacter <= endLineCharacterCount || (
			endCharacter = endLineCharacterCount
		);

		// Set meta of spans in selection
		let isInsideRange = false;
		for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
			const line: TextDocumentLine = this.document.lines[lineIndex];
			let newLine: TextDocumentSpan[] = [];
			let spanStartCharacter: number = 0;
			for (let span of line.spans) {
				const spanText = span.text;
				const spanLength = spanText.length;
				if (lineIndex === startLine) {
					if (startCharacter <= spanStartCharacter) {
						isInsideRange = true;
					}
				}
				if (lineIndex === endLine) {
					if (endCharacter < spanStartCharacter + spanLength) {
						isInsideRange = false;
					}
				}
				// Selection start splits the span it's inside of
				let choppedStartCharacters = 0;
				if (startCharacter > spanStartCharacter && startCharacter < spanStartCharacter + spanLength && lineIndex === startLine) {
					choppedStartCharacters = startCharacter - spanStartCharacter;
					newLine.push({
						text: span.text.slice(0, startCharacter - spanStartCharacter),
						meta: JSON.parse(JSON.stringify(span.meta))
					});
					span.text = span.text.slice(startCharacter - spanStartCharacter);
					isInsideRange = true;
				}
				newLine.push(span);
				// Selection end splits the span it's inside of
				if (endCharacter > spanStartCharacter && endCharacter < spanStartCharacter + spanLength && lineIndex === endLine) {
					newLine.push({
						text: span.text.slice(endCharacter - spanStartCharacter - choppedStartCharacters),
						meta: JSON.parse(JSON.stringify(span.meta))
					});
					span.text = span.text.slice(0, endCharacter - spanStartCharacter - choppedStartCharacters);
					isInsideRange = true;
				}
				// Add meta to span
				if (isInsideRange) {
					for (const metaKey in meta) {
						span.meta[metaKey as keyof TextDocumentSpanMeta] = meta[metaKey as keyof TextDocumentSpanMeta] as never;
					}
				}
				spanStartCharacter += spanLength;
			}
			this.document.lines[lineIndex].spans = newLine;
		}

		this.normalize(startLine, endLine);

		// Notify change
        this.notifyChange();
	}

	/**
	 * Queues a change to the meta for the next text edit
	 */
	public queueMetaChange(name: keyof TextDocumentSpanMeta, value: any) {
		if (this.queuedMetaChanges == null) {
			this.queuedMetaChanges = {};
		}
		this.queuedMetaChanges[name] = value;
	}

    /**
	 * Merges sibling spans that have the same metadata, and removes empty spans. 
	 * @param startLine - The starting line of the text range
	 * @param endLine - The ending line of the text range
	 */
	public normalize(startLine: number, endLine: number) {
		for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
			const line: TextDocumentLine = this.document.lines[lineIndex];
			let spanIndex = 0;
			for (spanIndex = 0; spanIndex < line.spans.length; spanIndex++) {
				const span1 = line.spans[spanIndex];
				const span2 = line.spans[spanIndex + 1];
				if (span1 && span2 && this.isSameSpanMeta(span1.meta, span2.meta)) {
					line.spans[spanIndex] = {
						text: span1.text + span2.text,
						meta: span1.meta
					};
					line.spans.splice(spanIndex + 1, 1);
					spanIndex--;
					continue;
				}
				if (span1.text === '' && line.spans.length > 1) {
					line.spans.splice(spanIndex, 1);
					spanIndex--;
					continue;
				}
			}
		}
	}

	/**
	 * Calling this may help the browser with memory clean up.
	 */
	public dispose() {
		(this.document as unknown) = undefined;
		(this.queuedMetaChanges as unknown) = undefined;
		(this.notifyChangeHandlers as unknown) = undefined;
	}

}


/**
 * This class represents a single selection range in a text editor's document.
 */
export class TextDocumentSelection {
    private documentEditor: TextDocumentEditor;

    public isActiveSideEnd: boolean = true;

    public start: { line: number, character: number };
    public end: { line: number, character: number };

	private notifyChangeHandlers: Array<() => void> = [];

    constructor(documentEditor: TextDocumentEditor) {
		this.documentEditor = documentEditor;

		this.start = {
			line: 0,
			character: 0
		};
		
		this.end = {
			line: 0,
			character: 0
		};

		this.setPosition(0, 0);
	}

	public onNotifyChange(handler: () => void) {
		this.notifyChangeHandlers.push(handler);
	}

    public notifyChange() {
        for (const handler of this.notifyChangeHandlers) {
			try {
				handler();
			} catch (error) { /* Ignore */ }
		}
    }

	public getSelectionState(): TextDocumentSelectionState {
		return {
			isActiveSideEnd: this.isActiveSideEnd,
    		start: this.start,
    		end: this.end,
		}
	}

    /**
	 * Returns if the current text selection contains no characters
	 */
	public isEmpty(): boolean {
		return this.comparePosition(this.start.line, this.start.character, this.end.line, this.end.character) === 0;
	}

    /**
	 * Determines the relative position of two line/character sets.
	 * @param line1
	 * @param character1 
	 * @param line2 
	 * @param character2
	 * @returns -1 if line1/character1 is less than line2/character2, 1 if greater, and 0 if equal
	 */
    public comparePosition(line1: number, character1: number, line2: number, character2: number) {
		if (line1 < line2) {
			return -1;
		} else if (line1 > line2) {
			return 1;
		} else {
			if (character1 < character2) {
				return -1;
			} else if (character1 > character2) {
				return 1;
			} else {
				return 0;
			}
		}
	}

    /**
	 * Sets the head position of the selection to the specified line/character, optionally extends to selection to that position.
	 * @param line - The line number to set the selection to 
	 * @param character - The character index to set the selection to
	 * @param [keepSelection] - If true, extends the current selection to the specified position. If false or undefined, sets an empty selection at that position. 
	 */
	public setPosition(line: number | null, character: number | null, keepSelection?: boolean) {
		if (line == null) {
			line = this.end.line;
		}
		if (character == null) {
			character = this.end.character;
		}

		// Check lower bounds
		line >= 0 || (line = 0);
		character >= 0 || (character = 0);

		// Check upper bounds
		const lineCount = this.documentEditor.getLineCount();
		line < lineCount || (line = lineCount - 1);
		const lineCharacterCount = this.documentEditor.getLineCharacterCount(line);
		character <= lineCharacterCount || (character = lineCharacterCount);

		// Add to selection
		if (keepSelection) {
			const positionCompare: number = this.comparePosition(
				line,
				character,
				this.start.line,
				this.start.character
			);

			// Determine whether we should make the start side of the range active, selection moving left or up.
			if (positionCompare === -1 && (this.isEmpty() || line < this.start.line)) {
				this.isActiveSideEnd = false;
			}

			// Assign new value to the side that is active
			if (this.isActiveSideEnd) {
				this.end.line = line;
				this.end.character = character;
			} else {
				this.start.line = line;
				this.start.character = character;
			}

			// Making sure that end is greater than start and swap if necessary
			if (this.comparePosition(this.start.line, this.start.character, this.end.line, this.end.character) > 0) {
				this.isActiveSideEnd = !this.isActiveSideEnd;
				const temp = {
					line: this.start.line,
					character: this.start.character
				}
				this.start.line = this.end.line;
				this.start.character = this.end.character;
				this.end.line = temp.line;
				this.end.character = temp.character;
			}
		}
		// Empty cursor move
		else {
			this.isActiveSideEnd = true;
			this.start.line = this.end.line = line;
			this.start.character = this.end.character = character;
		}

		this.notifyChange();
	}

    /**
	 * Retrieves the position of the head of the selection (could be the start or end of the selection based on previous operations)
	 */
	public getPosition(): { line: number, character: number } {
		if (this.isActiveSideEnd) {
			return {
				character: this.end.character,
				line: this.end.line
			};
		} else {
			return {
				character: this.start.character,
				line: this.start.line
			};
		}
	}

    /**
	 * Gets the plain text value in the current selection range.
	 */
	public getText(): string {
		const positionCompare = this.comparePosition(this.start.line, this.start.character, this.end.line, this.end.character);
		const firstLine = positionCompare === 1 ? this.end.line : this.start.line;
		const lastLine = positionCompare === 1 ? this.start.line : this.end.line;
		const firstCharacter = positionCompare === 1 ? this.end.character : this.start.character;
		const lastCharacter = positionCompare === 1 ? this.start.character : this.end.character;
		let textLines = [];
		for (let i = firstLine; i <= lastLine; i++) {
			if (i === firstLine && i === lastLine) {
				textLines.push(this.documentEditor.getLineText(i).slice(firstCharacter, lastCharacter));
			} else if (i === firstLine) {
				textLines.push(this.documentEditor.getLineText(i).slice(firstCharacter));
			} else if (i === lastLine) {
				textLines.push(this.documentEditor.getLineText(i).slice(0, lastCharacter));
			} else {
				textLines.push(this.documentEditor.getLineText(i));
			}
		}
		return textLines.join('\n');
	}

    /**
	 * Moves the cursor to a previous line.
	 * @param length - The number of lines to move 
	 * @param keepSelection - Whether to move to an empty selection or extend the current selection
	 */
	public moveLinePrevious(length: number, keepSelection?: boolean) {
		length = length == null ? 1 : length;
		const position = this.getPosition();
		this.setPosition(position.line - length, null, keepSelection);
	}

    /**
	 * Moves the cursor to a next line.
	 * @param length - The number of lines to move 
	 * @param keepSelection - Whether to move to an empty selection or extend the current selection
	 */
	public moveLineNext(length: number, keepSelection?: boolean) {
		length = length == null ? 1 : length;
		const position = this.getPosition();
		this.setPosition(position.line + length, null, keepSelection);
	}

    /**
	 * Moves to the start of the current line.
	 * @param keepSelection - Whether to move to an empty selection or extend the current selection 
	 */
	public moveLineStart(keepSelection?: boolean) {
		const position = this.getPosition();
		this.setPosition(position.line, 0, keepSelection);
	}

    /**
	 * Moves to the end of the current line.
	 * @param keepSelection - Whether to move to an empty selection or extend the current selection 
	 */
	public moveLineEnd(keepSelection?: boolean) {
		const position = this.getPosition();
		this.setPosition(position.line, this.documentEditor.getLineCharacterCount(position.line), keepSelection);
	}

    /**
	 * Moves the cursor to a character behind in the document, handles line wrapping.
	 * @param length - The number of characters to move 
	 * @param keepSelection - Whether to move to an empty selection or extend the current selection 
	 */
	public moveCharacterPrevious(length: number, keepSelection?: boolean) {
		length = length == null ? 1 : length;
		const position = this.getPosition();
		if (position.character - length < 0) {
			if (position.line > 0) {
				this.setPosition(position.line - 1, this.documentEditor.getLineCharacterCount(position.line - 1), keepSelection);
			}
		} else {
			this.setPosition(position.line, position.character - length, keepSelection);
		}
	}

    /**
	 * Moves the cursor to a character ahead in the document, handles line wrapping.
	 * @param length - The number of characters to move 
	 * @param keepSelection - Whether to move to an empty selection or extend the current selection 
	 */
	public moveCharacterNext(length: number, keepSelection?: boolean) {
		length = length == null ? 1 : length;
		const position = this.getPosition();
		const characterCount = this.documentEditor.getLineCharacterCount(position.line);
		if (position.character + length > characterCount) {
			if (position.line + 1 < this.documentEditor.getLineCount()) {
				this.setPosition(position.line + 1, 0, keepSelection);
			}
		} else {
			this.setPosition(position.line, position.character + length, keepSelection);
		}
	}

    /**
	 * Moves the cursor to the beginning of the current word or previous word, handles line wrapping.
	 * @param keepSelection - Whether to move to an empty selection or extend the current selection 
	 */
	public moveWordPrevious(keepSelection?: boolean) {
		const position = this.getPosition();
		const newPosition = this.documentEditor.getWordStartPosition(position.line, position.character);
		this.setPosition(newPosition.line, newPosition.character, keepSelection);
	}

    /**
	 * Moves the cursor to the end of the current word or next word, handles line wrapping.
	 * @param keepSelection - Whether to move to an empty selection or extend the current selection 
	 */
	public moveWordNext(keepSelection?: boolean) {
		const position = this.getPosition();
		const newPosition = this.documentEditor.getWordEndPosition(position.line, position.character);
		this.setPosition(newPosition.line, newPosition.character, keepSelection);
	}

	/**
	 * Calling this may help the browser with memory clean up.
	 */
	 public dispose() {
		(this.documentEditor as unknown) = undefined;
		(this.notifyChangeHandlers as unknown) = undefined;
	}

}

/**
 * This class represents static utility functions that operate on an editor + selection.
 */

export class TextDocumentEditorWithSelection {

	/** Inserts text at the specified selection position in the document. */
	static insertTextAtCurrentPosition(documentEditor: TextDocumentEditor, documentSelection: TextDocumentSelection, text: string, selectText: boolean = false) {
		if (!documentSelection.isEmpty()) {
			TextDocumentEditorWithSelection.deleteCharacterAtCurrentPosition(documentEditor, documentSelection);
		}
		const position = documentSelection.getPosition();
		const newPosition = documentEditor.insertText(text, position.line, position.character);
		if (selectText) {
			documentSelection.setPosition(position.line, position.character);
			documentSelection.setPosition(newPosition.line, newPosition.character, true);
		} else {
			documentSelection.setPosition(newPosition.line, newPosition.character);
		}
	}

	/** Deletes the character at the cursor specified by the selection. */
	static deleteCharacterAtCurrentPosition(documentEditor: TextDocumentEditor, documentSelection: TextDocumentSelection, forward: boolean = false) {
		let newPosition;
		if (documentSelection.isEmpty()) {
			const position = documentSelection.getPosition();
			newPosition = documentEditor.deleteCharacter(forward, position.line, position.character);
		} else {
			newPosition = documentEditor.deleteRange(
				documentSelection.start.line,
				documentSelection.start.character,
				documentSelection.end.line,
				documentSelection.end.character
			);
		}
		documentSelection.setPosition(newPosition.line, newPosition.character);
	}

	/** Deletes the range from the document specified by the selection. */
	static deleteSelection(documentEditor: TextDocumentEditor, documentSelection: TextDocumentSelection) {
		let newPosition = documentEditor.deleteRange(
			documentSelection.start.line,
			documentSelection.start.character,
			documentSelection.end.line,
			documentSelection.end.character
		);
		documentSelection.setPosition(newPosition.line, newPosition.character);
	}
}
