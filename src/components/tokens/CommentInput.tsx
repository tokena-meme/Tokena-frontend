import { useState } from 'react';
import { Send, Wallet } from 'lucide-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

interface CommentInputProps {
  onSubmit: (text: string) => Promise<void>;
  isSubmitting: boolean;
  isConnected: boolean;
  placeholder?: string;
}

export function CommentInput({ onSubmit, isSubmitting, isConnected, placeholder = "Write a comment..." }: CommentInputProps) {
  const { setVisible } = useWalletModal();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!text.trim() || isSubmitting) return;
    setError(null);
    try {
      await onSubmit(text.trim());
      setText('');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to post comment');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (!isConnected) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#111] border border-[#1a1a1a] text-sm font-mono text-[#555] hover:text-[#888] hover:border-[#222] transition-all"
      >
        <Wallet size={14} /> Connect wallet to comment
      </button>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 500));
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={500}
            className="tokena-input w-full rounded-xl px-3 py-2.5 text-sm font-mono pr-12"
            disabled={isSubmitting}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#333]">
            {text.length}/500
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting}
          className="btn-primary px-4 py-2.5 rounded-xl text-sm flex items-center gap-1.5 flex-shrink-0"
        >
          <Send size={13} />
        </button>
      </div>
      {error && (
        <p className="text-xs font-mono text-[#FF4444] mt-1.5">{error}</p>
      )}
    </div>
  );
}
