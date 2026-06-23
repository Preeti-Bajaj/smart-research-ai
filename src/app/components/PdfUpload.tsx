"use client";

import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api"; // <-- Verify this path (changed to ../../)
import { Id } from "../../../convex/_generated/dataModel"; // <-- Added this import

export default function PdfUpload() {
  const generateUploadUrl = useMutation(api.fileStorage.generateUploadUrl);
  const addPdfFile = useMutation(api.fileStorage.addPdfFile);

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      if (selectedFile.type !== "application/pdf") {
        setFile(null);
        setStatusMessage("Please select a valid PDF file.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      
      if (selectedFile.size > 10 * 1024 * 1024) {
        setFile(null);
        setStatusMessage("File must be smaller than 10MB");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setFile(selectedFile);
      setStatusMessage("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatusMessage("Please select a file first.");
      return;
    }

    setIsUploading(true);
    setStatusMessage("Securing upload link...");

    try {
      const postUrl = await generateUploadUrl();

      setStatusMessage("Uploading document...");

      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) throw new Error("Failed to upload file to storage");

      const { storageId } = await result.json();
      const newFileId = crypto.randomUUID();

      const parsedTags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      setStatusMessage("Saving metadata...");

      const addResult = await addPdfFile({
        fileName: file.name,
        storageId: storageId as Id<"_storage">, // <-- Cast the ID perfectly for TypeScript
        createdBy: "demo-user@example.com", 
        fileId: newFileId,
        description: description || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      });

      if (!addResult?.fileUrl) {
        throw new Error("File URL generation failed. Cannot proceed with AI processing.");
      }

      setStatusMessage("Extracting document intelligence...");

      const apiResponse = await fetch("/api/pdf-loader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: addResult.fileUrl, 
          fileId: newFileId,
        }),
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`Pipeline Error: ${errorText}`);
      }

      setStatusMessage("Upload complete! Document is processing in the background.");
      
      setFile(null);
      setDescription("");
      setTags("");
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (error) {
      console.error("Upload error:", error);
      setStatusMessage(
        error instanceof Error ? error.message : "An unknown error occurred during upload"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Upload Document</h2>
        <p className="text-sm text-gray-500">Upload a PDF to start analyzing and generating insights.</p>
      </div>

      <div className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            id="pdf-upload"
            ref={fileInputRef} 
            disabled={isUploading}
          />
          <label
            htmlFor="pdf-upload"
            className="cursor-pointer flex flex-col items-center w-full"
          >
            <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="text-sm font-medium text-blue-600 hover:text-blue-500 text-center px-4">
              {file ? file.name : "Click to select a PDF"}
            </span>
            <span className="text-xs text-gray-500 mt-1">Maximum file size: 10MB</span>
          </label>
        </div>

        {file && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                placeholder="E.g., Operating Systems Chapter 4"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={isUploading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (Comma separated)
              </label>
              <input
                type="text"
                placeholder="OS, Placement, Core"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={isUploading}
              />
            </div>
          </div>
        )}

        {statusMessage && (
          <div className={`text-sm p-3 rounded-md transition-colors ${statusMessage.toLowerCase().includes("error") || statusMessage.includes("valid") || statusMessage.includes("smaller") || statusMessage.includes("failed") ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
            {statusMessage}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className={`w-full py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
            ${!file || isUploading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"} 
            transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex justify-center items-center gap-2`}
        >
          {isUploading && (
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {isUploading ? "Processing Upload..." : "Upload Document"}
        </button>
      </div>
    </div>
  );
}