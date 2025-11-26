import { BotResponse } from '../types/schema';
import fs from 'fs';
import path from 'path';

export interface Document {
  id: string;
  title: string;
  url: string;
  content: string;
  embedding?: number[];
}

export interface DocsIndex {
  documents: Document[];
  last_updated: string;
}

// Load docs index
function loadDocsIndex(): DocsIndex | null {
  try {
    const indexPath = path.join(__dirname, '../../data/docs.index.json');
    if (!fs.existsSync(indexPath)) {
      return null;
    }
    const data = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading docs index:', error);
    return null;
  }
}

// Stub function for future embedding-based retrieval
// In production, this would use Azure OpenAI or AWS Bedrock embeddings
export async function generateEmbedding(text: string): Promise<number[]> {
  // Stub: return a zero vector
  // In production, call HIPAA-compliant embedding service:
  // const response = await azureOpenAI.embeddings.create({ input: text, model: 'text-embedding-ada-002' });
  // return response.data[0].embedding;
  return new Array(1536).fill(0);
}

// Simple keyword-based retrieval (fallback until embeddings are integrated)
function keywordSearch(query: string, documents: Document[]): Document[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const scored = documents.map(doc => {
    const content = (doc.title + ' ' + doc.content).toLowerCase();
    const score = keywords.reduce((sum, keyword) => {
      return sum + (content.includes(keyword) ? 1 : 0);
    }, 0);
    return { doc, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.doc);
}

// Cosine similarity for vector comparison
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return magA && magB ? dotProduct / (magA * magB) : 0;
}

// Retrieve relevant documents
export async function retrieveDocuments(query: string): Promise<Document[]> {
  const index = loadDocsIndex();
  if (!index || index.documents.length === 0) {
    return [];
  }

  // If embeddings are available, use vector search
  const hasEmbeddings = index.documents.some(doc => doc.embedding && doc.embedding.length > 0);
  
  if (hasEmbeddings) {
    const queryEmbedding = await generateEmbedding(query);
    const scored = index.documents.map(doc => ({
      doc,
      score: doc.embedding ? cosineSimilarity(queryEmbedding, doc.embedding) : 0,
    }));
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.doc);
  }

  // Fallback to keyword search
  return keywordSearch(query, index.documents);
}

// Generate response from retrieved documents
export async function generateRetrievalResponse(query: string): Promise<BotResponse | null> {
  const docs = await retrieveDocuments(query);
  
  if (docs.length === 0) {
    return null;
  }

  // Summarize top result (keeping under 400 chars as specified)
  const topDoc = docs[0];
  const summary = topDoc.content.substring(0, 400);
  
  return {
    text: summary,
    links: [
      {
        title: topDoc.title,
        url: topDoc.url,
        description: 'Learn more',
      },
    ],
    buttons: [
      { label: 'Yes ✅', value: 'resolved' },
      { label: 'No — Contact me 📞', value: 'contact_me' },
    ],
    next_state: 'awaiting_user_choice',
  };
}
