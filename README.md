# AI React Website Template

A flexible, feature-rich React template designed for AI-generated websites with modern development tools and libraries.

## ✨ Key Features

- 🚀 **React 18 + TypeScript** - Modern development experience
- 🎨 **Tailwind CSS** - Utility-first CSS framework
- ⚡ **Vite** - Fast build tool
- 🌐 **i18next** - Complete internationalization solution
- 🎯 **Zustand** - Lightweight state management
- ✨ **Framer Motion** - Smooth animation effects
- 🎭 **Headless UI** - Accessible UI components
- 📦 **Lucide React** - Beautiful icon library
- 🛣️ **React Router** - Single-page application routing

## 🛠️ Tech Stack

### Core Technologies
- React 18.3.1 + TypeScript 5.8.3
- Vite 7.0.0 (Build tool)
- Tailwind CSS 3.4.17 (CSS framework)

### Feature Libraries
- React Router DOM 6.30.1 (Routing)
- Zustand 4.4.7 (State management)
- i18next + react-i18next (Internationalization)
- Framer Motion 11.0.8 (Animations)
- Headless UI 1.7.18 (UI components)
- Lucide React (Icon library)

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   Visit http://localhost:5173 to view the application

3. **Build for production**:
   ```bash
   npm run build
   ```

4. **Preview build**:
   ```bash
   npm run preview
   ```

## 📱 Download APK

[![Build Android APK](https://github.com/Vikram1311/shg-bank-app/actions/workflows/build-apk.yml/badge.svg)](https://github.com/Vikram1311/shg-bank-app/actions/workflows/build-apk.yml)

👉 **[📥 Download Latest APK](https://github.com/Vikram1311/shg-bank-app/releases/latest/download/app-debug.apk)** 👈

> Phone me install karne ke liye "Install from Unknown Sources" enable karein Settings mein.

---

## 📱 Build Android APK (Manual)

This app uses [Capacitor](https://capacitorjs.com/) to generate a native Android APK.

### Prerequisites

- **Java JDK 17+** – [Download](https://adoptium.net/)
- **Android Studio** – [Download](https://developer.android.com/studio) (or just the command-line tools)
- Set `ANDROID_HOME` environment variable to your Android SDK path

### Build Steps

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Build web app + sync + generate debug APK** (one command):
   ```bash
   npm run build:android
   ```

3. **Your APK will be at**:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Transfer to phone** and install. (Enable "Install from Unknown Sources" in Settings.)

### Other Useful Commands

| Command | Description |
|---------|-------------|
| `npm run cap:sync` | Sync web assets to Android project |
| `npm run cap:open` | Open in Android Studio |
| `npm run build:android` | Build debug APK |
| `npm run build:android:release` | Build release APK |

### Open in Android Studio

If you want to use Android Studio to build/debug:
```bash
npm run build
npm run cap:open
```
Then click **Run ▶️** in Android Studio.

## ☁️ Cloud Sync Setup (So Members Can See Data on Mobile)

By default, data is stored only in the browser's localStorage. This means data entered on one device (laptop) will NOT be visible on another device (mobile). To enable cloud sync:

### Step 1: Create a free Supabase project
1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click "New Project" and create a project

### Step 2: Create the database table
1. In your Supabase dashboard, go to **SQL Editor**
2. Copy and paste the contents of `supabase-setup.sql` from this repository
3. Click "Run"

### Step 3: Add environment variables
1. In your Supabase dashboard, go to **Settings → API**
2. Copy the **Project URL** and **anon/public key**
3. Create a `.env` file in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
4. If deploying to Vercel/Netlify, add these as environment variables in the deployment settings

### Step 4: Rebuild and deploy
```bash
npm run build
```

Now admin data will automatically sync to the cloud, and members opening the app on mobile will see the latest data.

---

## 📁 Project Structure

```
src/
├── api/             # API related code
├── assets/          # Static assets
├── components/      # Reusable components
├── layouts/         # Layout components  
├── pages/           # Page components
├── styles/          # Style files
├── types/           # TypeScript type definitions
├── App.tsx          # Main application component
└── main.tsx         # Application entry point
```

## More Information

For more detailed project structure, tech stack, configuration instructions and development guide, please refer to the [YOUWARE.md](./YOUWARE.md) file.