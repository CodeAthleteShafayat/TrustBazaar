import { forwardRef } from "react";
import { cn } from "../../lib/utils";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, label, hint, error, id, ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-stone-700">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-900",
            "placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60",
            "transition-all shadow-sm",
            error && "border-rose-500 focus:ring-rose-500/30",
            className,
          )}
          {...rest}
        />
        {hint && !error && <p className="text-xs text-stone-500">{hint}</p>}
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-stone-700">{label}</label>}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "min-h-[100px] rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900",
            "placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60",
            "transition-all resize-y shadow-sm",
            error && "border-rose-500 focus:ring-rose-500/30",
            className,
          )}
          {...rest}
        />
        {hint && !error && <p className="text-xs text-stone-500">{hint}</p>}
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, id, children, ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-stone-700">{label}</label>}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-900",
            "focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 transition-all shadow-sm",
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        {hint && <p className="text-xs text-stone-500">{hint}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";