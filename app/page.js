// app/page.jsx
'use client';

import { useState } from 'react';

export default function Home() {
  const [dxfFile, setDxfFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    const fileInput = event.target.elements.mprFile;
    const formData = new FormData();
    formData.append('mprFile', fileInput.files[0]);

    const response = await fetch('/api/process-mpr', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDxfFile(url);
    } else {
      const errorData = await response.json();
      alert(errorData.error || 'Error processing the MPR file.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
      <h1 className="text-3xl font-bold mb-8">MPR to DXF Converter</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <input
          type="file"
          name="mprFile"
          accept=".mpr"
          required
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer focus:outline-none mb-4"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
        >
          Convert to DXF
        </button>
      </form>
      {loading && <p className="mt-4 text-blue-600">Processing...</p>}
      {dxfFile && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Conversion Complete</h2>
          <a
            href={dxfFile}
            download="output.dxf"
            className="text-blue-500 hover:underline"
          >
            Download DXF File
          </a>
        </div>
      )}
    </div>
  );
}
