import PdfUpload from "./components/PdfUpload"; // Adjust the path if you use the @/ alias

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <main className="max-w-3xl w-full space-y-8 text-center">
        {/* Hero Section */}
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
            SmartResearch AI
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your AI-powered document intelligence platform. Upload a PDF to start extracting insights, generating summaries, and querying your documents using semantic search.
          </p>
        </div>

        {/* Upload Component */}
        <div className="mt-10">
          <PdfUpload />
        </div>
      </main>
    </div>
  );
}