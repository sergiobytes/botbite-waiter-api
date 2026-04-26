import { MenuItem } from '../../menus/entities/menu-item.entity';
import { normalizeProductName } from '../../common/utils/normalize-product-name';
import { removeStopwordsUtil } from './detect-stopwords.util';

const FUZZY_THRESHOLD = 0.4;

/**
 * Scores how well a query matches a single MenuItem.
 * Returns a value in [0, 1]; higher is better.
 */
export const scoreMenuItem = (query: string, item: MenuItem): number => {
    if (!item.isActive || !item.product) return 0;

    const cleaned = removeStopwordsUtil(query);
    if (!cleaned) return 0;

    const normQuery = normalizeProductName(cleaned);
    const queryWords = normQuery.split(/\s+/).filter(w => w.length > 1);
    if (queryWords.length === 0) return 0;

    const productNorm = item.product.normalizedName || normalizeProductName(item.product.name);
    const productWords = productNorm.split(/\s+/).filter(w => w.length > 1);
    if (productWords.length === 0) return 0;

    let matchCount = 0;
    for (const qw of queryWords) {
        if (productWords.some(pw => pw === qw || pw.startsWith(qw) || qw.startsWith(pw))) {
            matchCount++;
        }
    }

    if (matchCount === 0) return 0;

    // Score = fraction of product words matched, bonus for matching query words too
    const productCoverage = matchCount / productWords.length;
    const queryCoverage = matchCount / queryWords.length;
    return (productCoverage + queryCoverage) / 2;
};

/**
 * Finds the best matching active menu item for a given user query.
 * Applies stopword removal and requires score ≥ 0.4 to avoid false positives.
 */
export const findMenuItemFuzzyUtil = (
    query: string,
    menuItems: MenuItem[],
): MenuItem | null => {
    if (!query || !menuItems?.length) return null;

    let bestItem: MenuItem | null = null;
    let bestScore = 0;

    for (const item of menuItems) {
        const score = scoreMenuItem(query, item);
        if (score > bestScore) {
            bestScore = score;
            bestItem = item;
        }
    }

    return bestScore >= FUZZY_THRESHOLD ? bestItem : null;
};

/**
 * Returns the match type for a query against menu items:
 * - 'exact'   → one item scores ≥ 0.4 (clear match)
 * - 'partial' → query word matches a category name but no item scores ≥ 0.4
 * - 'mixed'   → multiple items score between 0.15–0.39 (confusing combination)
 * - 'none'    → no meaningful match at all
 */
export type FuzzyMatchType = 'exact' | 'partial' | 'mixed' | 'none';

export const classifyMenuMatch = (
    query: string,
    menuItems: MenuItem[],
): { type: FuzzyMatchType; item?: MenuItem } => {
    if (!query || !menuItems?.length) return { type: 'none' };

    const cleaned = removeStopwordsUtil(query);
    if (!cleaned) return { type: 'none' };

    let bestItem: MenuItem | null = null;
    let bestScore = 0;
    let aboveFloorCount = 0;

    for (const item of menuItems) {
        const score = scoreMenuItem(query, item);
        if (score >= 0.15) aboveFloorCount++;
        if (score > bestScore) {
            bestScore = score;
            bestItem = item;
        }
    }

    if (bestScore >= FUZZY_THRESHOLD) {
        return { type: 'exact', item: bestItem! };
    }

    // Check if query word appears in any category name → "partial" (e.g. "cerveza" → "CERVEZAS")
    const normCleaned = normalizeProductName(cleaned);
    const queryWords = normCleaned.split(/\s+/).filter(w => w.length > 2);
    const categories = new Set(menuItems.map(i => normalizeProductName(i.category?.name ?? '')));

    for (const qw of queryWords) {
        for (const cat of categories) {
            if (cat.includes(qw) || qw.includes(cat.replace(/S$/, ''))) {
                return { type: 'partial' };
            }
        }
    }

    // Multiple items weakly match → "mixed" (combining elements from different products)
    if (aboveFloorCount >= 2 && bestScore >= 0.15) {
        return { type: 'mixed' };
    }

    return { type: 'none' };
};

