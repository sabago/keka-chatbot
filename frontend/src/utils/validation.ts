import { parsePhoneNumber } from 'libphonenumber-js';

export function validateEmail(email: string): boolean {
  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  try {
    const phoneNumber = parsePhoneNumber(phone, 'US');
    // Ensure it's valid AND is a US number
    return phoneNumber.isValid() && phoneNumber.country === 'US';
  } catch {
    // Fallback: Require exactly 10 digits for US numbers
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length === 10;
  }
}

export function formatPhone(phone: string): string {
  try {
    const phoneNumber = parsePhoneNumber(phone, 'US');
    return phoneNumber.formatNational();
  } catch {
    return phone;
  }
}

export function getErrorMessage(contactType: 'email' | 'phone', value: string): string {
  if (!value.trim()) {
    return `Please enter your ${contactType}`;
  }

  if (contactType === 'email' && !validateEmail(value)) {
    return 'Please enter a valid email address';
  }

  if (contactType === 'phone' && !validatePhone(value)) {
    return 'Please enter a valid US phone number (10 digits)';
  }

  return '';
}
