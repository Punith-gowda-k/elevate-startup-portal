const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: isFormData
      ? options.headers
      : { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "The database operation failed.");
  }
  return data;
}

export async function registerUser(account) {
  const { user } = await request("/api/register", {
    method: "POST",
    body: JSON.stringify(account),
  });
  return user;
}

export async function authenticateUser(email, password) {
  const { user } = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return user;
}

export async function getEligibility(userId) {
  const { eligibility } = await request(
    `/api/eligibility/${encodeURIComponent(userId)}`,
  );
  return eligibility;
}

export async function verifyEligibility(userId, details) {
  return request("/api/eligibility", {
    method: "POST",
    body: JSON.stringify({ userId, ...details }),
  });
}

export async function getTransactions(userId) {
  const { transactions } = await request(
    `/api/transactions/${encodeURIComponent(userId)}`,
  );
  return transactions;
}

export async function addTransaction(userId, transaction) {
  if (transaction?.proof instanceof File) {
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("date", transaction.date);
    formData.append("type", transaction.type);
    formData.append("description", transaction.description);
    formData.append("amount", String(transaction.amount));
    formData.append("proof", transaction.proof);

    const { transaction: record } = await request("/api/transactions", {
      method: "POST",
      body: formData,
    });
    return record;
  }

  const { transaction: record } = await request("/api/transactions", {
    method: "POST",
    body: JSON.stringify({ userId, ...transaction }),
  });
  return record;
}
