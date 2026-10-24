
import knowledge from './supplier_knowledge.json';

export interface RAGResult {
    id: string;
    source: string;
    section: string;
    content: string;
    score: number;
}

interface KnowledgeItem {
    id: string;
    source: string;
    section: string;
    content: string;
}

/**
 * A very simple keyword-based search for the RAG demo.
 */
export function searchSupplierKnowledge(query: string): RAGResult[] {
    const keywords = query.toLowerCase()
        .replace(/[?¿!¡,.]/g, '')
        .split(/\s+/)
        .filter(k => k.length > 3); // Simple filter for significant words

    if (keywords.length === 0) return [];

    const results = (knowledge as KnowledgeItem[]).map(item => {
        let score = 0;
        const lowerContent = item.content.toLowerCase();
        const lowerSection = item.section.toLowerCase();

        keywords.forEach(kw => {
            if (lowerContent.includes(kw)) score += 1;
            if (lowerSection.includes(kw)) score += 2; // Weight sections higher
        });

        return { ...item, score };
    });

    // Return top 3 results with score > 0
    return results
        .filter((r: RAGResult) => r.score > 0)
        .sort((a: RAGResult, b: RAGResult) => b.score - a.score)
        .slice(0, 3);
}
