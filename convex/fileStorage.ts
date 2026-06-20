import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// =====================================================
// 1. GENERATE SECURE UPLOAD URL
// =====================================================
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// =====================================================
// 2. ADD INITIAL PDF METADATA (Triggered on Frontend)
// =====================================================
export const addPdfFile = mutation({
  args: {
    fileName: v.string(),
    storageId: v.id("_storage"),
    createdBy: v.string(),
    fileId: v.string(),
    tags: v.optional(v.array(v.string())),
    description: v.optional(v.string()), 
  },
  handler: async (ctx, args) => {
    const fileUrl = await ctx.storage.getUrl(args.storageId);

    await ctx.db.insert("pdfFiles", {
      fileId: args.fileId,
      fileName: args.fileName,
      fileUrl: fileUrl ?? "",
      storageId: args.storageId,
      createdBy: args.createdBy,
      uploadedAt: Date.now(),
      status: "uploading", 
      tags: args.tags || [],
      description: args.description,
      favorite: false, 
      lastOpenedAt: Date.now(),
    });

    return { success: true, fileUrl };
  },
});

// =====================================================
// 3. UPDATE FILE DETAILS (Triggered by LangChain API)
// =====================================================
export const updateFileDetails = mutation({
  args: {
    fileId: v.string(),
    status: v.optional(
      v.union(
        v.literal("uploading"),
        v.literal("processing"),
        v.literal("ready"),
        v.literal("failed")
      )
    ),
    totalPages: v.optional(v.number()),
    totalChunks: v.optional(v.number()),
    description: v.optional(v.string()), 
  },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("pdfFiles")
      .withIndex("byFileId", (q) => q.eq("fileId", args.fileId))
      .unique();

    if (!document) throw new Error("Document not found in database.");

    // The TypeScript-safe object initialization
    const updateFields: {
      status?: "uploading" | "processing" | "ready" | "failed";
      totalPages?: number;
      totalChunks?: number;
      description?: string;
    } = {};

    if (args.status !== undefined) updateFields.status = args.status;
    if (args.totalPages !== undefined) updateFields.totalPages = args.totalPages;
    if (args.totalChunks !== undefined) updateFields.totalChunks = args.totalChunks;
    if (args.description !== undefined) updateFields.description = args.description;

    await ctx.db.patch(document._id, updateFields);
    
    return { success: true };
  },
});

// =====================================================
// 4. GET USER FILES (For the Dashboard UI)
// =====================================================
export const getUserFiles = query({
  args: {
    userEmail: v.string(), 
  },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("pdfFiles")
      .withIndex("byUser", (q) => q.eq("createdBy", args.userEmail))
      .order("desc") 
      .collect();

    return files;
  },
});

// =====================================================
// 5. GET SINGLE FILE BY ID (For the Chat/View Page)
// =====================================================
export const getFileById = query({
  args: {
    fileId: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("pdfFiles")
      .withIndex("byFileId", (q) => q.eq("fileId", args.fileId))
      .unique();

    return result;
  },
});

// =====================================================
// 6. DELETE FILE AND STORAGE (Cleanup)
// =====================================================
export const deletePdfFile = mutation({
  args: {
    fileId: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query("pdfFiles")
      .withIndex("byFileId", (q) => q.eq("fileId", args.fileId))
      .unique();

    if (!file) throw new Error("File not found");

    // Delete binary from Convex Storage first to prevent orphaned files
    await ctx.storage.delete(file.storageId);
    
    // Delete metadata record from the database
    await ctx.db.delete(file._id);

    return { success: true };
  },
});