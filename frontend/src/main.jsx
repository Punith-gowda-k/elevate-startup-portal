import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
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
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  addTransaction as addTransactionToDatabase,
  approveStartup as approveStartupRequest,
  authenticateGM,
  authenticateUser,
  getEligibility,
  getGMStartup,
  getGMStartups,
  getGMTransactions,
  getTransactions,
  registerUser,
  rejectStartup as rejectStartupRequest,
  verifyEligibility,
} from "./api.js";
import {
  validateLogin,
  validateRegistration,
} from "../../shared/validation.js";
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
  const [gmSession, setGMSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("ksfp_gm_session")) || null;
    } catch {
      return null;
    }
  });

  const login = (data) => {
    setStartup(data);
    sessionStorage.setItem("ksfp_session", JSON.stringify(data));
    setPage("eligibility");
  };

  const logout = () => {
    setStartup(null);
    sessionStorage.removeItem("ksfp_session");
    setPage("login");
  };

  const gmLogin = async (data) => {
    setGMSession(data);
    sessionStorage.setItem("ksfp_gm_session", JSON.stringify(data));
    setPage("gm-dashboard");
  };

  const gmLogout = () => {
    setGMSession(null);
    sessionStorage.removeItem("ksfp_gm_session");
    setPage("login");
  };

  const verified = () => {
    setStartup((current) => ({ ...current, eligibilityVerified: true }));
    setPage("dashboard");
  };

  return (
    <div className="app-shell">
      {page === "login" && (
        <LoginPage
          onLogin={login}
          onRegister={() => setPage("register")}
          onGMLogin={() => setPage("gm-login")}
        />
      )}
      {page === "gm-login" && (
        <GMLoginPage onLogin={gmLogin} onBack={() => setPage("login")} />
      )}
      {page === "register" && (
        <RegisterPage onBack={() => setPage("login")} onRegistered={login} />
      )}
      {page === "eligibility" && startup && (
        <EligibilityPage
          startup={startup}
          onVerified={verified}
          onBack={logout}
        />
      )}
      {page === "dashboard" && startup && (
        <Dashboard startup={startup} onLogout={logout} />
      )}
      {page === "gm-dashboard" && gmSession && (
        <GMDashboard session={gmSession} onLogout={gmLogout} />
      )}
    </div>
  );
}

function PortalHeader({ compact = false }) {
  return (
    <header className={`portal-header ${compact ? "compact" : ""}`}>
      <div className="brand-mark">
        <img src="/uploads/logo.jpg" alt="Logo" />
      </div>
      <div>
        <div className="brand-title">Government of Karnataka</div>
        <div className="brand-subtitle">Startup Fund Management Portal</div>
      </div>
    </header>
  );
}

function LoginPage({ onLogin, onRegister, onGMLogin }) {
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
          <h2>
            Empowering Karnataka startups through Idea2PoC Grant-in-Aid Fund
            Scheme.
          </h2>
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
          <button className="gm-login-link" onClick={onGMLogin}>
            Government Manager access
          </button>
        </div>
      </main>
    </div>
  );
}

function GMLoginPage({ onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await authenticateGM(email, password);
      onLogin({ ...session, email });
    } catch (loginError) {
      setError(loginError.message || "Unable to access the GM portal.");
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
          <span className="eyebrow">GOVERNMENT MANAGEMENT</span>
          <h2>Monitor every Karnataka startup activity.</h2>
          <p>
            Review eligibility, founder details, fund utilization and
            transaction records from one secure administration workspace.
          </p>
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
          <span className="eyebrow">GM PORTAL</span>
          <h2>Government Manager</h2>
          <p className="muted">Sign in to view all startup accounts.</p>
          {error && <div className="alert error">{error}</div>}
          <form onSubmit={submit} className="form">
            <label>GM email address</label>
            <div className="input-wrap">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <label>Password</label>
            <div className="input-wrap">
              <ShieldCheck size={18} />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                  Sign in securely <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <div className="auth-switch">
            <button onClick={onBack}>
              <ChevronLeft size={16} /> Back to startup login
            </button>
          </div>
          <p className="prototype-note">
            Preset credentials are configured in the server environment.
          </p>
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

function EligibilityPage({ startup, onVerified, onBack }) {
  const [form, setForm] = useState({
    registrationState: "Karnataka",
    entityType: "Private Limited",
    turnover: "",
    incorporationDate: "",
    innovationIdea: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Tracks the real eligibility status from the backend:
  // null (not submitted yet), "Pending", "Verified" or "Rejected".
  // The dashboard is only reachable once the GM sets this to "Verified".
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    getEligibility(startup.id)
      .then((record) => {
        if (!active) return;
        if (record) {
          setForm({
            registrationState: record.registration_state,
            entityType: record.entity_type,
            turnover: String(Number(record.turnover) / 10000000),
            incorporationDate: record.incorporation_date.slice(0, 10),
            innovationIdea: record.innovation_idea,
          });
          setStatus(record.status || "Pending");
        }
        setLoading(false);
      })
      .catch((databaseError) => {
        if (active) {
          setError(
            databaseError.message || "Unable to load eligibility details.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [startup.id]);

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.registrationState !== "Karnataka") {
      setError("Startup should be from Karnataka.");
      return;
    }
    const turnoverInCrores = Number(form.turnover);
    if (
      !form.turnover ||
      !Number.isFinite(turnoverInCrores) ||
      turnoverInCrores < 0
    ) {
      setError("Enter a valid current turnover.");
      return;
    }
    if (turnoverInCrores >= 100) {
      setError("Overall turnover should be less than 100 crore.");
      return;
    }
    const incorporationDate = new Date(`${form.incorporationDate}T00:00:00Z`);
    const tenYearsAgo = new Date();
    tenYearsAgo.setUTCFullYear(tenYearsAgo.getUTCFullYear() - 10);
    if (
      !form.incorporationDate ||
      Number.isNaN(incorporationDate.getTime()) ||
      incorporationDate > new Date() ||
      incorporationDate < tenYearsAgo
    ) {
      setError("Date of incorporation must be under 10 years.");
      return;
    }
    if (form.innovationIdea.trim().length < 20) {
      setError("Describe your innovation idea in at least 20 characters.");
      return;
    }

    setSaving(true);
    try {
      const result = await verifyEligibility(startup.id, {
        ...form,
        turnover: String(turnoverInCrores * 10000000),
      });
      if (!result.eligible) {
        setError(`You are not eligible. ${result.failedReasons.join(" ")}`);
        return;
      }
      // The backend always stores "Pending" until the GM approves, so we read
      // the status straight from the saved record instead of assuming success.
      setStatus(result.eligibility?.status || "Pending");
      setError("");
    } catch (databaseError) {
      setError(databaseError.message || "Unable to verify the startup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="eligibility-page">
      <header className="eligibility-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={18} /> Back to login
        </button>
        <PortalHeader compact />
      </header>

      <main className="eligibility-container">
        <div className="eligibility-heading">
          <span className="eligibility-icon">
            <ShieldCheck size={28} />
          </span>
          <span className="eyebrow">STARTUP ELIGIBILITY</span>
          <h1>Verify your startup</h1>
          <p>
            Complete the information below to check your startup against the
            Karnataka funding eligibility requirements.
          </p>
        </div>

        {error && <div className="alert error">{error}</div>}

        {loading ? (
          <div className="eligibility-card loading-card">
            Loading eligibility details...
          </div>
        ) : status === "Verified" ? (
          <div className="eligibility-card verified-card">
            <CheckCircle2 size={42} />
            <h2>Startup verified</h2>
            <p>
              Your startup has been approved by the Government Manager. You can
              now access your fund dashboard.
            </p>
            <button className="primary-btn" onClick={onVerified}>
              Continue to dashboard
            </button>
          </div>
        ) : status === "Rejected" ? (
          <div className="eligibility-card rejected-card">
            <X size={42} />
            <h2>Application rejected</h2>
            <p>
              Your eligibility application was rejected by the Government
              Manager. Please contact the scheme administrator for details.
            </p>
            <button className="secondary-btn" onClick={onBack}>
              Back to login
            </button>
          </div>
        ) : status === "Pending" ? (
          <div className="eligibility-card pending-card">
            <Clock3 size={42} />
            <h2>Awaiting GM approval</h2>
            <p>
              Your eligibility information has been submitted and is pending
              review by the Government Manager. You will be able to access the
              dashboard once your startup is approved.
            </p>
            <button className="secondary-btn" onClick={onBack}>
              Back to login
            </button>
          </div>
        ) : (
          <form className="eligibility-card" onSubmit={submit}>
            <section className="eligibility-section">
              <div className="eligibility-section-heading">
                <span>01</span>
                <div>
                  <h2>Company registration</h2>
                  <p>Tell us where your startup is registered.</p>
                </div>
              </div>
              <div className="eligibility-grid">
                <div className="field">
                  <label htmlFor="registration-state">
                    State of company registration
                  </label>
                  <select
                    id="registration-state"
                    value={form.registrationState}
                    onChange={(event) =>
                      update("registrationState", event.target.value)
                    }
                    required
                  >
                    <option>Karnataka</option>
                    <option>Other State</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="entity-type">Type of entity</label>
                  <select
                    id="entity-type"
                    value={form.entityType}
                    onChange={(event) =>
                      update("entityType", event.target.value)
                    }
                    required
                  >
                    <option>Private Limited</option>
                    <option>OPC</option>
                    <option>LLP</option>
                    <option>Partnership</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="turnover">Overall turnover (crores)</label>
                  <div className="currency-input">
                    <span>₹</span>
                    <input
                      id="turnover"
                      type="number"
                      min="0"
                      max="99.99"
                      step="0.01"
                      value={form.turnover}
                      onChange={(event) =>
                        update("turnover", event.target.value)
                      }
                      placeholder="Enter turnover in crores"
                      required
                    />
                    <small>crores</small>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="incorporation-date">
                    Date of incorporation
                  </label>
                  <input
                    id="incorporation-date"
                    type="date"
                    value={form.incorporationDate}
                    onChange={(event) =>
                      update("incorporationDate", event.target.value)
                    }
                    required
                  />
                </div>
              </div>
            </section>

            <section className="eligibility-section">
              <div className="eligibility-section-heading">
                <span>02</span>
                <div>
                  <h2>Describe your innovation idea</h2>
                  <p>
                    Explain the problem, solution, market, and expected impact.
                  </p>
                </div>
              </div>
              <div className="field idea-field">
                <label htmlFor="innovation-idea">Innovation idea</label>
                <textarea
                  id="innovation-idea"
                  value={form.innovationIdea}
                  onChange={(event) =>
                    update("innovationIdea", event.target.value)
                  }
                  placeholder="Describe your startup idea, target customers, unique innovation, and expected impact..."
                  minLength="20"
                  maxLength="5000"
                  rows="8"
                  required
                />
                <small>
                  {form.innovationIdea.trim().length}/5000 characters
                </small>
              </div>
            </section>

            <div className="eligibility-notice">
              <ShieldCheck size={18} />
              <p>
                By verifying, you confirm that the information provided is
                accurate and complete.
              </p>
            </div>

            <div className="eligibility-actions">
              <button type="button" className="secondary-btn" onClick={onBack}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? "Verifying startup..." : "Verify the startup"}
                <CheckCircle2 size={18} />
              </button>
            </div>
          </form>
        )}
      </main>
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

function GMDashboard({ session, onLogout }) {
  const [startups, setStartups] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("applied");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const records = await getGMStartups(session.token);
        const allTransactions = await getGMTransactions(session.token);
        if (active) {
          setStartups(records);
          setTransactions(allTransactions);
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "Unable to load GM data.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [session.token]);

  const loadStartup = async (userId) => {
    setError("");
    try {
      setSelected(await getGMStartup(userId, session.token));
      setMobileOpen(false);
    } catch (loadError) {
      setError(loadError.message || "Unable to load startup details.");
    }
  };

  const approveStartup = async (userId, eligibility) => {
    setError("");
    if (
      !confirm(
        "Approve this startup? The eligibility status will be set to Verified.",
      )
    ) {
      return false;
    }
    try {
      const result = await approveStartupRequest(userId, session.token);
      setSelected({ ...selected, eligibility: result.eligibility });
      const records = await getGMStartups(session.token);
      setStartups(records);
      setError("");
      return true;
    } catch (approveError) {
      setError(approveError.message || "Unable to approve the startup.");
      return false;
    }
  };

  const rejectStartup = async (userId, eligibility) => {
    setError("");
    if (
      !confirm(
        "Reject this startup? This will mark it as Rejected and remove the verified flag.",
      )
    ) {
      return false;
    }
    try {
      const result = await rejectStartupRequest(userId, session.token);
      setSelected({ ...selected, eligibility: result.eligibility });
      const records = await getGMStartups(session.token);
      setStartups(records);
      setError("");
      return true;
    } catch (rejectError) {
      setError(rejectError.message || "Unable to reject the startup.");
      return false;
    }
  };

  const filtered = startups.filter((startup) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      [
        startup.startupName,
        startup.founderName,
        startup.email,
        startup.cin,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      );

    const effectiveStatusFilter =
      view === "applied"
        ? "Applied Startups"
        : view === "verified"
          ? "Verified"
          : statusFilter;
    const matchesStatus =
      effectiveStatusFilter === "All" ||
      (() => {
        switch (effectiveStatusFilter) {
          case "Applied Startups":
            return startup.gmReviewStatus === "Pending GM Review";
          case "Verified":
            return startup.gmReviewStatus === "Verified";
          default:
            return true;
        }
      })();

    return matchesSearch && matchesStatus;
  });
  const totalTransactions = transactions.length;
  const verified = startups.filter(
    (startup) => startup.eligibilityStatus === "Verified",
  ).length;
  const totalFund = transactions
    .filter((transaction) => transaction.type === "Utilization")
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

  return (
    <div className="gm-dashboard">
      <aside className={`gm-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="side-brand">
          <div className="brand-mark">
            <img src="/uploads/logo.jpg" alt="Logo" />
          </div>
          <div>
            <strong>Karnataka</strong>
            <span>GM Administration</span>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="side-label">ADMINISTRATION</div>
        <button
          className={`gm-nav ${view === "dashboard" && !selected ? "active" : ""}`}
          onClick={() => {
            setView("dashboard");
            setSelected(null);
          }}
        >
          <LayoutDashboard size={19} /> Dashboard
        </button>
        <button
          className={`gm-nav ${view === "verified" && !selected ? "active" : ""}`}
          onClick={() => {
            setView("verified");
            setSelected(null);
          }}
        >
          <Building2 size={19} /> Startups
        </button>
        <button
          className={`gm-nav ${view === "applied" && !selected ? "active" : ""}`}
          onClick={() => {
            setView("applied");
            setSelected(null);
          }}
        >
          <Building2 size={19} /> Applied Startups
        </button>
        <button
          className={`gm-nav ${view === "transactions" ? "active" : ""}`}
          onClick={() => {
            setView("transactions");
            setSelected(null);
          }}
        >
          <ReceiptIndianRupee size={19} /> Transactions
        </button>
        <div className="side-bottom">
          <div className="security-mini">
            <ShieldCheck size={18} />
            <span>GM session secured</span>
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
      <main className="dashboard-main gm-main">
        <header className="dashboard-header">
          <button className="menu-btn" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
          <div>
            <span className="header-kicker">ADMIN CONTROL CENTER</span>
            <h2>
              {selected
                ? `Startup: ${selected.startupName}`
                : view === "dashboard"
                  ? "GM dashboard"
                  : view === "verified"
                    ? "Startups"
                    : view === "applied"
                      ? "Applied Startups"
                      : view === "transactions"
                        ? "Transactions"
                        : "Startup directory"}
            </h2>
          </div>
          <div className="user-chip">
            <div className="avatar">GM</div>
            <div>
              <strong>Government Manager</strong>
              <span>Administration portal</span>
            </div>
          </div>
        </header>
        {error && <div className="alert error">{error}</div>}
        {selected ? (
          <StartupDetail
            startup={selected}
            onBack={() => setSelected(null)}
            onApprove={approveStartup}
            onReject={rejectStartup}
          />
        ) : view === "dashboard" ? (
          <DashboardView
            startups={startups}
            transactions={transactions}
            loading={loading}
            verified={verified}
            totalTransactions={totalTransactions}
            totalFund={totalFund}
          />
        ) : view === "transactions" ? (
          <TransactionsView transactions={transactions} loading={loading} />
        ) : view === "verified" ? (
          <StartupList
            startups={filtered}
            loading={loading}
            search={search}
            setSearch={setSearch}
            statusFilter="Verified"
            setStatusFilter={() => {}}
            verified={verified}
            onSelect={loadStartup}
          />
        ) : view === "applied" ? (
          <StartupList
            startups={filtered}
            loading={loading}
            search={search}
            setSearch={setSearch}
            statusFilter="Applied Startups"
            setStatusFilter={() => {}}
            verified={verified}
            onSelect={loadStartup}
          />
        ) : (
          <StartupList
            startups={filtered}
            loading={loading}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            verified={verified}
            onSelect={loadStartup}
          />
        )}
      </main>
    </div>
  );
}

function DashboardView({
  startups,
  transactions,
  loading,
  verified,
  totalTransactions,
  totalFund,
}) {
  const statusCounts = startups.reduce(
    (counts, startup) => {
      const status = startup.eligibilityStatus || "Pending";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    { Verified: 0, Pending: 0 },
  );
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">ADMINISTRATION OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>
            Monitor startup registrations, eligibility status, and government
            fund activity.
          </p>
        </div>
        <div className="verified">
          <ShieldCheck size={19} /> Live administration data
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          icon={Building2}
          label="Registered startups"
          value={String(startups.length)}
          tone="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Verified startups"
          value={String(verified)}
          tone="green"
        />
        <StatCard
          icon={ReceiptIndianRupee}
          label="Total transactions"
          value={String(totalTransactions)}
          tone="orange"
        />
        <StatCard
          icon={IndianRupee}
          label="Tracked utilization"
          value={money(totalFund)}
          tone="blue"
        />
      </div>

      <div className="dashboard-section-grid">
        <section className="panel dashboard-status-panel">
          <div className="panel-title">
            <div>
              <h3>Eligibility status</h3>
              <p>Current startup verification distribution</p>
            </div>
            <ShieldCheck size={21} />
          </div>
          <div className="status-summary">
            <div>
              <span className="status-summary-dot verified" />
              <strong>{statusCounts.Verified}</strong>
              <small>Verified</small>
            </div>
            <div>
              <span className="status-summary-dot pending" />
              <strong>{statusCounts.Pending}</strong>
              <small>Pending</small>
            </div>
          </div>
        </section>

        <section className="panel dashboard-recent-panel">
          <div className="panel-title">
            <div>
              <h3>Recent transactions</h3>
              <p>Latest startup activity</p>
            </div>
            <ReceiptIndianRupee size={21} />
          </div>
          {loading ? (
            <div className="database-loading">Loading dashboard...</div>
          ) : recentTransactions.length ? (
            <div className="dashboard-recent-list">
              {recentTransactions.map((transaction) => (
                <div className="dashboard-recent-item" key={transaction.id}>
                  <div className="recent-icon">
                    <ReceiptIndianRupee size={16} />
                  </div>
                  <div>
                    <strong>{transaction.startupName}</strong>
                    <span>{transaction.description}</span>
                  </div>
                  <div>
                    <strong>{money(Number(transaction.amount))}</strong>
                    <span>
                      {new Date(transaction.date).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No transactions have been recorded.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StartupList({
  startups,
  loading,
  search,
  setSearch,
  onSelect,
  statusFilter = "All",
}) {
  const countText =
    statusFilter === "Applied Startups"
      ? "Applied startups"
      : statusFilter === "Verified"
        ? "Verified startups"
        : statusFilter === "Rejected"
          ? "Rejected startups"
          : "All startups";
  const panelTitle =
    statusFilter === "Verified"
      ? "Startups"
      : statusFilter === "Rejected"
        ? "Rejected startups"
        : "Applied Startups";

  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">GM REVIEW DASHBOARD</span>
          <h1>{countText}</h1>
          <p>
            {statusFilter === "Applied Startups"
              ? "Startups submitted for GM review."
              : statusFilter === "Verified"
                ? "Startups verified by the GM."
                : statusFilter === "Rejected"
                  ? "Startups rejected by the GM."
                  : "Search and select a startup to view its company details."}
          </p>
        </div>
        <div className="verified">
          <ShieldCheck size={19} /> GM administration view
        </div>
      </div>
      <div className="stat-grid">
        <StatCard
          icon={Building2}
          label={countText}
          value={String(startups.length)}
          tone="orange"
        />
      </div>
      <section className="panel gm-list-panel">
        <div className="gm-toolbar">
          <div>
            <h3>{panelTitle}</h3>
            <p>Startups submitted for GM review.</p>
          </div>
          <div className="gm-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search startup or founder"
            />
          </div>
        </div>
        {loading ? (
          <div className="database-loading">Loading startup directory...</div>
        ) : startups.length ? (
          <div className="gm-startup-grid">
            {startups.map((startup) => {
              const status = startup.gmReviewStatus || "Pending";
              const statusClass =
                startup.gmReviewStatus?.toLowerCase() || "pending";
              return (
                <button
                  key={startup.id}
                  className="gm-startup-card"
                  onClick={() => onSelect(startup.id)}
                >
                  <div className="gm-card-top">
                    <div className="gm-startup-icon">
                      <Building2 size={20} />
                    </div>
                    <span className={`status-pill ${statusClass}`}>
                      {status}
                    </span>
                  </div>
                  <h4>{startup.startup_name || startup.startupName}</h4>
                  <p>Founder: {startup.founder_name || startup.founderName}</p>
                  <div className="gm-card-meta">
                    <span>{startup.email}</span>
                    <span>{startup.transactionCount} transactions</span>
                  </div>
                  <div className="gm-card-footer">
                    <span>Last activity</span>
                    <strong>
                      {startup.lastActivityAt
                        ? new Date(startup.lastActivityAt).toLocaleDateString(
                            "en-IN",
                          )
                        : "Not recorded"}
                    </strong>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            No startups match the current filters.
          </div>
        )}
      </section>
    </div>
  );
}

function TransactionsView({ transactions, loading }) {
  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">ALL STARTUP ACTIVITY</span>
          <h1>Transactions</h1>
          <p>
            View every fund disbursement and utilization entry across all
            startups.
          </p>
        </div>
        <div className="verified">
          <ReceiptIndianRupee size={19} /> {transactions.length} transactions
        </div>
      </div>
      <section className="panel gm-list-panel">
        <div className="gm-toolbar">
          <div>
            <h3>All startup transactions</h3>
            <p>
              Transactions are grouped by startup and ordered by latest
              activity.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="database-loading">Loading transactions...</div>
        ) : transactions.length ? (
          <div className="gm-transaction-table-wrap">
            <table className="gm-transaction-table">
              <thead>
                <tr>
                  <th>Startup</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <strong>{transaction.startupName}</strong>
                      <small>{transaction.email}</small>
                    </td>
                    <td>
                      {new Date(transaction.date).toLocaleDateString("en-IN")}
                    </td>
                    <td>
                      <span
                        className={`transaction-type ${transaction.type.toLowerCase().replaceAll(" ", "-")}`}
                      >
                        {transaction.type}
                      </span>
                    </td>
                    <td>{transaction.description}</td>
                    <td>
                      <strong>{money(Number(transaction.amount))}</strong>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${transaction.status.toLowerCase()}`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No transactions have been recorded.</div>
        )}
      </section>
    </div>
  );
}

function StartupDetail({ startup, onBack, onApprove, onReject }) {
  return (
    <div className="content">
      <div className="gm-detail-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={18} /> Back to startup directory
        </button>
        <div>
          <span className="eyebrow">COMPANY DETAILS</span>
          <h1>{startup.startupName}</h1>
          <p>
            {startup.founderName} · {startup.email}
          </p>
        </div>
      </div>
      <div className="detail-grid">
        <section className="panel detail-panel">
          <div className="panel-title">
            <div>
              <h3>Founder profile</h3>
              <p>Registered account information</p>
            </div>
            <UserRound size={22} />
          </div>
          <DetailRow label="Startup name" value={startup.startupName} />
          <DetailRow label="Founder name" value={startup.founderName} />
          <DetailRow label="Email address" value={startup.email} />
          <DetailRow
            label="Phone number"
            value={startup.phone || "Not provided"}
          />
          <DetailRow label="CIN" value={startup.cin || "Not provided"} />
        </section>
        <section className="panel detail-panel">
          <div className="panel-title">
            <div>
              <h3>Eligibility verification</h3>
              <p>Current compliance details</p>
            </div>
            <ShieldCheck size={22} />
          </div>
          <DetailRow
            label="Registration state"
            value={startup.eligibility?.registrationState}
          />
          <DetailRow
            label="Entity type"
            value={startup.eligibility?.entityType}
          />
          <DetailRow
            label="Turnover"
            value={
              startup.eligibility?.turnover
                ? money(Number(startup.eligibility.turnover))
                : "Not provided"
            }
          />
          <DetailRow
            label="Incorporation date"
            value={
              startup.eligibility?.incorporationDate
                ? new Date(
                    `${startup.eligibility.incorporationDate}T00:00:00`,
                  ).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : "Not provided"
            }
          />
          <DetailRow label="Status" value={startup.eligibility?.status} />
          <DetailRow
            label="Innovation idea"
            value={startup.eligibility?.innovationIdea}
          />
          {startup.eligibility?.status === "Pending" && (
            <div className="gm-approve-actions">
              <button
                className="primary-btn"
                onClick={() => onApprove(startup.id, startup.eligibility)}
              >
                <CheckCircle2 size={17} /> Approve
              </button>
              <button
                className="secondary-btn"
                onClick={() => onReject(startup.id, startup.eligibility)}
              >
                <X size={17} /> Reject
              </button>
            </div>
          )}
        </section>
      </div>
      <section className="panel gm-activity-panel">
        <div className="panel-title">
          <div>
            <h3>Startup activity</h3>
            <p>Fund disbursements and utilization entries</p>
          </div>
          <ReceiptIndianRupee size={22} />
        </div>
        {startup.transactions?.length ? (
          <div className="gm-transaction-table-wrap">
            <table className="gm-transaction-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {startup.transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      {new Date(transaction.date).toLocaleDateString("en-IN")}
                    </td>
                    <td>
                      <span
                        className={`transaction-type ${String(transaction.type)
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {transaction.type}
                      </span>
                    </td>
                    <td>{transaction.description}</td>
                    <td>
                      <strong>{money(Number(transaction.amount))}</strong>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${String(
                          transaction.status || "",
                        )
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            No activity has been recorded for this startup.
          </div>
        )}
      </section>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="account-line">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
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
            <img src="/uploads/logo.jpg" alt="Logo" />
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
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getEligibility(startup.id)
      .then((record) => {
        if (active) {
          setEligibility(record);
          setLoading(false);
        }
      })
      .catch((databaseError) => {
        if (active) {
          setError(
            databaseError.message || "Unable to load eligibility details.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [startup.id]);

  const verified = eligibility?.status === "Verified";
  const statusLabel =
    eligibility?.status === "Verified" ? "Verified" : "Pending verification";

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
          <span
            className={`verified ${verified ? "verified-status" : "pending-status"}`}
          >
            {verified ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
            {statusLabel}
          </span>
        </div>

        {error && <div className="alert error">{error}</div>}

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
          <ProfileItem
            icon={Building2}
            label="State of registration"
            value={eligibility?.registration_state || "Not provided"}
          />
          <ProfileItem
            icon={Building2}
            label="Entity type"
            value={eligibility?.entity_type || "Not provided"}
          />
          <ProfileItem
            icon={IndianRupee}
            label="Current turnover"
            value={
              eligibility ? money(Number(eligibility.turnover)) : "Not provided"
            }
          />
          <ProfileItem
            icon={FileText}
            label="Date of incorporation"
            value={
              eligibility?.incorporation_date
                ? new Date(
                    `${eligibility.incorporation_date}T00:00:00Z`,
                  ).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })
                : "Not provided"
            }
          />
        </div>

        <div className="eligibility-profile-section">
          <div className="eligibility-profile-heading">
            <span className="eligibility-icon">
              <ShieldCheck size={22} />
            </span>
            <div>
              <span className="eyebrow">ELIGIBILITY VERIFICATION</span>
              <h2>Startup information</h2>
            </div>
          </div>
          {loading ? (
            <div className="eligibility-profile-loading">
              Loading eligibility information...
            </div>
          ) : (
            <div className="eligibility-profile-details">
              <div>
                <span>Innovation idea</span>
                <p>{eligibility?.innovation_idea || "Not provided"}</p>
              </div>
              <div>
                <span>Verification date</span>
                <p>
                  {eligibility?.verified_at
                    ? new Date(eligibility.verified_at).toLocaleString("en-IN")
                    : "Not verified"}
                </p>
              </div>
            </div>
          )}
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
