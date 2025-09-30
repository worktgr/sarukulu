# Sarukulu

Expo (React Native) app + Supabase schema.

## Repo Layout
- `sarukulu-app/` — Expo app source
- `supabase/` — SQL schema & seed files (for hosted Supabase)

## Prerequisites (new laptop)
- Git + SSH key set up with GitHub
- Node LTS (via nvm is recommended)
- npm (comes with Node)
- Expo Go app on your phone (for testing)
- Supabase project (get URL + Anon key from **Project Settings → API**)

## 60-Second Bootstrap (Windows)
```powershell
# 1) Clone
git clone git@github.com:worktgr/sarukulu.git
cd sarukulu

# 2) Create app .env from template (edit after)
copy sarukulu-app\.env.example sarukulu-app\.env
notepad sarukulu-app\.env   # fill EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY

# 3) Install deps and run the app
cd sarukulu-app
npm install
npx expo start
## Status (Oct 1, 2025)

- Expo SDK: 54
- Start (recommended): `npx expo start --tunnel -c`
- Env: copy `sarukulu-app/.env.example` → `sarukulu-app/.env` and fill `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Babel: using `babel-preset-expo` + `react-native-reanimated/plugin` (plugin must be last)
- Worklets mismatch fix: `npx expo install react-native-worklets@0.5.1` then restart with cache clear
- Notes: Expo Go on phone must match SDK 54; force-quit & reopen Expo Go after upgrades
