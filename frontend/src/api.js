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

export async function authenticateGM(email, password) {
  const { admin, token } = await request("/api/gm/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { admin, token };
}

export async function getGMStartups(token) {
  const { startups } = await request("/api/gm/startups", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return startups;
}

export async function getGMStartup(userId, token) {
  const { startup } = await request(
    `/api/gm/startups/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return startup;
}

export async function getGMTransactions(token) {
  const { transactions } = await request("/api/gm/transactions", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return transactions;
}

export async function approveStartup(userId, token) {
  return request(`/api/gm/startups/${encodeURIComponent(userId)}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function rejectStartup(userId, token) {
  return request(`/api/gm/startups/${encodeURIComponent(userId)}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
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

// ============================================================
//  Admin Portal API
// ============================================================

export async function authenticateAdmin(email, password) {
  const { admin, token } = await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { admin, token };
}

// Unified staff login — the server decides whether the credentials belong to
// an Admin or the Government Manager and returns the matching role.
export async function authenticateStaff(email, password) {
  const { role, admin, token } = await request("/api/staff/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { role, admin, token };
}

// ---- Users & role management ----
export async function getAdminUsers(token) {
  const { users } = await request("/api/admin/users", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return users;
}

export async function createAdminUser(token, account) {
  const { user } = await request("/api/admin/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(account),
  });
  return user;
}

export async function updateAdminUser(token, userId, updates) {
  const { user } = await request(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
  return user;
}

export async function setUserActive(token, userId, isActive) {
  const { user } = await request(
    `/api/admin/users/${encodeURIComponent(userId)}/status`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive }),
    },
  );
  return user;
}

// ---- Roles & permissions ----
export async function getAdminRoles(token) {
  const { roles } = await request("/api/admin/roles", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return roles;
}

export async function getAdminPermissions(token) {
  const { permissions } = await request("/api/admin/permissions", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return permissions;
}

export async function setRolePermissions(token, roleId, permissionCodes) {
  const { role } = await request(
    `/api/admin/roles/${encodeURIComponent(roleId)}/permissions`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ permissionCodes }),
    },
  );
  return role;
}

// ---- Activity logs ----
export async function getActivityLogs(token, params = {}) {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const { logs } = await request(`/api/admin/activity-logs${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return logs;
}

// ---- Dynamic form builder ----
export async function getAdminFormDefinitions(token) {
  const { forms } = await request("/api/admin/forms", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return forms;
}

export async function createAdminForm(token, form) {
  const { form: created } = await request("/api/admin/forms", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(form),
  });
  return created;
}

export async function getAdminFormFields(token, formId) {
  const { fields } = await request(
    `/api/admin/forms/${encodeURIComponent(formId)}/fields`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return fields;
}

export async function createFormField(token, formId, field) {
  const { field: created } = await request(
    `/api/admin/forms/${encodeURIComponent(formId)}/fields`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(field),
    },
  );
  return created;
}

export async function updateFormField(token, fieldId, updates) {
  const { field } = await request(
    `/api/admin/fields/${encodeURIComponent(fieldId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    },
  );
  return field;
}

export async function deleteFormField(token, fieldId) {
  return request(`/api/admin/fields/${encodeURIComponent(fieldId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ---- Public dynamic form rendering (no auth) ----
export async function getPublicForm(formKey) {
  const { form } = await request(
    `/api/forms/${encodeURIComponent(formKey)}`,
  );
  return form;
}

export async function submitPublicForm(formKey, data) {
  return request(`/api/forms/${encodeURIComponent(formKey)}/submit`, {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

// ---- Elevate Winners ----
export async function getWinnerOptions(token) {
  const { sectors, districts } = await request("/api/admin/winners/options", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { sectors, districts };
}

export async function getWinners(token, year) {
  const query = year && year !== "All" ? `?year=${encodeURIComponent(year)}` : "";
  const { winners } = await request(`/api/admin/winners${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return winners;
}

export async function createWinner(token, winner) {
  const { winner: created } = await request("/api/admin/winners", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(winner),
  });
  return created;
}

export async function deleteWinner(token, winnerId) {
  return request(`/api/admin/winners/${encodeURIComponent(winnerId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateWinner(token, winnerId, updates) {
  const { winner } = await request(
    `/api/admin/winners/${encodeURIComponent(winnerId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    },
  );
  return winner;
}

// ---- Public Elevate Winners (registration auto-fill, no auth) ----
export async function getWinnerYears() {
  const { years } = await request("/api/winners/years");
  return years;
}

export async function getPublicWinners(year) {
  const query = year ? `?year=${encodeURIComponent(year)}` : "";
  const { winners } = await request(`/api/winners${query}`);
  return winners;
}
