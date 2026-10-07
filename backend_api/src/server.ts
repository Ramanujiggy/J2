import app, { runMigrations } from './app.js';
import { startNotificationScheduler } from './lib/notificationScheduler.js';
import { startTranscodeWorker } from './workers/transcodeWorker.js';
import { buildRouteManifest } from './lib/routeManifest.js';

const PORT = process.env.PORT || 5000;

// Migrations run to completion BEFORE the port opens. Running them inside the
// app.listen callback left every deploy with a window where live traffic hit
// the old schema. runMigrations() exits the process on failure, so reaching
// the line after it means the schema is current.
await runMigrations();

app.listen(PORT, () => {
    console.log(`Mat time is starting on http://localhost:${PORT}`);
    buildRouteManifest(app as unknown as { _router?: { stack: unknown[] } });
    // Start the in-process cron tick that fans out class-time notifications.
    // No-ops cleanly if VAPID env vars aren't set.
    startNotificationScheduler();
    // Move Library v2 (mig 028): polling worker that runs ffmpeg on uploaded
    // raw clips and produces H.264/AAC MP4s for cross-browser playback. Boot
    // is async (probes ffmpeg + logs version) but doesn't block app.listen.
    void startTranscodeWorker();
});
