# Karnataka State Police (KSP) — Crime Intelligence Portal

An advanced, premium analytics dashboard and dossier management platform built for the Karnataka State Police (KSP) to track, profile, map, and analyze state crime trends, heinous offences, and suspect records. The portal is integrated directly with the Zoho Catalyst Serverless Cloud platform, incorporating real-time Datastore queries, file storage, and serverless functions.

---

##  Key Features

### 1. Unified Crime Intelligence Dashboard
* **Real-time KPI Metrics**: High-level visual summaries tracking total FIRs, heinous crime share, active investigations, charge-sheeted clearances, and custody arrests.
* **Interactive Cartogram Map**: Visualized density cartogram representing case frequencies across key districts (Bengaluru, Mysuru, Davanagere, Hubballi-Dharwad, Chikkamagaluru, Kodagu, Mangaluru, etc.) with hotspot alert zones.
* **Actionable Analytical Widgets**: Dynamic graphs for crime categories, historical trends, and district distributions.

### 2. Digital Dossier & Case File Repository
* **Multi-Parameter Search & Filter**: Fully filterable search explorer matching status, heinous severity, and target jurisdictions.
* **Granular Case Dossiers**: Fully detailed view containing:
  * **Master Case Particulars & Narrative Briefs**: Facts of the crime and incident timelines.
  * **Complainant Statements**: Social details (religion, caste, occupation) and statements.
  * **Victim Profiling**: Age, gender, injury details, and police personnel involvement.
  * **Suspect Registry**: Digital mugshots, investigating officers, and court jurisdictions.
  * **Legal Acts & Sections**: BNS, IPC, IT Act, and NDPS mappings.
  * **Chargesheet Records**: Automatically generated Chargesheet Filing Records linked dynamically to `ChargesheetDetails` tables.
* **Printable FIR Copies**: Official PDF-aligned print templates featuring professional KSP layouts, QR code tags, and official signature blocks.

### 3. Advanced Tactical Analytics
* **Hotspot Analysis**: Spatial cartogram views showing density points of high-risk sectors.
* **Sociological Profiling**: Breakdown of demographic crime indicators (age groups, gender splits, occupational associations).
* **Predictive AI Engine**: Algorithmic forecasting of crime risks by date, hour, and location category.
* **Network Analysis**: Criminal association networks mapping repeat offenders, suspect clusters, and crime rings.

---

## 🛠️ Technology Stack

* **Frontend**: React, TypeScript, Vite, TanStack Router, Lucide React Icons
* **Backend**: Node.js Serverless Advanced I/O functions
* **Database & Cloud Storage**: Zoho Catalyst Datastore, Zoho Catalyst File Store (Bucket storage for suspect mugshots and officer signatures)
* **Build System & Package Manager**: npm / Bun

---

##  Setup and Installation Instructions

### Prerequisites
* **Node.js** (v18.0.0 or higher) or **Bun** (v1.0 or higher)
* **Catalyst CLI**: Install using `npm install -g zcatalyst-cli`

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Athreyasp/KSP-Crime-Intelligence.git
   cd KSP-Crime-Intelligence
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   # or using bun:
   bun install
   ```

3. **Install Serverless API Dependencies**
   ```bash
   cd functions/api
   npm install
   # or:
   bun install
   cd ../..
   ```

4. **Initialize Zoho Catalyst Project Context**
   Configure your Catalyst project environment:
   ```bash
   catalyst login
   catalyst pull
   ```

---

## 🏃 Execution Instructions

### Running Locally
To launch the client environment locally (with mock data/local server configurations):
```bash
npm run dev
# or:
bun run dev
```
Open your browser and navigate to `http://localhost:5173`.

### Deploying to Zoho Catalyst Cloud
To bundle the compiled web client asset builds and serverless advanced I/O handlers and deploy them directly to your active Zoho Catalyst production domain:
```bash
catalyst deploy
```
Upon successful completion, the CLI will output your live public Access URL.

---

## 🗄️ Database Table Schema Structure
This platform relies on a normalized relational layout inside the **Zoho Catalyst Datastore** utilizing tables such as:
* `CaseMaster`: The core case details, incident times, location coordinates, and brief facts.
* `ChargesheetDetails`: Links `CaseMasterID` to filing dates, status types, and official Chargesheet IDs.
* `Accused`: Store suspect profiling records, age, and identifiers.
* `ArrestSurrender`: Contains arrest times, jurisdictions, and booking statuses.
* `Victim`: Victim age, sex, and Injury Status records.
* `ComplainantDetails`: Socio-demographic markers of complainants.
* `ActSectionAssociation`: Tracks legal codes (BNS, IPC, IT Act) associated with each incident file.
