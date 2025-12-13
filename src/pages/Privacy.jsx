export default function Privacy() {
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16, lineHeight: 1.6 }}>
      <h1>Datenschutzerklärung</h1>

      <h2>1. Verantwortlicher</h2>
      <p>
        Marijan Maric<br />
        Wien, Österreich<br />
        E-Mail: bogdale7@gmail.com
      </p>

      <h2>2. Welche Daten wir verarbeiten</h2>
      <ul>
        <li>Login-/Account-Daten (z.B. E-Mail)</li>
        <li>Inhalteingaben (Immobilien-Parameter)</li>
        <li>Fotos/Uploads</li>
      </ul>

      <h2>3. Zweck</h2>
      <p>
        Betrieb der App, Login, Speichern deiner Eingaben und Uploads.
      </p>

      <h2>4. Dienstleister</h2>
      <p>
        Hosting: Vercel<br />
        Backend/Auth: Supabase
      </p>

      <h2>5. Kontakt</h2>
      <p>Dbogdale7@gmail.com</p>

      <p><em>Stand: {new Date().toLocaleDateString()}</em></p>
    </div>
  );
}
