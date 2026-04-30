import { useState, useRef, useCallback } from "react";
import { ipfsToHttp } from "../../lib/ipfs/pinata";

interface ImageUploaderProps {
  onFileSelected: (file: File | null, previewUrl: string | null) => void;
  symbol?: string;
  initialPreviewUrl?: string | null;
}

export function ImageUploader({ onFileSelected, symbol, initialPreviewUrl }: ImageUploaderProps) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [preview,  setPreview]  = useState<string | null>(initialPreviewUrl || null);
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const MAX_MB   = 5;
  const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

  function validate(file: File): string | null {
    if (!ACCEPTED.includes(file.type))
      return "PNG, JPG, GIF or WEBP only";
    if (file.size > MAX_MB * 1024 * 1024)
      return `Max ${MAX_MB}MB`;
    return null;
  }

  function handle(file: File) {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    onFileSelected(file, url);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setPreview(null);
    setError(null);
    onFileSelected(null, null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  }, []);

  return (
    <div>
      <div
        onClick={() => !preview && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        style={{
          border:       `2px dashed ${dragging ? "#F5A623" : preview ? "#1a1a1a" : "#1a1a1a"}`,
          borderRadius: 12,
          padding:      preview ? 0 : "36px 20px",
          textAlign:    "center",
          cursor:       preview ? "default" : "pointer",
          background:   dragging ? "rgba(245,166,35,0.04)" : "#111",
          transition:   "all 0.2s",
          overflow:     "hidden",
          minHeight:    120,
          display:      "flex",
          alignItems:   "center",
          justifyContent:"center",
          position:     "relative",
        }}
        className={preview ? "" : "hover:border-[#2a2a2a]"}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Token logo preview"
              style={{
                width:        "100%",
                height:       176,
                objectFit:    "cover",
                borderRadius: 12,
                display:      "block",
              }}
            />
            <button
              onClick={handleRemove}
              style={{
                position:     "absolute",
                top:          8,
                right:        8,
                background:   "rgba(0,0,0,0.7)",
                borderRadius: "50%",
                width:        24,
                height:       24,
                display:      "flex",
                alignItems:   "center",
                justifyContent:"center",
                color:        "white",
                cursor:       "pointer",
                border:       "none",
              }}
              className="hover:bg-black transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <svg className="text-[#333] mb-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div
              style={{
                fontSize:   14,
                color:      "#555",
                fontFamily: "'DM Mono', monospace",
                marginBottom: 4,
              }}
            >
              {dragging ? "Drop it" : "Drop token image here"}
            </div>
            <div
              style={{
                fontSize:   12,
                color:      "#333",
                fontFamily: "'DM Mono', monospace",
                letterSpacing: 1,
              }}
            >
              PNG, JPG, GIF, WEBP up to 5MB
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handle(file);
        }}
      />

      {error && (
        <div
          style={{
            marginTop:  8,
            fontSize:   11,
            color:      "#FF4444",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
