# Mentor AI

Mentor AI is a small full-stack tutoring chat app with:

- `backend/` for the Express server and Gemini API integration
- `frontend/` for the browser UI
- a backend-only Gemini API key in `backend/.env`

## Project Structure

```text
mentor-ai/
├── backend/
│   ├── server.js
│   ├── geminiService.js
│   ├── middleware.js
│   ├── config.js
│   ├── .env
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── config.js
│       ├── api.js
│       ├── ui.js
│       ├── chat.js
│       └── app.js
├── .gitignore
└── README.md
```

## Setup

1. Open `backend/.env` and set your real Gemini key:

```env
GEMINI_API_KEY=AIza_replace_with_your_real_key
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Start the server:

```bash
npm run dev
```

4. Open `http://localhost:3000`

## Gemini Endpoint

The backend uses this template and injects the key from `.env`:

```text
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=API_KEY__
```

## Notes

- The webpage never asks the user for an API key.
- The frontend only calls `POST /api/chat`.
- Static frontend files are served by Express from `frontend/`.
