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
  FormInput,
  History,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Pencil,
  Phone,
  Plus,
  ReceiptIndianRupee,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  UserCog,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  addTransaction as addTransactionToDatabase,
  approveStartup as approveStartupRequest,
  authenticateStaff,
  authenticateUser,
  createAdminForm,
  createAdminUser,
  createFormField,
  createWinner,
  deleteFormField,
  deleteWinner,
  getActivityLogs,
  getAdminFormDefinitions,
  getAdminFormFields,
  getAdminPermissions,
  getAdminRoles,
  getAdminUsers,
  getEligibility,
  getGMStartup,
  getGMStartups,
  getGMTransactions,
  getPublicForm,
  getPublicWinners,
  getTransactions,
  getWinnerOptions,
  getWinnerYears,
  getWinners,
  registerUser,
  rejectStartup as rejectStartupRequest,
  setRolePermissions,
  setUserActive,
  submitPublicForm,
  updateAdminUser,
  updateFormField,
  updateWinner,
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
  const [adminSession, setAdminSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("ksfp_admin_session")) || null;
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

  const staffLogin = (data) => {
    const session = {
      role: data.role,
      admin: data.admin,
      token: data.token,
      email: data.email,
    };
    if (data.role === "admin") {
      setAdminSession(session);
      sessionStorage.setItem("ksfp_admin_session", JSON.stringify(session));
      setPage("admin-portal");
    } else {
      setGMSession(session);
      sessionStorage.setItem("ksfp_gm_session", JSON.stringify(session));
      setPage("gm-dashboard");
    }
  };

  const gmLogout = () => {
    setGMSession(null);
    sessionStorage.removeItem("ksfp_gm_session");
    setPage("login");
  };

  const adminLogout = () => {
    setAdminSession(null);
    sessionStorage.removeItem("ksfp_admin_session");
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
        <GMLoginPage onLogin={staffLogin} onBack={() => setPage("login")} />
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
      {page === "admin-portal" && adminSession && (
        <AdminPortal session={adminSession} onLogout={adminLogout} />
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
            <ShieldCheck size={15} /> Administrator / GM access
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
      const session = await authenticateStaff(email, password);
      onLogin({ ...session, email });
    } catch (loginError) {
      setError(
        loginError.message || "Unable to sign in. Please check your credentials.",
      );
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
          <span className="eyebrow">ADMINISTRATION</span>
          <h2>One secure sign-in for staff access.</h2>
          <p>
            Sign in with your Government Manager or Administrator credentials —
            you'll be taken to the right workspace automatically.
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
          <span className="eyebrow">STAFF PORTAL</span>
          <h2>Administrator sign-in</h2>
          <p className="muted">GM and Admin access in one place.</p>
          {error && <div className="alert error">{error}</div>}
          <form onSubmit={submit} className="form">
            <label>Email address</label>
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
            GM and Admin credentials are configured in the server environment.
          </p>
        </div>
      </main>
    </div>
  );
}

const STATIC_OTP = "123456";

function RegisterPage({ onBack, onRegistered }) {
  const [form, setForm] = useState({
    startupName: "",
    founderName: "",
    email: "",
    phone: "",
    cin: "",
    password: "",
    confirmPassword: "",
    otp: "",
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [winnerYears, setWinnerYears] = useState([]);
  const [yearWinners, setYearWinners] = useState([]);
  const [winningYear, setWinningYear] = useState("");
  const [selectedWinnerId, setSelectedWinnerId] = useState("");

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    let active = true;
    getWinnerYears()
      .then((years) => {
        if (active) setWinnerYears(years);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleYearChange = (year) => {
    setWinningYear(year);
    setSelectedWinnerId("");
    setYearWinners([]);
    if (!year) return;
    getPublicWinners(year)
      .then((records) => setYearWinners(records))
      .catch(() => setYearWinners([]));
  };

  const handleWinnerChange = (winnerId) => {
    setSelectedWinnerId(winnerId);
    const winner = yearWinners.find(
      (item) => String(item.id) === String(winnerId),
    );
    if (winner) {
      setForm((prev) => ({
        ...prev,
        startupName: winner.companyName || prev.startupName,
        founderName: winner.founderName || prev.founderName,
        phone: winner.mobileNumber || prev.phone,
      }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (String(form.otp).trim() !== STATIC_OTP) {
      setError("Invalid OTP. Please enter the correct OTP.");
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
          {winnerYears.length > 0 && (
            <section className="form-section">
              <div className="section-heading">
                <Trophy size={20} />
                <div>
                  <h3>Elevate Winner</h3>
                  <p>
                    Select your winning year and company to auto-fill your
                    details.
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Winning year</label>
                  <select
                    value={winningYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                  >
                    <option value="">Select year</option>
                    {winnerYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                {winningYear && (
                  <div className="field">
                    <label>Company</label>
                    <select
                      value={selectedWinnerId}
                      onChange={(e) => handleWinnerChange(e.target.value)}
                    >
                      <option value="">Select your company</option>
                      {yearWinners.map((winner) => (
                        <option key={winner.id} value={winner.id}>
                          {winner.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {winningYear && yearWinners.length === 0 && (
                <small className="muted">
                  No winners recorded for {winningYear}.
                </small>
              )}
            </section>
          )}

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
            <div className="field otp-field">
              <label>Enter OTP</label>
              <div className="otp-input-row">
                <ShieldCheck size={18} />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.otp}
                  onChange={(e) => update("otp", e.target.value)}
                  placeholder="6-digit OTP"
                  required
                />
              </div>
              <small className="otp-hint">
                Demo OTP: <strong>{STATIC_OTP}</strong>
              </small>
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
  disabled = false,
  onFocus,
  onBlur,
  hint,
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
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {hint && <small className="field-hint">{hint}</small>}
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
          : view === "rejected"
            ? "Rejected"
            : statusFilter;
    const matchesStatus =
      effectiveStatusFilter === "All" ||
      (() => {
        switch (effectiveStatusFilter) {
          case "Applied Startups":
            return startup.gmReviewStatus === "Pending GM Review";
          case "Verified":
            return startup.gmReviewStatus === "Verified";
          case "Rejected":
            return startup.gmReviewStatus === "Rejected";
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
          className={`gm-nav ${view === "rejected" && !selected ? "active" : ""}`}
          onClick={() => {
            setView("rejected");
            setSelected(null);
          }}
        >
          <XCircle size={19} /> Rejected Startups
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
                      : view === "rejected"
                        ? "Rejected Startups"
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
        ) : view === "rejected" ? (
          <StartupList
            startups={filtered}
            loading={loading}
            search={search}
            setSearch={setSearch}
            statusFilter="Rejected"
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

// ============================================================
//  Admin Portal
// ============================================================

function AdminPortal({ session, onLogout }) {
  const [view, setView] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "users", label: "Users & Roles", icon: Users },
    { id: "roles", label: "Permissions", icon: ShieldCheck },
    { id: "logs", label: "Activity Logs", icon: History },
    { id: "forms", label: "Form Builder", icon: FormInput },
    { id: "winners", label: "Elevate Winners", icon: Trophy },
  ];

  return (
    <div className="gm-dashboard admin-portal">
      <aside className={`gm-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="side-brand">
          <div className="brand-mark">
            <img src="/uploads/logo.jpg" alt="Logo" />
          </div>
          <div>
            <strong>Karnataka</strong>
            <span>Admin Console</span>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="side-label">ADMINISTRATION</div>
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`gm-nav ${view === item.id ? "active" : ""}`}
              onClick={() => {
                setView(item.id);
                setMobileOpen(false);
              }}
            >
              <Icon size={19} /> {item.label}
            </button>
          );
        })}
        <div className="side-bottom">
          <div className="security-mini">
            <ShieldCheck size={18} />
            <span>Admin access secured</span>
          </div>
          <button className="nav-item logout" onClick={onLogout}>
            <LogOut size={19} /> Logout
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <main className="dashboard-main gm-main">
        <header className="dashboard-header">
          <button className="menu-btn" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
          <div>
            <span className="header-kicker">ADMIN CONTROL CENTER</span>
            <h2>{nav.find((item) => item.id === view)?.label || "Admin portal"}</h2>
          </div>
          <div className="user-chip">
            <div className="avatar">AD</div>
            <div>
              <strong>{session.admin?.name || "Administrator"}</strong>
              <span>{session.admin?.email || session.email}</span>
            </div>
          </div>
        </header>

        {view === "overview" && (
          <AdminOverview session={session} onNavigate={setView} />
        )}
        {view === "users" && <AdminUsers session={session} />}
        {view === "roles" && <AdminRoles session={session} />}
        {view === "logs" && <AdminLogs session={session} />}
        {view === "forms" && <AdminFormBuilder session={session} />}
        {view === "winners" && <AdminWinners session={session} />}
      </main>
    </div>
  );
}

function AdminOverview({ session, onNavigate }) {
  const [stats, setStats] = useState({ users: 0, active: 0, logs: 0, forms: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      getAdminUsers(session.token),
      getActivityLogs(session.token, { limit: 500 }),
      getAdminFormDefinitions(session.token),
    ])
      .then(([users, logs, forms]) => {
        if (!active) return;
        setStats({
          users: users.length,
          active: users.filter((user) => user.isActive).length,
          logs: logs.length,
          forms: forms.length,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.token]);

  const cards = [
    {
      icon: Users,
      label: "Total users",
      value: stats.users,
      tone: "blue",
      target: "users",
    },
    {
      icon: CheckCircle2,
      label: "Active accounts",
      value: stats.active,
      tone: "green",
      target: "users",
    },
    {
      icon: History,
      label: "Activity events",
      value: stats.logs,
      tone: "orange",
      target: "logs",
    },
    {
      icon: FormInput,
      label: "Dynamic forms",
      value: stats.forms,
      tone: "blue",
      target: "forms",
    },
  ];

  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">ADMINISTRATION OVERVIEW</span>
          <h1>Admin dashboard</h1>
          <p>
            Manage users and roles, review activity logs and build dynamic forms
            for the portal.
          </p>
        </div>
        <div className="verified">
          <ShieldCheck size={19} /> Full administrative access
        </div>
      </div>

      <div className="stat-grid">
        {cards.map((card) => (
          <button
            key={card.label}
            className="stat-card-link"
            onClick={() => onNavigate(card.target)}
          >
            <StatCard
              icon={card.icon}
              label={card.label}
              value={loading ? "…" : String(card.value)}
              tone={card.tone}
            />
          </button>
        ))}
      </div>

      <section className="panel gm-list-panel">
        <div className="gm-toolbar">
          <div>
            <h3>Quick actions</h3>
            <p>Jump straight to a management area.</p>
          </div>
        </div>
        <div className="admin-quick-actions">
          <button className="secondary-btn" onClick={() => onNavigate("users")}>
            <UserCog size={17} /> Manage users & roles
          </button>
          <button className="secondary-btn" onClick={() => onNavigate("roles")}>
            <ShieldCheck size={17} /> Configure permissions
          </button>
          <button className="secondary-btn" onClick={() => onNavigate("logs")}>
            <History size={17} /> View activity logs
          </button>
          <button className="secondary-btn" onClick={() => onNavigate("forms")}>
            <FormInput size={17} /> Open form builder
          </button>
        </div>
      </section>
    </div>
  );
}

function AdminUsers({ session }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    startupName: "",
    founderName: "",
    email: "",
    phone: "",
    cin: "",
    password: "",
    roleName: "founder",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [userRecords, roleRecords] = await Promise.all([
        getAdminUsers(session.token),
        getAdminRoles(session.token),
      ]);
      setUsers(userRecords);
      setRoles(roleRecords);
    } catch (loadError) {
      setError(loadError.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session.token]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await createAdminUser(session.token, form);
      setSuccess("User account created successfully.");
      setForm({
        startupName: "",
        founderName: "",
        email: "",
        phone: "",
        cin: "",
        password: "",
        roleName: "founder",
      });
      setShowForm(false);
      await load();
    } catch (createError) {
      setError(createError.message || "Unable to create the user.");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (userId, roleName) => {
    setError("");
    setSuccess("");
    try {
      await updateAdminUser(session.token, userId, { roleName });
      setSuccess("Role updated.");
      await load();
    } catch (updateError) {
      setError(updateError.message || "Unable to update the role.");
    }
  };

  const toggleActive = async (userId, isActive) => {
    setError("");
    setSuccess("");
    try {
      await setUserActive(session.token, userId, isActive);
      setSuccess(isActive ? "Account activated." : "Account deactivated.");
      await load();
    } catch (updateError) {
      setError(updateError.message || "Unable to update account status.");
    }
  };

  const query = search.toLowerCase();
  const filtered = users.filter((user) =>
    !query ||
    [user.startupName, user.founderName, user.email, user.cin].some((value) =>
      String(value || "").toLowerCase().includes(query),
    ),
  );

  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">USER & ROLE MANAGEMENT</span>
          <h1>Users</h1>
          <p>
            Create accounts, assign roles and activate or deactivate portal
            access.
          </p>
        </div>
        <div className="verified">
          <Users size={19} /> {users.length} users
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <section className="panel gm-list-panel">
        <div className="gm-toolbar">
          <div>
            <h3>User accounts</h3>
            <p>All registered portal users.</p>
          </div>
          <div className="transaction-heading-actions">
            <div className="gm-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search user"
              />
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? <X size={17} /> : <Plus size={17} />}
              {showForm ? "Close" : "New user"}
            </button>
          </div>
        </div>

        {showForm && (
          <form className="admin-user-form" onSubmit={submit}>
            <div className="transaction-form-grid">
              <div className="field">
                <label>Startup / company name</label>
                <input
                  value={form.startupName}
                  onChange={(e) => setForm({ ...form, startupName: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Founder name</label>
                <input
                  value={form.founderName}
                  onChange={(e) => setForm({ ...form, founderName: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label>CIN (optional)</label>
                <input
                  value={form.cin}
                  onChange={(e) => setForm({ ...form, cin: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="8+ chars, uppercase & special"
                  required
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select
                  value={form.roleName}
                  onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="transaction-form-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? "Creating..." : "Create user"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="database-loading">Loading users...</div>
        ) : filtered.length ? (
          <div className="gm-transaction-table-wrap">
            <table className="gm-transaction-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.startupName}</strong>
                      <small>{user.founderName}</small>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        value={user.roleName}
                        onChange={(e) => changeRole(user.id, e.target.value)}
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          user.isActive ? "verified" : "rejected"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString("en-IN")
                        : "Never"}
                    </td>
                    <td>
                      <button
                        className="text-btn"
                        onClick={() => toggleActive(user.id, !user.isActive)}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No users match your search.</div>
        )}
      </section>
    </div>
  );
}

function AdminRoles({ session }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [selected, setSelected] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [roleRecords, permissionRecords] = await Promise.all([
        getAdminRoles(session.token),
        getAdminPermissions(session.token),
      ]);
      setRoles(roleRecords);
      setPermissions(permissionRecords);
      const initial = {};
      roleRecords.forEach((role) => {
        initial[role.id] = new Set(role.permissions || []);
      });
      setSelected(initial);
    } catch (loadError) {
      setError(loadError.message || "Unable to load roles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session.token]);

  const toggle = (roleId, code) => {
    setSelected((current) => {
      const next = { ...current };
      const set = new Set(next[roleId] || []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      next[roleId] = set;
      return next;
    });
  };

  const save = async (role) => {
    setError("");
    setSuccess("");
    setSavingRoleId(role.id);
    try {
      await setRolePermissions(
        session.token,
        role.id,
        Array.from(selected[role.id] || []),
      );
      setSuccess(`Permissions updated for "${role.name}".`);
      await load();
    } catch (saveError) {
      setError(saveError.message || "Unable to update permissions.");
    } finally {
      setSavingRoleId(null);
    }
  };

  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">ROLE & PERMISSION MANAGEMENT</span>
          <h1>Permissions</h1>
          <p>Assign what each role is allowed to do across the portal.</p>
        </div>
        <div className="verified">
          <ShieldCheck size={19} /> {permissions.length} permissions
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {loading ? (
        <div className="database-loading">Loading roles...</div>
      ) : (
        <div className="admin-roles-grid">
          {roles.map((role) => (
            <section key={role.id} className="panel detail-panel">
              <div className="panel-title">
                <div>
                  <h3>{role.name}</h3>
                  <p>{role.description || "No description"}</p>
                </div>
                <UserCog size={22} />
              </div>
              <div className="admin-permission-list">
                {permissions.map((permission) => {
                  const checked = selected[role.id]?.has(permission.code);
                  return (
                    <label key={permission.code} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(checked)}
                        onChange={() => toggle(role.id, permission.code)}
                      />
                      <span>
                        <strong>{permission.code}</strong>
                        <small>{permission.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="transaction-form-actions">
                <button
                  className="primary-btn"
                  onClick={() => save(role)}
                  disabled={savingRoleId === role.id}
                >
                  {savingRoleId === role.id ? "Saving..." : "Save permissions"}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminLogs({ session }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    getActivityLogs(session.token, { limit: 500 })
      .then((records) => {
        if (active) setLogs(records);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load activity logs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.token]);

  const query = search.toLowerCase();
  const filtered = logs.filter((log) =>
    !query ||
    [log.action, log.actor_email, log.details, log.actor_type].some((value) =>
      String(value || "").toLowerCase().includes(query),
    ),
  );

  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">ACTIVITY & AUDIT LOGS</span>
          <h1>Activity logs</h1>
          <p>Review login and administrative activity across the portal.</p>
        </div>
        <div className="verified">
          <History size={19} /> {logs.length} events
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <section className="panel gm-list-panel">
        <div className="gm-toolbar">
          <div>
            <h3>Recent activity</h3>
            <p>Latest administrative and login events.</p>
          </div>
          <div className="gm-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action or user"
            />
          </div>
        </div>
        {loading ? (
          <div className="database-loading">Loading activity logs...</div>
        ) : filtered.length ? (
          <div className="gm-transaction-table-wrap">
            <table className="gm-transaction-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td>
                      {new Date(log.created_at).toLocaleString("en-IN")}
                    </td>
                    <td>
                      <strong>{log.actor_email || "system"}</strong>
                      <small>{log.actor_type}</small>
                    </td>
                    <td>
                      <span className="status-pill pending">{log.action}</span>
                    </td>
                    <td>{log.details || "—"}</td>
                    <td>{log.ip_address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No activity matches your search.</div>
        )}
      </section>
    </div>
  );
}

// ============================================================
//  Dynamic Form Builder
// ============================================================
const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

function emptyField() {
  return {
    fieldName: "",
    label: "",
    fieldType: "text",
    placeholder: "",
    helpText: "",
    section: "",
    isRequired: false,
    options: [],
    sortOrder: 0,
  };
}

function AdminFormBuilder({ session }) {
  const [forms, setForms] = useState([]);
  const [activeForm, setActiveForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newForm, setNewForm] = useState({ formKey: "", name: "", description: "" });
  const [fieldForm, setFieldForm] = useState(emptyField());
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(null);

  const loadForms = async () => {
    setLoading(true);
    try {
      const records = await getAdminFormDefinitions(session.token);
      setForms(records);
      if (records.length && !activeForm) {
        setActiveForm(records[0].id);
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load forms.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);

  const loadFields = async (formId) => {
    if (!formId) return;
    try {
      const records = await getAdminFormFields(session.token, formId);
      setFields(records);
    } catch (loadError) {
      setError(loadError.message || "Unable to load form fields.");
    }
  };

  useEffect(() => {
    if (activeForm) loadFields(activeForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeForm]);

  const createForm = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const created = await createAdminForm(session.token, newForm);
      setSuccess(`Form "${created.name}" created.`);
      setNewForm({ formKey: "", name: "", description: "" });
      await loadForms();
      setActiveForm(created.id);
    } catch (createError) {
      setError(createError.message || "Unable to create the form.");
    }
  };

  const submitField = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!activeForm) {
      setError("Select or create a form first.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...fieldForm,
        options: fieldForm.options.length ? fieldForm.options : null,
      };
      if (editingFieldId) {
        await updateFormField(session.token, editingFieldId, payload);
        setSuccess("Field updated.");
      } else {
        await createFormField(session.token, activeForm, payload);
        setSuccess("Field added.");
      }
      setFieldForm(emptyField());
      setEditingFieldId(null);
      await loadFields(activeForm);
      await loadForms();
    } catch (saveError) {
      setError(saveError.message || "Unable to save the field.");
    } finally {
      setSaving(false);
    }
  };

  const editField = (field) => {
    setEditingFieldId(field.id);
    setFieldForm({
      fieldName: field.field_name,
      label: field.label,
      fieldType: field.field_type,
      placeholder: field.placeholder || "",
      helpText: field.help_text || "",
      section: field.section || "",
      isRequired: field.is_required,
      options: field.options || [],
      sortOrder: field.sort_order,
    });
  };

  const removeField = async (fieldId) => {
    if (!confirm("Delete this field? This cannot be undone.")) return;
    setError("");
    setSuccess("");
    try {
      await deleteFormField(session.token, fieldId);
      setSuccess("Field deleted.");
      if (editingFieldId === fieldId) {
        setEditingFieldId(null);
        setFieldForm(emptyField());
      }
      await loadFields(activeForm);
      await loadForms();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete the field.");
    }
  };

  const addOption = () =>
    setFieldForm((current) => ({
      ...current,
      options: [...current.options, { label: "", value: "" }],
    }));

  const updateOption = (index, key, value) =>
    setFieldForm((current) => {
      const options = current.options.slice();
      options[index] = { ...options[index], [key]: value };
      return { ...current, options };
    });

  const removeOption = (index) =>
    setFieldForm((current) => ({
      ...current,
      options: current.options.filter((_, i) => i !== index),
    }));

  const activeFormMeta = forms.find((form) => form.id === activeForm);

  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">DYNAMIC FORM BUILDER</span>
          <h1>Form builder</h1>
          <p>
            Add, edit or delete input fields and dropdown options without
            touching the source code.
          </p>
        </div>
        <div className="verified">
          <FormInput size={19} /> {forms.length} forms
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="admin-form-builder-grid">
        <section className="panel detail-panel">
          <div className="panel-title">
            <div>
              <h3>Forms</h3>
              <p>Select a form or create a new one.</p>
            </div>
            <FormInput size={22} />
          </div>

          <form className="admin-inline-form" onSubmit={createForm}>
            <div className="field">
              <label>Form key</label>
              <input
                value={newForm.formKey}
                onChange={(e) =>
                  setNewForm({ ...newForm, formKey: e.target.value })
                }
                placeholder="startup_onboarding"
                pattern="[a-z0-9_]+"
                required
              />
            </div>
            <div className="field">
              <label>Form name</label>
              <input
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="Startup onboarding"
                required
              />
            </div>
            <div className="field">
              <label>Description (optional)</label>
              <input
                value={newForm.description}
                onChange={(e) =>
                  setNewForm({ ...newForm, description: e.target.value })
                }
              />
            </div>
            <button type="submit" className="primary-btn">
              <Plus size={16} /> Create form
            </button>
          </form>

          {loading ? (
            <div className="database-loading">Loading forms...</div>
          ) : forms.length ? (
            <div className="admin-form-list">
              {forms.map((form) => (
                <button
                  key={form.id}
                  className={`admin-form-item ${
                    activeForm === form.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveForm(form.id);
                    setEditingFieldId(null);
                    setFieldForm(emptyField());
                    setPreviewKey(null);
                  }}
                >
                  <div>
                    <strong>{form.name}</strong>
                    <small>{form.form_key}</small>
                  </div>
                  <span className="status-pill pending">
                    {form.field_count} fields
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">No forms yet. Create one above.</div>
          )}
        </section>

        <section className="panel detail-panel">
          <div className="panel-title">
            <div>
              <h3>
                {activeFormMeta ? `Fields — ${activeFormMeta.name}` : "Fields"}
              </h3>
              <p>Configure the inputs for the selected form.</p>
            </div>
            <FormInput size={22} />
          </div>

          <form className="admin-field-form" onSubmit={submitField}>
            <div className="transaction-form-grid">
              <div className="field">
                <label>Field name (data key)</label>
                <input
                  value={fieldForm.fieldName}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, fieldName: e.target.value })
                  }
                  placeholder="gstNumber"
                  pattern="[a-zA-Z][a-zA-Z0-9_]*"
                  disabled={Boolean(editingFieldId)}
                  required
                />
              </div>
              <div className="field">
                <label>Label</label>
                <input
                  value={fieldForm.label}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, label: e.target.value })
                  }
                  placeholder="GST number"
                  required
                />
              </div>
              <div className="field">
                <label>Type</label>
                <select
                  value={fieldForm.fieldType}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, fieldType: e.target.value })
                  }
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Section (optional)</label>
                <input
                  value={fieldForm.section}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, section: e.target.value })
                  }
                  placeholder="Company details"
                />
              </div>
              {fieldForm.fieldType !== "checkbox" && (
                <div className="field">
                  <label>Placeholder (optional)</label>
                  <input
                    value={fieldForm.placeholder}
                    onChange={(e) =>
                      setFieldForm({ ...fieldForm, placeholder: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="field">
                <label>Help text (optional)</label>
                <input
                  value={fieldForm.helpText}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, helpText: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Sort order</label>
                <input
                  type="number"
                  value={fieldForm.sortOrder}
                  onChange={(e) =>
                    setFieldForm({
                      ...fieldForm,
                      sortOrder: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="field">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={fieldForm.isRequired}
                    onChange={(e) =>
                      setFieldForm({
                        ...fieldForm,
                        isRequired: e.target.checked,
                      })
                    }
                  />
                  <span>Required field</span>
                </label>
              </div>
            </div>

            {fieldForm.fieldType === "select" && (
              <div className="admin-options-editor">
                <div className="admin-options-head">
                  <strong>Dropdown options</strong>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={addOption}
                  >
                    <Plus size={15} /> Add option
                  </button>
                </div>
                {fieldForm.options.length ? (
                  fieldForm.options.map((option, index) => (
                    <div key={index} className="admin-option-row">
                      <input
                        placeholder="Label"
                        value={option.label}
                        onChange={(e) =>
                          updateOption(index, "label", e.target.value)
                        }
                      />
                      <input
                        placeholder="Value"
                        value={option.value}
                        onChange={(e) =>
                          updateOption(index, "value", e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="text-btn danger"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <small className="muted">
                    No options yet. Add at least one for a dropdown.
                  </small>
                )}
              </div>
            )}

            <div className="transaction-form-actions">
              {editingFieldId && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setEditingFieldId(null);
                    setFieldForm(emptyField());
                  }}
                >
                  Cancel edit
                </button>
              )}
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingFieldId
                    ? "Update field"
                    : "Add field"}
              </button>
            </div>
          </form>

          <div className="admin-fields-list">
            {fields.length ? (
              fields.map((field) => (
                <div key={field.id} className="admin-field-row">
                  <div>
                    <strong>{field.label}</strong>
                    <small>
                      {field.field_name} · {field.field_type}
                      {field.is_required ? " · required" : ""}
                      {field.options?.length
                        ? ` · ${field.options.length} options`
                        : ""}
                    </small>
                  </div>
                  <div className="admin-field-actions">
                    <button
                      className="text-btn"
                      onClick={() => editField(field)}
                    >
                      <Pencil size={15} /> Edit
                    </button>
                    <button
                      className="text-btn danger"
                      onClick={() => removeField(field.id)}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                No fields yet. Add your first field above.
              </div>
            )}
          </div>

          {activeFormMeta && (
            <div className="admin-preview-actions">
              <button
                className="secondary-btn"
                onClick={() =>
                  setPreviewKey(
                    previewKey === activeFormMeta.form_key
                      ? null
                      : activeFormMeta.form_key,
                  )
                }
              >
                <Eye size={16} />
                {previewKey === activeFormMeta.form_key
                  ? "Hide live preview"
                  : "Preview live form"}
              </button>
            </div>
          )}
          {previewKey && <DynamicForm formKey={previewKey} />}
        </section>
      </div>
    </div>
  );
}

// Renders a dynamic form from its DB definition — no hardcoded fields.
// Fields added in the Form Builder appear here automatically.
function DynamicForm({ formKey }) {
  const [form, setForm] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSubmitted(false);
    setData({});
    getPublicForm(formKey)
      .then((record) => {
        if (active) setForm(record);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load the form.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [formKey]);

  const setValue = (name, value) =>
    setData((current) => ({ ...current, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await submitPublicForm(formKey, data);
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message || "Unable to submit the form.");
    }
  };

  if (loading) {
    return (
      <div className="admin-dynamic-preview">
        <div className="database-loading">Loading form…</div>
      </div>
    );
  }

  if (!form || !form.fields || !form.fields.length) {
    return (
      <div className="admin-dynamic-preview">
        <div className="empty-state">
          {form ? "This form has no active fields yet." : "Form not available."}
        </div>
      </div>
    );
  }

  // Group fields by their (optional) section for nicer layout.
  const sections = form.fields.reduce((groups, field) => {
    const key = field.section || "Details";
    if (!groups[key]) groups[key] = [];
    groups[key].push(field);
    return groups;
  }, {});

  return (
    <div className="admin-dynamic-preview">
      <div className="admin-preview-banner">
        <span className="eyebrow">LIVE PREVIEW</span>
        <h3>{form.name}</h3>
        {form.description && <p>{form.description}</p>}
      </div>

      {error && <div className="alert error">{error}</div>}
      {submitted && (
        <div className="alert success">
          Form submitted successfully (captured in activity logs).
        </div>
      )}

      <form className="dynamic-form" onSubmit={submit}>
        {Object.entries(sections).map(([sectionName, sectionFields]) => (
          <section key={sectionName} className="eligibility-section">
            <div className="eligibility-section-heading">
              <div>
                <h4>{sectionName}</h4>
              </div>
            </div>
            <div className="eligibility-grid">
              {sectionFields.map((field) => (
                <div
                  key={field.id}
                  className={`field ${
                    field.field_type === "textarea" ? "idea-field" : ""
                  }`}
                >
                  <label htmlFor={`dyn-${field.field_name}`}>{field.label}</label>

                  {field.field_type === "textarea" ? (
                    <textarea
                      id={`dyn-${field.field_name}`}
                      rows={5}
                      placeholder={field.placeholder || ""}
                      required={field.is_required}
                      value={data[field.field_name] || ""}
                      onChange={(e) =>
                        setValue(field.field_name, e.target.value)
                      }
                    />
                  ) : field.field_type === "select" ? (
                    <select
                      id={`dyn-${field.field_name}`}
                      required={field.is_required}
                      value={data[field.field_name] || ""}
                      onChange={(e) =>
                        setValue(field.field_name, e.target.value)
                      }
                    >
                      <option value="">Select…</option>
                      {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.field_type === "checkbox" ? (
                    <label className="checkbox-row">
                      <input
                        id={`dyn-${field.field_name}`}
                        type="checkbox"
                        checked={Boolean(data[field.field_name])}
                        onChange={(e) =>
                          setValue(field.field_name, e.target.checked)
                        }
                      />
                      <span>{field.help_text || field.label}</span>
                    </label>
                  ) : (
                    <input
                      id={`dyn-${field.field_name}`}
                      type={field.field_type}
                      placeholder={field.placeholder || ""}
                      required={field.is_required}
                      value={data[field.field_name] || ""}
                      onChange={(e) =>
                        setValue(field.field_name, e.target.value)
                      }
                    />
                  )}

                  {field.help_text && field.field_type !== "checkbox" && (
                    <small>{field.help_text}</small>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="eligibility-actions">
          <button type="submit" className="primary-btn">
            Submit <CheckCircle2 size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminWinners({ session }) {
  const [winners, setWinners] = useState([]);
  const [options, setOptions] = useState({ sectors: [], districts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentYear = new Date().getFullYear();
  const yearChoices = Array.from({ length: 12 }, (_, i) => currentYear - i);
  const [form, setForm] = useState({
    winningYear: String(currentYear),
    companyName: "",
    founderName: "",
    mobileNumber: "",
    sector: "",
    district: "",
  });
  const [customSector, setCustomSector] = useState("");
  const [editingWinnerId, setEditingWinnerId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [records, opts] = await Promise.all([
        getWinners(session.token),
        getWinnerOptions(session.token),
      ]);
      setWinners(records);
      setOptions(opts);
    } catch (loadError) {
      setError(loadError.message || "Unable to load winners.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session.token]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    // When "Other" is chosen, use the custom sector the admin typed.
    let finalSector = form.sector;
    if (form.sector === "Other") {
      finalSector = customSector.trim();
      if (!finalSector) {
        setError("Please specify the sector.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        winningYear: Number(form.winningYear),
        companyName: form.companyName,
        founderName: form.founderName,
        mobileNumber: form.mobileNumber,
        sector: finalSector,
        district: form.district,
      };
      if (editingWinnerId) {
        await updateWinner(session.token, editingWinnerId, payload);
        setSuccess("Winner updated successfully.");
      } else {
        await createWinner(session.token, payload);
        setSuccess("Winner added successfully.");
      }
      setForm({
        winningYear: String(currentYear),
        companyName: "",
        founderName: "",
        mobileNumber: "",
        sector: "",
        district: "",
      });
      setCustomSector("");
      setEditingWinnerId(null);
      setFormOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError.message || "Unable to save the winner.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (winnerId) => {
    if (!confirm("Remove this winner?")) return;
    setError("");
    setSuccess("");
    try {
      await deleteWinner(session.token, winnerId);
      setSuccess("Winner removed.");
      if (editingWinnerId === winnerId) {
        setEditingWinnerId(null);
        setFormOpen(false);
      }
      await load();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to remove the winner.");
    }
  };

  const editWinner = (winner) => {
    setError("");
    setSuccess("");
    setEditingWinnerId(winner.id);
    setForm({
      winningYear: String(winner.winningYear),
      companyName: winner.companyName || "",
      founderName: winner.founderName || "",
      mobileNumber: winner.mobileNumber || "",
      sector: winner.sector || "",
      district: winner.district || "",
    });
    setCustomSector("");
    setFormOpen(true);
  };

  const openAddForm = () => {
    setError("");
    setSuccess("");
    setEditingWinnerId(null);
    setCustomSector("");
    setForm({
      winningYear: String(currentYear),
      companyName: "",
      founderName: "",
      mobileNumber: "",
      sector: "",
      district: "",
    });
    setFormOpen(true);
  };

  const availableYears = Array.from(
    new Set(winners.map((w) => String(w.winningYear))),
  ).sort((a, b) => Number(b) - Number(a));

  const filtered =
    yearFilter === "All"
      ? winners
      : winners.filter((w) => String(w.winningYear) === String(yearFilter));

  // Sector dropdown = configured sectors + any custom sectors already used by
  // existing winners, with "Other" always kept last.
  const mergedSectors = Array.from(
    new Set([...options.sectors, ...winners.map((w) => w.sector)]),
  );
  const sectorOptions = mergedSectors.includes("Other")
    ? [...mergedSectors.filter((s) => s !== "Other"), "Other"]
    : mergedSectors;

  return (
    <div className="content">
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">ELEVATE WINNERS</span>
          <h1>Elevate Winners</h1>
          <p>Manage the startups recognized as Elevate winners each year.</p>
        </div>
        <div className="verified">
          <Trophy size={19} /> {winners.length} winners
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <section className="panel gm-list-panel">
        <div className="gm-toolbar winners-toolbar">
          <div>
            <h3>Winners</h3>
            <p>Filter by year or add a new winner.</p>
          </div>
          <div className="winners-toolbar-actions">
            <div className="field winners-year-filter">
              <label>Year</label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="All">All years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={openAddForm}
            >
              {formOpen && !editingWinnerId ? <X size={17} /> : <Plus size={17} />}
              {formOpen && !editingWinnerId ? "Close" : "Add Winner"}
            </button>
          </div>
        </div>

        {formOpen && (
          <form className="admin-field-form" onSubmit={submit}>
            <div className="transaction-form-grid">
              <div className="field">
                <label>Winning year</label>
                <select
                  value={form.winningYear}
                  onChange={(e) =>
                    setForm({ ...form, winningYear: e.target.value })
                  }
                  required
                >
                  {yearChoices.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Company name</label>
                <input
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  placeholder="Winning company"
                  required
                />
              </div>
              <div className="field">
                <label>Founder name</label>
                <input
                  value={form.founderName}
                  onChange={(e) =>
                    setForm({ ...form, founderName: e.target.value })
                  }
                  placeholder="Founder name"
                  required
                />
              </div>
              <div className="field">
                <label>Mobile number</label>
                <input
                  type="tel"
                  value={form.mobileNumber}
                  onChange={(e) =>
                    setForm({ ...form, mobileNumber: e.target.value })
                  }
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
              <div className="field">
                <label>Sector</label>
                <select
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  required
                >
                  <option value="">Select sector</option>
                  {sectorOptions.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
              </div>
              {form.sector === "Other" && (
                <div className="field">
                  <label>Specify sector</label>
                  <input
                    value={customSector}
                    onChange={(e) => setCustomSector(e.target.value)}
                    placeholder="Enter your sector"
                    required
                  />
                </div>
              )}
              <div className="field">
                <label>District</label>
                <select
                  value={form.district}
                  onChange={(e) =>
                    setForm({ ...form, district: e.target.value })
                  }
                  required
                >
                  <option value="">Select district</option>
                  {options.districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="transaction-form-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setFormOpen(false);
                  setEditingWinnerId(null);
                  setCustomSector("");
                }}
              >
                {editingWinnerId ? "Cancel edit" : "Cancel"}
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingWinnerId
                    ? "Update Winner"
                    : "Add Winner"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="database-loading">Loading winners...</div>
        ) : filtered.length ? (
          <div className="gm-transaction-table-wrap">
            <table className="gm-transaction-table">
              <thead>
                <tr>
                  <th>Winning year</th>
                  <th>Company name</th>
                  <th>Founder name</th>
                  <th>Mobile number</th>
                  <th>Sector</th>
                  <th>District</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((winner) => (
                  <tr key={winner.id}>
                    <td>
                      <span className="status-pill verified">
                        {winner.winningYear}
                      </span>
                    </td>
                    <td>
                      <strong>{winner.companyName}</strong>
                    </td>
                    <td>{winner.founderName || "—"}</td>
                    <td>{winner.mobileNumber || "—"}</td>
                    <td>{winner.sector}</td>
                    <td>{winner.district}</td>
                    <td>
                      <div className="admin-field-actions">
                        <button
                          className="text-btn"
                          onClick={() => editWinner(winner)}
                        >
                          <Pencil size={15} /> Edit
                        </button>
                        <button
                          className="text-btn danger"
                          onClick={() => remove(winner.id)}
                        >
                          <Trash2 size={15} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            No winners{yearFilter !== "All" ? ` for ${yearFilter}` : ""} yet.
          </div>
        )}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
