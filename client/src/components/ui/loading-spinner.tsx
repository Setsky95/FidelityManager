import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <div className={cn("animate-spin rounded-full border-2 border-gray-300 border-t-primary h-4 w-4", className)} />
  );
}
