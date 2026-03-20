import app, { runMigrations } from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Mat time is starting on http://localhost:${PORT}`);
    await runMigrations();
});
