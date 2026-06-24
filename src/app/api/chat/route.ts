import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: Request) {
  try {
    const { message, fileId } = await req.json();

    if (!fileId || !message) {
      return new Response(JSON.stringify({ error: "Missing fileId or message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Perform Similarity Search
    const searchResponse = await convex.action(api.search.performSimilaritySearch, {
      query: message,
      fileId: fileId,
      limit: 8,
    });

    if (searchResponse.matchCount === 0) {
      return new Response(JSON.stringify({ answer: "I couldn't find relevant information in this document to answer your question." }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Debug logs to verify retrieval health
    console.log(`Found ${searchResponse.matchCount} chunks for query: "${message}"`);
    console.log("Top chunk score:", searchResponse.chunks[0]?.score);

    // 2. Prepare Context
    const contextText = searchResponse.chunks
      .map((chunk) => `[Chunk ${chunk.chunkIndex}${chunk.pageNumber ? `, Page ${chunk.pageNumber}` : ''}]:\n${chunk.text}`)
      .join("\n\n---\n\n");

    const systemPrompt = `
You are SmartResearch AI.

Rules:
1. Answer ONLY from the supplied context.
2. Never invent facts.
3. If the answer is not present in the context, say:
   "I could not find that information in the uploaded document."
4. Quote relevant chunks when useful.
5. Mention chunk numbers when citing evidence.

CONTEXT:
${contextText}

QUESTION:
${message}
`;

    // 3. Generate response with a resilient Waterfall Fallback mechanism
    // Updated to include the newest 2.0 and 2.5 model aliases at the top
    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash", 
      "gemini-1.5-pro", 
      "gemini-1.5-flash-8b", 
      "gemini-1.0-pro"
    ];
    
    let responseText = "";
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 Attempting generation with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(systemPrompt);
        responseText = result.response.text();
        
        console.log(`✅ Successfully generated response using ${modelName}`);
        break; // Exit the loop as soon as one model succeeds
      } catch (error: any) {
        console.warn(`⚠️ Model ${modelName} failed. Falling back...`);
        lastError = error;
      }
    }

    // If all models in the waterfall fail, throw the last error
    if (!responseText) {
      throw lastError;
    }

    // 4. Return JSON as the React UI expects
    return new Response(JSON.stringify({ answer: responseText }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Chat API Error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}