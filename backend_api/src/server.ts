import app, { runMigrations } from './app.js';
import { startNotificationScheduler } from './lib/notificationScheduler.js';
import { startTranscodeWorker } from './workers/transcodeWorker.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Mat time is starting on http://localhost:${PORT}`);
    await runMigrations();
    // Start the in-process cron tick that fans out class-time notifications.
    // No-ops cleanly if VAPID env vars aren't set.
    startNotificationScheduler();
    // Move Library v2 (mig 028): polling worker that runs ffmpeg on uploaded
    // raw clips and produces H.264/AAC MP4s for cross-browser playback. Boot
    // is async (probes ffmpeg + logs version) but doesn't block app.listen.
    void startTranscodeWorker();
});
