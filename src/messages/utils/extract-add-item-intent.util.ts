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

// Order-initiation verbs stripped before quantity detection so "quiero 3 tacos" → "3 tacos"
const ORDER_VERB_PREFIX = /^(?:quiero|dame|ponme|me\s+das?|me\s+da|pide|quisiera|deseo|ordenar?|ordena|agrega(?:r|me|rme)?|trae(?:r|me|rme)?|a[nñ]iade|a[nñ]ade|give\s+me|bring\s+me|please\s+give|je\s+voudrais?|주세요)\s+/i;

/**
 * Extracts quantity and optional notes (modifiers) from a user's add-item message.
 * e.g. "2 hamburguesas sin cebolla" → { quantity: 2, notes: "sin cebolla" }
 *
 * Numbers embedded inside product names (e.g. "pizza de 4 quesos") are NOT treated
 * as quantity — only a leading number (after optional order verbs) counts.
 */
export const extractAddItemIntentUtil = (message: string): AddItemIntent => {
    const lower = message.toLowerCase().trim();

    // Strip leading order verbs before quantity detection
    const stripped = lower.replace(ORDER_VERB_PREFIX, '').trim();

    // Only treat a LEADING digit as quantity (not embedded numbers like "pizza de 4 quesos")
    let quantity = 1;
    const leadingDigit = stripped.match(/^(\d+)\b/);
    if (leadingDigit) {
        const parsed = parseInt(leadingDigit[1]);
        if (parsed > 0 && parsed <= 20) quantity = parsed;
    } else {
        // Check for a leading word-number (e.g. "dos tacos", "quiero tres cervezas")
        for (const [word, num] of Object.entries(WORD_NUMBERS)) {
            if (new RegExp(`^${word}\\b`).test(stripped)) {
                quantity = num;
                break;
            }
        }
    }

    // Extract notes: text starting at the first note-prefix keyword
    const notesMatch = lower.match(new RegExp(NOTE_PREFIXES.source + '.*$', 'i'));
    const notes = notesMatch ? notesMatch[0].trim() : null;

    return { quantity, notes };
};
