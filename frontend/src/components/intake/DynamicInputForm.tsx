import { useState, FormEvent } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import {
  validateEmail,
  validatePhone,
  getErrorMessage,
  formatPhone,
} from "../../utils/validation";

interface DynamicInputFormProps {
  inputType: "text" | "email" | "phone" | "textarea";
  label?: string;
  placeholder?: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export default function DynamicInputForm({
  inputType,
  label,
  placeholder,
  initialValue = "",
  onSubmit,
  onCancel,
  onBack,
  canGoBack = false,
}: DynamicInputFormProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Validate based on input type
    if (inputType === "email" || inputType === "phone") {
      const errorMsg = getErrorMessage(inputType, value);
      if (errorMsg) {
        setError(errorMsg);
        return;
      }
    } else {
      // For text and textarea, just check it's not empty
      if (!value.trim()) {
        setError("This field is required");
        return;
      }
    }

    setIsSubmitting(true);
    const formattedValue = inputType === "phone" ? formatPhone(value) : value;
    onSubmit(formattedValue);
  };

  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (error) {
      setError("");
    }
  };

  const isValid = (() => {
    if (!value.trim()) return false;
    if (inputType === "email") return validateEmail(value);
    if (inputType === "phone") return validatePhone(value);
    return true; // text and textarea just need to be non-empty
  })();

  const getInputLabel = () => {
    if (label) return label;
    switch (inputType) {
      case "email":
        return "Your email address";
      case "phone":
        return "Your phone number";
      case "text":
        return "Your response";
      case "textarea":
        return "Your message";
      default:
        return "Input";
    }
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    switch (inputType) {
      case "email":
        return "you@example.com";
      case "phone":
        return "(555) 123-4567";
      case "text":
        return "Type your answer...";
      case "textarea":
        return "Type your message...";
      default:
        return "";
    }
  };

  const getHelperText = () => {
    switch (inputType) {
      case "email":
        return "Enter a valid email address (e.g., you@example.com)";
      case "phone":
        return "Enter a valid US phone number (10 digits, e.g., 555-123-4567)";
      default:
        return "";
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="px-5 py-4 border-t border-gray-200 bg-white"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="dynamic-input"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            {getInputLabel()}
          </label>
          {inputType === "textarea" ? (
            <textarea
              id="dynamic-input"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={getPlaceholder()}
              rows={4}
              className={`input-field resize-none ${
                error ? "border-red-300 focus:ring-red-500" : ""
              }`}
              autoFocus
              disabled={isSubmitting}
              aria-invalid={!!error}
              aria-describedby={error ? "input-error" : "input-helper"}
            />
          ) : (
            <input
              id="dynamic-input"
              type={
                inputType === "email"
                  ? "email"
                  : inputType === "phone"
                  ? "tel"
                  : "text"
              }
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={getPlaceholder()}
              className={`input-field ${
                error ? "border-red-300 focus:ring-red-500" : ""
              }`}
              autoFocus
              disabled={isSubmitting}
              aria-invalid={!!error}
              aria-describedby={error ? "input-error" : "input-helper"}
            />
          )}
          {error ? (
            <p
              id="input-error"
              className="text-sm text-red-600 mt-2 flex items-center gap-1.5"
              role="alert"
            >
              <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" />
              {error}
            </p>
          ) : getHelperText() ? (
            <p id="input-helper" className="text-xs text-gray-500 mt-2">
              {getHelperText()}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3">
          {canGoBack && onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50 transition-all duration-150"
              aria-label="Go back to previous step"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-[#27A9E2] to-blue-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50 transition-all duration-150"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
