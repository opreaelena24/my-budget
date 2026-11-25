# My Budget – personal budget planner

A mobile-first budget planner I built for myself to track my wages, bills and everyday spending. It works on iPhone as a home-screen app and is deployed on Netlify.

**Live demo:** _add your Netlify link here_

## Features

- **Monthly overview:** income, bills, spending and how much money is left this month
- **Weekly, fortnightly or monthly pay:** add your wage once and every payday in the month is counted automatically
- **Bills with reminders:** recurring or one-off bills, ticked off when paid, flagged when due soon or overdue
- **Calendar reminders:** one tap creates a recurring event in the phone's calendar, with an alert the day before and on the due date (`.ics` file with `RRULE` and `VALARM`)
- **Budget categories:** set a monthly budget (e.g. Food £250), log payments and see what is left, with warnings at 80% and when over budget
- **Quick-add bar:** `+ Wage`, `+ Bill` and `+ Payment` always within thumb reach
- **Month navigation:** separate paid/received status for each month and each payday
- **Backup:** export and restore all data as a JSON file
- **Installable (PWA):** web app manifest and icons, so it can be added to the iPhone home screen

## Tech

- HTML, CSS and vanilla JavaScript (no frameworks)
- `localStorage` for data persistence
- Date logic for weekly / fortnightly / monthly schedules, including months with fewer days
- `Intl` API for GBP currency and UK date formatting
- Responsive, accessible UI: 44px touch targets, visible focus states, reduced-motion support, light and dark mode
- Hosted on Netlify with continuous deployment from GitHub

## How to install on iPhone

1. Open the Netlify link in **Safari**
2. Tap **Share → Add to Home Screen**

## Roadmap

- [ ] Sync across devices with Supabase (auth + PostgreSQL)
- [ ] Spending charts by category
- [ ] Push notifications for bills

## About

Built by Elena Oprea with AI-assisted development (Claude).
