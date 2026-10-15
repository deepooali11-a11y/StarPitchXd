import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadVideo, pollUploadStatus } from '../lib/api';
import type { AnalysisResults, UploadRecord } from '../lib/types';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResultsReady: (results: AnalysisResults) => void;
}

type UploadState = 'idle' | 'uploading' | 'polling' | 'done' | 'error';

export function VideoUploadModal({
  isOpen,
  onClose,
  onResultsReady,
}: VideoUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setState('idle');
      setProgress(0);
      setErrorMsg(null);
      setIsDragging(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const validateFile = (f: File): string | null => {
    const maxSizeMB = 500;
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (!f.type.startsWith('video/')) return 'الملف لازم يكون فيديو';
    if (f.size > maxBytes) return `حجم الملف أكبر من ${maxSizeMB}MB`;
    return null;
  };

  const handleFileSelect = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) {
      setErrorMsg(err);
      setFile(null);
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setState('idle');
    setProgress(0);
  }, []);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setState('uploading');
    setErrorMsg(null);
    setProgress(5);

    try {
      const uploadRes = await uploadVideo(file);
      setProgress(20);
      setState('polling');

      abortRef.current = new AbortController();
      const results = await pollUploadStatus(
        uploadRes.id,
        (status: UploadRecord) => {
          const mapped = 20 + Math.min(79, Math.round(status.progress * 0.79));
          setProgress(mapped);
        },
        { intervalMs: 1000, maxAttempts: 60, signal: abortRef.current.signal }
      );

      setProgress(100);
      setState('done');
      onResultsReady(results);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMsg(err?.message || 'حدث خطأ غير متوقع');
      setState('error');
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    onClose();
  };

  if (!isOpen) return null;

  const isBusy = state === 'uploading' || state === 'polling';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">رفع فيديو للتحليل</h2>
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-white transition"
            disabled={state === 'polling'}
          >
            <X size={22} />
          </button>
        </div>

        {!file && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              isDragging ? 'border-blue-400 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500'
            }`}
          >
            <input
              id="video-upload-input"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={onFileInput}
            />
            <label htmlFor="video-upload-input" className="cursor-pointer">
              <Upload className="mx-auto mb-3 text-slate-400" size={40} />
              <p className="text-slate-200 font-semibold">اسحب الفيديو هنا أو اضغط للاختيار</p>
              <p className="text-slate-500 text-sm mt-1">MP4, MOV, AVI — أقصى حجم 500MB</p>
            </label>
          </div>
        )}

        {file && (
          <div className="rounded-xl bg-slate-800 p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{file.name}</p>
                <p className="text-slate-400 text-sm">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              {!isBusy && state !== 'done' && (
                <button
                  onClick={() => {
                    setFile(null);
                    setProgress(0);
                    setState('idle');
                  }}
                  className="text-slate-400 hover:text-red-400 transition ml-3"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {isBusy && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">
                {state === 'uploading' ? 'جاري الرفع...' : 'جاري التحليل...'}
              </span>
              <span className="text-sm text-slate-400">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {state === 'done' && (
          <div className="flex items-center gap-2 text-green-400 mb-4">
            <CheckCircle2 size={20} />
            <span className="font-medium">تم التحليل بنجاح!</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-3 mb-4">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <span className="text-sm">{errorMsg}</span>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            disabled={isBusy}
          >
            إلغاء
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || isBusy || state === 'done'}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isBusy && <Loader2 size={16} className="animate-spin" />}
            {state === 'uploading' ? 'جاري الرفع...' : state === 'polling' ? 'جاري التحليل...' : 'رفع وتحليل'}
          </button>
        </div>
      </div>
    </div>
  );
}
