# ScotSponsor (scotsponsor.co.uk)
**Verified Scottish Tier-2 & Skilled Worker Visa Job Broadcaster**

A production-ready React + TypeScript web application engineered to hit **£1,500 – £3,000+ monthly cash flow** by solving the acute visa sponsorship search problem for international university graduates in Scotland.

---

### Features Built In

1. **UKVI Home Office Register Verification:**
   - Real-time badge indicators: `Confirmed Sponsorship (Green)`, `General Sponsor (Yellow)`, and `Explicitly Blocked (Red)` for jobs containing *"Must have Right to Work"* clauses.
2. **2024–2026 Salary Rule Checker:**
   - Automatically checks jobs against the standard £38,700 threshold and the 70% discounted **New Entrant (~£30,960)** threshold for recent graduates.
3. **High-Converting 3-Tier Monetization Model:**
   - **Quarterly Job Hunt Pass (£24.99 one-off / 90 days):** The primary cash engine.
   - **Monthly Alert Pass (£9.99/mo recurring):** Low-barrier entry point.
   - **The Scottish Visa Switching Kit (£19.00 order bump):** 1-click high-margin upsell for instant downloadable scripts and sponsor spreadsheets.
4. **Interactive Audit Modal:**
   - Displays official Home Office license rating, mapped SOC codes, and legal route eligibility.
5. **Real-time Alert Engine Interface:**
   - Instant Telegram & WhatsApp webhook simulation to demonstrate 2-minute alert delivery.

---

### Quick Start in VS Code

1. Unzip `scotsponsor-react-app.zip` into your preferred project directory.
2. Open the folder in **Visual Studio Code**:
   ```bash
   code .
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the local Vite development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173` in your browser.

---

### Deployment to Vercel (scotsponsor.co.uk)

1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial ScotSponsor release"
   git branch -M main
   git remote add origin https://github.com/<your-username>/scotsponsor.git
   git push -u origin main
   ```
2. Import the project in [Vercel](https://vercel.com).
3. Connect your domain **`scotsponsor.co.uk`** in the Vercel Project Domains settings.
