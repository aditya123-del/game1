# Arena Blaster Online

## Run locally

```powershell
npm install
npm start
```

Open `http://localhost:3002`.

## Deploy to Render

1. Put this folder in a GitHub repository.
2. In Render, create a **New Blueprint** and select the repository.
3. Render reads `render.yaml`, installs dependencies, and creates a public game link.

The application automatically uses the host-provided `PORT` in production.