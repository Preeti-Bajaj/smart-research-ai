import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { api, internal } from "./_generated/api"; 

// 1. The Action: Calls Gemini API to generate vectors
export const processChunks = action({
  args: {
    fileId: v.string(),
    chunks: v.array(v.string()),
    totalPages: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      // Initialize Gemini Embeddings
      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY,
        model: "text-embedding-004", 
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });

      // Generate embeddings for all chunks
      const vectors = await embeddings.embedDocuments(args.chunks);

      console.log(`✅ Success! Generated ${vectors.length} vectors.`);
      console.log(`📏 Vector Dimension Size: ${vectors[0].length}`);
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
      
      // Update file status to "failed" using the public mutation
      // (If you want to make updateFileDetails internal later, change 'api' to 'internal')
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
          // pageNumber is safely omitted here per Convex best practices
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