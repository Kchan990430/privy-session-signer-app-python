import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  className?: string;
  successText?: string;
  children?: React.ReactNode;
}

export function CopyButton({ text, className = '', successText = '✓ Copied', children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Failed to copy
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`transition-all ${copied ? 'bg-green-500 text-white' : ''} ${className}`}
      title={`Copy: ${text}`}
    >
      {copied ? successText : (children || 'Copy')}
    </button>
  );
}