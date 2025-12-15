import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Privacy from "./pages/Privacy";
import aimLogo from "./assets/aim-logo.svg";
import PortfolioStrip from "./components/PortfolioStrip";
import * as backend from "./services/backend";

const STORAGE_KEY = "brickplan-properties-v1";
const ACCOUNTS_KEY = "aim-realestate-accounts";
const RENOVATION_REQUESTS_KEY = "aim-renovation-requests";
const USER_KEY = "aim-realestate-user";
const generateVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const numberFields = [
  "purchasePrice",
  "equity",
  "rent",
  "expenses",
  "interestRate",
  "loanYears",
  "brokerPercent",
  "otherCostsPercent",
  "loanAmount",
  "monthlyLoanPayment",
  "monthlyCashflow",
  "grossYield",
  "equityReturn",
  "brokerFee",
  "otherBuyingCosts",
  "totalPurchaseCosts",
  "totalInvestment",
];

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const createPhotoEntry = (photo, fallbackId = null) => {
  if (!photo) return null;
  if (typeof photo === "string") {
    return {
      id: fallbackId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      src: photo,
      category: "Sonstiges",
      note: "",
    };
  }
  const src = photo.src || photo.url || "";
  if (!src) return null;
  return {
    id: photo.id || fallbackId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    src,
    category: photo.category || photo.type || "Sonstiges",
    note: photo.note || photo.description || "",
  };
};

const normalizeProperty = (raw) => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const normalized = {
    ...raw,
    propertyType: raw.propertyType || "wohnung",
    strategy: raw.strategy || "buy_and_hold",
    photos: [],
  };

  numberFields.forEach((field) => {
    normalized[field] = toNumber(raw[field]);
  });

  const rawPhotos = Array.isArray(raw.photos)
    ? raw.photos
    : raw.photoEntries
    ? raw.photoEntries
    : raw.photoUrl
    ? [raw.photoUrl]
    : [];

  normalized.photos = rawPhotos
    .map((photo, index) => createPhotoEntry(photo, `${raw.id || "photo"}-${index}`))
    .filter(Boolean)
    .map(({ id, ...rest }) => rest);

  return normalized;
};

const initialFormState = {
  title: "",
  purchasePrice: "",
  equity: "",
  rent: "",
  expenses: "",
  interestRate: "",
  loanYears: "",
  brokerPercent: "3",
  otherCostsPercent: "4.5",
  propertyType: "wohnung",
  strategy: "buy_and_hold",
  photoUrls: "",
  photoEntries: [],
};

const PROPERTY_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "wohnung", label: "Wohnungen" },
  { value: "haus", label: "Häuser" },
  { value: "garage", label: "Garagen" },
];

const getPropertyStorageKey = (userId) => `${STORAGE_KEY}-${userId || "guest"}`;

const loadAccounts = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveAccounts = (accounts) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore
  }
};

const hashPassword = (password) => {
  try {
    const salted = `aim:${password}`;
    return typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(salted)))
      : Buffer.from(salted).toString("base64");
  } catch {
    return password;
  }
};

const verifyPassword = (password, hash) => hashPassword(password) === hash;

const mapAccountToProfile = (account) => ({
  id: account.id,
  firstName: account.firstName || "",
  lastName: account.lastName || "",
  company: account.company || "",
  email: account.email,
  createdAt: account.createdAt,
});

const RENOVATION_AREA_OPTIONS = [
  { value: "kitchen", label: "Küche" },
  { value: "bathroom", label: "Bad" },
  { value: "livingroom", label: "Wohnzimmer" },
  { value: "bedroom", label: "Schlafzimmer" },
  { value: "flooring", label: "Bodenbeläge" },
  { value: "facade", label: "Fassade" },
  { value: "electrics", label: "Elektrik" },
  { value: "sanitary", label: "Sanitär" },
  { value: "other", label: "Sonstiges" },
];

const RENOVATION_AREA_PRESETS = {
  kitchen: { label: "Küche", min: 7000, max: 12000 },
  bathroom: { label: "Bad", min: 6000, max: 11000 },
  livingroom: { label: "Wohnzimmer", min: 3500, max: 7000 },
  bedroom: { label: "Schlafzimmer", min: 3000, max: 6000 },
  flooring: { label: "Bodenbeläge", min: 2500, max: 5500 },
  facade: { label: "Fassade", min: 8000, max: 15000 },
  electrics: { label: "Elektrik", min: 4000, max: 9000 },
  sanitary: { label: "Sanitär", min: 3500, max: 8000 },
  other: { label: "Sonstiger Bereich", min: 2500, max: 5000 },
};

const REGION_DATA = {
  wien: {
    label: "Wien",
    averagePrice: 5200,
    minPrice: 3800,
    maxPrice: 8200,
    districts: [
      { value: "1010", label: "01 · Innere Stadt", price: 8200 },
      { value: "1020", label: "02 · Leopoldstadt", price: 6400 },
      { value: "1030", label: "03 · Landstraße", price: 5900 },
      { value: "1040", label: "04 · Wieden", price: 6100 },
      { value: "1050", label: "05 · Margareten", price: 5400 },
      { value: "1060", label: "06 · Mariahilf", price: 6100 },
      { value: "1070", label: "07 · Neubau", price: 6200 },
      { value: "1080", label: "08 · Josefstadt", price: 6000 },
      { value: "1090", label: "09 · Alsergrund", price: 5900 },
      { value: "1100", label: "10 · Favoriten", price: 4600 },
      { value: "1110", label: "11 · Simmering", price: 4200 },
      { value: "1120", label: "12 · Meidling", price: 4700 },
      { value: "1130", label: "13 · Hietzing", price: 5200 },
      { value: "1140", label: "14 · Penzing", price: 4300 },
      { value: "1150", label: "15 · Rudolfsheim-Fünfhaus", price: 4500 },
      { value: "1160", label: "16 · Ottakring", price: 4400 },
      { value: "1170", label: "17 · Hernals", price: 4600 },
      { value: "1180", label: "18 · Währing", price: 5400 },
      { value: "1190", label: "19 · Döbling", price: 6100 },
      { value: "1200", label: "20 · Brigittenau", price: 4800 },
      { value: "1210", label: "21 · Floridsdorf", price: 4200 },
      { value: "1220", label: "22 · Donaustadt", price: 4500 },
      { value: "1230", label: "23 · Liesing", price: 4300 },
    ],
  },
  niederoesterreich: {
    label: "Niederösterreich",
    averagePrice: 3200,
    minPrice: 2100,
    maxPrice: 4200,
    districts: [
      { value: "stpoelten", label: "St. Pölten Stadt", price: 3500 },
      { value: "moedling", label: "Mödling", price: 4100 },
      { value: "korneuburg", label: "Korneuburg", price: 3600 },
      { value: "krems", label: "Krems Stadt", price: 3300 },
      { value: "wrneustadt", label: "Wiener Neustadt", price: 3000 },
    ],
  },
  steiermark: {
    label: "Steiermark",
    averagePrice: 3100,
    minPrice: 1900,
    maxPrice: 4300,
    districts: [
      { value: "graz", label: "Graz Stadt", price: 3900 },
      { value: "graz-umgebung", label: "Graz Umgebung", price: 3200 },
      { value: "leoben", label: "Leoben", price: 2500 },
      { value: "bruckmur", label: "Bruck-Mürzzuschlag", price: 2400 },
      { value: "liezen", label: "Liezen", price: 2200 },
    ],
  },
};

const CONDITION_FACTORS = {
  neubau: 1.1,
  sehr_gut: 1.0,
  gut: 0.95,
  sanierungsbeduerftig: 0.85,
  kernsanierung: 0.7,
};

const PROPERTY_TYPE_FACTORS = {
  wohnung: 1,
  haus: 1.05,
  sonstiges: 0.9,
};

const YEAR_FACTOR_RULES = [
  { maxYear: 1980, factor: 0.9 },
  { maxYear: 2000, factor: 0.95 },
  { maxYear: 2014, factor: 1 },
  { maxYear: 2019, factor: 1.03 },
  { maxYear: Infinity, factor: 1.08 },
];

const NAV_TABS = [
  { key: "info", label: "Allgemein" },
  { key: "properties", label: "Immobilien" },
  { key: "analysis", label: "Analyse" },
  { key: "renovation", label: "Renovierung" },
  { key: "overview", label: "Dashboard" },
  { key: "profile", label: "Profil" },
];

function App() {
  const [formData, setFormData] = useState(initialFormState);
  const [userProfile, setUserProfile] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.email ? parsed : null;
    } catch {
      return null;
    }
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
    </BrowserRouter>
  );
}


  });
  const [properties, setProperties] = useState([]);
  const [results, setResults] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [pendingVerification, setPendingVerification] = useState(null);
  const [verificationCode, setVerificationCode] = useState(null);
  const [authView, setAuthView] = useState(() => {
    if (typeof window === "undefined") return "login";
    try {
      const raw = window.localStorage.getItem(USER_KEY);
      return raw ? null : "register";
    } catch {
      return "login";
    }
  });
  const [passwordResetDraft, setPasswordResetDraft] = useState(null);
  const [passwordResetCode, setPasswordResetCode] = useState(null);
  const [renovationRequests, setRenovationRequests] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(RENOVATION_REQUESTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userProfile) {
      setProperties([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(getPropertyStorageKey(userProfile.id));
      if (!raw) {
        setProperties([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setProperties(
        Array.isArray(parsed)
          ? parsed
              .map((p) => normalizeProperty(p))
              .filter((item) => item !== null)
          : []
      );
    } catch {
      setProperties([]);
    }
  }, [userProfile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userProfile) return;
    const key = getPropertyStorageKey(userProfile.id);
    if (!properties || properties.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(properties));
  }, [properties, userProfile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userProfile) {
      window.localStorage.removeItem(USER_KEY);
      return;
    }
    window.localStorage.setItem(USER_KEY, JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RENOVATION_REQUESTS_KEY, JSON.stringify(renovationRequests));
  }, [renovationRequests]);

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateRenovationRequest = useCallback((request) => {
    setRenovationRequests((prev) => [...prev, request]);
    if (backend.hasRemoteBackend) {
      backend.submitRenovationRequest(request).catch((error) => {
        console.warn("Remote Anfrage fehlgeschlagen:", error);
      });
    }
  }, []);

  const handleUpdateRenovationRequest = useCallback((id, updates) => {
    setRenovationRequests((prev) => {
      const next = prev.map((req) =>
        req.id === id
          ? { ...req, ...updates, updatedAt: updates.updatedAt || new Date().toISOString() }
          : req
      );

      if (backend.hasRemoteBackend) {
        const current = next.find((req) => req.id === id);
        if (current) {
          backend.updateRenovationRequest(id, current).catch((error) => {
            console.warn("Remote Update fehlgeschlagen:", error);
          });
        }
      }

      return next;
    });
  }, []);

  const handleRegisterSubmit = useCallback(async (payload) => {
    if (backend.hasRemoteBackend) {
      const remote = await backend.registerUser(payload);
      if (remote.ok) {
        if (remote.profile) {
          setUserProfile(remote.profile);
          setAuthView(null);
        }
        return { ok: true };
      }
      if (!remote.allowFallback) {
        return { ok: false, error: remote.error || "Registrierung fehlgeschlagen." };
      }
    }

    const accounts = loadAccounts();
    const email = payload.email.trim().toLowerCase();
    if (accounts.some((acc) => acc.email === email)) {
      return { ok: false, error: "Diese E-Mail ist bereits registriert." };
    }
    const draft = {
      id: Date.now().toString(36),
      firstName: (payload.firstName || "").trim(),
      lastName: (payload.lastName || "").trim(),
      company: (payload.company || "").trim(),
      email,
      passwordHash: hashPassword(payload.password),
      createdAt: new Date().toISOString(),
    };
    setPendingVerification(draft);
    const code = generateVerificationCode();
    setVerificationCode(code);
    setAuthView("verify");
    return { ok: true };
  }, []);

  const handleVerificationSubmit = useCallback(
    (code) => {
      if (!pendingVerification || !verificationCode) return false;
      if (code !== verificationCode) return false;
      const accounts = loadAccounts();
      accounts.push({
        id: pendingVerification.id,
        firstName: pendingVerification.firstName,
        lastName: pendingVerification.lastName,
        company: pendingVerification.company,
        email: pendingVerification.email,
        passwordHash: pendingVerification.passwordHash,
        createdAt: pendingVerification.createdAt,
      });
      saveAccounts(accounts);
      setUserProfile(mapAccountToProfile(pendingVerification));
      setPendingVerification(null);
      setVerificationCode(null);
      setAuthView(null);
      return true;
    },
    [pendingVerification, verificationCode]
  );

  const handleResendVerification = useCallback(() => {
    if (!pendingVerification) return;
    setVerificationCode(generateVerificationCode());
  }, [pendingVerification]);

  const handleLoginSubmit = useCallback(async (payload) => {
    if (backend.hasRemoteBackend) {
      const remote = await backend.loginUser(payload);
      if (remote.ok && remote.profile) {
        setUserProfile(remote.profile);
        setAuthView(null);
        return { ok: true };
      }
      if (remote.ok) {
        return { ok: true };
      }
      if (!remote.allowFallback) {
        return { ok: false, error: remote.error || "Anmeldung fehlgeschlagen." };
      }
    }

    const accounts = loadAccounts();
    const email = payload.email.trim().toLowerCase();
    const account = accounts.find((acc) => acc.email === email);
    if (!account) {
      return { ok: false, error: "Kein Konto mit dieser E-Mail gefunden." };
    }
    if (!verifyPassword(payload.password, account.passwordHash)) {
      return { ok: false, error: "Passwort ist nicht korrekt." };
    }
    setUserProfile(mapAccountToProfile(account));
    setAuthView(null);
    return { ok: true };
  }, []);

  const handleRequestPasswordReset = useCallback(async (email) => {
    if (backend.hasRemoteBackend) {
      const remote = await backend.requestPasswordReset(email);
      if (remote.ok) {
        return { ok: true };
      }
      if (!remote.allowFallback) {
        return { ok: false, error: remote.error || "Zurücksetzen fehlgeschlagen." };
      }
    }

    const accounts = loadAccounts();
    const account = accounts.find((acc) => acc.email === email.trim().toLowerCase());
    if (!account) {
      return { ok: false, error: "Unter dieser E-Mail existiert kein Konto." };
    }
    setPasswordResetDraft(account);
    setPasswordResetCode(generateVerificationCode());
    setAuthView("reset-verify");
    return { ok: true };
  }, []);

  const handleConfirmPasswordReset = useCallback(
    async (payload) => {
      if (backend.hasRemoteBackend) {
        const remote = await backend.confirmPasswordReset(payload);
        if (remote.ok) {
          return { ok: true };
        }
        if (!remote.allowFallback) {
          return { ok: false, error: remote.error || "Zurücksetzen fehlgeschlagen." };
        }
      }

      if (!passwordResetDraft || !passwordResetCode) {
        return { ok: false, error: "Kein Reset-Vorgang aktiv." };
      }
      if (payload.code !== passwordResetCode) {
        return { ok: false, error: "Code ist nicht korrekt." };
      }
      const accounts = loadAccounts();
      const idx = accounts.findIndex((acc) => acc.id === passwordResetDraft.id);
      if (idx === -1) {
        return { ok: false, error: "Konto nicht gefunden." };
      }
      accounts[idx] = {
        ...accounts[idx],
        passwordHash: hashPassword(payload.password),
      };
      saveAccounts(accounts);
      setPasswordResetDraft(null);
      setPasswordResetCode(null);
      setAuthView("login");
      return { ok: true };
    },
    [passwordResetDraft, passwordResetCode]
  );

  const handleCalculate = useCallback(() => {
    const {
      purchasePrice,
      equity,
      rent,
      expenses,
      interestRate,
      loanYears,
      brokerPercent,
      otherCostsPercent,
    } = formData;

    const p = Number(purchasePrice) || 0;
    const e = Number(equity) || 0;
    const r = Number(rent) || 0;
    const ex = Number(expenses) || 0;
    const iRate = Number(interestRate) || 0;
    const years = Number(loanYears) || 0;
    const brokerP = Number(brokerPercent) || 0;
    const otherP = Number(otherCostsPercent) || 0;

    const loanAmount = Math.max(p - e, 0);
    const monthlyInterest = iRate > 0 ? iRate / 100 / 12 : 0;
    const totalMonths = years > 0 ? years * 12 : 0;

    let monthlyLoanPayment = 0;
    if (loanAmount > 0 && monthlyInterest > 0 && totalMonths > 0) {
      const pow = Math.pow(1 + monthlyInterest, totalMonths);
      monthlyLoanPayment = (loanAmount * monthlyInterest * pow) / (pow - 1);
    } else if (loanAmount > 0 && monthlyInterest === 0 && totalMonths > 0) {
      monthlyLoanPayment = loanAmount / totalMonths;
    }

    const brokerFee = (p * brokerP) / 100;
    const otherBuyingCosts = (p * otherP) / 100;
    const totalPurchaseCosts = brokerFee + otherBuyingCosts;
    const totalInvestment = p + totalPurchaseCosts;

    const monthlyCashflow = r - ex - monthlyLoanPayment;
    const yearlyRent = r * 12;
    const grossBase = totalInvestment > 0 ? totalInvestment : p;
    const grossYield = grossBase > 0 ? (yearlyRent / grossBase) * 100 : 0;

    const yearlyCashflow = monthlyCashflow * 12;
    const equityReturn = e > 0 ? (yearlyCashflow / e) * 100 : 0;

    setResults({
      loanAmount,
      monthlyLoanPayment,
      monthlyCashflow,
      grossYield,
      equityReturn,
      brokerFee,
      otherBuyingCosts,
      totalPurchaseCosts,
      totalInvestment,
    });
  }, [formData]);

  const resetFormToInitial = useCallback(() => {
    setFormData({ ...initialFormState, photoEntries: [], photoUrls: "" });
    setResults(null);
    setEditingPropertyId(null);
  }, []);

  const handleAddToList = useCallback(() => {
    if (!results) {
      alert("Bitte zuerst auf „Berechnen“ klicken.");
      return;
    }
    if (!formData.title.trim()) {
      alert("Bitte gib einen Namen für die Immobilie ein.");
      return;
    }

    const uploadedPhotos =
      formData.photoEntries && formData.photoEntries.length > 0
        ? formData.photoEntries
            .filter((entry) => entry && entry.src)
            .map(({ src, category, note }) => ({
              src,
              category: category || "Sonstiges",
              note: note || "",
            }))
        : [];

    const linkedPhotos =
      formData.photoUrls
        .split(/[\n,]/)
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url) => ({
          src: url,
          category: "Sonstiges",
          note: "",
        })) || [];

    const combinedPhotos = [...uploadedPhotos, ...linkedPhotos];

    const newProperty = {
      id: editingPropertyId || Date.now(),
      title: formData.title.trim(),
      propertyType: formData.propertyType,
      strategy: formData.strategy,
      photos: combinedPhotos,
      purchasePrice: Number(formData.purchasePrice) || 0,
      equity: Number(formData.equity) || 0,
      rent: Number(formData.rent) || 0,
      expenses: Number(formData.expenses) || 0,
      interestRate: Number(formData.interestRate) || 0,
      loanYears: Number(formData.loanYears) || 0,
      brokerPercent: Number(formData.brokerPercent) || 0,
      otherCostsPercent: Number(formData.otherCostsPercent) || 0,
      ...results,
    };

    const normalizedProperty = normalizeProperty(newProperty);

    setProperties((prev) => {
      if (editingPropertyId) {
        return prev.map((prop) => (prop.id === editingPropertyId ? normalizedProperty : prop));
      }
      return [...prev, normalizedProperty];
    });
    resetFormToInitial();
  }, [formData, results, editingPropertyId, resetFormToInitial]);

  const handleDelete = useCallback(
    (id) => {
      setProperties((prev) => prev.filter((p) => p.id !== id));
      setSelectedProperty((prev) => (prev && prev.id === id ? null : prev));
      if (editingPropertyId === id) {
        resetFormToInitial();
      } else {
        setEditingPropertyId((prev) => (prev === id ? null : prev));
      }
    },
    [editingPropertyId, resetFormToInitial]
  );

  const handleEditProperty = useCallback(
    (property) => {
      if (!property) return;
      setActiveTab("properties");
      setEditingPropertyId(property.id);
      setFormData({
        title: property.title || "",
        propertyType: property.propertyType || "wohnung",
        strategy: property.strategy || "buy_and_hold",
        photoUrls: (property.photos || [])
          .map((photo) => (typeof photo === "string" ? photo : photo?.src || ""))
          .filter(Boolean)
          .join("\n"),
        photoEntries: (property.photos || [])
          .map((photo, index) => createPhotoEntry(photo, `${property.id}-${index}`))
          .filter(Boolean),
        purchasePrice: property.purchasePrice?.toString() || "",
        equity: property.equity?.toString() || "",
        rent: property.rent?.toString() || "",
        expenses: property.expenses?.toString() || "",
        interestRate: property.interestRate?.toString() || "",
        loanYears: property.loanYears?.toString() || "",
        brokerPercent: property.brokerPercent?.toString() || "3",
        otherCostsPercent: property.otherCostsPercent?.toString() || "4.5",
      });
      setResults({
        loanAmount: property.loanAmount || 0,
        monthlyLoanPayment: property.monthlyLoanPayment || 0,
        monthlyCashflow: property.monthlyCashflow || 0,
        grossYield: property.grossYield || 0,
        equityReturn: property.equityReturn || 0,
        brokerFee: property.brokerFee || 0,
        otherBuyingCosts: property.otherBuyingCosts || 0,
        totalPurchaseCosts: property.totalPurchaseCosts || 0,
        totalInvestment: property.totalInvestment || 0,
      });
    },
    [setActiveTab, setEditingPropertyId, setFormData, setResults]
  );

  const handleCancelEdit = useCallback(() => {
    resetFormToInitial();
  }, [resetFormToInitial]);

  const handleClearAll = useCallback(() => {
    const sure = window.confirm(
      "Wirklich alle gespeicherten Immobilien löschen?"
    );
    if (!sure) return;
    setProperties([]);
    setSelectedProperty(null);
    if (typeof window !== "undefined" && userProfile) {
      window.localStorage.removeItem(getPropertyStorageKey(userProfile.id));
    }
  }, [userProfile]);

  const handleExportJson = useCallback(() => {
    if (properties.length === 0) {
      alert("Es gibt aktuell keine Immobilien zu exportieren.");
      return;
    }

    const dataStr = JSON.stringify(properties, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "aim-properties.json";
    a.click();

    URL.revokeObjectURL(url);
  }, [properties]);

  const handleSignOut = useCallback(() => {
    const sure = window.confirm("Möchtest du dich wirklich abmelden? Deine Daten bleiben im Browser erhalten.");
    if (!sure) return;
    setProperties([]);
    setSelectedProperty(null);
    setPendingVerification(null);
    setVerificationCode(null);
    setPasswordResetDraft(null);
    setPasswordResetCode(null);
    setAuthView("login");
    setUserProfile(null);
  }, []);

  const isAdmin =
    !!(
      userProfile &&
      userProfile.email &&
      (userProfile.email.toLowerCase().startsWith("admin") ||
        userProfile.email.toLowerCase().includes("+admin") ||
        userProfile.email.toLowerCase().endsWith("@aimrealestate.com"))
    );

  const navTabs = useMemo(
    () =>
      isAdmin ? [...NAV_TABS, { key: "admin", label: "Admin" }] : NAV_TABS,
    [isAdmin]
  );

  const {
    totalCashflow,
    avgGrossYield,
    avgEquityReturn,
    propertiesCount,
  } = useMemo(() => {
    if (properties.length === 0) {
      return {
        totalCashflow: 0,
        avgGrossYield: 0,
        avgEquityReturn: 0,
        propertiesCount: 0,
      };
    }

    const totals = properties.reduce(
      (acc, p) => {
        acc.cashflow += p.monthlyCashflow;
        acc.gross += p.grossYield;
        acc.equity += p.equityReturn;
        return acc;
      },
      { cashflow: 0, gross: 0, equity: 0 }
    );

    return {
      totalCashflow: totals.cashflow,
      avgGrossYield: totals.gross / properties.length,
      avgEquityReturn: totals.equity / properties.length,
      propertiesCount: properties.length,
    };
  }, [properties]);

  const { bestByEquity, bestByCashflow } = useMemo(() => {
    if (properties.length === 0) {
      return { bestByEquity: null, bestByCashflow: null };
    }

    const bestEquity = properties.reduce(
      (best, p) => (!best || p.equityReturn > best.equityReturn ? p : best),
      null
    );
    const bestCashflow = properties.reduce(
      (best, p) => (!best || p.monthlyCashflow > best.monthlyCashflow ? p : best),
      null
    );
    return { bestByEquity: bestEquity, bestByCashflow: bestCashflow };
  }, [properties]);

  const handleUpdateProfile = useCallback((updates) => {
    setUserProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      const accounts = loadAccounts();
      const idx = accounts.findIndex((acc) => acc.id === prev.id);
      if (idx >= 0) {
        accounts[idx] = { ...accounts[idx], ...updates };
        saveAccounts(accounts);
      }
      return next;
    });
  }, []);

const propertyTypeStats = useMemo(() => {
    return properties.reduce(
      (acc, prop) => {
        const typeKey = prop.propertyType || "wohnung";
        acc[typeKey] = (acc[typeKey] || 0) + 1;
        acc.all = (acc.all || 0) + 1;
        return acc;
      },
      { all: 0 }
    );
  }, [properties]);

  const propertyTypeBreakdown = useMemo(() => {
    const buckets = {
      all: {
        key: "all",
        label: "Gesamtportfolio",
        count: 0,
        totalCashflow: 0,
        totalGross: 0,
        totalEquity: 0,
      },
    };

    const ensureBucket = (key) => {
      if (!buckets[key]) {
        buckets[key] = {
          key,
          label: formatPropertyType(key),
          count: 0,
          totalCashflow: 0,
          totalGross: 0,
          totalEquity: 0,
        };
      }
      return buckets[key];
    };

    properties.forEach((prop) => {
      const typeKey = prop.propertyType || "wohnung";
      const aggregate = (bucket) => {
        bucket.count += 1;
        bucket.totalCashflow += prop.monthlyCashflow;
        bucket.totalGross += prop.grossYield;
        bucket.totalEquity += prop.equityReturn;
      };

      aggregate(ensureBucket("all"));
      aggregate(ensureBucket(typeKey));
    });

    return Object.values(buckets).map((bucket) => ({
      ...bucket,
      avgGrossYield: bucket.count > 0 ? bucket.totalGross / bucket.count : 0,
      avgEquityReturn: bucket.count > 0 ? bucket.totalEquity / bucket.count : 0,
    }));
  }, [properties]);

  const analyticsData = useMemo(() => {
    if (properties.length === 0) {
      return {
        sortedByEquity: [],
        sortedByCashflow: [],
        maxEquityReturn: 0,
        maxAbsCashflow: 0,
      };
    }

    const sortedByEquity = [...properties].sort(
      (a, b) => b.equityReturn - a.equityReturn
    );
    const sortedByCashflow = [...properties].sort(
      (a, b) => b.monthlyCashflow - a.monthlyCashflow
    );

    const maxEquityReturn = sortedByEquity.reduce(
      (max, p) => (p.equityReturn > max ? p.equityReturn : max),
      0
    );
    const maxAbsCashflow = sortedByCashflow.reduce((max, p) => {
      const v = Math.abs(p.monthlyCashflow);
      return v > max ? v : max;
    }, 0);

    return { sortedByEquity, sortedByCashflow, maxEquityReturn, maxAbsCashflow };
  }, [properties]);

  if (!userProfile) {
    if (authView === "verify" && pendingVerification) {
      return (
        <VerificationScreen
          draft={pendingVerification}
          code={verificationCode}
          onVerify={handleVerificationSubmit}
          onResend={handleResendVerification}
          onCancel={() => {
            setPendingVerification(null);
            setVerificationCode(null);
            setAuthView("register");
          }}
        />
      );
    }
    if (authView === "login") {
      return (
        <LoginScreen
          onLogin={handleLoginSubmit}
          onSwitchToRegister={() => setAuthView("register")}
          onForgotPassword={() => setAuthView("reset")}
        />
      );
    }
    if (authView === "reset") {
      return (
        <PasswordResetRequest
          onRequest={handleRequestPasswordReset}
          onBack={() => setAuthView("login")}
        />
      );
    }
    if (authView === "reset-verify" && passwordResetDraft) {
      return (
        <PasswordResetVerify
          draft={passwordResetDraft}
          code={passwordResetCode}
          onSubmit={handleConfirmPasswordReset}
          onCancel={() => {
            setPasswordResetDraft(null);
            setPasswordResetCode(null);
            setAuthView("login");
          }}
        />
      );
    }
    return (
      <RegistrationScreen
        onRegister={handleRegisterSubmit}
        onSwitchToLogin={() => setAuthView("login")}
      />
    );
  }

  return (
    <div style={pageStyle} className="app-page">
      <div style={cardStyle} className="app-root-card">
        <BrandBar />
        <nav style={navStyle} className="app-nav">
          {navTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`nav-pill ${activeTab === tab.key ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
  <img
    src={aimLogo}
    alt="AIM RealEstate Analytics Logo"
    style={{
      width: 44,
      height: 44,
      borderRadius: "12px",
      boxShadow: "0 10px 22px rgba(15, 23, 42, 0.55)",
      flexShrink: 0,
    }}
  />
            <div>
              <h1 style={titleStyle}>AIM RealEstate Analytics</h1>
              <p style={subtitleStyle}>
                Präzise Analyse für smarte Immobilien-Investments.
              </p>
            </div>
          </div>

          <div style={headerRightStyle}>
            <div style={{ textAlign: "right", marginRight: "0.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Firma</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                {userProfile?.company || userProfile?.name || "AIM RealEstate Analytics"}
              </div>
            </div>
            <span style={badgeStyle}>MVP · v0.5</span>
          </div>
        </header>

        {activeTab === "overview" && (
          <>
            <PortfolioStrip
              propertiesCount={propertiesCount}
              totalCashflow={totalCashflow}
              avgGrossYield={avgGrossYield}
              avgEquityReturn={avgEquityReturn}
            />
            <OverviewSection
              propertiesCount={propertiesCount}
              totalCashflow={totalCashflow}
              avgGrossYield={avgGrossYield}
              avgEquityReturn={avgEquityReturn}
              propertyTypeBreakdown={propertyTypeBreakdown}
            />
            <AnalyticsSection
              bestByEquity={bestByEquity}
              bestByCashflow={bestByCashflow}
              analyticsData={analyticsData}
              propertiesCount={propertiesCount}
              properties={properties}
            />
          </>
        )}

        {activeTab === "properties" && (
          <MainAndList
            formData={formData}
            onFormChange={handleFormChange}
            onCalculate={handleCalculate}
            onAddToList={handleAddToList}
            results={results}
            properties={properties}
            onDelete={handleDelete}
            selectedProperty={selectedProperty}
            onSelectProperty={setSelectedProperty}
            propertyFilter={propertyFilter}
            onFilterChange={setPropertyFilter}
            propertyTypeStats={propertyTypeStats}
            onEditProperty={handleEditProperty}
            onCancelEdit={handleCancelEdit}
            isEditing={Boolean(editingPropertyId)}
          />
        )}

        {activeTab === "analysis" && <MarketAnalysisTab />}

        {activeTab === "renovation" && (
          <RenovationCoachTab
            properties={properties}
            requests={renovationRequests}
            onCreateRequest={handleCreateRenovationRequest}
            currentUserId={userProfile?.id || "guest"}
          />
        )}

        {activeTab === "info" && (
          <InfoTab
            onStart={() => setActiveTab("properties")}
            userName={
              userProfile
                ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(" ") ||
                  userProfile.email
                : null
            }
          />
        )}

        {activeTab === "profile" && (
          <ProfileSection
            userProfile={userProfile}
            onUpdateProfile={setUserProfile}
            onExportJson={handleExportJson}
          />
        )}

        {activeTab === "admin" && (
          isAdmin ? (
            <AdminPanel
              requests={renovationRequests}
              onUpdateRequest={handleUpdateRenovationRequest}
            />
          ) : (
            <section style={{ marginTop: "1.5rem" }}>
              <h2 style={sectionTitleStyle}>Admin</h2>
              <p style={{ color: "rgba(226,232,240,0.8)" }}>
                Du hast keinen Zugriff auf den Admin-Bereich.
              </p>
            </section>
          )
        )}
      </div>
      <button type="button" style={floatingLogoutStyle} onClick={handleSignOut}>
        Abmelden
      </button>
    </div>
  );
}

function OverviewSection({
  propertiesCount,
  totalCashflow,
  avgGrossYield,
  avgEquityReturn,
  propertyTypeBreakdown,
}) {
  const hasProperties = propertiesCount > 0;
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={sectionTitleStyle}>Gesamtübersicht</h2>
      <div style={summaryGridStyle} className="summary-grid">
        <SummaryCard label="Anzahl Immobilien" value={propertiesCount.toString()} />
        <SummaryCard
          label="Gesamt-Cashflow / Monat"
          value={`${totalCashflow.toFixed(2)} €`}
          highlight={
            !hasProperties
              ? "neutral"
              : totalCashflow >= 0
              ? "green"
              : "red"
          }
        />
        <SummaryCard
          label="Ø Bruttorendite"
          value={hasProperties ? `${avgGrossYield.toFixed(2)} %` : "—"}
        />
        <SummaryCard
          label="Ø EK-Rendite"
          value={hasProperties ? `${avgEquityReturn.toFixed(2)} %` : "—"}
        />
      </div>
      {hasProperties && (
        <PropertyTypeOverview breakdown={propertyTypeBreakdown} />
      )}
    </section>
  );
}



function BrandBar() {
  return (
    <div style={brandBarStyle}>
      <div style={brandBarLeftStyle}>
        <span style={brandDotStyle} />
        <span style={brandBarTextStyle}>AIM RealEstate Analytics</span>
      </div>
      <div style={brandBarRightStyle}>
        <span style={brandEnvStyle}>App</span>
        <span style={brandBetaStyle}>Beta v0.5</span>
      </div>
    </div>
  );
}

function MainAndList({
  formData,
  onFormChange,
  onCalculate,
  onAddToList,
  results,
  properties,
  onDelete,
  selectedProperty,
  onSelectProperty,
  propertyFilter,
  onFilterChange,
  propertyTypeStats,
  onEditProperty,
  onCancelEdit,
  isEditing,
}) {
  const {
    title,
    propertyType,
    strategy,
    photoUrls,
    photoEntries,
    purchasePrice,
    equity,
    rent,
    expenses,
    interestRate,
    loanYears,
    brokerPercent,
    otherCostsPercent,
  } = formData;

  const filteredProperties =
    propertyFilter === "all"
      ? properties
      : properties.filter((prop) => prop.propertyType === propertyFilter);

  useEffect(() => {
    if (
      selectedProperty &&
      propertyFilter !== "all" &&
      selectedProperty.propertyType !== propertyFilter
    ) {
      onSelectProperty(null);
    }
  }, [selectedProperty, propertyFilter, onSelectProperty]);

  return (
    <>
      <div style={mainGridStyle} className="main-grid">
        <section style={formCardStyle}>
          <h2 style={sectionTitleStyle}>Immobilie anlegen</h2>
          {isEditing && (
            <div style={editBannerStyle}>
              <span>Bearbeitung aktiv{formData.title ? `: ${formData.title}` : ""}</span>
              <button type="button" style={editBannerLinkStyle} onClick={onCancelEdit}>
                Abbrechen
              </button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle} htmlFor="title-input">
                Name der Immobilie
              </label>
              <input
                className="aim-input"
                id="title-input"
                type="text"
                value={title}
                onChange={(e) => onFormChange("title", e.target.value)}
                placeholder="z.B. Wohnung Ottakring 72m²"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="propertyType">
                Immobilienart
              </label>
              <select
                className="aim-input"
                id="propertyType"
                value={propertyType}
                onChange={(e) => onFormChange("propertyType", e.target.value)}
                style={selectStyle}
              >
                <option value="wohnung">Wohnung</option>
                <option value="haus">Haus</option>
                <option value="garage">Garage</option>
              </select>
            </div>

            <div>
              <label style={labelStyle} htmlFor="strategy">
                Strategie
              </label>
              <select
                className="aim-input"
                id="strategy"
                value={strategy}
                onChange={(e) => onFormChange("strategy", e.target.value)}
                style={selectStyle}
              >
                <option value="buy_and_hold">Buy &amp; Hold</option>
                <option value="flip">Fix &amp; Flip</option>
                <option value="eigennutzung">Eigennutzung</option>
              </select>
            </div>

            <PhotoField
              value={photoUrls}
              onChange={(val) => onFormChange("photoUrls", val)}
              entries={photoEntries}
              onEntriesChange={(items) => onFormChange("photoEntries", items)}
            />

            <Field
              name="purchasePrice"
              label="Kaufpreis (€)"
              placeholder="z.B. 250000"
              value={purchasePrice}
              onChange={onFormChange}
            />
            <Field
              name="equity"
              label="Eigenkapital (€)"
              placeholder="z.B. 50000"
              value={equity}
              onChange={onFormChange}
            />
            <Field
              name="rent"
              label="Mieteinnahmen pro Monat (€)"
              placeholder="z.B. 900"
              value={rent}
              onChange={onFormChange}
            />
            <Field
              name="expenses"
              label="Monatliche Kosten (€)"
              placeholder="z.B. 350"
              value={expenses}
              onChange={onFormChange}
            />
            <Field
              name="interestRate"
              label="Zinssatz p.a. (%)"
              placeholder="z.B. 4"
              value={interestRate}
              onChange={onFormChange}
            />
            <Field
              name="loanYears"
              label="Laufzeit (Jahre)"
              placeholder="z.B. 30"
              value={loanYears}
              onChange={onFormChange}
            />
            <Field
              name="brokerPercent"
              label="Maklerprovision (%)"
              placeholder="z.B. 3"
              value={brokerPercent}
              onChange={onFormChange}
            />
            <Field
              name="otherCostsPercent"
              label="Sonstige Kaufnebenkosten (%)"
              placeholder="z.B. 4.5"
              value={otherCostsPercent}
              onChange={onFormChange}
            />

            <div style={buttonRowStyle} className="button-row">
              <button style={primaryButtonStyle} type="button" onClick={onCalculate}>
                Berechnen
              </button>
              <button
                style={secondaryButtonStyle}
                type="button"
                onClick={onAddToList}
              >
                {isEditing ? "Änderungen speichern" : "Zur Liste hinzufügen"}
              </button>
              {isEditing && (
                <button type="button" style={tertiaryButtonStyle} onClick={onCancelEdit}>
                  Eingaben zurücksetzen
                </button>
              )}
            </div>
          </div>
        </section>

        <section style={resultsCardStyle}>
          <h2 style={sectionTitleStyle}>Ergebnisse (aktuelle Immobilie)</h2>
          {results ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <ResultRow label="Kreditbetrag" value={`${results.loanAmount.toFixed(2)} €`} />
              <ResultRow
                label="Monatliche Kreditrate"
                value={`${results.monthlyLoanPayment.toFixed(2)} €`}
              />
              <ResultRow
                label="Monatlicher Cashflow (nach Kredit)"
                value={`${results.monthlyCashflow.toFixed(2)} € / Monat`}
                highlight={results.monthlyCashflow >= 0 ? "green" : "red"}
              />
              <ResultRow
                label="Bruttorendite (inkl. Nebenkosten)"
                value={`${results.grossYield.toFixed(2)} %`}
              />
              <ResultRow
                label="Eigenkapitalrendite"
                value={`${results.equityReturn.toFixed(2)} %`}
              />
              <ResultRow label="Maklerprovision" value={`${results.brokerFee.toFixed(2)} €`} />
              <ResultRow
                label="Sonstige Kaufnebenkosten"
                value={`${results.otherBuyingCosts.toFixed(2)} €`}
              />
              <ResultRow
                label="Gesamte Kaufnebenkosten"
                value={`${results.totalPurchaseCosts.toFixed(2)} €`}
              />
              <ResultRow
                label="Gesamtinvestition (KP + Nebenkosten)"
                value={`${results.totalInvestment.toFixed(2)} €`}
              />
              <small style={{ color: "#9ca3af", marginTop: "0.5rem" }}>
                Hinweis: Nebenkosten werden als Prozent vom Kaufpreis berechnet (Makler +
                sonstige Kosten).
              </small>
            </div>
          ) : (
            <p style={{ color: "#9ca3af" }}>
              Trage links deine Daten ein und klicke auf <strong>„Berechnen“</strong>, um Kennzahlen
              zu sehen.
            </p>
          )}
        </section>
      </div>

      <section style={{ marginTop: "2.5rem" }}>
        <div style={listHeaderStyle}>
          <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Immobilien-Liste</h2>
          <PropertyFilterBar
            activeFilter={propertyFilter}
            onChange={onFilterChange}
            stats={propertyTypeStats}
          />
        </div>
        {properties.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>
            Noch keine Immobilien in der Liste. Berechne eine Immobilie und klicke auf
            <strong>„Zur Liste hinzufügen“</strong>.
          </p>
        ) : filteredProperties.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>
            Keine Immobilien für diese Kategorie vorhanden. Wähle eine andere Filteroption.
          </p>
        ) : (
          <div style={tableWrapperStyle} className="table-wrapper">
            <table style={tableStyle}>
              <thead>
                <tr style={tableHeadRowStyle}>
                  <Th>Name</Th>
                  <Th>Cashflow / Monat</Th>
                  <Th>Bruttorendite</Th>
                  <Th>EK-Rendite</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((prop) => (
                  <tr
                    key={prop.id}
                    style={{ ...tableBodyRowStyle, cursor: "pointer" }}
                    onClick={() => onSelectProperty(prop)}
                  >
                    <Td>{prop.title}</Td>
                    <Td
                      style={{
                        color: prop.monthlyCashflow >= 0 ? "#166534" : "#991b1b",
                        fontWeight: 500,
                      }}
                    >
                      {prop.monthlyCashflow.toFixed(2)} €
                    </Td>
                    <Td>{prop.grossYield.toFixed(2)} %</Td>
                    <Td>{prop.equityReturn.toFixed(2)} %</Td>
                    <Td>
                      <div style={tableActionsStyle}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProperty(prop);
                          }}
                          style={smallLinkButtonStyle}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(prop.id);
                          }}
                          style={smallLinkButtonStyle}
                        >
                          Entfernen
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedProperty && (
        <section style={{ marginTop: "1.5rem" }}>
          <h3
            style={{
              ...sectionTitleStyle,
              marginBottom: "0.5rem",
              fontSize: "1rem",
            }}
          >
            Details zu: {selectedProperty.title}
          </h3>
          {selectedProperty.photos && selectedProperty.photos.length > 0 && (
            <div style={detailGalleryStyle}>
              {selectedProperty.photos.map((photo, index) => {
                const meta = toPhotoObject(photo);
                if (!meta.src) return null;
                return (
                  <div key={`${selectedProperty.id}-photo-${index}`} style={detailImageWrapperStyle}>
                    <img
                      src={meta.src}
                      alt={`Foto ${index + 1} von ${selectedProperty.title}`}
                      style={detailImageStyle}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    {(meta.category || meta.note) && (
                      <div style={photoTagStyle}>
                        <strong>{meta.category || "Foto"}</strong>
                        {meta.note && <span style={{ display: "block", fontWeight: 400 }}>{meta.note}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <DetailItem label="Immobilienart" value={formatPropertyType(selectedProperty.propertyType)} />
            <DetailItem label="Strategie" value={formatStrategy(selectedProperty.strategy)} />
            <DetailItem
              label="Kaufpreis"
              value={`${safeFixed(selectedProperty.purchasePrice)} €`}
            />
            <DetailItem label="Eigenkapital" value={`${safeFixed(selectedProperty.equity)} €`} />
            <DetailItem
              label="Mieteinnahmen / Monat"
              value={`${safeFixed(selectedProperty.rent)} €`}
            />
            <DetailItem
              label="Monatliche Kosten"
              value={`${safeFixed(selectedProperty.expenses)} €`}
            />
            <DetailItem
              label="Zinssatz p.a."
              value={`${safeFixed(selectedProperty.interestRate)} %`}
            />
            <DetailItem label="Laufzeit" value={`${safeFixed(selectedProperty.loanYears, 0)} Jahre`} />
            <DetailItem
              label="Maklerprovision (%)"
              value={`${safeFixed(selectedProperty.brokerPercent)} %`}
            />
            <DetailItem
              label="Sonstige Nebenkosten (%)"
              value={`${safeFixed(selectedProperty.otherCostsPercent)} %`}
            />
            <DetailItem
              label="Maklerprovision (Betrag)"
              value={`${safeFixed(selectedProperty.brokerFee)} €`}
            />
            <DetailItem
              label="Sonstige Kaufnebenkosten"
              value={`${safeFixed(selectedProperty.otherBuyingCosts)} €`}
            />
            <DetailItem
              label="Gesamte Kaufnebenkosten"
              value={`${safeFixed(selectedProperty.totalPurchaseCosts)} €`}
            />
            <DetailItem
              label="Gesamtinvestition (KP + Nebenkosten)"
              value={`${safeFixed(selectedProperty.totalInvestment)} €`}
            />
            <DetailItem label="Kreditbetrag" value={`${safeFixed(selectedProperty.loanAmount)} €`} />
            <DetailItem
              label="Monatliche Kreditrate"
              value={`${safeFixed(selectedProperty.monthlyLoanPayment)} €`}
            />
            <DetailItem
              label="Monatlicher Cashflow"
              value={`${safeFixed(selectedProperty.monthlyCashflow)} € / Monat`}
            />
            <DetailItem label="Bruttorendite" value={`${safeFixed(selectedProperty.grossYield)} %`} />
            <DetailItem label="Eigenkapitalrendite" value={`${safeFixed(selectedProperty.equityReturn)} %`} />
          </div>
          <button
            type="button"
            onClick={() => onSelectProperty(null)}
            style={{ ...secondaryButtonStyle, marginTop: "1rem" }}
          >
            Details schließen
          </button>
        </section>
      )}
    </>
  );
}

function RenovationCoachTab({ properties, requests = [], onCreateRequest, currentUserId }) {
  const hasPhotos = properties.some((p) => p.photos && p.photos.length > 0);
  const [meta, setMeta] = useState({
    objectName: "",
    totalArea: "",
    state: "wien",
    district: REGION_DATA.wien.districts[0].value,
    notes: "",
  });
  const [areaDraft, setAreaDraft] = useState({
    type: "kitchen",
    description: "",
    photos: [],
  });
  const [areas, setAreas] = useState([]);
  const [submitMessage, setSubmitMessage] = useState("");
  const [error, setError] = useState("");

  const districtOptions = REGION_DATA[meta.state]?.districts || [];

  const handleMetaChange = (field, value) => {
    setMeta((prev) => {
      if (field === "state") {
        const nextDistrict = REGION_DATA[value]?.districts?.[0]?.value || "";
        return { ...prev, state: value, district: nextDistrict };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleDraftChange = (field, value) => {
    setAreaDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleDraftPhotos = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const src = loadEvent.target?.result?.toString();
        if (!src) return;
        setAreaDraft((prev) => ({
          ...prev,
          photos: [
            ...prev.photos,
            { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, src, name: file.name },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const handleRemoveDraftPhoto = (id) => {
    setAreaDraft((prev) => ({
      ...prev,
      photos: prev.photos.filter((photo) => photo.id !== id),
    }));
  };

  const handleAddArea = () => {
    if (!areaDraft.description.trim() && areaDraft.photos.length === 0) {
      setError("Bitte beschreibe den Bereich oder füge zumindest ein Foto hinzu.");
      return;
    }
    const newArea = {
      id: Date.now(),
      type: areaDraft.type,
      description: areaDraft.description.trim(),
      photos: areaDraft.photos,
    };
    setAreas((prev) => [...prev, newArea]);
    setAreaDraft({ type: "kitchen", description: "", photos: [] });
    setError("");
  };

  const handleRemoveArea = (id) => {
    setAreas((prev) => prev.filter((area) => area.id !== id));
  };

  const handleEstimate = () => {
    if (areas.length === 0) {
      setError("Füge mindestens einen Bereich mit Fotos hinzu.");
      return;
    }
    if (typeof onCreateRequest !== "function") {
      setError("Speichern nicht möglich. Bitte später erneut versuchen.");
      return;
    }
    const request = {
      id: Date.now().toString(36),
      userId: currentUserId,
      meta,
      areas: areas.map((area) => ({
        ...area,
        estimateMin: area.estimateMin || null,
        estimateMax: area.estimateMax || null,
      })),
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      adminNote: "",
      totalMin: null,
      totalMax: null,
    };
    onCreateRequest(request);
    setMeta({
      objectName: "",
      totalArea: "",
      state: "wien",
      district: REGION_DATA.wien.districts[0].value,
      notes: "",
    });
    setAreas([]);
    setAreaDraft({ type: "kitchen", description: "", photos: [] });
    setError("");
    setSubmitMessage("Analyse-Anfrage gesendet. Wir melden uns mit einer Schätzung.");
    setTimeout(() => setSubmitMessage(""), 3500);
  };

  const userRequests = requests.filter((req) => req.userId === currentUserId);

  return (
    <section style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={sectionTitleStyle}>Renovierungsanalyse</h2>
      <p style={{ color: "rgba(226, 232, 240, 0.85)", maxWidth: "780px" }}>
        Dokumentiere Räume mit Fotos und Notizen. Wir schätzen daraus ein realistisches Budget pro Bereich
        sowie Gesamtkosten. Die Daten bleiben lokal gespeichert, bis du sie exportierst.
      </p>

      <div style={analysisCoachGridStyle}>
        <div style={analysisCoachCardStyle}>
          <h3 style={sectionSubtitleStyle}>Objektdetails</h3>
          <div className="input-stack">
            <label style={labelStyle}>Name / Referenz</label>
            <input
              type="text"
              value={meta.objectName}
              onChange={(e) => handleMetaChange("objectName", e.target.value)}
              placeholder="z.B. Projekt Ottakring"
              style={inputStyle}
            />
          </div>
          <div style={analysisFormGridStyle}>
            <div className="input-stack">
              <label style={labelStyle}>Wohnfläche (m²)</label>
              <input
                type="number"
                value={meta.totalArea}
                onChange={(e) => handleMetaChange("totalArea", e.target.value)}
                placeholder="z.B. 82"
                style={inputStyle}
                min="0"
              />
            </div>
            <div className="input-stack">
              <label style={labelStyle}>Bundesland</label>
              <select
                value={meta.state}
                onChange={(e) => handleMetaChange("state", e.target.value)}
                style={selectStyle}
              >
                {Object.entries(REGION_DATA).map(([value, info]) => (
                  <option key={value} value={value}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-stack">
              <label style={labelStyle}>Bezirk</label>
              <select
                value={meta.district}
                onChange={(e) => handleMetaChange("district", e.target.value)}
                style={selectStyle}
              >
                {districtOptions.map((district) => (
                  <option key={district.value} value={district.value}>
                    {district.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="input-stack">
            <label style={labelStyle}>Notizen (optional)</label>
            <textarea
              value={meta.notes}
              onChange={(e) => handleMetaChange("notes", e.target.value)}
              placeholder="z.B. Feuchte Kellerwand, Budgetgrenze 30k"
              style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }}
            />
          </div>

          <div style={areaDraftCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={areaDraftTitleStyle}>Bereich erfassen</h4>
              <span style={areaDraftHintStyle}>Füge jeden Raum mit Fotos hinzu.</span>
            </div>
            <div style={analysisFormGridStyle}>
              <div className="input-stack">
                <label style={labelStyle}>Bereich</label>
                <select
                  value={areaDraft.type}
                  onChange={(e) => handleDraftChange("type", e.target.value)}
                  style={selectStyle}
                >
                  {RENOVATION_AREA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-stack">
                <label style={labelStyle}>Beschreibung</label>
                <textarea
                  value={areaDraft.description}
                  onChange={(e) => handleDraftChange("description", e.target.value)}
                  placeholder="z.B. alte Fliesen, neue Geräte geplant"
                  style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                />
              </div>
            </div>
              <div>
                <label style={uploadButtonStyle}>
                  Fotos hochladen
                  <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleDraftPhotos} />
                </label>
                <div style={areaPhotoPreviewStyle}>
                  {areaDraft.photos.length === 0 ? (
                    <div style={areaPhotoEmptyStyle}>
                      <span style={{ fontSize: "1.1rem" }}>📷</span>
                      <span>Keine Fotos – füge Bilder hinzu.</span>
                    </div>
                  ) : (
                    areaDraft.photos.map((photo) => (
                      <div key={photo.id} style={renovationPhotoThumbStyle}>
                        <img src={photo.src} alt={photo.name} style={renovationPhotoImgStyle} />
                        <button
                          type="button"
                          style={photoRemoveButtonStyle}
                          onClick={() => handleRemoveDraftPhoto(photo.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            <button type="button" style={{ ...primaryButtonStyle, width: "100%" }} onClick={handleAddArea}>
              Bereich speichern
            </button>
          </div>

          <div>
            <h4 style={areaDraftTitleStyle}>Dokumentierte Bereiche</h4>
            {areas.length === 0 ? (
              <p style={{ color: "rgba(226, 232, 240, 0.7)", fontSize: "0.85rem" }}>
                Noch keine Bereiche hinzugefügt. Speichere jeden Raum mit Beschreibung und Fotos.
              </p>
            ) : (
              <div style={renovationAreaListStyle}>
                {areas.map((area) => {
                  const preset = RENOVATION_AREA_PRESETS[area.type] || RENOVATION_AREA_PRESETS.other;
                  return (
                    <div key={area.id} style={renovationAreaCardStyle}>
                      <div style={renovationAreaHeaderStyle}>
                        <div>
                          <strong>{preset.label}</strong>
                          <div style={smallLabelStyle}>
                            {area.photos.length} Foto{area.photos.length === 1 ? "" : "s"}
                          </div>
                        </div>
                        <button style={areaRemoveButtonStyle} onClick={() => handleRemoveArea(area.id)}>
                          Entfernen
                        </button>
                      </div>
                      <p style={{ color: "rgba(226,232,240,0.85)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                        {area.description || "Keine Beschreibung"}
                      </p>
                      {area.photos.length > 0 && (
                        <div style={renovationPhotoGridStyle}>
                          {area.photos.map((photo) => (
                            <div key={photo.id} style={renovationPhotoThumbStyle}>
                              <img src={photo.src} alt={photo.name || preset.label} style={renovationPhotoImgStyle} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={analysisResultCardStyle}>
          <div style={analysisResultHeaderStyle}>
            <div>
              <span style={analysisResultLabelStyle}>Analyse anfordern</span>
              <div style={analysisResultHintStyle}>
                Sobald du die Anfrage sendest, landet sie in unserem Backend zur Prüfung.
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={analysisResultLabelStyle}>Bereiche</span>
              <div style={analysisResultValueStyle}>{areas.length}</div>
            </div>
          </div>

          <div style={renovationEmptyStateStyle}>
            <span style={renovationEmptyIconStyle}>🧰</span>
            <strong>Bereichsliste kontrollieren</strong>
            <span>Füge links mindestens einen Bereich mit Fotos hinzu und sende dann deine Analyse.</span>
          </div>

          <button
            type="button"
            style={{
              ...primaryButtonStyle,
              alignSelf: "flex-start",
              padding: "0.4rem 1.2rem",
              flex: "0 0 auto",
            }}
            onClick={handleEstimate}
          >
            Analyse anfordern
          </button>
          {error && <div style={errorTextStyle}>{error}</div>}
          {submitMessage && <div style={infoBadgeStyle}>{submitMessage}</div>}
        </div>
      </div>

      <div style={userRequestListStyle}>
        <h3 style={{ ...sectionTitleStyle, fontSize: "1.05rem" }}>Meine Analyse-Anfragen</h3>
        {userRequests.length === 0 ? (
          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>Noch keine Anfragen</span>
            <span style={summaryValueStyle}>
              Nachdem du eine Analyse anforderst, erscheint sie hier mit Status-Updates.
            </span>
          </div>
        ) : (
          <div style={requestTableWrapperStyle}>
            {userRequests
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((req) => (
                <div key={req.id} style={requestCardStyle}>
                  <div style={requestCardHeaderStyle}>
                    <div>
                      <strong>{req.meta.objectName || "Unbenanntes Objekt"}</strong>
                      <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.7)" }}>
                        {new Date(req.createdAt).toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    </div>
                    <span
                      style={{
                        ...statusPillStyle,
                        backgroundColor: requestStatusColor(req.status),
                      }}
                    >
                      {req.status === "reviewed" ? "Ausgewertet" : "In Prüfung"}
                    </span>
                  </div>
                  {req.status === "reviewed" && req.totalMin !== null && req.totalMax !== null ? (
                    <div style={{ marginTop: "0.5rem" }}>
                      <div style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.7)", marginBottom: "0.35rem" }}>
                        Ergebnis
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {formatEuro(req.totalMin)} – {formatEuro(req.totalMax)}
                      </div>
                      {req.adminNote && (
                        <div style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.85)", marginTop: "0.35rem" }}>
                          {req.adminNote}
                        </div>
                      )}
                      <div style={renovationBreakdownStyle}>
                        {req.areas.map((area) => (
                          <div key={area.id} style={renovationBreakdownRowStyle}>
                            <div>
                              <div style={{ fontSize: "0.85rem", color: "#f8fafc" }}>
                                {RENOVATION_AREA_PRESETS[area.type]?.label || "Bereich"}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.6)" }}>
                                {area.description || "Keine Beschreibung"}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              {area.estimateMin !== null && area.estimateMax !== null ? (
                                <div style={{ fontWeight: 600 }}>
                                  {formatEuro(area.estimateMin)} – {formatEuro(area.estimateMax)}
                                </div>
                              ) : (
                                <div style={{ color: "rgba(226,232,240,0.7)", fontSize: "0.8rem" }}>—</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.85rem", color: "rgba(226,232,240,0.75)", marginTop: "0.35rem" }}>
                      Wir prüfen deine Bilder und melden uns mit einer Schätzung.
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        <h3 style={{ ...sectionTitleStyle, fontSize: "1rem" }}>Foto-Galerie aus deinen Deals</h3>
        {!hasPhotos ? (
          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>Noch keine Fotos</span>
            <span style={summaryValueStyle}>
              Füge Bilder in der Immobilien-Erfassung hinzu, um hier eine Galerie zu sehen.
            </span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {properties.map((prop) =>
              !prop.photos || prop.photos.length === 0 ? null : (
                <div key={prop.id} style={typeSplitCardStyle}>
                  <strong style={{ color: "#f8fafc" }}>{prop.title}</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "0.35rem" }}>
                    {prop.photos.map((photo, idx) => {
                      const metaPhoto = toPhotoObject(photo);
                      if (!metaPhoto.src) return null;
                      return (
                        <div key={`${prop.id}-gallery-${idx}`} style={detailImageWrapperStyle}>
                          <img src={metaPhoto.src} alt={`${prop.title} Foto ${idx + 1}`} style={detailImageStyle} />
                          {(metaPhoto.category || metaPhoto.note) && (
                            <div style={photoTagStyle}>
                              <strong>{metaPhoto.category || "Foto"}</strong>
                              {metaPhoto.note && <span style={{ display: "block", fontWeight: 400 }}>{metaPhoto.note}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function createAdminDraft(request) {
  if (!request) return null;
  return {
    status: request.status || "pending",
    adminNote: request.adminNote || "",
    totalMin:
      request.totalMin !== null && request.totalMin !== undefined
        ? request.totalMin.toString()
        : "",
    totalMax:
      request.totalMax !== null && request.totalMax !== undefined
        ? request.totalMax.toString()
        : "",
    areas: (request.areas || []).map((area, index) => ({
      id: area.id || `${request.id}-area-${index}`,
      type: area.type || "other",
      description: area.description || "",
      photos: Array.isArray(area.photos) ? area.photos : [],
      estimateMin:
        area.estimateMin !== null && area.estimateMin !== undefined
          ? area.estimateMin.toString()
          : "",
      estimateMax:
        area.estimateMax !== null && area.estimateMax !== undefined
          ? area.estimateMax.toString()
          : "",
    })),
  };
}

const parseAmount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized =
    typeof value === "string" ? value.replace(",", ".").trim() : value;
  const num = Number(normalized);
  return Number.isFinite(num) ? Math.round(num) : null;
};

const getDistrictLabel = (stateKey, districtValue) => {
  if (!stateKey || !districtValue) return "—";
  const state = REGION_DATA[stateKey];
  if (!state) return "—";
  const district = state.districts.find((d) => d.value === districtValue);
  return district ? district.label : "—";
};

function AdminPanel({ requests = [], onUpdateRequest }) {
  const sortedRequests = useMemo(
    () =>
      requests
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [requests]
  );
  const [selectedId, setSelectedId] = useState(() => sortedRequests[0]?.id || null);
  const [draft, setDraft] = useState(() => createAdminDraft(sortedRequests[0] || null));
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (sortedRequests.length === 0) {
      setSelectedId(null);
      setDraft(null);
      return;
    }
    if (!selectedId || !sortedRequests.some((req) => req.id === selectedId)) {
      const fallbackId = sortedRequests[0].id;
      setSelectedId(fallbackId);
      setDraft(createAdminDraft(sortedRequests[0]));
    }
  }, [sortedRequests, selectedId]);

  useEffect(() => {
    const current = sortedRequests.find((req) => req.id === selectedId) || null;
    setDraft(createAdminDraft(current));
  }, [selectedId, sortedRequests]);

  const handleAreaEstimateChange = (areaId, field, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        areas: prev.areas.map((area) =>
          area.id === areaId ? { ...area, [field]: value } : area
        ),
      };
    });
  };

  const handleDraftChange = (field, value) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleAutoTotals = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      let minSum = 0;
      let maxSum = 0;
      let hasMin = false;
      let hasMax = false;

      prev.areas.forEach((area) => {
        const minVal = parseAmount(area.estimateMin);
        if (minVal !== null) {
          minSum += minVal;
          hasMin = true;
        }
        const maxVal = parseAmount(area.estimateMax);
        if (maxVal !== null) {
          maxSum += maxVal;
          hasMax = true;
        }
      });

      return {
        ...prev,
        totalMin: hasMin ? minSum.toString() : prev.totalMin,
        totalMax: hasMax ? maxSum.toString() : prev.totalMax,
      };
    });
  };

  const persistDraft = (nextDraft) => {
    if (!nextDraft || !selectedId || typeof onUpdateRequest !== "function") return;
    const sanitizedAreas = (nextDraft.areas || []).map((area) => ({
      ...area,
      estimateMin: parseAmount(area.estimateMin),
      estimateMax: parseAmount(area.estimateMax),
    }));
    onUpdateRequest(selectedId, {
      status: nextDraft.status,
      adminNote: (nextDraft.adminNote || "").trim(),
      totalMin: parseAmount(nextDraft.totalMin),
      totalMax: parseAmount(nextDraft.totalMax),
      areas: sanitizedAreas,
    });
    setFeedback("Änderungen gespeichert.");
    setTimeout(() => setFeedback(""), 2400);
  };

  const handleSave = () => {
    if (draft) {
      persistDraft(draft);
    }
  };

  const handleMarkReviewed = () => {
    if (!draft) return;
    const nextDraft = { ...draft, status: "reviewed" };
    setDraft(nextDraft);
    persistDraft(nextDraft);
  };

  const selectedRequest = sortedRequests.find((req) => req.id === selectedId) || null;
  const currentState = selectedRequest ? REGION_DATA[selectedRequest.meta?.state] : null;
  const requestDistrictLabel = selectedRequest
    ? getDistrictLabel(selectedRequest.meta?.state, selectedRequest.meta?.district)
    : "—";

  return (
    <section style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2 style={sectionTitleStyle}>Admin · Renovierungsanfragen</h2>
      <p style={{ color: "rgba(226,232,240,0.8)", maxWidth: "820px" }}>
        Prüfe eingereichte Bereiche, ergänze Kostenschätzungen und gib den Status frei. Änderungen werden
        im Browser gespeichert und stehen nur Administrations-Accounts zur Verfügung.
      </p>

      {sortedRequests.length === 0 ? (
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Noch keine Anfragen</span>
          <span style={summaryValueStyle}>
            Sobald Nutzer Fotos hochladen, erscheinen sie hier zur Auswertung.
          </span>
        </div>
      ) : (
        <div style={adminPanelGridStyle}>
          <div style={adminListStyle}>
            {sortedRequests.map((req) => {
              const isActive = req.id === selectedId;
              const statusLabel = REQUEST_STATUS_LABELS[req.status] || req.status || "Offen";
              return (
                <button
                  type="button"
                  key={req.id}
                  onClick={() => setSelectedId(req.id)}
                  style={{
                    ...adminListItemStyle,
                    ...(isActive ? adminListItemActiveStyle : {}),
                  }}
                >
                  <div style={adminListItemHeaderStyle}>
                    <div>
                      <strong>{req.meta?.objectName || "Unbenanntes Objekt"}</strong>
                      <div style={smallLabelStyle}>
                        {new Date(req.createdAt).toLocaleString("de-AT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <span
                      style={{
                        ...statusPillStyle,
                        backgroundColor: requestStatusColor(req.status),
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div style={adminListMetaStyle}>
                    <span>{REGION_DATA[req.meta?.state]?.label || "—"}</span>
                    <span>·</span>
                    <span>{getDistrictLabel(req.meta?.state, req.meta?.district)}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.7)" }}>
                    {req.areas?.length || 0} Bereich{(req.areas?.length || 0) === 1 ? "" : "e"}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={adminDetailsStyle}>
            {!selectedRequest || !draft ? (
              <div style={{ color: "rgba(226,232,240,0.7)" }}>
                Wähle links eine Anfrage, um Details zu sehen.
              </div>
            ) : (
              <>
                <div style={adminMetaGridStyle}>
                  <div style={adminMetaCardStyle}>
                    <div style={summaryLabelStyle}>Objekt</div>
                    <div style={summaryValueStyle}>
                      {selectedRequest.meta?.objectName || "Unbenannt"}
                    </div>
                  </div>
                  <div style={adminMetaCardStyle}>
                    <div style={summaryLabelStyle}>Nutzer</div>
                    <div style={summaryValueStyle}>{selectedRequest.userId || "—"}</div>
                  </div>
                  <div style={adminMetaCardStyle}>
                    <div style={summaryLabelStyle}>Ort</div>
                    <div style={summaryValueStyle}>
                      {currentState?.label || "—"}
                      {requestDistrictLabel !== "—" ? ` · ${requestDistrictLabel}` : ""}
                    </div>
                  </div>
                  <div style={adminMetaCardStyle}>
                    <div style={summaryLabelStyle}>Wohnfläche</div>
                    <div style={summaryValueStyle}>
                      {selectedRequest.meta?.totalArea
                        ? `${selectedRequest.meta.totalArea} m²`
                        : "—"}
                    </div>
                  </div>
                </div>

                {selectedRequest.meta?.notes && (
                  <div style={adminNoteIntroStyle}>
                    <strong>Notizen</strong>
                    <p style={{ margin: 0, color: "rgba(226,232,240,0.75)", fontSize: "0.85rem" }}>
                      {selectedRequest.meta.notes}
                    </p>
                  </div>
                )}

                <div style={adminTotalsGridStyle}>
                  <div>
                    <label style={labelStyle}>Gesamt (min)</label>
                    <input
                      type="number"
                      value={draft.totalMin}
                      onChange={(e) => handleDraftChange("totalMin", e.target.value)}
                      placeholder="z.B. 12000"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Gesamt (max)</label>
                    <input
                      type="number"
                      value={draft.totalMax}
                      onChange={(e) => handleDraftChange("totalMax", e.target.value)}
                      placeholder="z.B. 18000"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select
                      value={draft.status}
                      onChange={(e) => handleDraftChange("status", e.target.value)}
                      style={selectStyle}
                    >
                      <option value="pending">{REQUEST_STATUS_LABELS.pending}</option>
                      <option value="in_progress">{REQUEST_STATUS_LABELS.in_progress}</option>
                      <option value="reviewed">{REQUEST_STATUS_LABELS.reviewed}</option>
                    </select>
                  </div>
                </div>

                <div className="input-stack">
                  <label style={labelStyle}>Admin-Notiz</label>
                  <textarea
                    value={draft.adminNote}
                    onChange={(e) => handleDraftChange("adminNote", e.target.value)}
                    placeholder="z.B. Angebot anfordern oder genaue Maße prüfen"
                    style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                  />
                </div>

                <div style={adminActionsStyle}>
                  <button type="button" style={secondaryButtonStyle} onClick={handleAutoTotals}>
                    Gesamt aus Bereichen berechnen
                  </button>
                  <button type="button" style={secondaryButtonStyle} onClick={handleSave}>
                    Änderungen speichern
                  </button>
                  <button type="button" style={primaryButtonStyle} onClick={handleMarkReviewed}>
                    Speichern & freigeben
                  </button>
                </div>
                {feedback && <div style={{ color: "#22c55e", fontSize: "0.85rem" }}>{feedback}</div>}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <h3 style={{ ...sectionTitleStyle, fontSize: "1rem" }}>Bereiche</h3>
                  {draft.areas.length === 0 ? (
                    <p style={{ color: "rgba(226,232,240,0.75)", fontSize: "0.85rem" }}>
                      Keine Bereiche vorhanden.
                    </p>
                  ) : (
                    draft.areas.map((area) => {
                      const preset = RENOVATION_AREA_PRESETS[area.type] || RENOVATION_AREA_PRESETS.other;
                      return (
                        <div key={area.id} style={adminAreaCardStyle}>
                          <div style={renovationAreaHeaderStyle}>
                            <div>
                              <strong>{preset.label}</strong>
                              <div style={smallLabelStyle}>
                                {area.description || "Keine Beschreibung"}
                              </div>
                            </div>
                            <span style={{ ...smallLabelStyle, fontSize: "0.75rem" }}>
                              {area.photos?.length || 0} Foto{(area.photos?.length || 0) === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div style={adminAreaInputsStyle}>
                            <div>
                              <label style={smallLabelStyle}>Min (€)</label>
                              <input
                                type="number"
                                value={area.estimateMin}
                                onChange={(e) =>
                                  handleAreaEstimateChange(area.id, "estimateMin", e.target.value)
                                }
                                placeholder="z.B. 6500"
                                style={inputStyle}
                              />
                            </div>
                            <div>
                              <label style={smallLabelStyle}>Max (€)</label>
                              <input
                                type="number"
                                value={area.estimateMax}
                                onChange={(e) =>
                                  handleAreaEstimateChange(area.id, "estimateMax", e.target.value)
                                }
                                placeholder="z.B. 9800"
                                style={inputStyle}
                              />
                            </div>
                          </div>
                          {area.photos && area.photos.length > 0 && (
                            <div style={adminPhotosGridStyle}>
                              {area.photos.map((photo, idx) => {
                                const metaPhoto = toPhotoObject(photo);
                                if (!metaPhoto.src) return null;
                                return (
                                  <div key={`${area.id}-photo-${idx}`} style={adminPhotoThumbStyle}>
                                    <img src={metaPhoto.src} alt={preset.label} style={adminPhotoImgStyle} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ValuationCharts({ properties }) {
  if (!properties || properties.length === 0) {
    return null;
  }

  const totalPositive = properties
    .filter((p) => p.monthlyCashflow >= 0)
    .reduce((sum, p) => sum + p.monthlyCashflow, 0);
  const totalNegative = Math.abs(
    properties
      .filter((p) => p.monthlyCashflow < 0)
      .reduce((sum, p) => sum + p.monthlyCashflow, 0)
  );
  const totalAbs = totalPositive + totalNegative || 1;
  const condensed = properties
    .map((p) => ({
      title: p.title,
      value: Math.abs(p.monthlyCashflow),
      positive: p.monthlyCashflow >= 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div style={valuationChartsWrapperStyle}>
      <div style={donutCardStyle}>
        <h3 style={donutTitleStyle}>Cashflow-Verteilung</h3>
        <div style={{ width: "160px", height: "160px", position: "relative" }}>
          <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx="18"
              cy="18"
              r="16"
              stroke="#22c55e"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${(totalPositive / totalAbs) * 100} ${
                100 - (totalPositive / totalAbs) * 100
              }`}
              strokeDashoffset="0"
            />
            <circle
              cx="18"
              cy="18"
              r="16"
              stroke="#f97373"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${(totalNegative / totalAbs) * 100} ${
                100 - (totalNegative / totalAbs) * 100
              }`}
              strokeDashoffset={`${(totalPositive / totalAbs) * 100}`}
            />
          </svg>
          <div style={donutCenterStyle}>
            <span
              style={{
                color: totalPositive >= totalNegative ? "#22c55e" : "#f97373",
                fontSize: "1.2rem",
                fontWeight: 700,
              }}
            >
              {totalPositive >= totalNegative
                ? `+${totalPositive.toFixed(0)} €`
                : `-${totalNegative.toFixed(0)} €`}
            </span>
          </div>
        </div>
        <div style={donutLegendStyle}>
          <span style={{ color: "#22c55e" }}>Positiver Cashflow</span>
          <span style={{ color: "#f97373" }}>Negativer Cashflow</span>
        </div>
      </div>
      <div style={barCardStyle}>
        <h3 style={donutTitleStyle}>Top Cashflow</h3>
        {condensed.map((entry) => (
          <div key={entry.title} style={barRowStyle}>
            <span style={{ flex: "0 0 130px", color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis" }}>
              {entry.title}
            </span>
            <div style={barTrackStyle}>
              <div
                style={{
                  ...barFillStyle,
                  width: `${(entry.value / (condensed[0]?.value || 1)) * 100}%`,
                  background: entry.positive
                    ? "linear-gradient(90deg,#22c55e,#16a34a)"
                    : "linear-gradient(90deg,#f97373,#b91c1c)",
                }}
              />
            </div>
            <span
              style={{
                width: "110px",
                textAlign: "right",
                color: entry.positive ? "#22c55e" : "#f97373",
              }}
            >
              {(entry.positive ? entry.value : -entry.value).toFixed(2)} €
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegistrationScreen({ onRegister, onSwitchToLogin }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    password: "",
    consent: false,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!form.email.trim() || !form.password.trim()) {
      setError("Bitte gib mindestens E-Mail und Passwort ein.");
      return;
    }
    if (form.password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (!form.consent) {
      setError("Bitte bestätige die Nutzungsbedingungen und Datenschutz.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const result = await onRegister({
        firstName: form.firstName,
        lastName: form.lastName,
        company: form.company,
        email: form.email,
        password: form.password,
      });
      if (!result.ok) {
        setError(result.error || "Registrierung fehlgeschlagen.");
        return;
      }
      setError("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={pageStyle} className="app-page">
      <div style={registerCardStyle}>
        <div>
          <h1 style={{ ...titleStyle, fontSize: "2rem" }}>AIM RealEstate Analytics</h1>
          <p style={{ color: "rgba(226,232,240,0.8)", marginBottom: "1.5rem" }}>
            Registriere dich, um deine Immobilienanalysen zu speichern und personalisierte Auswertungen zu
            erhalten.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={registerFormStyle}>
          <div className="input-stack">
            <label style={labelStyle} htmlFor="reg-first">
              Vorname
            </label>
            <input
              id="reg-first"
              className="aim-input"
              type="text"
              value={form.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              placeholder="z.B. Anna"
            />
          </div>
          <div className="input-stack">
            <label style={labelStyle} htmlFor="reg-last">
              Nachname
            </label>
            <input
              id="reg-last"
              className="aim-input"
              type="text"
              value={form.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              placeholder="z.B. Mustermann"
            />
          </div>
          <div className="input-stack">
            <label style={labelStyle} htmlFor="reg-company">
              Unternehmen (optional)
            </label>
            <input
              id="reg-company"
              className="aim-input"
              type="text"
              value={form.company}
              onChange={(e) => handleChange("company", e.target.value)}
              placeholder="z.B. AM Investment GmbH"
            />
          </div>
          <div className="input-stack">
            <label style={labelStyle} htmlFor="reg-email">
              E-Mail-Adresse
            </label>
            <input
              id="reg-email"
              className="aim-input"
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="du@example.com"
              required
            />
          </div>
          <div className="input-stack">
            <label style={labelStyle} htmlFor="reg-password">
              Passwort
            </label>
            <input
              id="reg-password"
              className="aim-input"
              type="password"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              placeholder="mind. 6 Zeichen"
              required
            />
          </div>
          <label style={consentLabelStyle}>
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => handleChange("consent", e.target.checked)}
            />{" "}
            Ich stimme den Nutzungsbedingungen und der Datenschutzerklärung zu.
          </label>
          {error && <div style={errorBadgeStyle}>{error}</div>}
          <button
            type="submit"
            style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.7 : 1 }}
            disabled={isSubmitting}
          >
            Registrieren und loslegen
          </button>
        </form>
        <div style={authSwitchStyle}>
          <span>
            Schon registriert?{" "}
            <button type="button" style={linkButtonStyle} onClick={onSwitchToLogin}>
              Anmelden
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function VerificationScreen({ draft, code, onVerify, onResend, onCancel }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!input.trim()) {
      setError("Bitte gib den Bestätigungscode ein.");
      return;
    }
    const ok = onVerify(input.trim());
    if (!ok) {
      setError("Code ist nicht korrekt.");
      return;
    }
    setError("");
  };

  return (
    <div style={pageStyle} className="app-page">
      <div style={registerCardStyle}>
        <div>
          <h1 style={{ ...titleStyle, fontSize: "2rem" }}>E-Mail bestätigen</h1>
          <p style={{ color: "rgba(226,232,240,0.8)", marginBottom: "1.2rem" }}>
            Wir haben einen Bestätigungscode an <strong>{draft.email}</strong> gesendet. (Demo:
            unten siehst du den simulierten Code.)
          </p>
          <div style={mockMailStyle}>
            <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Simulierte E-Mail</div>
            <div style={{ fontSize: "0.9rem" }}>
              Hallo {draft.firstName || draft.email || "AIM Nutzer"},
            </div>
            <div style={{ fontSize: "0.9rem" }}>
              dein Verifizierungscode lautet <strong>{code}</strong>.
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={registerFormStyle}>
          <div className="input-stack">
            <label style={labelStyle} htmlFor="verification-code">
              Bestätigungscode
            </label>
            <input
              id="verification-code"
              className="aim-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Code eingeben"
            />
          </div>
          {error && <div style={errorBadgeStyle}>{error}</div>}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button type="submit" style={primaryButtonStyle}>
              Verifizieren
            </button>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => {
                setInput("");
                setError("");
                onResend();
              }}
            >
              Code erneut senden
            </button>
            <button type="button" style={ghostButtonStyle} onClick={onCancel}>
              Zur Registrierung
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, onSwitchToRegister, onForgotPassword }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const result = await onLogin(form);
      if (!result.ok) {
        setError(result.error || "Anmeldung fehlgeschlagen.");
        return;
      }
      setError("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={pageStyle} className="app-page">
      <div style={registerCardStyle}>
        <div>
          <h1 style={{ ...titleStyle, fontSize: "2rem" }}>Willkommen zurück</h1>
          <p style={{ color: "rgba(226,232,240,0.8)", marginBottom: "1.5rem" }}>
            Melde dich mit deiner E-Mail an, um deine Analysen zu sehen.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={registerFormStyle}>
          <div className="input-stack">
            <label style={labelStyle} htmlFor="login-email">
              E-Mail-Adresse
            </label>
            <input
              id="login-email"
              className="aim-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="du@example.com"
              required
            />
          </div>
          <div className="input-stack">
            <label style={labelStyle} htmlFor="login-password">
              Passwort
            </label>
            <input
              id="login-password"
              className="aim-input"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="••••••"
              required
            />
          </div>
          {error && <div style={errorBadgeStyle}>{error}</div>}
          <button
            type="submit"
            style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.7 : 1 }}
            disabled={isSubmitting}
          >
            Anmelden
          </button>
        </form>
        <div style={authSwitchStyle}>
          <button type="button" style={linkButtonStyle} onClick={onForgotPassword}>
            Passwort vergessen?
          </button>
          <span>
            Kein Konto?{" "}
            <button type="button" style={linkButtonStyle} onClick={onSwitchToRegister}>
              Registrieren
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function PasswordResetRequest({ onRequest, onBack }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await onRequest(email);
      if (!result.ok) {
        setError(result.error || "Fehler beim Zurücksetzen.");
        return;
      }
      setError("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={pageStyle} className="app-page">
      <div style={registerCardStyle}>
        <div>
          <h1 style={{ ...titleStyle, fontSize: "2rem" }}>Passwort zurücksetzen</h1>
          <p style={{ color: "rgba(226,232,240,0.8)", marginBottom: "1.5rem" }}>
            Gib deine E-Mail ein. Wir senden dir einen Code zum Zurücksetzen (Simulation).
          </p>
        </div>
        <form onSubmit={handleSubmit} style={registerFormStyle}>
          <div className="input-stack">
            <label style={labelStyle} htmlFor="reset-email">
              E-Mail-Adresse
            </label>
            <input
              id="reset-email"
              className="aim-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@example.com"
              required
            />
          </div>
          {error && <div style={errorBadgeStyle}>{error}</div>}
          <button
            type="submit"
            style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.7 : 1 }}
            disabled={isSubmitting}
          >
            Code anfordern
          </button>
        </form>
        <button type="button" style={linkButtonStyle} onClick={onBack}>
          Zurück zur Anmeldung
        </button>
      </div>
    </div>
  );
}

function PasswordResetVerify({ draft, code, onSubmit, onCancel }) {
  const [inputCode, setInputCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await onSubmit({ code: inputCode.trim(), password });
      if (!result.ok) {
        setError(result.error || "Zurücksetzen fehlgeschlagen.");
        return;
      }
      setError("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={pageStyle} className="app-page">
      <div style={registerCardStyle}>
        <div>
          <h1 style={{ ...titleStyle, fontSize: "2rem" }}>Code eingeben</h1>
          <p style={{ color: "rgba(226,232,240,0.8)", marginBottom: "1.2rem" }}>
            Wir haben einen Code an <strong>{draft.email}</strong> gesendet. (Demo-Code:{" "}
            <strong>{code}</strong>)
          </p>
        </div>
        <form onSubmit={handleSubmit} style={registerFormStyle}>
          <div className="input-stack">
            <label style={labelStyle}>Bestätigungscode</label>
            <input
              className="aim-input"
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Code"
            />
          </div>
          <div className="input-stack">
            <label style={labelStyle}>Neues Passwort</label>
            <input
              className="aim-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mind. 6 Zeichen"
            />
          </div>
          {error && <div style={errorBadgeStyle}>{error}</div>}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="submit"
              style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.7 : 1 }}
              disabled={isSubmitting}
            >
              Passwort speichern
            </button>
            <button type="button" style={ghostButtonStyle} onClick={onCancel}>
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoTab({ onStart, userName }) {
  const greetingName =
    typeof userName === "string" && userName.trim().length > 0 ? userName.trim() : null;
  const heroTitle = greetingName
    ? `Willkommen, ${greetingName}`
    : "Willkommen bei AIM RealEstate Analytics";

  return (
    <section style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={infoHeroStyle}>
        <div>
      <h2 style={{ ...sectionTitleStyle, fontSize: "1.3rem" }}>{heroTitle}</h2>
          <p style={infoHeroTextStyle}>
            AIM RealEstate Analytics ist dein persönlicher Deal-Copilot. Erfasse Wohnungen, Häuser oder
            Garagen, optimiere Cashflow und Rendite und exportiere Portfolios als JSON.
          </p>
        </div>
        <div style={infoHeroBadgeStyle}>Beta · v0.5</div>
      </div>

      <div style={infoGridStyle}>
        <InfoCard
          title="1 · Deal anlegen"
          body="Trage Eckdaten wie Kaufpreis, Eigenkapital oder Miete ein. Optional kannst du mehrere Fotos hinzufügen, um dein Objekt visuell festzuhalten."
        />
        <InfoCard
          title="2 · Kennzahlen prüfen"
          body="Mit einem Klick auf „Berechnen“ erhältst du Cashflow, Renditen und Nebenkosten. Die neue Bewertungsansicht zeigt Szenarien (Worst/Real/Best)."
        />
        <InfoCard
          title="3 · Analysieren & Exportieren"
          body="Vergleiche dein Portfolio im Dashboard, nutze den Analyse-Tab für Fotos und exportiere alles als JSON-Datei."
        />
      </div>

      <div style={infoChecklistStyle}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#f8fafc" }}>Was du wissen solltest</h3>
        <ul style={infoChecklistListStyle}>
          <li>🧮 Renditen basieren auf deinen Annahmen. Passe sie jederzeit an.</li>
          <li>📤 Exportfunktion findest du im Tab „Export“.</li>
          <li>🔐 Deine Daten verlassen den Browser nur, wenn du sie exportierst.</li>
        </ul>
        <button
          type="button"
          style={{
            ...primaryButtonStyle,
            alignSelf: "flex-start",
            flex: "0 0 auto",
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            minWidth: "auto",
          }}
          onClick={() => {
            if (typeof onStart === "function") {
              onStart();
            }
            setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
          }}
        >
          Lege deine erste Immobilie an
        </button>
      </div>
    </section>
  );
}

function InfoCard({ title, body }) {
  return (
    <div style={infoCardStyle}>
      <h4 style={infoCardTitleStyle}>{title}</h4>
      <p style={infoCardTextStyle}>{body}</p>
    </div>
  );
}

const photoCategories = [
  "Wohnzimmer",
  "Schlafzimmer",
  "Küche",
  "Bad",
  "Balkon / Terrasse",
  "Außenbereich",
  "Garage",
  "Technik",
  "Sonstiges",
];

const euroFormatter = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("de-AT", {
  maximumFractionDigits: 1,
});

const formatEuro = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return euroFormatter.format(num);
};

const formatPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(1)} %`;
};

const getYearFactor = (yearInput) => {
  const year = Number(yearInput);
  if (!Number.isFinite(year) || year <= 0) {
    return 1;
  }
  const rule = YEAR_FACTOR_RULES.find((entry) => year <= entry.maxYear);
  return rule ? rule.factor : 1;
};

const getVerdictFromDiff = (diffPct) => {
  if (diffPct === null || !Number.isFinite(diffPct)) {
    return { label: "Marktpreis laut Analyse", color: "#38bdf8" };
  }
  if (diffPct <= -5) {
    return { label: "Guter Deal", color: "#22c55e" };
  }
  if (Math.abs(diffPct) <= 5) {
    return { label: "Marktpreis", color: "#facc15" };
  }
  return { label: "Überteuert", color: "#f87171" };
};

const runMarketAnalysis = (inputs = {}) => {
  const state = REGION_DATA[inputs.state];
  if (!state) {
    return { ok: false, error: "Bitte ein Bundesland auswählen." };
  }
  const livingArea = Number(inputs.livingArea);
  if (!Number.isFinite(livingArea) || livingArea <= 0) {
    return { ok: false, error: "Bitte eine Wohnfläche in m² angeben." };
  }
  const district =
    state.districts.find((d) => d.value === inputs.district) || null;
  const basePerSqm = district?.price || state.averagePrice;
  const conditionFactor = CONDITION_FACTORS[inputs.condition] || 1;
  const yearFactor = getYearFactor(inputs.yearBuilt);
  const typeFactor = PROPERTY_TYPE_FACTORS[inputs.propertyType] || 1;
  const recommendedPrice =
    basePerSqm * livingArea * conditionFactor * yearFactor * typeFactor;
  const recommendedPerSqm = recommendedPrice / livingArea;
  const userPriceInput = Number(inputs.targetPrice);
  const userPrice = Number.isFinite(userPriceInput) && userPriceInput > 0 ? userPriceInput : null;
  const differenceAbs =
    userPrice !== null ? userPrice - recommendedPrice : null;
  const differencePct =
    differenceAbs !== null ? (differenceAbs / recommendedPrice) * 100 : null;
  const verdict = getVerdictFromDiff(differencePct);

  return {
    ok: true,
    data: {
      stateLabel: state.label,
      districtLabel: district ? district.label : "—",
      basePerSqm,
      livingArea,
      recommendedPerSqm,
      recommendedPrice,
      conditionFactor,
      yearFactor,
      typeFactor,
      userPrice,
      differenceAbs,
      differencePct,
      verdict,
      minPrice: state.minPrice || null,
      maxPrice: state.maxPrice || null,
    },
  };
};

function MarketAnalysisTab() {
  const [form, setForm] = useState({
    state: "wien",
    district: REGION_DATA.wien.districts[0].value,
    address: "",
    propertyType: "wohnung",
    livingArea: "",
    rooms: "3",
    yearBuilt: "",
    condition: "sehr_gut",
    targetPrice: "",
  });
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState("");

  const selectedState = REGION_DATA[form.state];
  const districtOptions = selectedState ? selectedState.districts : [];
  const maxConditionFactor = Math.max(...Object.values(CONDITION_FACTORS));

  const handleChange = (field, value) => {
    setForm((prev) => {
      if (field === "state") {
        const fallbackDistrict =
          REGION_DATA[value]?.districts?.[0]?.value || "";
        return { ...prev, state: value, district: fallbackDistrict };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = () => {
    const outcome = runMarketAnalysis(form);
    if (!outcome.ok) {
      setError(outcome.error || "Analyse fehlgeschlagen.");
      setAnalysisResult(null);
      return;
    }
    setError("");
    setAnalysisResult(outcome.data);
  };

  const sqmReference = analysisResult
    ? Math.max(
        analysisResult.basePerSqm,
        analysisResult.recommendedPerSqm,
        selectedState?.maxPrice || analysisResult.recommendedPerSqm
      )
    : selectedState?.maxPrice || 1;

  return (
    <section style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <h2 style={sectionTitleStyle}>Marktanalyse</h2>
      <p style={{ color: "rgba(226, 232, 240, 0.85)", maxWidth: "820px" }}>
        Gib Lage und Eckdaten erneut ein, um einen empfohlenen Kaufpreis zu erhalten. So erkennst du,
        ob dein Angebot ein guter Deal oder überteuert ist.
      </p>

      <div style={marketAnalysisGridStyle}>
        <div style={marketFormCardStyle}>
          <div className="input-stack">
            <label style={labelStyle}>Bundesland</label>
            <select
              value={form.state}
              onChange={(e) => handleChange("state", e.target.value)}
              style={selectStyle}
            >
              {Object.entries(REGION_DATA).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div className="input-stack">
            <label style={labelStyle}>Bezirk</label>
            <select
              value={form.district}
              onChange={(e) => handleChange("district", e.target.value)}
              style={selectStyle}
            >
              {districtOptions.length === 0 && (
                <option value="">Bitte Bundesland wählen</option>
              )}
              {districtOptions.map((district) => (
                <option key={district.value} value={district.value}>
                  {district.label}
                </option>
              ))}
            </select>
          </div>
          <div className="input-stack">
            <label style={labelStyle}>Adresse (optional)</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="z.B. Musterstraße 10"
              style={inputStyle}
            />
          </div>

          <div style={analysisFormGridStyle}>
            <div className="input-stack">
              <label style={labelStyle}>Objektart</label>
              <select
                value={form.propertyType}
                onChange={(e) => handleChange("propertyType", e.target.value)}
                style={selectStyle}
              >
                <option value="wohnung">Wohnung</option>
                <option value="haus">Haus</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
            </div>
            <div className="input-stack">
              <label style={labelStyle}>Wohnfläche (m²)</label>
              <input
                type="number"
                inputMode="decimal"
                value={form.livingArea}
                onChange={(e) => handleChange("livingArea", e.target.value)}
                placeholder="z.B. 85"
                style={inputStyle}
                min="1"
              />
            </div>
            <div className="input-stack">
              <label style={labelStyle}>Zimmer</label>
              <input
                type="number"
                value={form.rooms}
                onChange={(e) => handleChange("rooms", e.target.value)}
                placeholder="3"
                style={inputStyle}
                min="1"
              />
            </div>
            <div className="input-stack">
              <label style={labelStyle}>Baujahr</label>
              <input
                type="number"
                value={form.yearBuilt}
                onChange={(e) => handleChange("yearBuilt", e.target.value)}
                placeholder="z.B. 1998"
                style={inputStyle}
                min="1900"
              />
            </div>
            <div className="input-stack">
              <label style={labelStyle}>Zustand</label>
              <select
                value={form.condition}
                onChange={(e) => handleChange("condition", e.target.value)}
                style={selectStyle}
              >
                <option value="neubau">Neubau</option>
                <option value="sehr_gut">Sehr gut</option>
                <option value="gut">Gut</option>
                <option value="sanierungsbeduerftig">Sanierungsbedürftig</option>
                <option value="kernsanierung">Kernsanierungsbedürftig</option>
              </select>
            </div>
            <div className="input-stack">
              <label style={labelStyle}>Dein Kaufpreis (optional)</label>
              <input
                type="number"
                inputMode="decimal"
                value={form.targetPrice}
                onChange={(e) => handleChange("targetPrice", e.target.value)}
                placeholder="z.B. 420000"
                style={inputStyle}
                min="0"
              />
            </div>
          </div>

          {error && (
            <div style={{ color: "#f87171", fontSize: "0.85rem", marginTop: "0.35rem" }}>{error}</div>
          )}

          <button
            type="button"
            style={{ ...primaryButtonStyle, width: "100%", marginTop: "0.75rem" }}
            onClick={handleSubmit}
          >
            Marktwert berechnen
          </button>
        </div>

        <div style={marketResultCardStyle}>
          {analysisResult ? (
            <>
              <div style={analysisResultHeaderStyle}>
                <div>
                  <span style={analysisResultLabelStyle}>Perfekter Kaufpreis</span>
                  <div style={analysisResultValueStyle}>{formatEuro(analysisResult.recommendedPrice)}</div>
                  <div style={analysisResultHintStyle}>
                    {analysisResult.stateLabel} · {analysisResult.districtLabel}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={analysisResultLabelStyle}>Bewertung</span>
                  <div style={{ ...analysisVerdictStyle, color: analysisResult.verdict.color }}>
                    {analysisResult.verdict.label}
                  </div>
                </div>
              </div>

              <div style={marketResultGridStyle}>
                <div>
                  <div style={summaryLabelStyle}>m²-Preis (Basis)</div>
                  <div style={summaryValueStyle}>{formatEuro(analysisResult.basePerSqm)}</div>
                  <div style={{ ...progressTrackStyle, marginTop: "0.35rem" }}>
                    <div
                      style={{
                        ...progressBarStyle,
                        width: `${Math.min(100, (analysisResult.basePerSqm / sqmReference) * 100)}%`,
                        background: "linear-gradient(90deg,#94a3b8,#cbd5f5)",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div style={summaryLabelStyle}>m²-Preis (angepasst)</div>
                  <div style={summaryValueStyle}>{formatEuro(analysisResult.recommendedPerSqm)}</div>
                  <div style={{ ...progressTrackStyle, marginTop: "0.35rem" }}>
                    <div
                      style={{
                        ...progressBarStyle,
                        width: `${Math.min(100, (analysisResult.recommendedPerSqm / sqmReference) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={marketResultGridStyle}>
                <div>
                  <div style={summaryLabelStyle}>Zustandsfaktor</div>
                  <div style={summaryValueStyle}>
                    {numberFormatter.format(analysisResult.conditionFactor)}×
                  </div>
                  <div style={{ ...progressTrackStyle, marginTop: "0.35rem" }}>
                    <div
                      style={{
                        ...progressBarStyle,
                        width: `${Math.min(100, (analysisResult.conditionFactor / maxConditionFactor) * 100)}%`,
                        background: "linear-gradient(90deg,#34d399,#059669)",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div style={summaryLabelStyle}>Baujahr-Faktor</div>
                  <div style={summaryValueStyle}>
                    {numberFormatter.format(analysisResult.yearFactor)}×
                  </div>
                  <div style={{ ...progressTrackStyle, marginTop: "0.35rem" }}>
                    <div
                      style={{
                        ...progressBarStyle,
                        width: `${Math.min(100, (analysisResult.yearFactor / 1.1) * 100)}%`,
                        background: "linear-gradient(90deg,#60a5fa,#2563eb)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {analysisResult.userPrice ? (
                <div style={analysisComparisonCardStyle}>
                  <div>
                    <div style={summaryLabelStyle}>Dein Kaufpreis</div>
                    <div style={{ ...summaryValueStyle, fontSize: "1.1rem" }}>
                      {formatEuro(analysisResult.userPrice)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={summaryLabelStyle}>Differenz</div>
                    <div
                      style={{
                        ...summaryValueStyle,
                        fontSize: "1.1rem",
                        color: analysisResult.differenceAbs <= 0 ? "#22c55e" : "#f87171",
                      }}
                    >
                      {formatEuro(analysisResult.differenceAbs)}
                    </div>
                    <div style={{ color: "rgba(226,232,240,0.75)", fontSize: "0.8rem" }}>
                      {formatPercent(analysisResult.differencePct)}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "rgba(226, 232, 240, 0.7)", fontSize: "0.85rem" }}>
                  Trage deinen Angebotspreis ein, um die Differenz zum Analysepreis zu sehen.
                </div>
              )}

              {selectedState?.minPrice && selectedState?.maxPrice && (
                <div style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "rgba(226,232,240,0.7)" }}>
                  Preisspanne im Bundesland: {formatEuro(selectedState.minPrice)} –{" "}
                  {formatEuro(selectedState.maxPrice)} pro m²
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "rgba(226, 232, 240, 0.7)", fontSize: "0.9rem" }}>
              Wähle Bundesland, Bezirk und gib die Eckdaten deiner Immobilie ein. Du erhältst den idealen
              Kaufpreis plus Bewertung.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PhotoField({ value, onChange, entries = [], onEntriesChange }) {
  const photoItems = Array.isArray(entries) ? entries : [];
  const urls = value
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter(Boolean);

  const updateEntry = (id, field, newValue) => {
    if (!onEntriesChange) return;
    onEntriesChange(
      photoItems.map((entry) => (entry.id === id ? { ...entry, [field]: newValue } : entry))
    );
  };

  const removeEntry = (id) => {
    if (!onEntriesChange) return;
    onEntriesChange(photoItems.filter((entry) => entry.id !== id));
  };

  const handleFiles = (event) => {
    if (!onEntriesChange) return;
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const nextEntries = [...photoItems];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const src = loadEvent.target?.result?.toString();
        if (!src) return;
        nextEntries.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          src,
          category: "Sonstiges",
          note: file.name,
        });
        onEntriesChange([...nextEntries]);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  return (
    <div style={photoFieldContainerStyle}>
      <h3 style={photoFieldTitleStyle}>📸 Fotos zur Wiedererkennung</h3>
      <p style={helperTextStyle}>
        Diese Fotos erscheinen in deiner Immobilienliste, damit du sofort weißt, um welches Objekt es
        sich handelt. Ergänze optional Kategorie und Notiz.
      </p>

      <div style={photoUploadRowStyle}>
        <label style={uploadButtonStyle}>
          Foto hochladen
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
        </label>
        <span style={{ fontSize: "0.75rem", color: "rgba(226, 232, 240, 0.7)" }}>
          Unterstützt PNG, JPG, HEIC (wird lokal gespeichert).
        </span>
      </div>

      {photoItems.length > 0 && (
        <div style={photoEntryListStyle}>
          {photoItems.map((entry) => (
            <div key={entry.id} style={photoEntryItemStyle}>
              <div style={photoEntryPreviewStyle}>
                <img
                  src={entry.src}
                  alt={entry.note || entry.category}
                  style={photoPreviewImageStyle}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <div style={photoEntryControlsStyle}>
                <label style={smallLabelStyle}>Kategorie</label>
                <select
                  value={entry.category || "Sonstiges"}
                  onChange={(e) => updateEntry(entry.id, "category", e.target.value)}
                  style={selectStyle}
                >
                  {photoCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <label style={{ ...smallLabelStyle, marginTop: "0.35rem" }}>Beschreibung</label>
                <textarea
                  style={photoEntryNoteStyle}
                  value={entry.note || ""}
                  onChange={(e) => updateEntry(entry.id, "note", e.target.value)}
                  placeholder="z.B. Bad – Fliesen Zustand dokumentiert"
                />
              </div>
              <button type="button" style={photoEntryRemoveStyle} onClick={() => removeEntry(entry.id)}>
                Entfernen
              </button>
            </div>
          ))}
        </div>
      )}

      <label style={labelStyle} htmlFor="photoUrls">
        Zusätzliche Bild-Links (optional)
      </label>
      <textarea
        className="aim-input"
        id="photoUrls"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"https://example.com/foto-1.jpg\nhttps://example.com/foto-2.jpg"}
        style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
      />
      <div style={photoPreviewGridStyle}>
        {photoItems.length === 0 && urls.length === 0 ? (
          <div style={photoPreviewPlaceholderStyle}>
            <span role="img" aria-label="Foto hinzufügen">
              🏙️
            </span>
            <span>Füge Fotos hinzu, um hier eine Vorschau zu sehen.</span>
          </div>
        ) : (
          <>
            {photoItems.slice(0, 3).map((entry) => (
              <div key={`entry-${entry.id}`} style={photoPreviewStyle}>
                <img src={entry.src} alt={entry.note || entry.category} style={photoPreviewImageStyle} />
              </div>
            ))}
            {photoItems.length < 3 &&
              urls.slice(0, 3 - photoItems.length).map((link, index) => (
                <div key={`url-${link}-${index}`} style={photoPreviewStyle}>
                  <img src={link} alt={`Link Vorschau ${index + 1}`} style={photoPreviewImageStyle} />
                </div>
              ))}
            {photoItems.length + urls.length > 3 && (
              <div style={photoPreviewMoreBadgeStyle}>+{photoItems.length + urls.length - 3} weitere</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AnalysisPhotoUploader({ entries = [], onChange }) {
  const items = Array.isArray(entries) ? entries : [];

  const updateEntry = (id, field, newValue) => {
    if (!onChange) return;
    onChange(items.map((entry) => (entry.id === id ? { ...entry, [field]: newValue } : entry)));
  };

  const removeEntry = (id) => {
    if (!onChange) return;
    onChange(items.filter((entry) => entry.id !== id));
  };

  const handleFiles = (event) => {
    if (!onChange) return;
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const nextEntries = [...items];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const src = loadEvent.target?.result?.toString();
        if (!src) return;
        nextEntries.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          src,
          category: "Sonstiges",
          note: file.name,
        });
        onChange([...nextEntries]);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  return (
    <div style={photoEntryListStyle}>
      <div style={photoUploadRowStyle}>
        <label style={uploadButtonStyle}>
          Analyse-Foto hochladen
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
        </label>
        <span style={{ fontSize: "0.75rem", color: "rgba(226, 232, 240, 0.7)" }}>
          Dokumentiere Räume für die Kostenschätzung.
        </span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: "0.85rem", color: "rgba(226, 232, 240, 0.7)" }}>
          Noch keine Analysebilder hochgeladen.
        </div>
      ) : (
        items.map((entry) => (
          <div key={entry.id} style={photoEntryItemStyle}>
            <div style={photoEntryPreviewStyle}>
              <img src={entry.src} alt={entry.note || entry.category} style={photoPreviewImageStyle} />
            </div>
            <div style={photoEntryControlsStyle}>
              <label style={smallLabelStyle}>Bereich</label>
              <select
                value={entry.category || "Sonstiges"}
                onChange={(e) => updateEntry(entry.id, "category", e.target.value)}
                style={selectStyle}
              >
                {photoCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <label style={{ ...smallLabelStyle, marginTop: "0.35rem" }}>Anmerkung</label>
              <textarea
                style={photoEntryNoteStyle}
                value={entry.note || ""}
                onChange={(e) => updateEntry(entry.id, "note", e.target.value)}
                placeholder="z.B. Fliesen müssen komplett erneuert werden"
              />
            </div>
            <button type="button" style={photoEntryRemoveStyle} onClick={() => removeEntry(entry.id)}>
              Entfernen
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function PropertyFilterBar({ activeFilter, onChange, stats }) {
  return (
    <div style={filterBarStyle} className="property-filter-bar">
      {PROPERTY_FILTERS.map((filter) => {
        const isActive = activeFilter === filter.value;
        const count = stats[filter.value] ?? 0;
        return (
          <button
            key={filter.value}
            type="button"
            className={`property-filter-pill ${isActive ? "is-active" : ""}`}
            style={isActive ? propertyFilterPillActiveStyle : propertyFilterPillStyle}
            onClick={() => onChange(filter.value)}
          >
            <span>{filter.label}</span>
            <span style={filterCountStyle}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function ValuationTab({ formData, results, onCalculate }) {
  return (
    <section style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={valuationIntroStyle}>
        <h2 style={{ ...sectionTitleStyle, fontSize: "1.3rem" }}>Bewertung &amp; Szenarien</h2>
        <p style={{ color: "rgba(226, 232, 240, 0.85)" }}>
          Nutze diese Ansicht, um schnell zu prüfen, wie sich Änderungen bei Kaufpreis,
          Eigenkapital oder Cashflow auswirken. Die Szenarien bauen auf deinen Eingaben aus dem
          Formular auf.
        </p>
        <div>
          <button type="button" style={primaryButtonStyle} onClick={onCalculate}>
            Kennzahlen aktualisieren
          </button>
        </div>
      </div>

      <div style={valuationSummaryGridStyle}>
        <SummaryCard label="Kaufpreis" value={`${formData.purchasePrice || 0} €`} />
        <SummaryCard label="Eigenkapital" value={`${formData.equity || 0} €`} />
        <SummaryCard label="Strategie" value={formatStrategy(formData.strategy)} />
        <SummaryCard
          label="Letzte Berechnung"
          value={results ? `${results.monthlyCashflow.toFixed(2)} € CF` : "—"}
        />
      </div>

      <div style={valuationScenarioStyle}>
        <h3 style={{ color: "#f8fafc", marginBottom: "0.6rem" }}>Szenario-Analyse</h3>
        <div style={valuationScenarioGridStyle}>
          {valuationScenarios(results).map((scenario) => (
            <div key={scenario.label} style={valuationScenarioCardStyle}>
              <div style={{ fontSize: "0.8rem", color: "rgba(226, 232, 240, 0.8)" }}>
                {scenario.label}
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 600, color: scenario.color }}>
                {scenario.cashflow.toFixed(2)} € / Monat
              </div>
              <div style={{ fontSize: "0.85rem", color: "rgba(226, 232, 240, 0.7)" }}>
                Rendite: {scenario.equityReturn.toFixed(2)} %
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PropertyTypeOverview({ breakdown }) {
  if (!breakdown || breakdown.length <= 1) {
    return null;
  }

  return (
    <div style={typeSplitGridStyle}>
      {breakdown.map((bucket) => (
        <div
          key={bucket.key}
          style={{
            ...typeSplitCardStyle,
            border:
              bucket.key === "all"
                ? "1px solid rgba(96, 165, 250, 0.5)"
                : "1px solid rgba(148, 163, 184, 0.25)",
            background:
              bucket.key === "all"
                ? "linear-gradient(130deg, rgba(59, 130, 246, 0.3), rgba(13, 148, 136, 0.15))"
                : "rgba(15, 23, 42, 0.5)",
          }}
        >
          <div style={typeSplitHeaderStyle}>
            <span style={typeSplitLabelStyle}>{bucket.label}</span>
            <span style={typeSplitCountStyle}>{bucket.count}</span>
          </div>
          <div style={typeSplitMetricsStyle}>
            <div>
              <div style={typeSplitMetricLabelStyle}>Cashflow / Monat</div>
              <div style={typeSplitMetricValueStyle}>
                {bucket.totalCashflow.toFixed(2)} €
              </div>
            </div>
            <div>
              <div style={typeSplitMetricLabelStyle}>Ø Bruttorendite</div>
              <div style={typeSplitMetricValueStyle}>
                {bucket.avgGrossYield.toFixed(2)} %
              </div>
            </div>
            <div>
              <div style={typeSplitMetricLabelStyle}>Ø EK-Rendite</div>
              <div style={typeSplitMetricValueStyle}>
                {bucket.avgEquityReturn.toFixed(2)} %
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsSection({
  bestByEquity,
  bestByCashflow,
  analyticsData,
  propertiesCount,
  properties,
}) {
  if (propertiesCount === 0) {
    return (
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={sectionTitleStyle}>Analysen</h2>
        <p style={{ color: "#9ca3af" }}>
          Noch keine Daten. Lege zuerst ein paar Immobilien an, um Analysen zu sehen.
        </p>
      </section>
    );
  }

  const { sortedByEquity, sortedByCashflow, maxEquityReturn, maxAbsCashflow } = analyticsData;

  return (
    <section style={{ marginTop: "1.5rem" }}>
      <h2 style={sectionTitleStyle}>Analysen</h2>
      <ValuationCharts properties={properties} />
      <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {bestByEquity && (
          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>Beste Immobilie nach Eigenkapitalrendite</span>
            <span style={summaryValueStyle}>
              {bestByEquity.title} – {bestByEquity.equityReturn.toFixed(2)} %
            </span>
          </div>
        )}
        {bestByCashflow && (
          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>Beste Immobilie nach Cashflow</span>
            <span style={summaryValueStyle}>
              {bestByCashflow.title} – {bestByCashflow.monthlyCashflow.toFixed(2)} € / Monat
            </span>
          </div>
        )}
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Anzahl analysierter Immobilien</span>
          <span style={summaryValueStyle}>{propertiesCount}</span>
        </div>
      </div>

      <h3
        style={{
          fontSize: "0.95rem",
          marginBottom: "0.5rem",
          color: "#4b5563",
        }}
      >
        Ranking nach Eigenkapitalrendite
      </h3>

      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={tableHeadRowStyle}>
              <Th>#</Th>
              <Th>Immobilie</Th>
              <Th>EK-Rendite</Th>
              <Th>Cashflow / Monat</Th>
              <Th>Deal-Qualität</Th>
            </tr>
          </thead>
          <tbody>
            {sortedByEquity.map((prop, index) => {
              const quality = getDealQuality(prop.equityReturn);
              const barWidth =
                maxEquityReturn > 0
                  ? Math.max(6, (prop.equityReturn / maxEquityReturn) * 100)
                  : 0;

              return (
                <tr key={prop.id} style={tableBodyRowStyle}>
                  <Td style={{ width: "40px" }}>{index + 1}</Td>
                  <Td>{prop.title}</Td>
                  <Td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span>{prop.equityReturn.toFixed(2)} %</span>
                      <div
                        style={{
                          height: "6px",
                          borderRadius: "999px",
                          backgroundColor: "#e5e7eb",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${barWidth}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #22c55e, #16a34a)",
                          }}
                        />
                      </div>
                    </div>
                  </Td>
                  <Td>{prop.monthlyCashflow.toFixed(2)} € / Monat</Td>
                  <Td>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "999px",
                        fontWeight: 500,
                        backgroundColor: quality.bg,
                        color: quality.color,
                      }}
                    >
                      {quality.label}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3
        style={{
          fontSize: "0.95rem",
          marginTop: "1.5rem",
          marginBottom: "0.5rem",
          color: "#4b5563",
        }}
      >
        Cashflow-Übersicht
      </h3>

      <div
        style={{
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "0.9rem 1rem",
          backgroundColor: "#f9fafb",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
        }}
      >
        {sortedByCashflow.map((prop) => {
          const rel =
            maxAbsCashflow > 0
              ? Math.max(6, (Math.abs(prop.monthlyCashflow) / maxAbsCashflow) * 100)
              : 0;
          const isPositive = prop.monthlyCashflow >= 0;

          return (
            <div key={prop.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "180px",
                  fontSize: "0.85rem",
                  color: "#4b5563",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {prop.title}
              </div>
              <div
                style={{
                  flex: 1,
                  height: "8px",
                  borderRadius: "999px",
                  backgroundColor: "#e5e7eb",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${rel}%`,
                    height: "100%",
                    background: isPositive
                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                      : "linear-gradient(90deg, #f97373, #b91c1c)",
                  }}
                />
              </div>
              <div
                style={{
                  width: "130px",
                  textAlign: "right",
                  fontSize: "0.85rem",
                  color: isPositive ? "#166534" : "#991b1b",
                  fontWeight: 500,
                }}
              >
                {prop.monthlyCashflow.toFixed(2)} € / Monat
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getDealQuality(equityReturn) {
  if (equityReturn <= 0) {
    return {
      label: "Negativ",
      bg: "#fee2e2",
      color: "#991b1b",
    };
  }
  if (equityReturn < 4) {
    return {
      label: "Schwach",
      bg: "#fef3c7",
      color: "#92400e",
    };
  }
  if (equityReturn < 7) {
    return {
      label: "Okay",
      bg: "#e0f2fe",
      color: "#0369a1",
    };
  }
  if (equityReturn < 10) {
    return {
      label: "Gut",
      bg: "#dcfce7",
      color: "#166534",
    };
  }
  return {
    label: "Top-Deal",
    bg: "#22c55e33",
    color: "#15803d",
  };
}

function safeFixed(value, digits = 2) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(digits) : "—";
}

const toPhotoObject = (photo) => {
  if (!photo) {
    return { src: "", category: "", note: "" };
  }
  if (typeof photo === "string") {
    return { src: photo, category: "", note: "" };
  }
  return {
    src: photo.src || photo.url || "",
    category: photo.category || photo.type || "",
    note: photo.note || photo.description || "",
  };
};

function formatPropertyType(type) {
  switch (type) {
    case "wohnung":
      return "Wohnung";
    case "haus":
      return "Haus";
    case "garage":
      return "Garage";
    default:
      return "Unbekannt";
  }
}

function formatStrategy(strategy) {
  switch (strategy) {
    case "buy_and_hold":
      return "Buy & Hold";
    case "flip":
      return "Fix & Flip";
    case "eigennutzung":
      return "Eigennutzung";
    default:
      return "Unbekannt";
  }
}

const requestStatusColor = (status) => {
  switch (status) {
    case "reviewed":
      return "rgba(34,197,94,0.25)";
    case "in_progress":
      return "rgba(251,191,36,0.25)";
    default:
      return "rgba(148,163,184,0.25)";
  }
};

const REQUEST_STATUS_LABELS = {
  pending: "Offen",
  in_progress: "In Prüfung",
  reviewed: "Ausgewertet",
};

function valuationScenarios(results) {
  if (!results) {
    return [
      { label: "Worst Case", cashflow: 0, equityReturn: 0, color: "#f97316" },
      { label: "Realistisch", cashflow: 0, equityReturn: 0, color: "#22d3ee" },
      { label: "Best Case", cashflow: 0, equityReturn: 0, color: "#22c55e" },
    ];
  }

  return [
    {
      label: "Worst Case (−10% Miete)",
      cashflow: results.monthlyCashflow * 0.9,
      equityReturn: results.equityReturn * 0.85,
      color: "#f97316",
    },
    {
      label: "Realistisch",
      cashflow: results.monthlyCashflow,
      equityReturn: results.equityReturn,
      color: "#22d3ee",
    },
    {
      label: "Best Case (+10% Miete)",
      cashflow: results.monthlyCashflow * 1.1,
      equityReturn: results.equityReturn * 1.15,
      color: "#22c55e",
    },
  ];
}

function ProfileSection({ userProfile, onUpdateProfile, onExportJson }) {
  const [form, setForm] = useState({
    firstName: userProfile?.firstName || "",
    lastName: userProfile?.lastName || "",
    company: userProfile?.company || "",
    email: userProfile?.email || "",
    password: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      firstName: userProfile?.firstName || "",
      lastName: userProfile?.lastName || "",
      company: userProfile?.company || "",
      email: userProfile?.email || "",
      password: "",
    });
  }, [userProfile]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    onUpdateProfile({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
    });
    setMessage("Profil aktualisiert.");
    setTimeout(() => setMessage(""), 2200);
  };

  return (
    <section style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={profileHeaderStyle}>
        <div>
          <h2 style={sectionTitleStyle}>Profil & Sicherheit</h2>
          <p style={{ color: "rgba(226,232,240,0.8)" }}>
            Passe deine persönlichen Daten an oder exportiere dein Portfolio als JSON-Datei.
          </p>
        </div>
        <button type="button" style={secondaryButtonStyle} onClick={onExportJson}>
          Portfolio exportieren
        </button>
      </div>

      <form onSubmit={handleSave} style={profileFormStyle}>
        <div style={analysisFormGridStyle}>
          <div className="input-stack">
            <label style={labelStyle}>Vorname</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              placeholder="z.B. Anna"
              style={inputStyle}
            />
          </div>
          <div className="input-stack">
            <label style={labelStyle}>Nachname</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              placeholder="z.B. Beispiel"
              style={inputStyle}
            />
          </div>
        </div>
        <div className="input-stack">
          <label style={labelStyle}>Firma (optional)</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleChange("company", e.target.value)}
            placeholder="z.B. AIM Ventures"
            style={inputStyle}
          />
        </div>
        <div className="input-stack">
          <label style={labelStyle}>E-Mail-Adresse</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="z.B. anna@example.com"
            style={inputStyle}
          />
        </div>
        <div className="input-stack">
          <label style={labelStyle}>Neues Passwort (optional)</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
            placeholder="Nur ausfüllen, wenn du es ändern möchtest"
            style={inputStyle}
          />
          <small style={{ color: "rgba(226,232,240,0.6)" }}>
            Die Passwortänderung wird lokal gespeichert und nicht an einen Server gesendet.
          </small>
        </div>

        <button type="submit" style={{ ...primaryButtonStyle, alignSelf: "flex-start" }}>
          Änderungen speichern
        </button>
        {message && <div style={{ color: "#22c55e", fontSize: "0.85rem" }}>{message}</div>}
      </form>
    </section>
  );
}

function Field({ name, label, placeholder, value, onChange }) {
  return (
    <div className="input-stack">
      <label style={labelStyle} htmlFor={name}>
        {label}
      </label>
      <input
        className="aim-input"
        id={name}
        name={name}
        type="number"
        inputMode="decimal"
        step="0.01"
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

function ResultRow({ label, value, highlight }) {
  const badgeColor =
    highlight === "green"
      ? { backgroundColor: "#dcfce7", color: "#166534" }
      : highlight === "red"
      ? { backgroundColor: "#fee2e2", color: "#991b1b" }
      : { backgroundColor: "#eff6ff", color: "#1d4ed8" };

  return (
    <div style={resultRowStyle} className="result-row">
      <span style={resultLabelStyle}>{label}</span>
      <span style={{ ...resultValueBadgeStyle, ...badgeColor }}>{value}</span>
    </div>
  );
}

function SummaryCard({ label, value, highlight }) {
  let colorStyle = {};
  if (highlight === "green") colorStyle = { color: "#166534" };
  if (highlight === "red") colorStyle = { color: "#991b1b" };

  return (
    <div style={summaryCardStyle}>
      <span style={summaryLabelStyle}>{label}</span>
      <span style={{ ...summaryValueStyle, ...colorStyle }}>{value}</span>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={summaryCardStyle}>
      <span style={summaryLabelStyle}>{label}</span>
      <span style={summaryValueStyle}>{value}</span>
    </div>
  );
}

function Th({ children }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children, style }) {
  return <td style={{ ...tdStyle, ...style }}>{children}</td>;
}

const selectArrowSvg = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 9l6 6 6-6'/></svg>"
);

const pageStyle = {
  minHeight: "100vh",
  margin: 0,
  padding: "var(--app-page-padding)",
  background: "var(--aim-bg)",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
};

const registerCardStyle = {
  width: "100%",
  maxWidth: "560px",
  backgroundColor: "rgba(15, 23, 42, 0.85)",
  borderRadius: "20px",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  padding: "2.5rem",
  boxShadow: "0 35px 80px rgba(0, 0, 0, 0.45)",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
  color: "#f8fafc",
};

const registerFormStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.85rem",
};

const consentLabelStyle = {
  fontSize: "0.85rem",
  color: "rgba(226, 232, 240, 0.8)",
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
};

const errorBadgeStyle = {
  backgroundColor: "rgba(248, 113, 113, 0.2)",
  border: "1px solid rgba(248, 113, 113, 0.4)",
  borderRadius: "12px",
  padding: "0.5rem 0.75rem",
  color: "#fecaca",
  fontSize: "0.85rem",
};

const authSwitchStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  marginTop: "0.75rem",
  fontSize: "0.85rem",
  color: "rgba(226,232,240,0.8)",
};

const mockMailStyle = {
  borderRadius: "14px",
  border: "1px solid rgba(148,163,184,0.3)",
  backgroundColor: "rgba(15,23,42,0.5)",
  padding: "0.85rem 1rem",
  fontSize: "0.85rem",
};

const cardStyle = {
  width: "100%",
  maxWidth: "1100px",
  backgroundColor: "transparent",
  color: "var(--aim-text)",
  borderRadius: "18px",
  boxShadow: "0 25px 60px rgba(2, 6, 23, 0.55)",
  padding: "var(--app-card-padding)",
};

const navStyle = {
  display: "flex",
  gap: "0.4rem",
  marginBottom: "0.9rem",
  padding: "0.3rem",
  borderRadius: "999px",
  backgroundColor: "rgba(15,23,42,0.14)",
  border: "1px solid rgba(148,163,184,0.35)",
  flexWrap: "wrap",
  width: "100%",
};

const headerStyle = {
  borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
  paddingBottom: "1rem",
  marginBottom: "1.5rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
};

const titleStyle = {
  fontSize: "1.8rem",
  margin: 0,
  fontWeight: 800,
  backgroundImage: "linear-gradient(120deg, #c7d2fe, #60a5fa, #22d3ee)",
  WebkitBackgroundClip: "text",
  color: "transparent",
};

const subtitleStyle = {
  margin: "0.25rem 0 0",
  color: "rgba(226, 232, 240, 0.7)",
  fontSize: "0.9rem",
};

const headerRightStyle = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
  flexWrap: "wrap",
};

const badgeStyle = {
  fontSize: "0.85rem",
  padding: "0.4rem 0.8rem",
  borderRadius: "999px",
  backgroundColor: "rgba(96, 165, 250, 0.15)",
  color: "#93c5fd",
  fontWeight: 500,
};

const floatingLogoutStyle = {
  position: "fixed",
  right: "1.2rem",
  bottom: "1.2rem",
  padding: "0.55rem 1.1rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.35)",
  background: "rgba(15,23,42,0.9)",
  color: "#e2e8f0",
  fontSize: "0.9rem",
  cursor: "pointer",
  boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
  zIndex: 50,
};

const linkButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#9ca3af",
  fontSize: "0.8rem",
  cursor: "pointer",
  textDecoration: "underline",
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: "0.75rem",
  fontSize: "1.1rem",
  color: "#e2e8f0",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.75rem",
};

const listHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
  marginBottom: "0.85rem",
};

const summaryCardStyle = {
  padding: "0.9rem 1rem",
  borderRadius: "12px",
  backgroundColor: "rgba(15, 23, 42, 0.55)",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const summaryLabelStyle = {
  fontSize: "0.8rem",
  color: "rgba(148, 163, 184, 0.85)",
};

const summaryValueStyle = {
  fontSize: "1rem",
  fontWeight: 600,
  color: "#f8fafc",
};

const mainGridStyle = {
  display: "grid",
  gridTemplateColumns: "var(--app-main-grid-columns)",
  gap: "2rem",
  alignItems: "flex-start",
};

const formCardStyle = {
  padding: "1.5rem",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  backgroundColor: "rgba(15, 23, 42, 0.65)",
};

const resultsCardStyle = {
  padding: "1.5rem",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  backgroundColor: "rgba(15, 23, 42, 0.4)",
};

const labelStyle = {
  display: "block",
  marginBottom: "0.25rem",
  fontSize: "0.85rem",
  color: "rgba(226, 232, 240, 0.8)",
};

const inputStyle = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: "10px",
  border: "1px solid var(--aim-input-border)",
  backgroundColor: "var(--aim-input-bg)",
  fontSize: "0.95rem",
  lineHeight: "1.2",
  outline: "none",
  boxSizing: "border-box",
  color: "#f8fafc",
};

const selectStyle = {
  ...inputStyle,
  paddingRight: "2.4rem",
  backgroundImage: `url("data:image/svg+xml,${selectArrowSvg}")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.9rem center",
  backgroundSize: "0.75rem auto",
};

const buttonRowStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginTop: "0.5rem",
};

const brandBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.4rem 0.75rem",
  borderRadius: "999px",
  background: "linear-gradient(120deg, rgba(15,23,42,0.9), rgba(37,99,235,0.7))",
  marginBottom: "0.9rem",
  border: "1px solid rgba(148,163,184,0.7)",
};

const brandBarLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
};

const brandDotStyle = {
  width: 8,
  height: 8,
  borderRadius: "999px",
  backgroundColor: "#22c55e",
  boxShadow: "0 0 12px rgba(34,197,94,0.9)",
};

const brandBarTextStyle = {
  fontSize: "0.8rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#e5e7eb",
};

const brandBarRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
};

const brandEnvStyle = {
  fontSize: "0.75rem",
  padding: "0.15rem 0.5rem",
  borderRadius: "999px",
  backgroundColor: "rgba(15,23,42,0.8)",
  color: "#e5e7eb",
  border: "1px solid rgba(148,163,184,0.7)",
};

const brandBetaStyle = {
  fontSize: "0.75rem",
  padding: "0.15rem 0.6rem",
  borderRadius: "999px",
  backgroundColor: "rgba(37,99,235,0.2)",
  color: "#bfdbfe",
  border: "1px solid rgba(129,140,248,0.9)",
};

const primaryButtonStyle = {
  padding: "0.6rem 0.9rem",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #38bdf8, #6366f1)",
  color: "#0f172a",
  fontSize: "0.9rem",
  fontWeight: 500,
  cursor: "pointer",
  flex: "1 1 140px",
  boxShadow: "0 12px 30px rgba(59, 130, 246, 0.35)",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
};

const secondaryButtonStyle = {
  padding: "0.6rem 0.9rem",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  backgroundColor: "rgba(15, 23, 42, 0.2)",
  color: "#e2e8f0",
  fontSize: "0.9rem",
  fontWeight: 500,
  cursor: "pointer",
  flex: "1 1 140px",
};

const ghostButtonStyle = {
  border: "1px solid rgba(148, 163, 184, 0.3)",
  borderRadius: "999px",
  background: "transparent",
  color: "#f8fafc",
  padding: "0.4rem 0.8rem",
  cursor: "pointer",
};

const tertiaryButtonStyle = {
  padding: "0.55rem 0.85rem",
  borderRadius: "999px",
  border: "1px dashed rgba(148,163,184,0.4)",
  backgroundColor: "transparent",
  color: "rgba(226,232,240,0.85)",
  fontSize: "0.85rem",
  fontWeight: 500,
  cursor: "pointer",
  flex: "0 0 auto",
};

const resultRowStyle = {
  padding: "0.75rem 0.9rem",
  borderRadius: "10px",
  backgroundColor: "rgba(15, 23, 42, 0.5)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
};

const resultLabelStyle = {
  fontSize: "0.9rem",
  color: "rgba(226, 232, 240, 0.8)",
};

const resultValueBadgeStyle = {
  fontSize: "0.9rem",
  padding: "0.25rem 0.6rem",
  borderRadius: "999px",
  fontWeight: 500,
};

const tableWrapperStyle = {
  overflowX: "auto",
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  backgroundColor: "rgba(15, 23, 42, 0.4)",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.9rem",
};

const tableHeadRowStyle = {
  backgroundColor: "rgba(15, 23, 42, 0.8)",
  textAlign: "left",
};

const tableBodyRowStyle = {
  borderTop: "1px solid rgba(148, 163, 184, 0.2)",
};

const thStyle = {
  padding: "0.6rem 0.75rem",
  fontWeight: 600,
  fontSize: "0.8rem",
  color: "rgba(226, 232, 240, 0.85)",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "0.55rem 0.75rem",
  color: "#f8fafc",
  verticalAlign: "middle",
};

const smallLinkButtonStyle = {
  border: "none",
  background: "none",
  color: "rgba(148, 163, 184, 0.9)",
  cursor: "pointer",
  fontSize: "0.8rem",
  textDecoration: "underline",
};

const tableActionsStyle = {
  display: "flex",
  gap: "0.4rem",
  flexWrap: "wrap",
};

const filterBarStyle = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const propertyFilterPillStyle = {
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  backgroundColor: "rgba(15, 23, 42, 0.2)",
  color: "rgba(226, 232, 240, 0.8)",
  padding: "0.35rem 0.9rem",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  cursor: "pointer",
};

const propertyFilterPillActiveStyle = {
  ...propertyFilterPillStyle,
  border: "1px solid rgba(96, 165, 250, 0.6)",
  backgroundColor: "rgba(59, 130, 246, 0.15)",
  color: "#f8fafc",
  boxShadow: "0 8px 20px rgba(59, 130, 246, 0.25)",
};

const filterCountStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  padding: "0.05rem 0.55rem",
  fontSize: "0.75rem",
  border: "1px solid rgba(148, 163, 184, 0.4)",
};

const detailImageWrapperStyle = {
  width: "100%",
  maxHeight: "320px",
  borderRadius: "14px",
  overflow: "hidden",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  marginBottom: "1rem",
  backgroundColor: "rgba(15, 23, 42, 0.4)",
  position: "relative",
};

const detailImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const photoTagStyle = {
  position: "absolute",
  left: "0.75rem",
  bottom: "0.75rem",
  backgroundColor: "rgba(2,6,23,0.75)",
  padding: "0.35rem 0.75rem",
  borderRadius: "12px",
  color: "#f8fafc",
  fontSize: "0.75rem",
  maxWidth: "90%",
};

const detailGalleryStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.75rem",
  marginBottom: "1rem",
};


const helperTextStyle = {
  color: "rgba(226, 232, 240, 0.8)",
  fontSize: "0.78rem",
};

const photoUploadRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.6rem",
  marginBottom: "0.5rem",
};

const uploadButtonStyle = {
  borderRadius: "999px",
  padding: "0.45rem 0.85rem",
  border: "1px solid rgba(96, 165, 250, 0.6)",
  color: "#bfdbfe",
  fontSize: "0.85rem",
  cursor: "pointer",
  background: "linear-gradient(120deg, rgba(59,130,246,0.25), rgba(14,165,233,0.2))",
};

const photoFieldTitleStyle = {
  margin: 0,
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#f8fafc",
};

const photoFieldContainerStyle = {
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid rgba(96, 165, 250, 0.35)",
  backgroundColor: "rgba(15, 23, 42, 0.35)",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  marginTop: "0.5rem",
};

const photoFieldHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "0.8rem",
  color: "rgba(226, 232, 240, 0.9)",
};

const photoPreviewStyle = {
  width: "100%",
  height: "180px",
  borderRadius: "16px",
  border: "1px dashed rgba(148, 163, 184, 0.5)",
  backgroundColor: "rgba(15, 23, 42, 0.35)",
  overflow: "hidden",
  position: "relative",
};

const photoPreviewGridStyle = {
  width: "100%",
  minHeight: "180px",
  borderRadius: "16px",
  border: "1px dashed rgba(148, 163, 184, 0.5)",
  backgroundColor: "rgba(15, 23, 42, 0.35)",
  overflow: "hidden",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "0.35rem",
  padding: "0.35rem",
  position: "relative",
};

const photoPreviewImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const photoPreviewPlaceholderStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.35rem",
  color: "rgba(226, 232, 240, 0.8)",
  fontSize: "0.85rem",
  textAlign: "center",
};

const photoPreviewMoreBadgeStyle = {
  position: "absolute",
  bottom: "0.4rem",
  right: "0.6rem",
  backgroundColor: "rgba(15, 23, 42, 0.8)",
  borderRadius: "999px",
  padding: "0.2rem 0.7rem",
  fontSize: "0.8rem",
  color: "#f8fafc",
  border: "1px solid rgba(148, 163, 184, 0.4)",
};

const photoEntryListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.65rem",
  marginBottom: "0.75rem",
};

const photoEntryItemStyle = {
  display: "flex",
  gap: "0.75rem",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  backgroundColor: "rgba(15, 23, 42, 0.45)",
  padding: "0.65rem",
  flexWrap: "wrap",
};

const photoEntryPreviewStyle = {
  width: "120px",
  height: "100px",
  borderRadius: "12px",
  overflow: "hidden",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  backgroundColor: "rgba(15, 23, 42, 0.4)",
  flexShrink: 0,
};

const photoEntryControlsStyle = {
  flex: 1,
  minWidth: "180px",
  display: "flex",
  flexDirection: "column",
};

const smallLabelStyle = {
  fontSize: "0.75rem",
  color: "rgba(226, 232, 240, 0.75)",
};

const photoEntryNoteStyle = {
  ...inputStyle,
  minHeight: "60px",
  resize: "vertical",
  marginTop: "0.2rem",
};

const photoEntryRemoveStyle = {
  border: "1px solid rgba(248, 113, 113, 0.45)",
  background: "transparent",
  color: "#f87171",
  borderRadius: "999px",
  padding: "0.35rem 0.8rem",
  cursor: "pointer",
  height: "fit-content",
};

const editBannerStyle = {
  borderRadius: "12px",
  border: "1px solid rgba(96,165,250,0.45)",
  backgroundColor: "rgba(37,99,235,0.15)",
  padding: "0.6rem 0.8rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "0.85rem",
  color: "#bfdbfe",
};

const editBannerLinkStyle = {
  border: "none",
  background: "transparent",
  color: "#93c5fd",
  cursor: "pointer",
  fontSize: "0.8rem",
  textDecoration: "underline",
};

const analysisCoachGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
};

const analysisCoachCardStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(96, 165, 250, 0.35)",
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  padding: "1.2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const analysisFormGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "0.65rem",
};

const analysisResultCardStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  backgroundColor: "rgba(15, 23, 42, 0.45)",
  padding: "1.2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
};

const analysisResultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  flexWrap: "wrap",
};

const analysisResultLabelStyle = {
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(226, 232, 240, 0.6)",
};

const analysisResultValueStyle = {
  fontSize: "1.35rem",
  fontWeight: 700,
  color: "#f8fafc",
};

const analysisResultHintStyle = {
  fontSize: "0.78rem",
  color: "rgba(226, 232, 240, 0.75)",
};

const analysisVerdictStyle = {
  fontSize: "1.1rem",
  fontWeight: 700,
};

const analysisBreakdownStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.65rem",
};

const analysisBreakdownRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.8rem",
  padding: "0.65rem 0.35rem",
  borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
};

const analysisFocusStyle = {
  borderRadius: "12px",
  border: "1px solid rgba(96, 165, 250, 0.3)",
  padding: "0.75rem",
  backgroundColor: "rgba(37, 99, 235, 0.12)",
};

const analysisFocusListStyle = {
  margin: "0.35rem 0 0",
  paddingLeft: "1.1rem",
  color: "rgba(226, 232, 240, 0.85)",
  fontSize: "0.82rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const sectionSubtitleStyle = {
  fontSize: "0.95rem",
  color: "rgba(226, 232, 240, 0.95)",
  marginBottom: "0.35rem",
};

const areaDraftCardStyle = {
  borderRadius: "14px",
  border: "1px dashed rgba(96, 165, 250, 0.6)",
  padding: "0.9rem",
  marginTop: "0.8rem",
  backgroundColor: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
};

const areaDraftTitleStyle = {
  margin: 0,
  fontSize: "0.95rem",
  color: "#f8fafc",
};

const areaDraftHintStyle = {
  fontSize: "0.75rem",
  color: "rgba(226, 232, 240, 0.65)",
};

const areaPhotoPreviewStyle = {
  borderRadius: "12px",
  border: "1px dashed rgba(148, 163, 184, 0.4)",
  padding: "0.4rem",
  minHeight: "90px",
  display: "flex",
  flexWrap: "wrap",
  gap: "0.35rem",
  backgroundColor: "rgba(15,23,42,0.35)",
  marginTop: "0.35rem",
  position: "relative",
};

const renovationPhotoThumbStyle = {
  width: "78px",
  height: "78px",
  borderRadius: "10px",
  overflow: "hidden",
  position: "relative",
  border: "1px solid rgba(148,163,184,0.35)",
  backgroundColor: "rgba(15,23,42,0.4)",
};

const renovationPhotoImgStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const photoRemoveButtonStyle = {
  position: "absolute",
  top: "4px",
  right: "4px",
  border: "none",
  backgroundColor: "rgba(15,23,42,0.75)",
  color: "#f8fafc",
  borderRadius: "999px",
  width: "18px",
  height: "18px",
  fontSize: "0.75rem",
  cursor: "pointer",
};

const renovationAreaListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  marginTop: "0.5rem",
};

const renovationAreaCardStyle = {
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.25)",
  padding: "0.75rem",
  backgroundColor: "rgba(15,23,42,0.45)",
};

const renovationAreaHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.5rem",
};

const areaRemoveButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#f87171",
  fontSize: "0.8rem",
  cursor: "pointer",
};

const renovationPhotoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))",
  gap: "0.35rem",
  marginTop: "0.5rem",
};

const renovationBreakdownStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
  margin: "0.85rem 0",
};

const renovationBreakdownRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.6rem",
  borderBottom: "1px solid rgba(148,163,184,0.2)",
  paddingBottom: "0.45rem",
};

const errorTextStyle = {
  color: "#f87171",
  fontSize: "0.82rem",
  marginTop: "0.45rem",
};

const historyCardStyle = {
  marginTop: "1rem",
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.25)",
  padding: "0.75rem",
  backgroundColor: "rgba(15,23,42,0.35)",
};

const historyListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const historyItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.4rem 0",
  borderBottom: "1px solid rgba(148,163,184,0.15)",
};

const areaPhotoEmptyStyle = {
  flex: "1 1 100%",
  minHeight: "70px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(226,232,240,0.6)",
  fontSize: "0.85rem",
  textAlign: "center",
  gap: "0.2rem",
};

const renovationEmptyStateStyle = {
  borderRadius: "12px",
  border: "1px dashed rgba(148,163,184,0.4)",
  padding: "1rem",
  backgroundColor: "rgba(15,23,42,0.35)",
  textAlign: "center",
  color: "rgba(226,232,240,0.8)",
  fontSize: "0.9rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const renovationEmptyIconStyle = {
  fontSize: "1.6rem",
};

const userRequestListStyle = {
  marginTop: "0.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const requestTableWrapperStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const requestCardStyle = {
  borderRadius: "14px",
  border: "1px solid rgba(148,163,184,0.3)",
  padding: "0.9rem 1rem",
  backgroundColor: "rgba(15,23,42,0.45)",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const requestCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.7rem",
  flexWrap: "wrap",
};

const adminPanelGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
  gap: "1rem",
  alignItems: "flex-start",
};

const adminListStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(148,163,184,0.3)",
  backgroundColor: "rgba(15,23,42,0.55)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const adminListItemStyle = {
  padding: "0.85rem 1rem",
  border: "none",
  background: "transparent",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  borderBottom: "1px solid rgba(148,163,184,0.2)",
  cursor: "pointer",
  color: "#f8fafc",
};

const adminListItemActiveStyle = {
  backgroundColor: "rgba(37,99,235,0.25)",
};

const adminListItemHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.6rem",
};

const adminListMetaStyle = {
  display: "flex",
  gap: "0.35rem",
  fontSize: "0.78rem",
  color: "rgba(226,232,240,0.75)",
};

const adminDetailsStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(148,163,184,0.35)",
  backgroundColor: "rgba(15,23,42,0.55)",
  padding: "1.2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
};

const adminMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.65rem",
};

const adminMetaCardStyle = {
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.25)",
  padding: "0.75rem",
  backgroundColor: "rgba(15,23,42,0.4)",
};

const adminNoteIntroStyle = {
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.25)",
  padding: "0.75rem",
  backgroundColor: "rgba(15,23,42,0.4)",
};

const adminTotalsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "0.65rem",
};

const adminActionsStyle = {
  display: "flex",
  gap: "0.6rem",
  flexWrap: "wrap",
  alignItems: "center",
};

const adminAreaCardStyle = {
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.25)",
  padding: "0.75rem",
  backgroundColor: "rgba(15,23,42,0.4)",
  display: "flex",
  flexDirection: "column",
  gap: "0.55rem",
};

const adminAreaInputsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "0.5rem",
};

const adminPhotosGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))",
  gap: "0.35rem",
};

const adminPhotoThumbStyle = {
  borderRadius: "10px",
  overflow: "hidden",
  border: "1px solid rgba(148,163,184,0.3)",
  backgroundColor: "rgba(15,23,42,0.35)",
  width: "100%",
  paddingBottom: "100%",
  position: "relative",
};

const adminPhotoImgStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const statusPillStyle = {
  borderRadius: "999px",
  padding: "0.2rem 0.8rem",
  fontSize: "0.8rem",
  color: "#0f172a",
  fontWeight: 600,
};

const profileHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const profileFormStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(148,163,184,0.3)",
  backgroundColor: "rgba(15,23,42,0.45)",
  padding: "1.25rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};


const marketAnalysisGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1rem",
};

const marketFormCardStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(96, 165, 250, 0.35)",
  backgroundColor: "rgba(15, 23, 42, 0.55)",
  padding: "1.2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const marketResultCardStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  backgroundColor: "rgba(15, 23, 42, 0.45)",
  padding: "1.2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
};

const marketResultGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.75rem",
};

const analysisComparisonCardStyle = {
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  padding: "0.9rem 1rem",
  backgroundColor: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const progressTrackStyle = {
  width: "100%",
  height: "8px",
  borderRadius: "999px",
  backgroundColor: "rgba(148, 163, 184, 0.25)",
  overflow: "hidden",
};

const progressBarStyle = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #34d399, #10b981)",
};

const analysisPreviewGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "0.4rem",
};

const analysisPreviewFrameStyle = {
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  overflow: "hidden",
  backgroundColor: "rgba(15, 23, 42, 0.4)",
};

const infoHeroStyle = {
  padding: "1.5rem",
  borderRadius: "18px",
  border: "1px solid rgba(96, 165, 250, 0.35)",
  background: "linear-gradient(120deg, rgba(37,99,235,0.35), rgba(8,47,73,0.65))",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
};

const infoHeroTextStyle = {
  color: "rgba(226, 232, 240, 0.85)",
  maxWidth: "600px",
};

const infoHeroBadgeStyle = {
  padding: "0.4rem 1.1rem",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.4)",
  color: "#bfdbfe",
  fontWeight: 600,
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0.8rem",
};

const infoCardStyle = {
  padding: "1rem",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  backgroundColor: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const infoCardTitleStyle = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "0.95rem",
};

const infoCardTextStyle = {
  margin: 0,
  color: "rgba(226, 232, 240, 0.75)",
  fontSize: "0.85rem",
};

const infoChecklistStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(96, 165, 250, 0.3)",
  backgroundColor: "rgba(15, 23, 42, 0.65)",
  padding: "1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
};

const infoChecklistListStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
  color: "rgba(226, 232, 240, 0.85)",
  fontSize: "0.85rem",
};

const valuationChartsWrapperStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
  marginBottom: "1rem",
};

const donutCardStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  backgroundColor: "rgba(15, 23, 42, 0.4)",
  padding: "1rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.6rem",
};

const donutTitleStyle = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "0.95rem",
};

const donutCenterStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  textAlign: "center",
  color: "#f8fafc",
  fontSize: "0.85rem",
};

const donutLegendStyle = {
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  fontSize: "0.75rem",
  color: "rgba(226, 232, 240, 0.8)",
};

const barCardStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  backgroundColor: "rgba(15, 23, 42, 0.4)",
  padding: "1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const barRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
};

const barTrackStyle = {
  flex: 1,
  height: "8px",
  borderRadius: "999px",
  backgroundColor: "rgba(255,255,255,0.15)",
  overflow: "hidden",
};

const barFillStyle = {
  height: "100%",
  borderRadius: "999px",
};

const typeSplitGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "0.9rem",
  marginTop: "1rem",
};

const typeSplitCardStyle = {
  borderRadius: "16px",
  padding: "1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
};

const typeSplitHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const typeSplitLabelStyle = {
  fontSize: "0.9rem",
  color: "#f8fafc",
  fontWeight: 600,
};

const typeSplitCountStyle = {
  fontSize: "0.85rem",
  padding: "0.1rem 0.65rem",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.4)",
};

const typeSplitMetricsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "0.6rem",
};

const typeSplitMetricLabelStyle = {
  fontSize: "0.75rem",
  color: "rgba(226, 232, 240, 0.7)",
};

const typeSplitMetricValueStyle = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#f8fafc",
};

const valuationIntroStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(96, 165, 250, 0.35)",
  padding: "1.2rem",
  backgroundColor: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const valuationSummaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.8rem",
};

const valuationScenarioStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  backgroundColor: "rgba(15, 23, 42, 0.5)",
  padding: "1rem",
};

const valuationScenarioGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.75rem",
};

const valuationScenarioCardStyle = {
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  padding: "0.9rem",
  backgroundColor: "rgba(3, 7, 18, 0.5)",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

export default App;
