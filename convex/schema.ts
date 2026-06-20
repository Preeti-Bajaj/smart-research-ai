
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // =====================================================
  // USERS
  // =====================================================
  users: defineTable({
    email: v.string(),
    userName: v.string(),
    imgUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("byEmail", ["email"]),

  // =====================================================
  // PDF FILES
  // =====================================================
  pdfFiles: defineTable({
    fileId: v.string(),

    fileName: v.string(),

    description: v.optional(v.string()),

    fileUrl: v.string(),

    storageId: v.id("_storage"),

    createdBy: v.string(),

    uploadedAt: v.number(),

    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),

    tags: v.optional(v.array(v.string())),

    totalPages: v.optional(v.number()),

    totalChunks: v.optional(v.number()),

    favorite: v.optional(v.boolean()),

    lastOpenedAt: v.optional(v.number()),
  })
    .index("byUser", ["createdBy"])
    .index("byFileId", ["fileId"]),

  // =====================================================
  // VECTOR DOCUMENTS (RAG ENGINE)
  // =====================================================
  documents: defineTable({
    embedding: v.array(v.number()),

    text: v.string(),

    metadata: v.object({
      fileId: v.string(),

      pageNumber: v.optional(v.number()),

      chunkIndex: v.optional(v.number()),
    }),
  }).vectorIndex("byEmbedding", {
    vectorField: "embedding",
    dimensions: 3072,
  }),

  // =====================================================
  // CHAT HISTORY
  // =====================================================
  chatHistory: defineTable({
    fileId: v.string(),

    createdBy: v.string(),

    question: v.string(),

    answer: v.string(),

    sources: v.optional(v.array(v.string())),

    createdAt: v.number(),
  })
    .index("byFile", ["fileId"])
    .index("byUser", ["createdBy"]),

  // =====================================================
  // USER NOTES
  // =====================================================
  notes: defineTable({
    fileId: v.string(),

    title: v.string(),

    content: v.string(),

    createdBy: v.string(),

    sourcePages: v.optional(v.array(v.number())),

    createdAt: v.number(),

    updatedAt: v.number(),
  })
    .index("byFile", ["fileId"])
    .index("byUser", ["createdBy"]),

  // =====================================================
  // SUMMARIES
  // =====================================================
  summaries: defineTable({
    fileId: v.string(),

    createdBy: v.string(),

    summaryType: v.union(
      v.literal("short"),
      v.literal("detailed"),
      v.literal("bullet"),
      v.literal("executive")
    ),

    summaryText: v.string(),

    sourcePages: v.optional(v.array(v.number())),

    createdAt: v.number(),
  })
    .index("byFile", ["fileId"])
    .index("byUser", ["createdBy"]),

  // =====================================================
  // FLASHCARDS
  // =====================================================
  flashcards: defineTable({
    fileId: v.string(),

    question: v.string(),

    answer: v.string(),

    difficulty: v.optional(
      v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard")
      )
    ),

    sourcePages: v.optional(v.array(v.number())),

    createdBy: v.string(),

    createdAt: v.number(),
  })
    .index("byFile", ["fileId"])
    .index("byUser", ["createdBy"]),

  // =====================================================
  // QUIZZES
  // =====================================================
  quizzes: defineTable({
    fileId: v.string(),

    question: v.string(),

    options: v.array(v.string()),

    correctAnswer: v.string(),

    explanation: v.optional(v.string()),

    sourcePages: v.optional(v.array(v.number())),

    createdBy: v.string(),

    createdAt: v.number(),
  })
    .index("byFile", ["fileId"])
    .index("byUser", ["createdBy"]),
});

