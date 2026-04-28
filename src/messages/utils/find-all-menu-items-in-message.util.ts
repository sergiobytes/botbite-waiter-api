import { MenuItem } from '../../menus/entities/menu-item.entity';
import { extractAddItemIntentUtil } from './extract-add-item-intent.util';
import { removeStopwordsUtil } from './detect-stopwords.util';
import { findMenuItemFuzzyUtil, scoreMenuItem } from './find-menu-item-fuzzy.util';

export interface FoundOrderItem {
    item: MenuItem;
    quantity: number;
    notes: string | null;
}

/**
 * Splits a user message into segments (by conjunctions / commas) and finds
 * ALL menu items mentioned. Items already matched are not re-matched.
 *
 * Returns an array of { item, quantity, notes } for each product found.
 * Returns an empty array if nothing matches.
 */
export const findAllMenuItemsInMessage = (
    message: string,
    menuItems: MenuItem[],
): FoundOrderItem[] => {
    if (!message || !menuItems?.length) return [];

    // Split on conjunctions / list separators
    const segments = message
        .split(/\s*[,;]\s*|\s+(?:y|and|et|와|tambien|también|también|además|ademas|plus|aussi)\s+/i)
        .map(s => s.trim())
        .filter(s => removeStopwordsUtil(s).length > 0);

    const results: FoundOrderItem[] = [];
    const usedItemIds = new Set<string>();

    for (const segment of segments) {
        const found = findMenuItemFuzzyUtil(segment, menuItems);
        if (found && !usedItemIds.has(found.id)) {
            const { quantity, notes } = extractAddItemIntentUtil(segment);
            results.push({ item: found, quantity, notes });
            usedItemIds.add(found.id);
        }
    }

    // If single-segment message matched nothing, try to find multiple items
    // by scoring all items and picking top distinct ones (for "hamburguesa y cerveza" typed together)
    if (results.length === 0 && segments.length === 1) {
        const cleaned = removeStopwordsUtil(message);
        const words = cleaned.split(/\s+/).filter(w => w.length > 2);

        if (words.length >= 2) {
            // Try each word as a potential product query
            for (const word of words) {
                const found = findMenuItemFuzzyUtil(word, menuItems);
                if (found && !usedItemIds.has(found.id)) {
                    // Only add if this single word scores well on its own
                    const s = scoreMenuItem(word, found);
                    if (s >= 0.5) {
                        results.push({ item: found, quantity: 1, notes: null });
                        usedItemIds.add(found.id);
                    }
                }
            }
        }
    }

    return results;
};
