import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  canGetDirections,
  openDirections,
  canCall,
  callNumber,
  buildIcs,
  toCsv,
  shareOrCopy,
} from './deviceActions';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deviceActions', () => {
  it('refuses directions when the venue has neither coordinates nor a name', () => {
    expect(canGetDirections(null)).toBe(false);
    expect(canGetDirections({})).toBe(false);
    expect(canGetDirections({ lat: 23.7, lng: 90.4 })).toBe(true);
    expect(canGetDirections({ name: 'Kick Off Arena' })).toBe(true);
  });

  it('prefers coordinates over an ambiguous address when opening a map', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    expect(openDirections({ lat: 23.75, lng: 90.38, address: 'Road 5' })).toBe(true);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=23.75%2C90.38',
    );
  });

  it('does not open anything when there is nothing to navigate to', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    expect(openDirections({})).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('only dials strings that contain digits', () => {
    expect(canCall(undefined)).toBe(false);
    expect(canCall('not a phone')).toBe(false);
    expect(canCall('+880 1713 442210')).toBe(true);
    expect(callNumber('n/a')).toBe(false);
  });

  it('builds a calendar entry with a real start and end', () => {
    const ics = buildIcs({
      title: 'Booking, confirmed',
      date: '2026-08-20',
      startTime: '18:00:00',
      endTime: '19:30:00',
      location: 'Kick Off Arena',
      uid: 'BK-1',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('UID:BK-1');
    // The comma in the title must be escaped, or the file is invalid.
    expect(ics).toContain('SUMMARY:Booking\\, confirmed');
    expect(ics.match(/DTSTART:/g)).toHaveLength(1);
    expect(ics.match(/DTEND:/g)).toHaveLength(1);
  });

  it('returns null rather than an invalid calendar file when the date is missing', () => {
    expect(buildIcs({ title: 'x', startTime: '18:00:00' })).toBeNull();
    expect(buildIcs({ title: 'x', date: 'not-a-date', startTime: '18:00:00' })).toBeNull();
  });

  it('quotes CSV cells that contain commas, quotes or newlines', () => {
    const csv = toCsv(
      ['Venue', 'Note'],
      [
        ['Kick Off Arena', 'Great turf, well kept'],
        ['Say "hi"', 'line1\nline2'],
        [null, undefined],
      ],
    );

    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Venue,Note');
    expect(lines[1]).toBe('Kick Off Arena,"Great turf, well kept"');
    // A newline inside a cell stays inside the quotes — it must not split the row.
    expect(lines[2]).toBe('"Say ""hi""","line1\nline2"');
    expect(lines[3]).toBe(',');
    expect(lines).toHaveLength(4);
  });

  it('reports which of share or copy actually happened', async () => {
    const originalShare = navigator.share;
    // No share sheet available: it must fall back to the clipboard and say so.
    delete navigator.share;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await expect(shareOrCopy({ url: 'https://turfchai.test/v/arena' })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://turfchai.test/v/arena');

    writeText.mockRejectedValueOnce(new Error('denied'));
    await expect(shareOrCopy({ url: 'https://turfchai.test/v/arena' })).resolves.toBe('failed');

    if (originalShare) navigator.share = originalShare;
  });
});
