import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  let currentFileId: string | null = null;

  try {
    const { fileUrl, fileId } = await req.json();
    currentFileId = fileId;

    if (!fileUrl || !fileId) {
      return NextResponse.json({ error: "Missing fileUrl or fileId" }, { status: 400 });
    }

    console.log("-----------------------------------------");
    console.log(`🚀 Starting PDF processing for File ID: ${fileId}`);

    // 1. Instantly update DB status
    await convex.mutation(api.fileStorage.updateFileDetails, {
      fileId,
      status: "processing",
    });

    // 2. Fetch the PDF from Convex Storage
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from storage: ${response.statusText}`);
    }
    
    // 3. Convert to Blob for LangChain's PDFLoader
    const blob = await response.blob();

    console.log("📄 Loading PDF via LangChain PDFLoader...");
    const loader = new PDFLoader(blob, {
      splitPages: false, // Keeps all text together
    });
    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      throw new Error("No pages could be loaded from the PDF.");
    }

    const fullText = docs[0].pageContent;
    console.log(`📝 Text length extracted: ${fullText.length} characters`);

    // 4. Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await textSplitter.splitText(fullText);
    console.log(`🔪 Text chunked into: ${chunks.length} segments`);

    // 5. Send chunks to Convex for Embedding
    await convex.action(api.ingest.processChunks, {
      fileId,
      chunks,
      totalPages: 1, 
    });
    
    console.log("✅ Embeddings generated and saved successfully!");
    console.log("-----------------------------------------");

    return NextResponse.json({ success: true, message: "PDF processed successfully." });

  } catch (error) {
    console.error("❌ PDF Loader Error:", error);
    
    // Handle failures gracefully
    if (currentFileId) {
      try {
        await convex.mutation(api.fileStorage.updateFileDetails, {
          fileId: currentFileId,
          status: "failed",
        });
      } catch (e) {
        console.error("Critical: Failed to update error status in DB", e);
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process PDF" },
      { status: 500 }
    );
  }
}