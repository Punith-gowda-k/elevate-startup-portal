const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CSRF_TOKEN_ID_KEY = "ksfp_csrf_token_id";
const CSRF_TOKEN_KEY = "ksfp_csrf_token";

async function getCsrfToken() {
  let id = sessionStorage.getItem(CSRF_TOKEN_ID_KEY);
  let token = sessionStorage.getItem(CSRF_TOKEN_KEY);
  if (!id || !token) {
    try {
      const res = await fetch(`${API_URL}/api/csrf-token`, {
        method: "GET",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        id = data.csrfTokenId;
        token = data.csrfToken;
        sessionStorage.setItem(CSRF_TOKEN_ID_KEY, id);
        sessionStorage.setItem(CSRF_TOKEN_KEY, token);
      }
    } catch {
      // Non-blocking: CSRF will be skipped if token retrieval fails
    }
  }
  return { id, token };
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const { id, token } = await getCsrfToken();

  const headers = {
    ...options.headers,
  };

  if (!isFormData && token) {
    headers["x-csrf-token"] = token;
    headers["x-csrf-token-id"] = id;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: isFormData
      ? options.headers
      : { "Content-Type": "application/json", ...headers },
  });

  // Clear CSRF token if server returns 403
  if (response.status === 403) {
    sessionStorage.removeItem(CSRF_TOKEN_ID_KEY);
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
  }

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
