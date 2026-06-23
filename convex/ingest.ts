import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api"; 

// 1. The Action: Calls Gemini API to generate vectors natively
export const processChunks = action({
  args: {
    fileId: v.string(),
    chunks: v.array(v.string()),
    totalPages: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY is missing in Convex Environment Variables!");
      }

      console.log(`🚀 Sending ${args.chunks.length} chunks to Gemini REST API natively...`);
      
      const vectors: number[][] = [];
      const BATCH_SIZE = 100; // Google's API limit is 100 per request

      // Process in batches to handle very large PDFs safely
      for (let i = 0; i < args.chunks.length; i += BATCH_SIZE) {
        const batchChunks = args.chunks.slice(i, i + BATCH_SIZE);
        
        // 🚀 THE FIX: Use the new gemini-embedding-001 model and scale it down to 768 dimensions
        const requests = batchChunks.map((chunk) => ({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: chunk }] },
          outputDimensionality: 768, // Forces the new model to fit your database schema
        }));

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requests }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Google API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        // Extract the arrays natively 
        const batchVectors = data.embeddings.map((e: any) => e.values);
        vectors.push(...batchVectors);
      }

      // Debug logs to verify vector health
      console.log("First vector (snippet):", vectors[0]?.slice(0, 3), "...");
      console.log("Vector count:", vectors.length);
      console.log("First vector length:", vectors[0]?.length);

      if (!vectors[0] || vectors[0].length === 0) {
        throw new Error("Native fetch returned empty arrays! Check your Gemini API key and quota.");
      }

      console.log(`✅ Success! Generated ${vectors.length} vectors.`);
      console.log(`📏 Vector Dimension Size: ${vectors[0]?.length}`);
      console.log("==========================================");

      // Pass the vectors to our internal database mutation
      await ctx.runMutation(internal.ingest.saveEmbeddings, {
        fileId: args.fileId,
        chunks: args.chunks,
        vectors: vectors,
        totalPages: args.totalPages,
      });

    } catch (error) {
      console.error("❌ Embedding generation failed:", error);
      
      await ctx.runMutation(api.fileStorage.updateFileDetails, {
        fileId: args.fileId,
        status: "failed",
      });
      
      throw error;
    }
  },
});

// 2. The Internal Mutation: Safely writes to the database
export const saveEmbeddings = internalMutation({
  args: {
    fileId: v.string(),
    chunks: v.array(v.string()),
    vectors: v.array(v.array(v.number())),
    totalPages: v.number(),
  },
  handler: async (ctx, args) => {
    // Insert all documents into the vector store
    for (let i = 0; i < args.chunks.length; i++) {
      await ctx.db.insert("documents", {
        fileId: args.fileId,
        text: args.chunks[i],
        embedding: args.vectors[i],
        metadata: {
          chunkIndex: i,
        },
      });
    }

    const file = await ctx.db
      .query("pdfFiles")
      .withIndex("byFileId", (q) => q.eq("fileId", args.fileId))
      .unique();

    if (file) {
      await ctx.db.patch(file._id, {
        status: "ready",
        totalPages: args.totalPages,
        totalChunks: args.chunks.length,
      });
    }
  },
});