import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
}

export function Input({ label, error, hint, suffix, prefix, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[#888] uppercase tracking-wider font-mono">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <div className="absolute left-3 text-[#666] text-sm">{prefix}</div>
        )}
        <input
          className={`tokena-input w-full rounded-lg px-3 py-2.5 text-sm font-mono ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-16' : ''} ${error ? 'border-[#FF4444]' : ''} ${className}`}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 text-[#888] text-xs font-mono">{suffix}</div>
        )}
      </div>
      {error && <p className="text-xs text-[#FF4444] font-mono">{error}</p>}
      {hint && !error && <p className="text-xs text-[#555] font-mono">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[#888] uppercase tracking-wider font-mono">
          {label}
        </label>
      )}
      <textarea
        className={`tokena-input w-full rounded-lg px-3 py-2.5 text-sm font-mono resize-none ${error ? 'border-[#FF4444]' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#FF4444] font-mono">{error}</p>}
      {hint && !error && <p className="text-xs text-[#555] font-mono">{hint}</p>}
    </div>
  );
}
