export interface AddItemIntent {
    quantity: number;
    notes: string | null;
}

const WORD_NUMBERS: Record<string, number> = {
    uno: 1, una: 1, one: 1, un: 1, une: 1, 하나: 1,
    dos: 2, two: 2, deux: 2, 둘: 2,
    tres: 3, three: 3, trois: 3, 셋: 3,
    cuatro: 4, four: 4, quatre: 4, 넷: 4,
    cinco: 5, five: 5, cinq: 5, 다섯: 5,
    seis: 6, six: 6, 여섯: 6,
    siete: 7, seven: 7, sept: 7, 일곱: 7,
    ocho: 8, eight: 8, huit: 8, 여덟: 8,
    nueve: 9, nine: 9, neuf: 9, 아홉: 9,
    diez: 10, ten: 10, dix: 10, 열: 10,
};

const NOTE_PREFIXES = /\b(sin|con|extra|bien|muy|a\s+la|al|without|with\s+no|with|with\s+extra|sans|avec|없이|함께|por\s+favor|please)\b/i;

/**
 * Extracts quantity and optional notes (modifiers) from a user's add-item message.
 * e.g. "2 hamburguesas sin cebolla" → { quantity: 2, notes: "sin cebolla" }
 */
export const extractAddItemIntentUtil = (message: string): AddItemIntent => {
    const lower = message.toLowerCase().trim();

    // Extract numeric quantity
    let quantity = 1;
    const numMatch = lower.match(/\b(\d+)\b/);
    if (numMatch) {
        const parsed = parseInt(numMatch[1]);
        if (parsed > 0 && parsed <= 20) quantity = parsed;
    } else {
        for (const [word, num] of Object.entries(WORD_NUMBERS)) {
            if (new RegExp(`\\b${word}\\b`).test(lower)) {
                quantity = num;
                break;
            }
        }
    }

    // Extract notes: text after a note prefix keyword
    const notesMatch = lower.match(new RegExp(NOTE_PREFIXES.source + '.*$', 'i'));
    const notes = notesMatch ? notesMatch[0].trim() : null;

    return { quantity, notes };
};
