import { parsePhoneNumber } from 'libphonenumber-js';

export function validateEmail(email: string): boolean {
  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Simple validation: Just check for exactly 10 digits (US format)
  // This is more lenient than libphonenumber-js which rejects test numbers like 555-xxx-xxxx
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 10;
}

export function formatPhone(phone: string): string {
  try {
    const phoneNumber = parsePhoneNumber(phone, 'US');
    if (phoneNumber.isValid()) {
      return phoneNumber.formatNational();
    }
  } catch {
    // Fall through to manual formatting
  }

  // Manual formatting for 10-digit numbers
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }

  return phone;
}

export function validateDate(dateString: string): boolean {
  // Check format using regex - accepts both M/D/YYYY and MM/DD/YYYY
  // Month: 1-9 or 01-09 or 10-12
  // Day: 1-9 or 01-09 or 10-31
  const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(\d{4})$/;

  if (!dateRegex.test(dateString)) {
    return false;
  }

  // Parse and validate as actual date
  const [month, day, year] = dateString.split('/').map(Number);
  const date = new Date(year, month - 1, day);

  // Check if the date is valid (handles leap years, invalid days per month)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function validateDateRange(dateString: string): boolean {
  if (!validateDate(dateString)) {
    return false;
  }

  const [, , year] = dateString.split('/').map(Number);
  const currentYear = new Date().getFullYear();

  return year >= 1900 && year <= currentYear + 1;
}

export function getErrorMessage(
  inputType: 'email' | 'phone' | 'date',
  value: string
): string {
  if (!value.trim()) {
    if (inputType === 'date') {
      return 'Please enter a date';
    }
    return `Please enter your ${inputType}`;
  }

  if (inputType === 'email' && !validateEmail(value)) {
    return 'Please enter a valid email address';
  }

  if (inputType === 'phone' && !validatePhone(value)) {
    return 'Please enter a valid US phone number (10 digits)';
  }

  if (inputType === 'date') {
    if (!validateDate(value)) {
      return 'Please enter a valid date (e.g., 1/15/1990 or 01/15/1990)';
    }
    if (!validateDateRange(value)) {
      return 'Please enter a date between 1900 and the current year';
    }
  }

  return '';
}
