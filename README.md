# HealthVerse AI – Personalized Wellness Platform

HealthVerse AI is a premium, highly interactive web application designed to act as an AI-powered fitness and nutrition assistant. It computes personalized wellness targets (BMI, BMR, TDEE, Calorie targets, and Macronutrients split), generates custom goal-specific workout plans, and simulates a computer-vision based AI meal nutrition scanner with healthy swap recommendations.

This app is structured as a high-performance, single-page client application (HTML5, CSS3, vanilla JavaScript) that works directly in the browser and persists state across reloads via `localStorage`. It is fully responsive and optimized for both desktop and mobile layouts.

---

## Key Features

1. **AI Profile Setup Onboarding Wizard**: A step-by-step animated wizard that tracks user name, age, biological gender, physical dimensions, activity status, and target goals to dynamically calculate metabolic figures:
   - **BMR (Mifflin-St Jeor)**
   - **TDEE (Daily Energy Expenditure)**
   - **Daily Calorie & Macronutrients Split Target** (Protein, Carbs, Fats)
2. **Dashboard Widgets**: 
   - Circular calorie consumption visual rings.
   - Macronutrient progress bars (Protein, Carbs, Fats).
   - Quick-action buttons to scan food, trigger exercises, or log body weights.
3. **AI Workout Generator**: Generates customized multi-day schedules based on your goals:
   - **Lose Body Fat**: Cardiovascular conditioning, high-density circuits, and HIIT.
   - **Build Muscle**: Strength routines split across push, pull, and leg structures.
   - **Active Lifestyle**: Steady heart health, mobility movements, and flexibility yoga.
   - **Endurance & Speed**: Running base, stamina intervals, and plyometrics.
4. **Interactive Workout Mode**: Launches a full-screen workout interface with a live stopwatch, exercise checklists, and congrats celebration banners.
5. **AI Meal Scanner & Tracker**:
   - Drag & drop picture files or click preset food buttons.
   - Visual scanner animation showing scanning progress status overlays.
   - Computes macros, calculates overall Health Score (A, B, C, or D), and lists healthier swaps.
6. **Progress Analytics & Journals**:
   - Weight history line graphs (glowing gradients).
   - Weekly Calorie intake bar charts compared with daily target lines.
   - Complete logged journal history.

---

## Local Setup & Development

The codebase is self-contained. Since it is a pure static web app, no compilers or package installations are required.

### Option 1: Double-Click
Simply double-click `index.html` on your computer to launch the application immediately in your web browser.

### Option 2: Local Dev Server (Recommended)
To run with hot-reload or view files on local network devices, you can run a simple static file server.

**Using python:**
```bash
python -m http.server 8000
```
Then visit: `http://localhost:8000`

**Using Node.js (`npx`):**
```bash
npx serve .
```
Then visit: `http://localhost:3000` or the port displayed on screen.

---

## Git Operations (Upload to GitHub/GitLab)

To upload the project to your version control host:

1. **Verify Git Initialization**:
   Ensure you are in the root directory and initialize the repository (completed locally):
   ```bash
   git init
   ```
2. **Add Files and Commit**:
   ```bash
   git add .
   git commit -m "feat: initial release of HealthVerse AI Personalized Wellness Platform"
   ```
3. **Link Remote Repository and Push**:
   Create an empty repository on GitHub/GitLab, copy the URL, and execute:
   ```bash
   git remote add origin https://github.com/yourusername/healthverse-ai.git
   git branch -M main
   git push -u origin main
   ```

---

## Vercel Deployment

Deploying static projects to Vercel is extremely fast and can be done via their CLI or Git integration.

### Method 1: Vercel Dashboard (Connected to GitHub)
1. Push your code to GitHub (see Git steps above).
2. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
3. Click **Add New** > **Project**.
4. Import your repository, choose default configuration (it detects HTML/CSS/JS static structure automatically), and click **Deploy**.

### Method 2: Vercel CLI (Command Line)
To deploy directly from your command line:

1. Install the Vercel CLI tool if not already done:
   ```bash
   npm install -g vercel
   ```
2. Run the deployment command inside the project directory:
   ```bash
   vercel
   ```
3. Follow the CLI login prompts (press Enter for default suggestions).
4. For production deployment, execute:
   ```bash
   vercel --prod
   ```

---

## Technologies Employed

- **Structure**: Semantic HTML5 markup
- **Styling**: Modern CSS3 (Custom properties, grid, flexbox, glassmorphic filters, keyframes)
- **Logics**: Vanilla ES6+ Javascript
- **Data Rendering**: [Chart.js](https://www.chartjs.org/) via CDN
- **Aesthetic Iconography**: [Lucide Icons](https://lucide.dev/) client library
- **Routing & State**: Browser `hashchange` routing and `localStorage` API
