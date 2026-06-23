import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: Request) {
  try {
    const { messages, fileId } = await req.json();

    // Fix 1: Guard against missing fileId
    if (!fileId) {
      return new Response(JSON.stringify({ error: "Missing fileId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fix 2: Guard against empty or malformed messages array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fix 3: Safely extract and validate the last message
    const lastMessage = messages.at(-1)?.content;
    if (!lastMessage) {
      return new Response(JSON.stringify({ error: "Invalid message format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const searchResponse = await convex.action(api.search.performSimilaritySearch, {
      query: lastMessage,
      fileId: fileId,
      limit: 5,
    });

    if (searchResponse.matchCount === 0) {
      const emptyStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode("I couldn't find relevant information in this document to answer your question.")
          );
          controller.close();
        }
      });
      return new Response(emptyStream, { 
        headers: { "Content-Type": "text/plain; charset=utf-8" } 
      });
    }

    const contextText = searchResponse.chunks
      .map((chunk) => `[Chunk ${chunk.chunkIndex}${chunk.pageNumber ? `, Page ${chunk.pageNumber}` : ''}]:\n${chunk.text}`)
      .join("\n\n---\n\n");

    const systemPrompt = `You are 'SmartResearch AI', a highly intelligent document analysis assistant. 

Rules:
1. You must answer the user's question using ONLY the provided CONTEXT. 
2. If the answer cannot be found in the CONTEXT, politely state that you do not have enough information from the document to answer. 
3. Do NOT make up information.
4. Cite Chunk numbers or Page numbers when available.

CONTEXT:
${contextText}

USER QUESTION:
${lastMessage}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const streamingResponse = await model.generateContentStream(systemPrompt);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamingResponse.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(new TextEncoder().encode(text));
            }
          }
        } catch (err) {
          console.error("Stream generation failed:", err);
          controller.enqueue(new TextEncoder().encode("\n\n[Error: Stream interrupted]"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff" 
      },
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}