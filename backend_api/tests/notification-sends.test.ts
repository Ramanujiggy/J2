// Unit tests for the small mapping functions used by the notification_sends
// ledger pipeline. The real fireOne() flow is integration-shaped (DB +
// web-push + cron) and is exercised by the real-DB regression suite — these
// tests just lock down the pure transforms so a future webpush behaviour
// change doesn't silently miscategorise a send result.

import { describe, it, expect } from 'vitest';
import { classifySendResult, endpointHost } from '../src/lib/notificationScheduler.js';
import type { PushSendResult } from '../src/lib/webPushClient.js';

describe('classifySendResult', () => {
  it("maps ok=true -> 'sent'", () => {
    const r: PushSendResult = { ok: true, expired: false };
    expect(classifySendResult(r)).toBe('sent');
  });

  it("maps expired=true (410/404) -> 'gone'", () => {
    const r410: PushSendResult = { ok: false, expired: true, statusCode: 410, error: 'Gone' };
    const r404: PushSendResult = { ok: false, expired: true, statusCode: 404, error: 'Not Found' };
    expect(classifySendResult(r410)).toBe('gone');
    expect(classifySendResult(r404)).toBe('gone');
  });

  it("maps 'Web Push not configured' error -> 'no_vapid'", () => {
    const r: PushSendResult = { ok: false, expired: false, error: 'Web Push not configured.' };
    expect(classifySendResult(r)).toBe('no_vapid');
  });

  it("maps 5xx -> 'server_error'", () => {
    const r: PushSendResult = { ok: false, expired: false, statusCode: 503, error: 'unavailable' };
    expect(classifySendResult(r)).toBe('server_error');
  });

  it("maps other 4xx -> 'client_error'", () => {
    const r400: PushSendResult = { ok: false, expired: false, statusCode: 400, error: 'bad payload' };
    const r413: PushSendResult = { ok: false, expired: false, statusCode: 413, error: 'too large' };
    expect(classifySendResult(r400)).toBe('client_error');
    expect(classifySendResult(r413)).toBe('client_error');
  });

  it("falls back to 'client_error' when status code is missing and not no_vapid", () => {
    const r: PushSendResult = { ok: false, expired: false, error: 'something weird happened' };
    expect(classifySendResult(r)).toBe('client_error');
  });
});

describe('endpointHost', () => {
  it('extracts host from a valid push endpoint', () => {
    expect(endpointHost('https://fcm.googleapis.com/fcm/send/abc123')).toBe('fcm.googleapis.com');
    expect(endpointHost('https://web.push.apple.com/AAAA-BBBB-CCCC')).toBe('web.push.apple.com');
  });

  it('returns null for unparseable input rather than throwing', () => {
    expect(endpointHost('')).toBeNull();
    expect(endpointHost('not a url')).toBeNull();
  });
});
