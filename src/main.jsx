import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Eye,
  EyeOff,
  FileText,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Phone,
  Plus,
  ReceiptIndianRupee,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  addTransaction as addTransactionToDatabase,
  authenticateUser,
  getTransactions,
  registerUser,
} from "./database.js";
import { validateLogin, validateRegistration } from "../validation.js";
import "./styles.css";

const DEMO_FUND = {
  approved: 2500000,
  spent: 875000,
  remaining: 1625000,
  transactions: [
    {
      id: "TXN-2026-001",
      date: "02 Sep 2026",
      type: "Fund Disbursement",
      description: "First tranche released",
      amount: 1500000,
      status: "Credited",
    },
    {
      id: "TXN-2026-002",
      date: "08 Sep 2026",
      type: "Utilization",
      description: "Product development",
      amount: -325000,
      status: "Approved",
    },
    {
      id: "TXN-2026-003",
      date: "14 Sep 2026",
      type: "Utilization",
      description: "Cloud infrastructure",
      amount: -175000,
      status: "Approved",
    },
    {
      id: "TXN-2026-004",
      date: "21 Sep 2026",
      type: "Utilization",
      description: "Team & operations",
      amount: -225000,
      status: "Approved",
    },
    {
      id: "TXN-2026-005",
      date: "29 Sep 2026",
      type: "Utilization",
      description: "Marketing & outreach",
      amount: -150000,
      status: "Approved",
    },
  ],
};

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function App() {
  const [page, setPage] = useState("login");
  const [startup, setStartup] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("ksfp_session")) || null;
    } catch {
      return null;
    }
  });

  const login = (data) => {
    setStartup(data);
    sessionStorage.setItem("ksfp_session", JSON.stringify(data));
    setPage("dashboard");
  };

  const logout = () => {
    setStartup(null);
    sessionStorage.removeItem("ksfp_session");
    setPage("login");
  };

  return (
    <div className="app-shell">
      {page === "login" && (
        <LoginPage onLogin={login} onRegister={() => setPage("register")} />
      )}
      {page === "register" && (
        <RegisterPage onBack={() => setPage("login")} onRegistered={login} />
      )}
      {page === "dashboard" && startup && (
        <Dashboard startup={startup} onLogout={logout} />
      )}
    </div>
  );
}

function PortalHeader({ compact = false }) {
  return (
    <header className={`portal-header ${compact ? "compact" : ""}`}>
      <div className="brand-mark">
        <img src="./src/uploads/logo.jpg" alt="Logo" />
      </div>
      <div>
        <div className="brand-title">Government of Karnataka</div>
        <div className="brand-subtitle">Startup Fund Management Portal</div>
      </div>
    </header>
  );
}

function LoginPage({ onLogin, onRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const validation = validateLogin({ email, password });
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setLoading(true);

    try {
      const user = await authenticateUser(email, password);
      if (!user) {
        setError("Invalid email address or password.");
        return;
      }
      onLogin(user);
    } catch (databaseError) {
      setError(databaseError.message || "Unable to access the database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-visual">
        <div className="visual-overlay" />
        <PortalHeader />
        <div className="visual-content">
          <span className="eyebrow">KARNATAKA STARTUP ECOSYSTEM</span>
          <h1>Empowering Karnataka startups through transparent funding.</h1>
          <p>
            A secure portal prototype for startup registration, government fund
            tracking, utilization and transaction visibility.
          </p>
          <div className="visual-points">
            <span>
              <CheckCircle2 size={18} /> Fund transparency
            </span>
            <span>
              <CheckCircle2 size={18} /> Digital startup registration
            </span>
            <span>
              <CheckCircle2 size={18} /> Real-time utilization view
            </span>
          </div>
        </div>
      </div>

      <main className="auth-panel">
        <div className="mobile-brand">
          <PortalHeader compact />
        </div>
        <div className="auth-card">
          <div className="card-icon">
            <ShieldCheck size={25} />
          </div>
          <span className="eyebrow">STARTUP LOGIN</span>
          <h2>Welcome back</h2>
          <p className="muted">
            Login to view your government funding account.
          </p>

          {error && <div className="alert error">{error}</div>}

          <form onSubmit={submit} className="form">
            <label>Email address</label>
            <div className="input-wrap">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="startup@company.com"
                required
              />
            </div>

            <label>Password</label>
            <div className="input-wrap">
              <ShieldCheck size={18} />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              className="primary-btn full"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  Login <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="auth-switch">
            New startup?{" "}
            <button onClick={onRegister}>Register your startup</button>
          </div>

          {/* <p className="prototype-note">
            Prototype interface — connect this UI to the official authentication
            and government fund APIs before production use.
          </p> */}
        </div>
      </main>
    </div>
  );
}

function RegisterPage({ onBack, onRegistered }) {
  const [form, setForm] = useState({
    startupName: "",
    founderName: "",
    email: "",
    phone: "",
    cin: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!form.terms) {
      setError("Please accept the declaration to continue.");
      return;
    }
    const validation = validateRegistration(form);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setLoading(true);
    try {
      const account = {
        startupName: form.startupName,
        founderName: form.founderName,
        email: form.email,
        phone: form.phone,
        cin: form.cin,
        password: form.password,
      };
      const registeredUser = await registerUser(account);
      onRegistered({
        id: registeredUser.id,
        startupName: registeredUser.startupName,
        founderName: registeredUser.founderName,
        email: registeredUser.email,
        phone: registeredUser.phone,
        cin: registeredUser.cin,
      });
    } catch (databaseError) {
      setError(databaseError.message || "Unable to create the account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-top">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={18} /> Back to Login
        </button>
        <PortalHeader compact />
      </div>

      <div className="register-container">
        <div className="register-heading">
          <span className="eyebrow">STARTUP REGISTRATION</span>
          <h1>Register your startup</h1>
          <p>
            Enter your organization and founder details to create a portal
            account.
          </p>
        </div>

        {error && <div className="alert error">{error}</div>}

        <form className="register-card" onSubmit={submit}>
          <section className="form-section">
            <div className="section-heading">
              <Building2 size={20} />
              <div>
                <h3>Company details</h3>
                <p>Basic information about the startup.</p>
              </div>
            </div>
            <div className="form-grid">
              <Field
                label="Startup / Company name"
                value={form.startupName}
                onChange={(v) => update("startupName", v)}
                placeholder="ABC Technologies Pvt. Ltd."
                required
              />
              <Field
                label="CIN / Registration number (optional)"
                value={form.cin}
                onChange={(v) => update("cin", v)}
                placeholder="Company registration number"
              />
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <UserRound size={20} />
              <div>
                <h3>Founder & contact</h3>
                <p>Details of the authorized startup representative.</p>
              </div>
            </div>
            <div className="form-grid">
              <Field
                label="Founder / Authorized person"
                value={form.founderName}
                onChange={(v) => update("founderName", v)}
                placeholder="Full name"
                required
              />
              <Field
                label="Mobile number"
                value={form.phone}
                onChange={(v) => update("phone", v)}
                placeholder="+91 98765 43210"
                required
              />
              <Field
                label="Email address"
                type="email"
                value={form.email}
                onChange={(v) => update("email", v)}
                placeholder="official@startup.com"
                required
              />
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <ShieldCheck size={20} />
              <div>
                <h3>Account security</h3>
                <p>Create a password for portal access.</p>
              </div>
            </div>
            <div className="form-grid">
              <Field
                label="Password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(v) => update("password", v)}
                placeholder="8+ chars, uppercase & special character"
                required
              />
              <Field
                label="Confirm password"
                type={showPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(v) => update("confirmPassword", v)}
                placeholder="Re-enter password"
                required
              />
            </div>
            <div className="password-rules">
              <strong>Password requirements</strong>
              <span>8+ characters</span>
              <span>1 uppercase letter</span>
              <span>1 special character</span>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.terms}
                onChange={(e) => update("terms", e.target.checked)}
              />
              <span>
                I declare that the information provided is accurate and belongs
                to the registered startup.
              </span>
            </label>
            <button
              type="button"
              className="text-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide passwords" : "Show passwords"}
            </button>
          </section>

          <div className="register-actions">
            <button type="button" className="secondary-btn" onClick={onBack}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? (
                "Creating account..."
              ) : (
                <>
                  Create startup account <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function Dashboard({ startup, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("overview");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getTransactions(startup.id)
      .then((records) => {
        if (active) {
          setTransactions(records);
          setLoading(false);
        }
      })
      .catch((databaseError) => {
        if (active) {
          setError(databaseError.message || "Unable to load transactions.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [startup.id]);

  const spent = transactions.reduce(
    (total, transaction) =>
      transaction.type === "Utilization"
        ? total + Number(transaction.amount)
        : total,
    0,
  );
  const remaining = DEMO_FUND.approved - spent;
  const spentPercent = Math.round((spent / DEMO_FUND.approved) * 100);

  const addTransaction = async ({ date, type, description, amount, proof }) => {
    try {
      const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString(
        "en-GB",
        { day: "2-digit", month: "short", year: "numeric" },
      );
      const record = await addTransactionToDatabase(startup.id, {
        date: formattedDate,
        type,
        description,
        amount,
        proof,
      });
      setTransactions((current) => [...current, record]);
      return true;
    } catch (databaseError) {
      setError(databaseError.message || "Unable to add the transaction.");
      return false;
    }
  };

  const nav = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "transactions", label: "Transactions", icon: ReceiptIndianRupee },
    { id: "profile", label: "Startup Profile", icon: Building2 },
  ];

  return (
    <div className="dashboard">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="side-brand">
          <div className="brand-mark">
            {" "}
            <img src="./src/uploads/logo.jpg" alt="Logo" />
          </div>
          <div>
            <strong>Karnataka</strong>
            <span>Startup Portal</span>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="side-label">PORTAL</div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={active === item.id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setActive(item.id);
                  setMobileOpen(false);
                }}
              >
                <Icon size={19} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="side-bottom">
          <div className="security-mini">
            <ShieldCheck size={18} />
            <span>Secure portal access</span>
          </div>
          <button className="nav-item logout" onClick={onLogout}>
            <LogOut size={19} /> Logout
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="dashboard-main">
        <header className="dashboard-header">
          <button className="menu-btn" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
          <div>
            <span className="header-kicker">STARTUP FUND ACCOUNT</span>
            <h2>
              {active === "overview"
                ? "Funding overview"
                : active === "transactions"
                  ? "Transactions"
                  : "Startup profile"}
            </h2>
          </div>
          <div className="user-chip">
            <div className="avatar">
              {startup.founderName?.charAt(0) || "S"}
            </div>
            <div>
              <strong>{startup.founderName}</strong>
              <span>{startup.startupName}</span>
            </div>
          </div>
        </header>

        {active === "overview" && (
          <Overview
            startup={startup}
            spent={spent}
            remaining={remaining}
            spentPercent={spentPercent}
            transactions={transactions}
            loading={loading}
            error={error}
          />
        )}
        {active === "transactions" && (
          <Transactions
            transactions={transactions}
            remaining={remaining}
            onAddTransaction={addTransaction}
            loading={loading}
            databaseError={error}
          />
        )}
        {active === "profile" && <Profile startup={startup} />}
      </main>
    </div>
  );
}

function Overview({
  startup,
  spent,
  remaining,
  spentPercent,
  transactions,
  loading,
  error,
}) {
  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">ACCOUNT VERIFIED</span>
          <h1>Hello, {startup.founderName?.split(" ")[0] || "Founder"} 👋</h1>
          <p>
            Here is the current government fund status for{" "}
            <strong>{startup.startupName}</strong>.
          </p>
        </div>
        <div className="verified">
          <CheckCircle2 size={19} /> Verified startup
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          icon={IndianRupee}
          label="Government Fund Approved"
          value={money(DEMO_FUND.approved)}
          tone="blue"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Fund Spent"
          value={money(spent)}
          tone="orange"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Fund Remaining"
          value={money(remaining)}
          tone="green"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel utilization">
          <div className="panel-title">
            <div>
              <h3>Fund utilization</h3>
              <p>Approved fund vs. utilized amount</p>
            </div>
            <strong>{spentPercent}%</strong>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${spentPercent}%` }}
            />
          </div>
          <div className="utilization-values">
            <span>
              Spent <b>{money(spent)}</b>
            </span>
            <span>
              Remaining <b>{money(remaining)}</b>
            </span>
          </div>
        </section>

        <section className="panel account-panel">
          <div className="panel-title">
            <div>
              <h3>Account information</h3>
              <p>Registered startup</p>
            </div>
            <Building2 size={22} />
          </div>
          <div className="account-line">
            <span>Startup</span>
            <strong>{startup.startupName}</strong>
          </div>
          <div className="account-line">
            <span>Founder</span>
            <strong>{startup.founderName}</strong>
          </div>
          <div className="account-line">
            <span>Email</span>
            <strong>{startup.email}</strong>
          </div>
        </section>
      </div>

      <section className="panel transaction-panel">
        <div className="panel-title">
          <div>
            <h3>Recent transactions</h3>
            <p>Latest fund credits and utilization entries</p>
          </div>
          <span className="count-badge">{transactions.length} entries</span>
        </div>
        {error && <div className="alert error">{error}</div>}
        {loading ? (
          <div className="database-loading">Loading transactions...</div>
        ) : (
          <TransactionTable transactions={transactions} compact />
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-icon">
        <Icon size={21} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Transactions({
  transactions,
  remaining,
  onAddTransaction,
  loading,
  databaseError,
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => {
    const today = new Date();
    const date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    return {
      date,
      type: "Utilization",
      description: "",
      amount: "",
      proof: null,
    };
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (form.type === "Utilization" && amount > remaining) {
      setError("This amount exceeds the remaining approved fund.");
      return;
    }
    if (form.proof && form.proof.size > 10 * 1024 * 1024) {
      setError("Proof document must be 10 MB or smaller.");
      return;
    }
    setSaving(true);
    const saved = await onAddTransaction({ ...form, amount });
    setSaving(false);
    if (!saved) {
      return;
    }
    setError("");
    setFormOpen(false);
    setForm((current) => ({
      ...current,
      description: "",
      amount: "",
      proof: null,
    }));
  };

  return (
    <div className="content">
      <section className="panel transaction-panel full-panel">
        <div className="panel-title">
          <div>
            <h3>All transactions</h3>
            <p>Government fund credits and approved utilization records</p>
          </div>
          <div className="transaction-heading-actions">
            <span className="count-badge">{transactions.length} entries</span>
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setError("");
                setFormOpen(!formOpen);
              }}
              aria-expanded={formOpen}
            >
              {formOpen ? <X size={17} /> : <Plus size={17} />}
              {formOpen ? "Close" : "Add transaction"}
            </button>
          </div>
        </div>
        {formOpen && (
          <form className="transaction-form" onSubmit={submit}>
            {error && <div className="alert error">{error}</div>}
            <div className="transaction-form-grid">
              <div className="field">
                <label htmlFor="transaction-type">Transaction type</label>
                <select
                  id="transaction-type"
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value })
                  }
                >
                  <option>Utilization</option>
                  <option>Fund Disbursement</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="transaction-date">Date</label>
                <input
                  id="transaction-date"
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm({ ...form, date: event.target.value })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="transaction-amount">Amount (INR)</label>
                <input
                  id="transaction-amount"
                  type="number"
                  min="1"
                  step="1"
                  max={form.type === "Utilization" ? remaining : undefined}
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  placeholder="Enter amount"
                  required
                />
              </div>
              <div className="field transaction-description">
                <label htmlFor="transaction-description">Description</label>
                <input
                  id="transaction-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="What was this transaction for?"
                  required
                />
              </div>
              <div className="field transaction-file">
                <label htmlFor="transaction-proof">
                  Proof document (optional)
                </label>
                <input
                  id="transaction-proof"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                  onChange={(event) =>
                    setForm({ ...form, proof: event.target.files?.[0] || null })
                  }
                />
                <small>Upload up to 10 MB, if available.</small>
              </div>
            </div>
            <div className="transaction-form-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? "Saving..." : "Add transaction"}
              </button>
            </div>
          </form>
        )}
        {databaseError && <div className="alert error">{databaseError}</div>}
        {loading ? (
          <div className="database-loading">Loading transactions...</div>
        ) : (
          <TransactionTable transactions={transactions} />
        )}
      </section>
    </div>
  );
}

function TransactionTable({ transactions, compact = false }) {
  const rows = compact
    ? transactions.slice(-4).reverse()
    : transactions.slice().reverse();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.id}</strong>
              </td>
              <td>{row.date}</td>
              <td>{row.type}</td>
              <td>{row.description}</td>
              <td className={row.type === "Utilization" ? "debit" : "credit"}>
                {row.type === "Utilization" ? "−" : "+"}
                {money(row.amount)}
              </td>
              <td>
                <span className="status">{row.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Profile({ startup }) {
  return (
    <div className="content">
      <section className="panel profile-panel">
        <div className="profile-hero">
          <div className="large-avatar">
            {startup.startupName?.charAt(0) || "S"}
          </div>
          <div>
            <span className="eyebrow">REGISTERED STARTUP</span>
            <h1>{startup.startupName}</h1>
            <p>Startup fund portal account</p>
          </div>
          <span className="verified">
            <CheckCircle2 size={18} /> Verified
          </span>
        </div>
        <div className="profile-grid">
          <ProfileItem
            icon={UserRound}
            label="Founder / Authorized person"
            value={startup.founderName}
          />
          <ProfileItem icon={Mail} label="Email" value={startup.email} />
          <ProfileItem icon={Phone} label="Mobile" value={startup.phone} />
          <ProfileItem
            icon={FileText}
            label="CIN / Registration number"
            value={startup.cin}
          />
        </div>
      </section>
    </div>
  );
}

function ProfileItem({ icon: Icon, label, value }) {
  return (
    <div className="profile-item">
      <div className="profile-item-icon">
        <Icon size={19} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value || "Not provided"}</strong>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
