# SHG Bank - स्वयं सहायता समूह बैंक

## Project Overview
A comprehensive Self Help Group (SHG) Banking application with Admin and Member panels, built with React + TypeScript + Vite + Tailwind CSS. Features loan management, contribution tracking, penalty/interest calculations, and multi-language support.

## Key Features
- **Admin Panel**: Dashboard, member management, loan management, contribution tracking, bulk entries, CSV export, messaging, settings
- **Member Panel**: Personal dashboard, loan application with calculator, contribution history, profile management
- **Loan System**: 2% declining interest, 1-6 EMI, max ₹15,000, eligibility check (50% of previous loan must be paid)
- **Penalty System**: ₹10/day after 11th of each month for late contributions and EMI payments
- **Share Distribution**: Interest and penalty earnings distributed proportionally to member contributions
- **Multi-language**: Hindi (default), English, Tamil (for Ravi Arumugam)
- **QR Code**: UPI payment QR code (9315341037@ybl) displayed on member pages
- **26 Members**: 25 members + 1 admin, pre-populated with correct details

## Login Credentials
- **Admin**: Mobile: 9315341037, Password: 1311
- **Members**: Mobile number as login, last 4 digits of mobile as default password

## Tech Stack
- React 18.3 + TypeScript 5.8 + Vite 7
- Tailwind CSS 3.4
- Zustand (state management with localStorage persistence)
- i18next (multi-language)
- qrcode.react (QR code generation)
- Lucide React (icons)

## Data Persistence
All data is stored in browser localStorage under key `shg-bank-storage`. Data persists across sessions.

## Development Commands
- `npm install` - Install dependencies
- `npm run build` - Production build
- `npm run dev` - Development server

## Important Business Rules
- Interest/penalty shares only apply from member's joining date
- New loan only after 50% of previous loan is paid
- History available from 10 September 2025 for existing members
- NANDINI joining: 10 February 2026, RUPESH joining: 10 January 2026
- Admin does not need to make monthly contributions but gets a share for efforts
