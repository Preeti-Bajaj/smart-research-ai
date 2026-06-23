import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { internal } from "./_generated/api";

// 1. Define the explicit type to break the circular dependency loop
type SearchChunk = {
  text: string;
  score: number;
  chunkIndex?: number;
  pageNumber?: number;
};

// =====================================================
// THE INTERNAL QUERY: Retrieves text from the DB
// =====================================================
export const fetchDocumentTexts = internalQuery({
  args: {
    results: v.array(
      v.object({
        id: v.id("documents"),
        score: v.number(),
      })
    ),
  },
  // Explicitly define the return type here
  handler: async (ctx, args): Promise<SearchChunk[]> => {
    const fetchPromises = args.results.map(async (searchResult) => {
      const doc = await ctx.db.get(searchResult.id);
      if (!doc) return null;
      
      return {
        text: doc.text,
        score: searchResult.score, 
        chunkIndex: doc.metadata.chunkIndex,
        pageNumber: doc.metadata.pageNumber, 
      };
    });

    const rawChunks = await Promise.all(fetchPromises);
    
    return rawChunks.filter(
      (chunk): chunk is NonNullable<typeof chunk> => chunk !== null
    );
  },
});

// =====================================================
// THE ACTION: Embeds query and runs vector search
// =====================================================
export const performSimilaritySearch = action({
  args: {
    query: v.string(),
    fileId: v.string(),
    limit: v.optional(v.number()), 
  },
  // Explicitly define the return type here as well
  handler: async (ctx, args): Promise<{ chunks: SearchChunk[]; matchCount: number }> => {
    try {
      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY,
        model: "text-embedding-004", 
        taskType: TaskType.RETRIEVAL_QUERY, 
      });

      const queryVector = await embeddings.embedQuery(args.query);

      const searchResults = await ctx.vectorSearch("documents", "byEmbedding", {
        vector: queryVector,
        limit: args.limit ?? 5, 
        filter: (q) => q.eq("fileId", args.fileId), 
      });

      if (searchResults.length === 0) {
        return { chunks: [], matchCount: 0 };
      }

      const mappedResults = searchResults.map((result) => ({
        id: result._id,
        score: result._score,
      }));
      
      // The cleaner, strict type annotation
      const relevantChunks: SearchChunk[] = await ctx.runQuery(
        internal.search.fetchDocumentTexts, 
        { results: mappedResults }
      );

      return {
        chunks: relevantChunks,
        matchCount: relevantChunks.length,
      };

    } catch (error) {
      console.error("Similarity Search Failed:", error);
      throw new Error("Failed to perform vector search");
    }
  },
});