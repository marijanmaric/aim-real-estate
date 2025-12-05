import { useState } from "react";
import "./App.css";
import aimLogo from "./assets/aim-logo.svg";


const STORAGE_KEY = "brickplan-properties-v1";

function App() {
  // Eingabefelder
  const [title, setTitle] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [equity, setEquity] = useState("");
  const [rent, setRent] = useState("");
  const [expenses, setExpenses] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [loanYears, setLoanYears] = useState("");
  const [brokerPercent, setBrokerPercent] = useState("3"); // Maklerprovision in %
  const [otherCostsPercent, setOtherCostsPercent] = useState("4.5"); // sonstige Nebenkosten in %
  const [propertyType, setPropertyType] = useState("wohnung");      // wohnung, haus, sanierung, gewerbe
  const [strategy, setStrategy] = useState("buy_and_hold");         // buy_and_hold, flip, eigennutzung

  // Liste aller Immobilien – beim ersten Render aus localStorage laden
  const [properties, setProperties] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Ergebnisse der aktuellen Berechnung
  const [results, setResults] = useState(null);

  // Ausgewählte Immobilie für Detailansicht
  const [selectedProperty, setSelectedProperty] = useState(null);

  // Aktiver Tab
  const [activeTab, setActiveTab] = useState("overview");

  function handleCalculate() {
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
      monthlyLoanPayment =
        (loanAmount * monthlyInterest * pow) / (pow - 1);
    } else if (loanAmount > 0 && monthlyInterest === 0 && totalMonths > 0) {
      monthlyLoanPayment = loanAmount / totalMonths;
    }

    // 🔹 Kaufnebenkosten
    const brokerFee = (p * brokerP) / 100;
    const otherBuyingCosts = (p * otherP) / 100;
    const totalPurchaseCosts = brokerFee + otherBuyingCosts;
    const totalInvestment = p + totalPurchaseCosts;

    const monthlyCashflow = r - ex - monthlyLoanPayment;
    const yearlyRent = r * 12;

    // Bruttorendite jetzt auf Gesamtinvestition bezogen (KP + Nebenkosten)
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
  }

  function handleAddToList() {
    if (!results) {
      alert("Bitte zuerst auf „Berechnen“ klicken.");
      return;
    }
    if (!title.trim()) {
      alert("Bitte gib einen Namen für die Immobilie ein.");
      return;
    }

      const newProperty = {
      id: Date.now(),
      title: title.trim(),
      propertyType,            // neu
      strategy,                // neu
      purchasePrice: Number(purchasePrice) || 0,
      equity: Number(equity) || 0,
      rent: Number(rent) || 0,
      expenses: Number(expenses) || 0,
      interestRate: Number(interestRate) || 0,
      loanYears: Number(loanYears) || 0,
      brokerPercent: Number(brokerPercent) || 0,
      otherCostsPercent: Number(otherCostsPercent) || 0,
      ...results,
    };


    setProperties((prev) => {
      const updated = [...prev, newProperty];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function handleDelete(id) {
    setProperties((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    if (selectedProperty && selectedProperty.id === id) {
      setSelectedProperty(null);
    }
  }

  function handleClearAll() {
    const sure = window.confirm(
      "Wirklich alle gespeicherten Immobilien löschen?"
    );
    if (!sure) return;
    setProperties([]);
    setSelectedProperty(null);
    localStorage.removeItem(STORAGE_KEY);
  }

    function handleExportJson() {
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
  }


  // Gesamtübersicht
  const totalCashflow = properties.reduce(
    (sum, p) => sum + p.monthlyCashflow,
    0
  );
  const avgGrossYield =
    properties.length > 0
      ? properties.reduce((sum, p) => sum + p.grossYield, 0) /
        properties.length
      : 0;
  const avgEquityReturn =
    properties.length > 0
      ? properties.reduce((sum, p) => sum + p.equityReturn, 0) /
        properties.length
      : 0;
        const propertiesCount = properties.length;


  // Beste Immobilien für Analysen
  const bestByEquity =
    properties.length > 0
      ? properties.reduce(
          (best, p) =>
            !best || p.equityReturn > best.equityReturn ? p : best,
          null
        )
      : null;

  const bestByCashflow =
    properties.length > 0
      ? properties.reduce(
          (best, p) =>
            !best || p.monthlyCashflow > best.monthlyCashflow ? p : best,
          null
        )
      : null;

  return (
    <div style={pageStyle}>
      <div style={cardStyle} className="app-root-card">
        <BrandBar />
        {/* Navigation */}
        <nav style={navStyle}>
          <button
            style={
              activeTab === "overview"
                ? navButtonActiveStyle
                : navButtonStyle
            }
            onClick={() => setActiveTab("overview")}
          >
            Dashboard
          </button>
          <button
            style={
              activeTab === "properties"
                ? navButtonActiveStyle
                : navButtonStyle
            }
            onClick={() => setActiveTab("properties")}
          >
            Immobilien
          </button>
          <button
            style={
              activeTab === "analytics"
                ? navButtonActiveStyle
                : navButtonStyle
            }
            onClick={() => setActiveTab("analytics")}
          >
            Analysen
          </button>
          <button
            style={
              activeTab === "settings"
                ? navButtonActiveStyle
                : navButtonStyle
            }
            onClick={() => setActiveTab("settings")}
          >
            Einstellungen
          </button>
        </nav>
          {/* Portfolio-Leiste */}
        <PortfolioStrip
          propertiesCount={propertiesCount}
          totalCashflow={totalCashflow}
          avgGrossYield={avgGrossYield}
          avgEquityReturn={avgEquityReturn}
        />
        {/* Header */}
        <header style={headerStyle}>
          {/* Linke Seite: Logo + Titel */}
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


          {/* Rechte Seite */}
          <div style={headerRightStyle}>
            <div style={{ textAlign: "right", marginRight: "0.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Firma</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                AIM Real Estate
              </div>
            </div>
            <span style={badgeStyle}>MVP · v0.5</span>
            <button onClick={handleClearAll} style={linkButtonStyle}>
              Alles löschen
            </button>
          </div>
        </header>

        {/* Inhalte je nach Tab */}

        {/* Dashboard: alles */}
        {activeTab === "overview" && (
          <>
            <OverviewSection
              properties={properties}
              totalCashflow={totalCashflow}
              avgGrossYield={avgGrossYield}
              avgEquityReturn={avgEquityReturn}
            />
            <MainAndList
              title={title}
              setTitle={setTitle}
              purchasePrice={purchasePrice}
              setPurchasePrice={setPurchasePrice}
              equity={equity}
              setEquity={setEquity}
              rent={rent}
              setRent={setRent}
              expenses={expenses}
              setExpenses={setExpenses}
              interestRate={interestRate}
              setInterestRate={setInterestRate}
              loanYears={loanYears}
              setLoanYears={setLoanYears}
              brokerPercent={brokerPercent}
              setBrokerPercent={setBrokerPercent}
              otherCostsPercent={otherCostsPercent}
              setOtherCostsPercent={setOtherCostsPercent}
              handleCalculate={handleCalculate}
              handleAddToList={handleAddToList}
              results={results}
              properties={properties}
              handleDelete={handleDelete}
              selectedProperty={selectedProperty}
              setSelectedProperty={setSelectedProperty}
              propertyType={propertyType}
              setPropertyType={setPropertyType}
              strategy={strategy}
              setStrategy={setStrategy}

            />
          </>
        )}

        {/* Immobilien: nur Formular + Liste */}
        {activeTab === "properties" && (
          <MainAndList
            title={title}
            setTitle={setTitle}
            purchasePrice={purchasePrice}
            setPurchasePrice={setPurchasePrice}
            equity={equity}
            setEquity={setEquity}
            rent={rent}
            setRent={setRent}
            expenses={expenses}
            setExpenses={setExpenses}
            interestRate={interestRate}
            setInterestRate={setInterestRate}
            loanYears={loanYears}
            setLoanYears={setLoanYears}
            brokerPercent={brokerPercent}
            setBrokerPercent={setBrokerPercent}
            otherCostsPercent={otherCostsPercent}
            setOtherCostsPercent={setOtherCostsPercent}
            handleCalculate={handleCalculate}
            handleAddToList={handleAddToList}
            results={results}
            properties={properties}
            handleDelete={handleDelete}
            selectedProperty={selectedProperty}
            setSelectedProperty={setSelectedProperty}
              propertyType={propertyType}
              setPropertyType={setPropertyType}
              strategy={strategy}
              setStrategy={setStrategy}

          />

        )}

        {/* Analysen */}
        {activeTab === "analytics" && (
          <AnalyticsSection
            properties={properties}
            bestByEquity={bestByEquity}
            bestByCashflow={bestByCashflow}
          />
        )}

                {/* Einstellungen */}
        {activeTab === "settings" && (
          <SettingsSection onExportJson={handleExportJson} />
        )}

      </div>
    </div>
  );
}

/* ====== Unterkomponenten ====== */

function OverviewSection({
  properties,
  totalCashflow,
  avgGrossYield,
  avgEquityReturn,
}) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={sectionTitleStyle}>Gesamtübersicht</h2>
      <div style={summaryGridStyle}>
        <SummaryCard
          label="Anzahl Immobilien"
          value={properties.length.toString()}
        />
        <SummaryCard
          label="Gesamt-Cashflow / Monat"
          value={`${totalCashflow.toFixed(2)} €`}
          highlight={
            properties.length === 0
              ? "neutral"
              : totalCashflow >= 0
              ? "green"
              : "red"
          }
        />
        <SummaryCard
          label="Ø Bruttorendite"
          value={
            properties.length === 0
              ? "—"
              : `${avgGrossYield.toFixed(2)} %`
          }
        />
        <SummaryCard
          label="Ø EK-Rendite"
          value={
            properties.length === 0
              ? "—"
              : `${avgEquityReturn.toFixed(2)} %`
          }
        />
      </div>
    </section>
  );
}
function PortfolioStrip({
  propertiesCount,
  totalCashflow,
  avgGrossYield,
  avgEquityReturn,
}) {
  return (
    <div style={portfolioStripStyle}>
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
            color:
              totalCashflow >= 0 ? "#22c55e" : "#f97373",
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
          {propertiesCount === 0
            ? "—"
            : `${avgEquityReturn.toFixed(2)} %`}
        </div>
        <div style={portfolioSubLabelStyle}>Basierend auf allen Deals</div>
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


function MainAndList(props) {
  const {
    title,
    setTitle,
    purchasePrice,
    setPurchasePrice,
    equity,
    setEquity,
    rent,
    setRent,
    expenses,
    setExpenses,
    interestRate,
    setInterestRate,
    loanYears,
    setLoanYears,
    brokerPercent,
    setBrokerPercent,
    otherCostsPercent,
    setOtherCostsPercent,
    handleCalculate,
    handleAddToList,
    results,
    properties,
    handleDelete,
    selectedProperty,
    setSelectedProperty,
    propertyType,
    setPropertyType,
    strategy,
    setStrategy,

  } = props;

  return (
    <>
      {/* Hauptbereich: Formular + Ergebnisse */}
      <div style={mainGridStyle}>
        {/* Formular */}
        <section style={formCardStyle}>
          <h2 style={sectionTitleStyle}>Immobilie anlegen</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Name der Immobilie</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Wohnung Ottakring 72m²"
                style={inputStyle}
              />
            </div>
                        <div>
              <label style={labelStyle}>Immobilienart</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                style={inputStyle}
              >
                <option value="wohnung">Wohnung</option>
                <option value="haus">Haus</option>
                <option value="sanierung">Sanierungsobjekt</option>
                <option value="gewerbe">Gewerbe</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Strategie</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                style={inputStyle}
              >
                <option value="buy_and_hold">Buy &amp; Hold</option>
                <option value="flip">Fix &amp; Flip</option>
                <option value="eigennutzung">Eigennutzung</option>
              </select>
            </div>

            <Field
              label="Kaufpreis (€)"
              placeholder="z.B. 250000"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
            <Field
              label="Eigenkapital (€)"
              placeholder="z.B. 50000"
              value={equity}
              onChange={(e) => setEquity(e.target.value)}
            />
            <Field
              label="Mieteinnahmen pro Monat (€)"
              placeholder="z.B. 900"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
            />
            <Field
              label="Monatliche Kosten (€)"
              placeholder="z.B. 350"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
            />
            <Field
              label="Zinssatz p.a. (%)"
              placeholder="z.B. 4"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
            />
            <Field
              label="Laufzeit (Jahre)"
              placeholder="z.B. 30"
              value={loanYears}
              onChange={(e) => setLoanYears(e.target.value)}
            />

            <Field
              label="Maklerprovision (%)"
              placeholder="z.B. 3"
              value={brokerPercent}
              onChange={(e) => setBrokerPercent(e.target.value)}
            />
            <Field
              label="Sonstige Kaufnebenkosten (%)"
              placeholder="z.B. 4.5"
              value={otherCostsPercent}
              onChange={(e) => setOtherCostsPercent(e.target.value)}
            />

            <div style={buttonRowStyle}>
              <button style={primaryButtonStyle} onClick={handleCalculate}>
                Berechnen
              </button>
              <button
                style={secondaryButtonStyle}
                type="button"
                onClick={handleAddToList}
              >
                Zur Liste hinzufügen
              </button>
            </div>
          </div>
        </section>

        {/* Ergebnisse */}
        <section style={resultsCardStyle}>
          <h2 style={sectionTitleStyle}>Ergebnisse (aktuelle Immobilie)</h2>
          {results ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <ResultRow
                label="Kreditbetrag"
                value={`${results.loanAmount.toFixed(2)} €`}
              />
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
              <ResultRow
                label="Maklerprovision"
                value={`${results.brokerFee.toFixed(2)} €`}
              />
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
                Hinweis: Nebenkosten werden als Prozent vom Kaufpreis
                berechnet (Makler + sonstige Kosten).
              </small>
            </div>
          ) : (
            <p style={{ color: "#9ca3af" }}>
              Trage links deine Daten ein und klicke auf{" "}
              <strong>„Berechnen“</strong>, um Kennzahlen zu sehen.
            </p>
          )}
        </section>
      </div>

      {/* Immobilien-Liste */}
      <section style={{ marginTop: "2.5rem" }}>
        <h2 style={sectionTitleStyle}>Immobilien-Liste</h2>

        {properties.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>
            Noch keine Immobilien in der Liste. Berechne eine Immobilie und
            klicke auf <strong>„Zur Liste hinzufügen“</strong>.
          </p>
        ) : (
          <div style={tableWrapperStyle}>
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
                {properties.map((prop) => (
                  <tr
                    key={prop.id}
                    style={{ ...tableBodyRowStyle, cursor: "pointer" }}
                    onClick={() => setSelectedProperty(prop)}
                  >
                    <Td>{prop.title}</Td>
                    <Td
                      style={{
                        color:
                          prop.monthlyCashflow >= 0 ? "#166534" : "#991b1b",
                        fontWeight: 500,
                      }}
                    >
                      {prop.monthlyCashflow.toFixed(2)} €
                    </Td>
                    <Td>{prop.grossYield.toFixed(2)} %</Td>
                    <Td>{prop.equityReturn.toFixed(2)} %</Td>
                    <Td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(prop.id);
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

      {/* Detailbereich unter der Liste */}
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <DetailItem
              label="Immobilienart"
              value={formatPropertyType(selectedProperty.propertyType)}
            />
            <DetailItem
              label="Strategie"
              value={formatStrategy(selectedProperty.strategy)}
            />

            <DetailItem
              label="Kaufpreis"
              value={`${selectedProperty.purchasePrice.toFixed(2)} €`}
            />
            <DetailItem
              label="Eigenkapital"
              value={`${selectedProperty.equity.toFixed(2)} €`}
            />
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
            <DetailItem
              label="Laufzeit"
              value={`${selectedProperty.loanYears.toFixed(0)} Jahre`}
            />
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
            <DetailItem
              label="Kreditbetrag"
              value={`${selectedProperty.loanAmount.toFixed(2)} €`}
            />
            <DetailItem
              label="Monatliche Kreditrate"
              value={`${selectedProperty.monthlyLoanPayment.toFixed(2)} €`}
            />
            <DetailItem
              label="Monatlicher Cashflow"
              value={`${selectedProperty.monthlyCashflow.toFixed(2)} € / Monat`}
            />
            <DetailItem
              label="Bruttorendite"
              value={`${selectedProperty.grossYield.toFixed(2)} %`}
            />
            <DetailItem
              label="Eigenkapitalrendite"
              value={`${selectedProperty.equityReturn.toFixed(2)} %`}
            />

          </div>

          <button
            type="button"
            onClick={() => setSelectedProperty(null)}
            style={{ ...secondaryButtonStyle, marginTop: "1rem" }}
          >
            Details schließen
          </button>
        </section>
      )}
    </>
  );
}

function AnalyticsSection({ properties, bestByEquity, bestByCashflow }) {
  if (properties.length === 0) {
    return (
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={sectionTitleStyle}>Analysen</h2>
        <p style={{ color: "#9ca3af" }}>
          Noch keine Daten. Lege zuerst ein paar Immobilien an, um Analysen zu
          sehen.
        </p>
      </section>
    );
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

  return (
    <section style={{ marginTop: "1.5rem" }}>
      <h2 style={sectionTitleStyle}>Analysen</h2>

      {/* Top-Karten */}
      <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {bestByEquity && (
          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>
              Beste Immobilie nach Eigenkapitalrendite
            </span>
            <span style={summaryValueStyle}>
              {bestByEquity.title} – {bestByEquity.equityReturn.toFixed(2)} %
            </span>
          </div>
        )}
        {bestByCashflow && (
          <div style={summaryCardStyle}>
            <span style={summaryLabelStyle}>
              Beste Immobilie nach Cashflow
            </span>
            <span style={summaryValueStyle}>
              {bestByCashflow.title} –{" "}
              {bestByCashflow.monthlyCashflow.toFixed(2)} € / Monat
            </span>
          </div>
        )}
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Anzahl analysierter Immobilien</span>
          <span style={summaryValueStyle}>{properties.length}</span>
        </div>
      </div>

      {/* Ranking-Tabelle */}
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
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.2rem",
                      }}
                    >
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
                            background:
                              "linear-gradient(90deg, #22c55e, #16a34a)",
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

      {/* Cashflow-"Chart" */}
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
              ? Math.max(
                  6,
                  (Math.abs(prop.monthlyCashflow) / maxAbsCashflow) * 100
                )
              : 0;
          const isPositive = prop.monthlyCashflow >= 0;

          return (
            <div
              key={prop.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
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


function SettingsSection({ onExportJson }) {
  return (
    <section style={{ marginTop: "1.5rem" }}>
      <h2 style={sectionTitleStyle}>Einstellungen</h2>
      <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
        Hier kannst du globale Einstellungen für AIM Real Estate verwalten.
      </p>
      <ul style={{ color: "#4b5563", fontSize: "0.9rem", marginBottom: "1rem" }}>
        <li>Firmenname & Branding von AIM Real Estate</li>
        <li>Standard-Zinssätze & Annahmen</li>
        <li>Export / Import von Immobiliendaten</li>
        <li>Benutzer & Rollen (wenn ihr größer werdet)</li>
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
        <button
          type="button"
          onClick={onExportJson}
          style={primaryButtonStyle}
        >
          Immobilien als Datei exportieren
        </button>
        <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.4rem" }}>
          Es wird eine <code>.json</code>-Datei mit allen gespeicherten
          Immobilien heruntergeladen. Diese kannst du später wieder importieren
          oder für Auswertungen / PDFs verwenden.
        </p>
      </div>
    </section>
  );
}

/* ====== Kleinere UI-Komponenten ====== */

function Field({ label, placeholder, value, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={onChange}
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
    <div style={resultRowStyle}>
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

/* ====== Styles ====== */

const pageStyle = {
  minHeight: "100vh",
  margin: 0,
  padding: "2rem",
  background: "var(--aim-bg)",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
};
const portfolioStripStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "0.75rem",
  marginBottom: "1.25rem",
  padding: "0.85rem 1rem",
  borderRadius: "999px",
  background:
    "linear-gradient(120deg, rgba(37,99,235,0.15), rgba(8,47,73,0.9))",
  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.55)",
  border: "1px solid rgba(148, 163, 184, 0.5)",
};

const portfolioItemStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
  minWidth: 0,
};

const portfolioLabelStyle = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  color: "#cbd5f5",
};

const portfolioValueStyle = {
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "#f9fafb",
};

const portfolioSubLabelStyle = {
  fontSize: "0.8rem",
  color: "#e5e7eb",
  opacity: 0.9,
};


const cardStyle = {
  width: "100%",
  maxWidth: "1100px",
  backgroundColor: "var(--aim-bg-card)",
  color: "var(--aim-text)",
  borderRadius: "18px",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.35)",
  padding: "2rem 2.5rem",
};

const navStyle = {
  display: "inline-flex",
  gap: "0.4rem",
  marginBottom: "0.9rem",
  padding: "0.25rem",
  borderRadius: "999px",
  backgroundColor: "rgba(15,23,42,0.06)",
  border: "1px solid rgba(148,163,184,0.6)",
  flexWrap: "wrap",
};

const navButtonStyle = {
  padding: "0.35rem 0.95rem",
  borderRadius: "999px",
  border: "none",
  backgroundColor: "transparent",
  color: "#9ca3af",
  fontSize: "0.82rem",
  cursor: "pointer",
  fontWeight: 500,
};

const navButtonActiveStyle = {
  ...navButtonStyle,
  background:
    "linear-gradient(135deg, rgba(37,99,235,0.9), rgba(129,140,248,0.95))",
  color: "#f9fafb",
};

const headerStyle = {
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: "1rem",
  marginBottom: "1.5rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
};

const logoStyle = {
  width: 44,
  height: 44,
  borderRadius: "999px",
  background:
    "radial-gradient(circle at 30% 30%, #93c5fd, #2563eb 45%, #1e3a8a 80%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ffffff",
  fontWeight: 800,
  fontSize: "0.9rem",
  letterSpacing: "0.09em",
  boxShadow: "0 12px 26px rgba(15, 23, 42, 0.65)",
  border: "1px solid rgba(148, 163, 184, 0.7)",
};

const titleStyle = {
  fontSize: "1.8rem",
  margin: 0,
  fontWeight: 800,
  backgroundImage:
    "linear-gradient(120deg, #eff6ff, #60a5fa, #1d4ed8)",
  WebkitBackgroundClip: "text",
  color: "transparent",
};


const subtitleStyle = {
  margin: "0.25rem 0 0",
  color: "#e5e7eb",
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
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
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
  color: "#111827",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.75rem",
};

const summaryCardStyle = {
  padding: "0.9rem 1rem",
  borderRadius: "12px",
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const summaryLabelStyle = {
  fontSize: "0.8rem",
  color: "#6b7280",
};

const summaryValueStyle = {
  fontSize: "1rem",
  fontWeight: 600,
  color: "#111827",
};

const mainGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
  gap: "2rem",
  alignItems: "flex-start",
};

const formCardStyle = {
  padding: "1.5rem",
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  backgroundColor: "#f9fafb",
};

const resultsCardStyle = {
  padding: "1.5rem",
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  backgroundColor: "#ffffff",
};

const labelStyle = {
  display: "block",
  marginBottom: "0.25rem",
  fontSize: "0.85rem",
  color: "#4b5563",
};

const inputStyle = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: "10px",
  border: "1px solid var(--aim-input-border)",
  backgroundColor: "var(--aim-input-bg)",
  fontSize: "0.95rem",
  outline: "none",
  boxSizing: "border-box",
  color: "var(--aim-text)",
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
  background:
    "linear-gradient(120deg, rgba(15,23,42,0.9), rgba(37,99,235,0.7))",
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

const footerStyle = {
  marginTop: "1.25rem",
  textAlign: "center",
  fontSize: "0.8rem",
  color: "#9ca3af",
};

const footerTextStyle = {
  opacity: 0.9,
};


const primaryButtonStyle = {
  padding: "0.6rem 0.9rem",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "white",
  fontSize: "0.9rem",
  fontWeight: 500,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "0.6rem 0.9rem",
  borderRadius: "999px",
  border: "1px solid #d1d5db",
  backgroundColor: "white",
  color: "#374151",
  fontSize: "0.9rem",
  fontWeight: 500,
  cursor: "pointer",
};

const resultRowStyle = {
  padding: "0.75rem 0.9rem",
  borderRadius: "10px",
  backgroundColor: "#f9fafb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
};

const resultLabelStyle = {
  fontSize: "0.9rem",
  color: "#4b5563",
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
  border: "1px solid #e5e7eb",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.9rem",
};

const tableHeadRowStyle = {
  backgroundColor: "#f3f4f6",
  textAlign: "left",
};

const tableBodyRowStyle = {
  borderTop: "1px solid #e5e7eb",
};

const thStyle = {
  padding: "0.6rem 0.75rem",
  fontWeight: 600,
  fontSize: "0.8rem",
  color: "#4b5563",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "0.55rem 0.75rem",
  color: "#374151",
  verticalAlign: "middle",
};

const smallLinkButtonStyle = {
  border: "none",
  background: "none",
  color: "#9ca3af",
  cursor: "pointer",
  fontSize: "0.8rem",
  textDecoration: "underline",
};

export default App;
