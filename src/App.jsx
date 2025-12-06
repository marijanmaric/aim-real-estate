import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import aimLogo from "./assets/aim-logo.svg";

const STORAGE_KEY = "brickplan-properties-v1";

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
};

const PROPERTY_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "wohnung", label: "Wohnungen" },
  { value: "haus", label: "Häuser" },
  { value: "sanierung", label: "Sanierung" },
  { value: "gewerbe", label: "Gewerbe" },
];

function App() {
  const [formData, setFormData] = useState(initialFormState);
  const [properties, setProperties] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((p) => ({
            ...p,
            propertyType: p.propertyType || "wohnung",
            strategy: p.strategy || "buy_and_hold",
            photos: Array.isArray(p.photos)
              ? p.photos
              : p.photoUrl
              ? [p.photoUrl]
              : [],
          }))
        : [];
    } catch {
      return [];
    }
  });
  const [results, setResults] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [propertyFilter, setPropertyFilter] = useState("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (properties.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
  }, [properties]);

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

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

  const handleAddToList = useCallback(() => {
    if (!results) {
      alert("Bitte zuerst auf „Berechnen“ klicken.");
      return;
    }
    if (!formData.title.trim()) {
      alert("Bitte gib einen Namen für die Immobilie ein.");
      return;
    }

    const newProperty = {
      id: Date.now(),
      title: formData.title.trim(),
      propertyType: formData.propertyType,
      strategy: formData.strategy,
      photos:
        formData.photoUrls
          .split(/[\n,]/)
          .map((url) => url.trim())
          .filter(Boolean) || [],
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

    setProperties((prev) => [...prev, newProperty]);
  }, [formData, results]);

  const handleDelete = useCallback((id) => {
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setSelectedProperty((prev) => (prev && prev.id === id ? null : prev));
  }, []);

  const handleClearAll = useCallback(() => {
    const sure = window.confirm(
      "Wirklich alle gespeicherten Immobilien löschen?"
    );
    if (!sure) return;
    setProperties([]);
    setSelectedProperty(null);
  }, []);

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

  return (
    <div style={pageStyle} className="app-page">
      <div style={cardStyle} className="app-root-card">
        <BrandBar />
        <nav style={navStyle} className="app-nav">
          <button
            type="button"
            className={`nav-pill ${activeTab === "info" ? "is-active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            Info
          </button>
          <button
            type="button"
            className={`nav-pill ${activeTab === "overview" ? "is-active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`nav-pill ${activeTab === "properties" ? "is-active" : ""}`}
            onClick={() => setActiveTab("properties")}
          >
            Immobilien
          </button>
          <button
            type="button"
            className={`nav-pill ${activeTab === "analytics" ? "is-active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            Analysen
          </button>
          <button
            type="button"
            className={`nav-pill ${activeTab === "settings" ? "is-active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Einstellungen
          </button>
          <button
            type="button"
            className={`nav-pill ${activeTab === "valuation" ? "is-active" : ""}`}
            onClick={() => setActiveTab("valuation")}
          >
            Bewertung
          </button>
        </nav>

        <PortfolioStrip
          propertiesCount={propertiesCount}
          totalCashflow={totalCashflow}
          avgGrossYield={avgGrossYield}
          avgEquityReturn={avgEquityReturn}
        />

        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <img
              src={aimLogo}
              alt="AIM Real Estate Logo"
              style={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                boxShadow: "0 10px 22px rgba(15, 23, 42, 0.55)",
                flexShrink: 0,
              }}
            />
            <div>
              <h1 style={titleStyle}>AIM Real Estate</h1>
              <p style={subtitleStyle}>
                Präzise Analyse für smarte Immobilien-Investments.
              </p>
            </div>
          </div>

          <div style={headerRightStyle}>
            <div style={{ textAlign: "right", marginRight: "0.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Firma</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                AIM Real Estate
              </div>
            </div>
            <span style={badgeStyle}>MVP · v0.5</span>
            <button type="button" onClick={handleClearAll} style={linkButtonStyle}>
              Alles löschen
            </button>
          </div>
        </header>

        {activeTab === "info" && <InfoTab />}

        {activeTab === "overview" && (
          <>
            <OverviewSection
              propertiesCount={propertiesCount}
              totalCashflow={totalCashflow}
              avgGrossYield={avgGrossYield}
              avgEquityReturn={avgEquityReturn}
              propertyTypeBreakdown={propertyTypeBreakdown}
            />
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
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsSection
            bestByEquity={bestByEquity}
            bestByCashflow={bestByCashflow}
            analyticsData={analyticsData}
            propertiesCount={propertiesCount}
          />
        )}

{activeTab === "valuation" && (
  <ValuationTab
    formData={formData}
    results={results}
    onCalculate={handleCalculate}
  />
)}

        {activeTab === "settings" && (
          <SettingsSection onExportJson={handleExportJson} />
        )}
      </div>
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

function InfoTab() {
  return (
    <section style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={infoHeroStyle}>
        <div>
          <h2 style={{ ...sectionTitleStyle, fontSize: "1.4rem" }}>Willkommen bei AIM Real Estate</h2>
          <p style={infoHeroTextStyle}>
            AIM Real Estate ist dein persönlicher Deal-Copilot. Erfasse Wohnungen, Häuser oder
            Sanierungen, optimiere Cashflow und Rendite und exportiere Portfolios als JSON.
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
          body="Mit einem Klick auf „Berechnen“ erhältst du Cashflow, Renditen und Nebenkosten. Die neue Bewertungs-Ansicht zeigt Szenarien (Worst/Real/Best)."
        />
        <InfoCard
          title="3 · Analysieren & Exportieren"
          body="Vergleiche dein Portfolio im Dashboard, nutze den Analytics-Tab für Rankings und exportiere alles als JSON-Datei."
        />
      </div>

      <div style={infoChecklistStyle}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#f8fafc" }}>Was du wissen solltest</h3>
        <ul style={infoChecklistListStyle}>
          <li>⚡ Keine Registrierung – alles bleibt im Browser (localStorage).</li>
          <li>🧮 Renditen basieren auf deinen Annahmen. Passe sie jederzeit an.</li>
          <li>📤 Exportfunktion findet sich im Tab „Einstellungen“.</li>
          <li>🔐 Deine Daten verlassen den Browser nur, wenn du sie exportierst.</li>
        </ul>
        <button type="button" style={primaryButtonStyle} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Zum Dashboard wechseln
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

function PortfolioStrip({
  propertiesCount,
  totalCashflow,
  avgGrossYield,
  avgEquityReturn,
}) {
  return (
    <div style={portfolioStripStyle} className="portfolio-strip">
      <div style={portfolioItemStyle}>
        <div style={portfolioLabelStyle}>Immobilien im Portfolio</div>
        <div style={portfolioValueStyle}>{propertiesCount}</div>
        <div style={portfolioSubLabelStyle}>Gespeicherte Deals</div>
      </div>

      <div style={portfolioItemStyle}>
        <div style={portfolioLabelStyle}>Gesamt-Cashflow / Monat</div>
        <div
          style={{
            ...portfolioValueStyle,
            color: totalCashflow >= 0 ? "#22c55e" : "#f97373",
          }}
        >
          {totalCashflow.toFixed(2)} €
        </div>
        <div style={portfolioSubLabelStyle}>
          {totalCashflow >= 0 ? "Positiver Cashflow" : "Negativer Cashflow"}
        </div>
      </div>

      <div style={portfolioItemStyle}>
        <div style={portfolioLabelStyle}>Ø EK-Rendite</div>
        <div style={portfolioValueStyle}>
          {propertiesCount === 0 ? "—" : `${avgEquityReturn.toFixed(2)} %`}
        </div>
        <div style={portfolioSubLabelStyle}>Basierend auf allen Deals</div>
      </div>

      <div style={portfolioItemStyle}>
        <div style={portfolioLabelStyle}>Ø Bruttorendite</div>
        <div style={portfolioValueStyle}>
          {propertiesCount === 0 ? "—" : `${avgGrossYield.toFixed(2)} %`}
        </div>
        <div style={portfolioSubLabelStyle}>KP inkl. Nebenkosten</div>
      </div>
    </div>
  );
}

function BrandBar() {
  return (
    <div style={brandBarStyle}>
      <div style={brandBarLeftStyle}>
        <span style={brandDotStyle} />
        <span style={brandBarTextStyle}>AIM Real Estate</span>
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
}) {
  const {
    title,
    propertyType,
    strategy,
    photoUrls,
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
                <option value="sanierung">Sanierungsobjekt</option>
                <option value="gewerbe">Gewerbe</option>
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

            <PhotoField value={photoUrls} onChange={(val) => onFormChange("photoUrls", val)} />

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
                Zur Liste hinzufügen
              </button>
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
              {selectedProperty.photos.map((photo, index) => (
                <div key={photo + index} style={detailImageWrapperStyle}>
                  <img
                    src={photo}
                    alt={`Foto ${index + 1} von ${selectedProperty.title}`}
                    style={detailImageStyle}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ))}
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
              value={`${selectedProperty.purchasePrice.toFixed(2)} €`}
            />
            <DetailItem label="Eigenkapital" value={`${selectedProperty.equity.toFixed(2)} €`} />
            <DetailItem
              label="Mieteinnahmen / Monat"
              value={`${selectedProperty.rent.toFixed(2)} €`}
            />
            <DetailItem
              label="Monatliche Kosten"
              value={`${selectedProperty.expenses.toFixed(2)} €`}
            />
            <DetailItem
              label="Zinssatz p.a."
              value={`${selectedProperty.interestRate.toFixed(2)} %`}
            />
            <DetailItem label="Laufzeit" value={`${selectedProperty.loanYears.toFixed(0)} Jahre`} />
            <DetailItem
              label="Maklerprovision (%)"
              value={`${selectedProperty.brokerPercent.toFixed(2)} %`}
            />
            <DetailItem
              label="Sonstige Nebenkosten (%)"
              value={`${selectedProperty.otherCostsPercent.toFixed(2)} %`}
            />
            <DetailItem
              label="Maklerprovision (Betrag)"
              value={`${selectedProperty.brokerFee.toFixed(2)} €`}
            />
            <DetailItem
              label="Sonstige Kaufnebenkosten"
              value={`${selectedProperty.otherBuyingCosts.toFixed(2)} €`}
            />
            <DetailItem
              label="Gesamte Kaufnebenkosten"
              value={`${selectedProperty.totalPurchaseCosts.toFixed(2)} €`}
            />
            <DetailItem
              label="Gesamtinvestition (KP + Nebenkosten)"
              value={`${selectedProperty.totalInvestment.toFixed(2)} €`}
            />
            <DetailItem label="Kreditbetrag" value={`${selectedProperty.loanAmount.toFixed(2)} €`} />
            <DetailItem
              label="Monatliche Kreditrate"
              value={`${selectedProperty.monthlyLoanPayment.toFixed(2)} €`}
            />
            <DetailItem
              label="Monatlicher Cashflow"
              value={`${selectedProperty.monthlyCashflow.toFixed(2)} € / Monat`}
            />
            <DetailItem label="Bruttorendite" value={`${selectedProperty.grossYield.toFixed(2)} %`} />
            <DetailItem label="Eigenkapitalrendite" value={`${selectedProperty.equityReturn.toFixed(2)} %`} />
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

function PhotoField({ value, onChange }) {
  const urls = value
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter(Boolean);
  return (
    <div style={photoFieldContainerStyle}>
      <h3 style={photoFieldTitleStyle}>📸 Immobilie visuell festhalten</h3>
      <p style={helperTextStyle}>
        Füge Links zu Fotos deiner Immobilie hinzu (je Zeile oder durch Komma getrennt) – du findest
        kostenlose Bilder z.&nbsp;B.
        bei{" "}
        <a
          href="https://unsplash.com/s/photos/real-estate"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#60a5fa" }}
        >
          Unsplash
        </a>
        .
      </p>
      <label style={labelStyle} htmlFor="photoUrls">
        Bild-URLs (optional)
      </label>
      <textarea
        className="aim-input"
        id="photoUrls"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"https://example.com/foto-1.jpg\nhttps://example.com/foto-2.jpg"}
        style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
      />
      <PhotoPreview url={value} />
    </div>
  );
}

function PhotoPreview({ url }) {
  const urls = url
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter(Boolean);
  return (
    <div style={photoPreviewGridStyle}>
      {urls.length === 0 ? (
        <div style={photoPreviewPlaceholderStyle}>
          <span role="img" aria-label="Foto hinzufügen">
            🏙️
          </span>
          <span>Foto-Links einfügen, um hier eine Vorschau zu sehen</span>
        </div>
      ) : (
        urls.slice(0, 3).map((link, index) => (
          <div key={link + index} style={photoPreviewStyle}>
            <img
              src={link}
              alt={`Vorschau ${index + 1}`}
              style={photoPreviewImageStyle}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        ))
      )}
      {urls.length > 3 && (
        <div style={photoPreviewMoreBadgeStyle}>+{urls.length - 3} weitere</div>
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

function AnalyticsSection({ bestByEquity, bestByCashflow, analyticsData, propertiesCount }) {
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

function formatPropertyType(type) {
  switch (type) {
    case "wohnung":
      return "Wohnung";
    case "haus":
      return "Haus";
    case "sanierung":
      return "Sanierungsobjekt";
    case "gewerbe":
      return "Gewerbe";
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

function SettingsSection({ onExportJson }) {
  return (
    <section style={{ marginTop: "1.5rem" }}>
      <h2 style={sectionTitleStyle}>Einstellungen</h2>
      <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
        Hier kannst du globale Einstellungen für AIM Real Estate verwalten.
      </p>
      <ul style={{ color: "#4b5563", fontSize: "0.9rem", marginBottom: "1rem" }}>
        <li>Firmenname &amp; Branding von AIM Real Estate</li>
        <li>Standard-Zinssätze &amp; Annahmen</li>
        <li>Export / Import von Immobiliendaten</li>
        <li>Benutzer &amp; Rollen (wenn ihr größer werdet)</li>
      </ul>

      <div>
        <h3
          style={{
            fontSize: "0.95rem",
            marginBottom: "0.4rem",
            color: "#111827",
          }}
        >
          Daten-Export
        </h3>
        <button type="button" onClick={onExportJson} style={primaryButtonStyle}>
          Immobilien als Datei exportieren
        </button>
        <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.4rem" }}>
          Es wird eine <code>.json</code>-Datei mit allen gespeicherten Immobilien heruntergeladen. Diese
          kannst du später wieder importieren oder für Auswertungen / PDFs verwenden.
        </p>
      </div>
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

const portfolioStripStyle = {
  display: "grid",
  gridTemplateColumns: "var(--portfolio-grid-columns)",
  gap: "0.75rem",
  marginBottom: "1.25rem",
  padding: "var(--portfolio-padding)",
  borderRadius: "var(--portfolio-radius)",
  position: "relative",
  overflow: "hidden",
  background: "linear-gradient(130deg, #10172a, #1f3c78 55%, #5ec9ff 105%)",
  boxShadow: "0 22px 45px rgba(15, 23, 42, 0.5)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  color: "#f9fbff",
  isolation: "isolate",
};

const portfolioItemStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  minWidth: 0,
  position: "relative",
  paddingInline: "0.35rem",
  maxWidth: "100%",
};

const portfolioLabelStyle = {
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontWeight: 700,
  color: "rgba(248, 250, 252, 0.95)",
  whiteSpace: "normal",
  wordBreak: "break-word",
  lineHeight: 1.15,
};

const portfolioValueStyle = {
  fontSize: "1.25rem",
  fontWeight: 800,
  color: "#ffffff",
  textShadow: "0 7px 26px rgba(7, 10, 22, 0.7)",
};

const portfolioSubLabelStyle = {
  fontSize: "0.8rem",
  color: "rgba(239, 246, 255, 0.92)",
  opacity: 1,
  lineHeight: 1.2,
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
};

const detailImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
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
