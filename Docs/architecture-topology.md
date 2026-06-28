# Architecture Topology

```mermaid
graph LR
    Browser["Browser (PWA)"]
    Vercel["Vercel CDN"]
    Railway["Railway API"]
    Postgres["PostgreSQL (Neon)"]
    R2["Cloudflare R2"]

    Browser -->|"HTTPS"| Vercel
    Browser -->|"API calls"| Railway
    Vercel -->|"Static assets"| Browser
    Railway -->|"SQL"| Postgres
    Railway -->|"Video upload/stream"| R2

    subgraph Frontend
        Vercel
    end

    subgraph Backend
        Railway
        Postgres
        R2
    end
```

## Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Frontend | Vercel | React SPA, static hosting |
| API | Railway | Express server, auth, business logic |
| Database | Neon PostgreSQL | User data, sessions, intentions, tags |
| Object Storage | Cloudflare R2 | Technique video clips |
| Transcoding | Railway (in-process) | ffmpeg worker for video encoding |
| Push Notifications | Web Push (VAPID) | Class-time reminders |
