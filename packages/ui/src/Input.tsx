import type React from "react";
import { useId } from "react";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  size = "md",
  className = "",
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const sizeClasses = {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-2 text-base",
    lg: "px-4 py-3 text-lg",
  };

  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={inputId} className="mb-1 text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${sizeClasses[size]} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 text-sm text-red-400">{error}</span>}
    </div>
  );
};
