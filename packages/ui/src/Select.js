import { useId } from "react";
export const Select = ({ label, error, size = "md", options, className = "", id, ...props }) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const sizeClasses = {
        sm: "px-2 py-1 text-sm",
        md: "px-3 py-2 text-base",
        lg: "px-4 py-3 text-lg",
    };
    return (<div className="flex flex-col">
      {label && (<label htmlFor={selectId} className="mb-1 text-sm font-medium text-gray-300">
          {label}
        </label>)}
      <select id={selectId} className={`bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${sizeClasses[size]} ${className}`} {...props}>
        {options.map((option) => (<option key={option.value} value={option.value}>
            {option.label}
          </option>))}
      </select>
      {error && <span className="mt-1 text-sm text-red-400">{error}</span>}
    </div>);
};
