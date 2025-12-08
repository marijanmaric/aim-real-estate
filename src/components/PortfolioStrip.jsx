const PortfolioStrip = ({
  propertiesCount,
  totalCashflow,
  avgGrossYield,
  avgEquityReturn,
}) => {
  return (
    <div style={stripStyle}>
      <div style={stripColumnStyle}>
        <span style={labelStyle}>Immobilien im Portfolio</span>
        <div style={valueStyle}>{propertiesCount}</div>
        <span style={subLabelStyle}>
          {propertiesCount === 1 ? "gespeicherter Deal" : "gespeicherte Deals"}
        </span>
        <div style={inlineMetricStyle}>
          <span style={inlineLabelStyle}>Ø EK-Rendite</span>
          <span style={inlineValueStyle}>
            {propertiesCount === 0 ? "—" : `${avgEquityReturn.toFixed(2)} %`}
          </span>
          <span style={inlineHintStyle}>basierend auf allen Deals</span>
        </div>
      </div>
      <div style={stripColumnStyle}>
        <span style={labelStyle}>Gesamt-Cashflow / Monat</span>
        <div
          style={{
            ...valueStyle,
            color: totalCashflow >= 0 ? "#22c55e" : "#f97373",
          }}
        >
          {totalCashflow.toFixed(2)} €
        </div>
        <span style={subLabelStyle}>
          {totalCashflow >= 0 ? "Positiver Cashflow" : "Negativer Cashflow"}
        </span>
      </div>
      <div style={stripColumnStyle}>
        <span style={labelStyle}>Ø Bruttorendite</span>
        <div style={valueStyle}>
          {propertiesCount === 0 ? "—" : `${avgGrossYield.toFixed(2)} %`}
        </div>
        <span style={subLabelStyle}>inkl. Nebenkosten</span>
      </div>
    </div>
  );
};

export default PortfolioStrip;

const stripStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
  padding: "1.25rem 2rem",
  borderRadius: "36px",
  background: "linear-gradient(130deg, #10172a, #1f3c78 50%, #5ec9ff 105%)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  color: "#f8fafc",
  marginBottom: "1.5rem",
};

const stripColumnStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const labelStyle = {
  fontSize: "0.78rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 600,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const valueStyle = {
  fontSize: "1.3rem",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const subLabelStyle = {
  fontSize: "0.85rem",
  color: "rgba(248, 250, 252, 0.8)",
};

const inlineMetricStyle = {
  marginTop: "0.2rem",
  paddingTop: "0.4rem",
  borderTop: "1px solid rgba(248, 250, 252, 0.2)",
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
};

const inlineLabelStyle = {
  fontSize: "0.7rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(248, 250, 252, 0.7)",
};

const inlineValueStyle = {
  fontSize: "1rem",
  fontWeight: 600,
};

const inlineHintStyle = {
  fontSize: "0.75rem",
  color: "rgba(248, 250, 252, 0.7)",
};
