import app, { runMigrations } from './app.js';
import { startNotificationScheduler } from './lib/notificationScheduler.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Mat time is starting on http://localhost:${PORT}`);
    await runMigrations();
    // Start the in-process cron tick that fans out class-time notifications.
    // No-ops cleanly if VAPID env vars aren't set.
    startNotificationScheduler();
});
