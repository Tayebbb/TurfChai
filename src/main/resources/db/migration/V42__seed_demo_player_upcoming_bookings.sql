-- V42: Seed upcoming 7-day bookings for demo player (rafi@turfchai.com)
DO $$
DECLARE
    v_rafi_id BIGINT;
    v_venue_id BIGINT;
    v_pitch_id BIGINT;
    v_slot_id BIGINT;
    i INT;
    d DATE;
    v_start TIME;
    v_end TIME;
    v_price NUMERIC(10,2);
    v_code VARCHAR(32);
BEGIN
    -- Look up demo player
    SELECT id INTO v_rafi_id FROM users WHERE email IN ('rafi@turfchai.com', 'rafi@turfchai.dev') ORDER BY id ASC LIMIT 1;

    IF v_rafi_id IS NOT NULL THEN
        FOR i IN 0..7 LOOP
            d := CURRENT_DATE + i;

            -- Different time slots throughout the week
            CASE (i % 4)
                WHEN 0 THEN
                    v_start := '20:30:00';
                    v_end := '22:00:00';
                    v_price := 2500;
                WHEN 1 THEN
                    v_start := '19:00:00';
                    v_end := '20:30:00';
                    v_price := 2500;
                WHEN 2 THEN
                    v_start := '20:00:00';
                    v_end := '21:30:00';
                    v_price := 2500;
                ELSE
                    v_start := '17:30:00';
                    v_end := '19:00:00';
                    v_price := 2000;
            END CASE;

            -- Cycle through distinct active pitches / venues
            SELECT p.venue_id, p.id INTO v_venue_id, v_pitch_id
            FROM pitches p
            JOIN venues v ON p.venue_id = v.id
            WHERE p.is_active = true
            ORDER BY ((p.id + i) % 7) ASC, p.id ASC
            LIMIT 1;

            IF v_pitch_id IS NOT NULL AND v_venue_id IS NOT NULL THEN
                -- Check if slot exists or insert
                SELECT id INTO v_slot_id FROM slots WHERE pitch_id = v_pitch_id AND slot_date = d AND start_time = v_start LIMIT 1;
                IF v_slot_id IS NULL THEN
                    INSERT INTO slots (venue_id, pitch_id, slot_date, start_time, end_time, price, status)
                    VALUES (v_venue_id, v_pitch_id, d, v_start, v_end, v_price, 'BOOKED')
                    RETURNING id INTO v_slot_id;
                ELSE
                    UPDATE slots SET status = 'BOOKED', held_by_user_id = NULL, hold_expires_at = NULL WHERE id = v_slot_id;
                END IF;

                -- Ensure demo player has booking for this slot
                v_code := 'TC-UPC-' || TO_CHAR(d, 'MMDD') || '-' || LPAD(i::text, 2, '0');

                IF NOT EXISTS (SELECT 1 FROM bookings WHERE slot_id = v_slot_id AND status <> 'CANCELLED') THEN
                    INSERT INTO bookings (
                        booking_code, slot_id, booker_user_id, venue_id, pitch_id,
                        booking_date, start_time, end_time, gross_amount, net_amount,
                        status, source, created_at, updated_at
                    )
                    VALUES (
                        v_code, v_slot_id, v_rafi_id, v_venue_id, v_pitch_id,
                        d, v_start, v_end, v_price, v_price * 0.9,
                        'CONFIRMED', 'ONLINE', NOW(), NOW()
                    )
                    ON CONFLICT (booking_code) DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;
