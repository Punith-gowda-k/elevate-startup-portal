const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;

export function validateLogin(data = {}) {
  const email = String(data.email || "")
    .trim()
    .toLowerCase();
  const password = String(data.password || "");
  if (!EMAIL_PATTERN.test(email)) {
    return { valid: false, message: "Enter a valid email address." };
  }
  if (!password) {
    return { valid: false, message: "Enter your password." };
  }
  return { valid: true, message: "" };
}

export function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) {
    return {
      valid: false,
      message: "Password must contain at least 8 characters.",
    };
  }
  if (!/[A-Z]/.test(value)) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter.",
    };
  }
  if (!SPECIAL_CHARACTER_PATTERN.test(value)) {
    return {
      valid: false,
      message: "Password must contain at least one special character.",
    };
  }
  return { valid: true, message: "" };
}

export function validateRegistration(data = {}) {
  const startupName = String(data.startupName || "").trim();
  const founderName = String(data.founderName || "").trim();
  const email = String(data.email || "")
    .trim()
    .toLowerCase();
  const phone = String(data.phone || "").trim();
  const cin = String(data.cin || "")
    .trim()
    .toUpperCase();
  const password = String(data.password || "");

  if (!startupName || startupName.length < 3) {
    return { valid: false, message: "Enter a valid startup name." };
  }
  if (!founderName || founderName.length < 2) {
    return { valid: false, message: "Enter a valid founder name." };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { valid: false, message: "Enter a valid email address." };
  }
  if (!/^\+?[0-9\s()-]{8,16}$/.test(phone)) {
    return { valid: false, message: "Enter a valid phone number." };
  }
  if (cin && !/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}$/.test(cin)) {
    return { valid: false, message: "Enter a valid 21-character CIN." };
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return passwordValidation;
  }

  return { valid: true, message: "" };
}
