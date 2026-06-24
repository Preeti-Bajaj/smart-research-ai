import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

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
// THE ACTION: Embeds query natively and runs vector search
// =====================================================
export const performSimilaritySearch = action({
  args: {
    query: v.string(),
    fileId: v.string(),
    limit: v.optional(v.number()), 
  },
  handler: async (ctx, args): Promise<{ chunks: SearchChunk[]; matchCount: number }> => {
    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY is missing in Convex Environment Variables!");
      }

      console.log(`🔍 Generating search vector for query: "${args.query}"`);

      // 🚀 Use gemini-embedding-001 natively so it perfectly matches ingestion
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text: args.query }] },
            outputDimensionality: 768, 
            taskType: "RETRIEVAL_QUERY"
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const queryVector = data?.embedding?.values;

      console.log("Query vector length:", queryVector?.length);
      console.log("First 3 values:", queryVector?.slice(0, 3));

      if (!queryVector || queryVector.length !== 768) {
        throw new Error(`Failed to generate 768-dimension query vector. Got length: ${queryVector?.length}`);
      }

      console.log("✅ Query vector generated successfully! Searching database...");

      const searchResults = await ctx.vectorSearch("documents", "byEmbedding", {
        vector: queryVector,
        limit: args.limit ?? 5, 
        filter: (q) => q.eq("fileId", args.fileId), 
      });

      console.log("Raw search results:", searchResults.length);
      if (searchResults.length > 0) {
        console.log("Top similarity score:", searchResults[0]._score);
      }

      if (searchResults.length === 0) {
        console.log("⚠️ No matching chunks found in the database.");
        return { chunks: [], matchCount: 0 };
      }

      const mappedResults = searchResults.map((result) => ({
        id: result._id,
        score: result._score,
      }));
      
      const relevantChunks: SearchChunk[] = await ctx.runQuery(
        internal.search.fetchDocumentTexts, 
        { results: mappedResults }
      );

      console.log(`🎯 Found ${relevantChunks.length} highly relevant chunks!`);

      return {
        chunks: relevantChunks,
        matchCount: relevantChunks.length,
      };

    } catch (error) {
      console.error("❌ Similarity Search Failed:", error);
      throw new Error("Failed to perform vector search");
    }
  },
});