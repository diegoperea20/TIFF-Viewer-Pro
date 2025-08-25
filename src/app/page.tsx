"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

// Dynamically import the TiffViewerComponent with SSR disabled
const TiffViewer = dynamic(() => import("./components/TiffViewerComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-cp-primary border-t-transparent"></div>
        <div className="absolute inset-0 rounded-full bg-cp-bright opacity-20 animate-pulse-green"></div>
      </div>
    </div>
  ),
});

export default function Home() {
  const [tiffPath, setTiffPath] = useState("/file.tif");
  const [isClient, setIsClient] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setTiffPath(url);
      setSelectedFileName(file.name);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (
        file.type.includes("tiff") ||
        file.name.toLowerCase().endsWith(".tif") ||
        file.name.toLowerCase().endsWith(".tiff")
      ) {
        const url = URL.createObjectURL(file);
        setTiffPath(url);
        setSelectedFileName(file.name);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-cp-bright opacity-20 rounded-full blur-xl animate-float"></div>
        <div
          className="absolute top-40 right-20 w-24 h-24 bg-cp-primary opacity-25 rounded-full blur-lg animate-float"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute bottom-20 left-1/4 w-40 h-40 bg-cp-secondary opacity-15 rounded-full blur-2xl animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/3 right-1/3 w-20 h-20 bg-cp-bright opacity-18 rounded-full blur-md animate-float"
          style={{ animationDelay: "0.5s" }}
        ></div>

        {/* Additional glow effects */}
        <div
          className="absolute top-10 left-1/2 w-2 h-2 bg-cp-bright rounded-full animate-glow"
          style={{ animationDelay: "3s" }}
        ></div>
        <div
          className="absolute bottom-32 right-10 w-3 h-3 bg-cp-primary rounded-full animate-glow"
          style={{ animationDelay: "1.5s" }}
        ></div>
      </div>

      <div className="relative z-10 p-4 md:p-8">
        <main className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-fadeInUp">
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="text-cp-secondary">TIFF</span>
              <span className="text-cp-primary ml-3">Viewer</span>
              <span className="text-cp-bright ml-2 animate-glow">Pro</span>
            </h1>
            <p className="text-xl md:text-2xl text-cp-secondary max-w-3xl mx-auto leading-relaxed">
              Professional high-resolution TIFF image viewer with advanced zoom
              and navigation technology
            </p>
            <div className="flex justify-center mt-8">
              <div className="w-24 h-1 bg-gradient-primary rounded-full animate-glow"></div>
            </div>
          </div>

          {/* Main Content Card */}
          <div
            className="bg-cp-glass rounded-3xl shadow-2xl overflow-hidden mb-8 animate-fadeInUp hover-glow"
            style={{ animationDelay: "0.2s" }}
          >
            {/* File Upload Section */}
            <div className="p-8 md:p-10 bg-gradient-accent/10">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-3xl font-bold text-cp-bright mb-4">
                    Load TIFF File
                  </h2>
                  <p className="text-cp-secondary text-lg mb-6">
                    Select or drag a TIFF file to start visualization
                  </p>

                  {/* File Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-cp-primary mb-3 uppercase tracking-wide">
                      Select File
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".tif,.tiff"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        id="file-upload"
                      />
                      <div
                        className="block w-full text-sm text-cp-bright
                        border-2 border-dashed border-cp-primary/50 rounded-xl p-4
                        hover:border-cp-bright/70 transition-all duration-300
                        bg-cp-accent/20 backdrop-blur-sm
                        cursor-pointer hover:bg-cp-bright/10"
                      >
                        <div className="flex items-center justify-center space-x-3">
                          <div className="bg-cp-primary hover:bg-cp-bright transition-all duration-300 text-white px-6 py-4 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl hover:transform hover:-translate-y-1">
                            Choose File
                          </div>
                          <span className="text-cp-secondary">
                            {selectedFileName
                              ? `Selected: ${selectedFileName}`
                              : "No file selected"}
                          </span>
                        </div>
                        <p className="text-xs text-cp-muted text-center mt-2">
                          Supported formats: .tif, .tiff
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  className={`border-3 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                    isDragOver
                      ? "border-cp-bright bg-cp-bright/20 scale-105 shadow-lg shadow-cp-bright/30"
                      : "border-cp-primary/60 bg-cp-primary/10 hover:border-cp-bright/80 hover:bg-cp-bright/15"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <div className="mb-4">
                    <svg
                      className="w-16 h-16 mx-auto text-cp-bright"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-cp-bright font-semibold text-lg mb-2">
                    {isDragOver ? "Drop here!" : "Drag and Drop"}
                  </p>
                  <p className="text-cp-secondary text-sm">
                    .tif or .tiff files
                  </p>
                </div>
              </div>
            </div>

            {/* Viewer Section */}
            <div className="border-t border-cp-primary/30">
              {isClient ? (
                <TiffViewer
                  tiffPath={tiffPath}
                  className="w-full h-[75vh] min-h-[600px]"
                />
              ) : (
                <div className="flex items-center justify-center h-[600px] bg-gradient-accent/10">
                  <div className="text-center">
                    <div className="relative mb-6">
                      <div className="animate-spin rounded-full h-20 w-20 border-4 border-cp-primary border-t-transparent mx-auto"></div>
                      <div className="absolute inset-0 rounded-full bg-cp-bright opacity-30 animate-pulse-green"></div>
                    </div>
                    <p className="text-cp-bright font-semibold text-xl animate-pulse">
                      Loading viewer...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Features Section */}
          <div
            className="grid md:grid-cols-2 gap-8 animate-fadeInUp"
            style={{ animationDelay: "0.4s" }}
          >
            {/* About Card */}
            <div className="bg-cp-glass rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 hover-glow">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-cp-bright">
                  About This Viewer
                </h2>
              </div>
              <p className="text-cp-secondary text-lg mb-6 leading-relaxed">
                This TIFF viewer uses OpenSeadragon and GeoTIFF.js to display
                high-resolution TIFF images with smooth zooming and panning.
              </p>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-cp-bright rounded-full mt-2 mr-3 flex-shrink-0 animate-glow"></div>
                  <p className="text-cp-muted font-medium">
                    High-resolution TIFF support
                  </p>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-cp-bright rounded-full mt-2 mr-3 flex-shrink-0 animate-glow"></div>
                  <p className="text-cp-muted font-medium">
                    Smooth zooming and panning
                  </p>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-cp-bright rounded-full mt-2 mr-3 flex-shrink-0 animate-glow"></div>
                  <p className="text-cp-muted font-medium">
                    Responsive and modern design
                  </p>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-cp-bright rounded-full mt-2 mr-3 flex-shrink-0 animate-glow"></div>
                  <p className="text-cp-muted font-medium">
                    Drag and drop support
                  </p>
                </div>
              </div>
            </div>

            {/* Controls Card */}
            <div className="bg-cp-glass rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 hover-glow">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-cp-bright">
                  Navigation Controls
                </h2>
              </div>
              <div className="space-y-6">
                <div className="bg-cp-primary/20 rounded-xl p-4 border border-cp-primary/30">
                  <h3 className="font-bold text-cp-bright mb-3 flex items-center">
                    <span className="w-3 h-3 bg-cp-primary rounded-full mr-2 animate-glow"></span>
                    Mouse Controls
                  </h3>
                  <div className="space-y-2 ml-5">
                    <p className="text-cp-muted">
                      <span className="font-semibold text-cp-secondary">
                        Mouse wheel:
                      </span>{" "}
                      Zoom in/out
                    </p>
                    <p className="text-cp-muted">
                      <span className="font-semibold text-cp-secondary">
                        Left click + drag:
                      </span>{" "}
                      Pan
                    </p>
                    <p className="text-cp-muted">
                      <span className="font-semibold text-cp-secondary">
                        Double click:
                      </span>{" "}
                      Zoom in
                    </p>
                    <p className="text-cp-muted">
                      <span className="font-semibold text-cp-secondary">
                        Shift + click:
                      </span>{" "}
                      Zoom out
                    </p>
                  </div>
                </div>

                <div className="bg-cp-secondary/20 rounded-xl p-4 border border-cp-secondary/30">
                  <h3 className="font-bold text-cp-bright mb-3 flex items-center">
                    <span className="w-3 h-3 bg-cp-secondary rounded-full mr-2 animate-glow"></span>
                    Advanced Features
                  </h3>
                  <div className="space-y-2 ml-5">
                    <p className="text-cp-muted">
                      <span className="font-semibold text-cp-secondary">
                        Rendering:
                      </span>{" "}
                      High quality
                    </p>
                    <p className="text-cp-muted">
                      <span className="font-semibold text-cp-secondary">
                        Performance:
                      </span>{" "}
                      Optimized
                    </p>
                    <p className="text-cp-muted">
                      <span className="font-semibold text-cp-secondary">
                        Compatibility:
                      </span>{" "}
                      Multiple TIFF formats
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="text-center mt-16 mb-8 animate-fadeInUp"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="inline-flex items-center bg-cp-card rounded-full px-8 py-4 shadow-lg">
              <div className="w-3 h-3 bg-cp-bright rounded-full mr-3 animate-pulse"></div>
              <p className="text-cp-secondary font-medium">
                Developed by
                <span className="text-cp-bright font-bold mx-2">
                  <a href="https://github.com/diegoperea20">
                    Diego Ivan Perea Montealegre
                  </a>
                </span>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
