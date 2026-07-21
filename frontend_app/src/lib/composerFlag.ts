// Rollback lever for the Capture Composer (spec §5). Default ON; set
// localStorage.j2_composer = 'off' in devtools to restore LogSessionForm
// as the capture target everywhere. Delete the key to re-enable.
export function composerEnabled(): boolean {
  try { return localStorage.getItem('j2_composer') !== 'off'; } catch { return true; }
}
