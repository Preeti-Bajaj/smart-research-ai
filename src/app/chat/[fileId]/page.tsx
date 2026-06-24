"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { Send, User, Bot, Loader2, FileText } from "lucide-react";

type Message = {
  role: "user" | "ai";
  content: string;
};

export default function ChatPage() {
  const params = useParams();
  const fileId = params?.fileId as string;

  console.log("File ID:", fileId);

  // State for continuous chat history instead of just one question/answer
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "Hello! I've successfully analyzed your document. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    
    // Optimistically add user message to UI
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      console.log("Sending question:", userMessage);
      console.log("File ID:", fileId);

      // Fetch logic exactly matches your mentor's structure
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          fileId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Request failed");
      }

      // Append AI response to chat
      const responseContent = typeof data.answer === "string" 
        ? data.answer 
        : JSON.stringify(data.answer) || "Sorry, I couldn't generate an answer.";

      setMessages((prev) => [
        ...prev,
        { role: "ai", content: responseContent },
      ]);
    } catch (error: any) {
      console.error("Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: `❌ I encountered an error: ${error.message || "Please try again."}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">SmartResearch AI</h1>
            <p className="text-xs text-gray-500 font-mono">Doc ID: {fileId ? fileId.slice(0, 12) : "Loading"}...</p>
          </div>
        </div>
      </header>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "ai" && (
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
                <Bot size={22} />
              </div>
            )}
            
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none shadow-md"
                  : "bg-white text-gray-800 rounded-bl-none shadow-sm border border-gray-200"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{msg.content}</p>
            </div>

            {msg.role === "user" && (
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white shrink-0 shadow-md">
                <User size={22} />
              </div>
            )}
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-4 justify-start">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <Bot size={22} />
            </div>
            <div className="bg-white text-gray-800 rounded-2xl rounded-bl-none shadow-sm border border-gray-200 px-5 py-4 flex items-center gap-3">
              <Loader2 className="animate-spin text-blue-600" size={20} />
              <span className="text-sm font-medium text-gray-500 animate-pulse">
                Analyzing document chunks...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-4 sm:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto flex items-end gap-3 bg-gray-50 border border-gray-300 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all shadow-sm"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Ask a question about this document..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-800 p-2 outline-none text-base resize-none max-h-32 min-h-[44px]"
            rows={1}
            disabled={isLoading || !fileId}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !fileId}
            className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm h-[44px] w-[44px]"
          >
            <Send size={20} className="ml-1" />
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-3">
          SmartResearch AI can make mistakes. Consider verifying important information.
        </p>
      </div>
    </div>
  );
}