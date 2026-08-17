import { useState } from 'react';
import axios from 'axios';
import ModelViewer from './components/ModelViewer';

function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/api/v1/generate`, {
        prompt
      });
      setResult(response.data);
    } catch (error) {
      console.error('Error generating CAD:', error);
      alert('Failed to generate CAD model');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            ParametriCAD AI
          </h1>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold tracking-wide uppercase">
            MVP Demo
          </span>
        </div>
      </header>

      <main className="flex-grow flex flex-col md:flex-row p-6 gap-8 max-w-7xl mx-auto w-full">
        {/* Sidebar / Controls */}
        <div className="w-full md:w-1/3 flex flex-col gap-5 bg-white p-6 rounded-xl shadow-lg border border-gray-100 transition-all">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-xl font-bold text-gray-800">Generation Settings</h2>
            <p className="text-sm text-gray-500 mt-1">Describe the part in natural language</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Natural Language Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 h-32 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. A stainless steel pipe with 20mm diameter and 150mm length"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt}
            className="bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Generating...' : 'Generate CAD Model'}
          </button>

          {result && result.extracted_params && (
            <div className="mt-4 p-4 bg-gray-50 rounded border">
              <h3 className="font-medium text-sm text-gray-700 mb-2">Extracted Parameters:</h3>
              <pre className="text-xs bg-white p-2 rounded overflow-auto">
                {JSON.stringify(result.extracted_params, null, 2)}
              </pre>
            </div>
          )}

          {result && result.validation_metrics && (
            <div className="mt-4 p-4 bg-gray-50 rounded border">
              <h3 className="font-medium text-sm text-gray-700 mb-2">Validation Metrics:</h3>
              <pre className="text-xs bg-white p-2 rounded overflow-auto">
                {JSON.stringify(result.validation_metrics, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* 3D Viewer Area */}
        <div className="w-full md:w-2/3 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">3D Viewer</h2>
          </div>
          <div className="flex-grow relative min-h-[400px]">
            {/* Assume backend serves GLB files at API URL */}
            <ModelViewer glbUrl={result?.glb_url ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${result.glb_url}` : null} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
