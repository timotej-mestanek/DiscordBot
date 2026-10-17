# Discord Bot - For dev

A simple Discord bot built with TypeScript.

This project is still in development and not finished yet.  
It currently includes a basic roulette game feature.

---

## 🛠️ Tech Stack

- Node.js
- TypeScript
- Discord.js

---

## 📦 Installation

Clone the repository:
```bash
git clone https://github.com/timotej-mestanek/DiscordBot
```
Navigate to the project folder:
```bash
cd repo
``` 
## ⚙️ Configuration
Create `bot/.env` for the bot credentials:
```bash 
DISCORD_BOT_TOKEN = <token>
```
Install all dependencies 
```bash
pnpm install 
``` 
For local development, `pnpm dev` loads `bot/.env.dev` over `bot/.env`.
The development file points `DATABASE_URL` to the local Postgres service and
`WEB_BASE_URL` to `http://localhost:3000`; provide the bot credentials and
channel settings in `bot/.env`. Start Postgres from the repository root with
`docker compose -f docker-compose.db.yml up -d`.
## 🚀 Running the bot
Running the bot via tsx
```bash
tsx bot.ts
```
# Discord bot - for usage

Clone repository 
```bash
git clone https://github.com/timotej-mestanek/DiscordBot
```
Build and start the bot using Docker compose 
```bash
docker compose up --build
```
To stop the bot 
```bash
docker compose down
```
