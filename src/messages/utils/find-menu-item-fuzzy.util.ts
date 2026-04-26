import { MenuItem } from '../../menus/entities/menu-item.entity';
import { normalizeProductName } from '../../common/utils/normalize-product-name';

/**
 * Finds the best matching active menu item for a given user query using word overlap scoring.
 * Returns null if no item exceeds the confidence threshold.
 */
export const findMenuItemFuzzyUtil = (
    query: string,
    menuItems: MenuItem[],
): MenuItem | null => {
    if (!query || !menuItems?.length) return null;

    const normalizedQuery = normalizeProductName(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);

    if (queryWords.length === 0) return null;

    let bestItem: MenuItem | null = null;
    let bestScore = 0;

    for (const item of menuItems) {
        if (!item.isActive || !item.product) continue;

        const productNorm = item.product.normalizedName || normalizeProductName(item.product.name);
        const productWords = productNorm.split(/\s+/).filter(w => w.length > 2);

        if (productWords.length === 0) continue;

        let matchCount = 0;
        for (const qw of queryWords) {
            if (productWords.some(pw => pw === qw || pw.startsWith(qw) || qw.startsWith(pw))) {
                matchCount++;
            }
        }

        if (matchCount === 0) continue;

        const score = matchCount / productWords.length;

        if (score > bestScore) {
            bestScore = score;
            bestItem = item;
        }
    }

    // Require at least 0.25 score to avoid false positives
    return bestScore >= 0.25 ? bestItem : null;
};
