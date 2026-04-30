import React from 'react';

type BadgeVariant = 'default' | 'green' | 'amber' | 'red' | 'blue' | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[#111] text-[#888] border border-[#1a1a1a]',
  green: 'bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/20',
  amber: 'bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/20',
  red: 'bg-[#FF4444]/10 text-[#FF4444] border border-[#FF4444]/20',
  blue: 'bg-[#4A9EFF]/10 text-[#4A9EFF] border border-[#4A9EFF]/20',
  outline: 'bg-transparent text-[#666] border border-[#1a1a1a]',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
