import { useState, FormEvent } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import {
  validateEmail,
  validatePhone,
  getErrorMessage,
  formatPhone,
} from "../../utils/validation";

interface IntakeFormProps {
  contactType: "email" | "phone";
  onSubmit: (value: string) => void;
  onCancel?: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export default function IntakeForm({
  contactType,
  onSubmit,
  onCancel,
  onBack,
  canGoBack = false,
}: IntakeFormProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const errorMsg = getErrorMessage(contactType, value);
    if (errorMsg) {
      setError(errorMsg);
      return;
    }

    setIsSubmitting(true);
    const formattedValue = contactType === "phone" ? formatPhone(value) : value;
    onSubmit(formattedValue);
  };

  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (error) {
      setError("");
    }
  };

  const isValid =
    contactType === "email" ? validateEmail(value) : validatePhone(value);

  return (
    <form
      onSubmit={handleSubmit}
      className="px-5 py-4 border-t border-gray-200 bg-white"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="contact-input"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            {contactType === "email"
              ? "Your email address"
              : "Your phone number"}
          </label>
          <input
            id="contact-input"
            type={contactType === "email" ? "email" : "tel"}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={
              contactType === "email" ? "you@example.com" : "(555) 123-4567"
            }
            className={`input-field ${
              error ? "border-red-300 focus:ring-red-500" : ""
            }`}
            autoFocus
            disabled={isSubmitting}
            aria-invalid={!!error}
            aria-describedby={error ? "contact-error" : "contact-helper"}
          />
          {error ? (
            <p
              id="contact-error"
              className="text-sm text-red-600 mt-2 flex items-center gap-1.5"
              role="alert"
            >
              <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" />
              {error}
            </p>
          ) : (
            <p id="contact-helper" className="text-xs text-gray-500 mt-2">
              {contactType === "email"
                ? "Enter a valid email address (e.g., you@example.com)"
                : "Enter a valid US phone number (10 digits, e.g., 555-123-4567)"}
            </p>
          )}
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
