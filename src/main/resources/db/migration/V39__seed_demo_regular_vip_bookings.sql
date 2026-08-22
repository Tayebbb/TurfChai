-- V39: Seed repeat bookings for demo owner to populate Regular and VIP customer tiers
DO $$
DECLARE
    v_owner_id BIGINT;
    v_venue_id BIGINT;
    v_pitch_id BIGINT;
    v_rafi_id BIGINT;
    v_user2_id BIGINT;
    v_user3_id BIGINT;
    v_slot_id BIGINT;
    i INT;
    d DATE;
BEGIN
    -- Look up demo owner & demo player
    SELECT id INTO v_owner_id FROM users WHERE email = 'mahmud@turfchai.com' LIMIT 1;
    SELECT id INTO v_rafi_id FROM users WHERE email = 'rafi@turfchai.com' LIMIT 1;

    -- Pick 2 other player users
    SELECT id INTO v_user2_id FROM users WHERE role IN ('PLAYER', 'SOLO_PLAYER') AND id <> v_rafi_id ORDER BY id ASC LIMIT 1;
    SELECT id INTO v_user3_id FROM users WHERE role IN ('PLAYER', 'SOLO_PLAYER') AND id NOT IN (v_rafi_id, COALESCE(v_user2_id, -1)) ORDER BY id ASC LIMIT 1;

    IF v_owner_id IS NOT NULL AND v_rafi_id IS NOT NULL THEN
        -- Find primary venue & pitch
        SELECT id INTO v_venue_id FROM venues WHERE owner_user_id = v_owner_id ORDER BY id ASC LIMIT 1;
        IF v_venue_id IS NOT NULL THEN
            SELECT id INTO v_pitch_id FROM pitches WHERE venue_id = v_venue_id ORDER BY id ASC LIMIT 1;
            
            IF v_pitch_id IS NOT NULL THEN
                -- 1. Seed 11 completed visits for Rafi (VIP)
                FOR i IN 1..11 LOOP
                    d := CURRENT_DATE - (i * 7); -- Weekly matches over past 11 weeks
                    IF NOT EXISTS (SELECT 1 FROM slots WHERE pitch_id = v_pitch_id AND slot_date = d AND start_time = '18:00:00') THEN
                        INSERT INTO slots (venue_id, pitch_id, slot_date, start_time, end_time, price, status, source)
                        VALUES (v_venue_id, v_pitch_id, d, '18:00:00', '19:30:00', 2500, 'BOOKED', 'ONLINE')
                        RETURNING id INTO v_slot_id;

                        INSERT INTO bookings (booking_code, slot_id, booker_user_id, venue_id, pitch_id, booking_date, start_time, end_time, gross_amount, net_amount, status, source, created_at, updated_at)
                        VALUES (
                            'BK-VIP-' || LPAD(i::text, 4, '0'),
                            v_slot_id,
                            v_rafi_id,
                            v_venue_id,
                            v_pitch_id,
                            d,
                            '18:00:00',
                            '19:30:00',
                            2500,
                            2250,
                            'CONFIRMED',
                            'ONLINE',
                            d::timestamp,
                            d::timestamp
                        )
                        ON CONFLICT (booking_code) DO NOTHING;
                    END IF;
                END LOOP;

                -- 2. Seed 6 completed visits for Player 2 (Regular)
                IF v_user2_id IS NOT NULL THEN
                    FOR i IN 1..6 LOOP
                        d := CURRENT_DATE - (i * 10);
                        IF NOT EXISTS (SELECT 1 FROM slots WHERE pitch_id = v_pitch_id AND slot_date = d AND start_time = '20:00:00') THEN
                            INSERT INTO slots (venue_id, pitch_id, slot_date, start_time, end_time, price, status, source)
                            VALUES (v_venue_id, v_pitch_id, d, '20:00:00', '21:30:00', 2500, 'BOOKED', 'ONLINE')
                            RETURNING id INTO v_slot_id;

                            INSERT INTO bookings (booking_code, slot_id, booker_user_id, venue_id, pitch_id, booking_date, start_time, end_time, gross_amount, net_amount, status, source, created_at, updated_at)
                            VALUES (
                                'BK-REG-' || LPAD(i::text, 4, '0'),
                                v_slot_id,
                                v_user2_id,
                                v_venue_id,
                                v_pitch_id,
                                d,
                                '20:00:00',
                                '21:30:00',
                                2500,
                                2250,
                                'CONFIRMED',
                                'ONLINE',
                                d::timestamp,
                                d::timestamp
                            )
                            ON CONFLICT (booking_code) DO NOTHING;
                        END IF;
                    END LOOP;
                END IF;

                -- 3. Seed 4 completed visits for Player 3 (Regular)
                IF v_user3_id IS NOT NULL THEN
                    FOR i IN 1..4 LOOP
                        d := CURRENT_DATE - (i * 12);
                        IF NOT EXISTS (SELECT 1 FROM slots WHERE pitch_id = v_pitch_id AND slot_date = d AND start_time = '16:00:00') THEN
                            INSERT INTO slots (venue_id, pitch_id, slot_date, start_time, end_time, price, status, source)
                            VALUES (v_venue_id, v_pitch_id, d, '16:00:00', '17:30:00', 2000, 'BOOKED', 'ONLINE')
                            RETURNING id INTO v_slot_id;

                            INSERT INTO bookings (booking_code, slot_id, booker_user_id, venue_id, pitch_id, booking_date, start_time, end_time, gross_amount, net_amount, status, source, created_at, updated_at)
                            VALUES (
                                'BK-REG2-' || LPAD(i::text, 4, '0'),
                                v_slot_id,
                                v_user3_id,
                                v_venue_id,
                                v_pitch_id,
                                d,
                                '16:00:00',
                                '17:30:00',
                                2000,
                                1800,
                                'CONFIRMED',
                                'ONLINE',
                                d::timestamp,
                                d::timestamp
                            )
                            ON CONFLICT (booking_code) DO NOTHING;
                        END IF;
                    END LOOP;
                END IF;

            END IF;
        END IF;
    END IF;
END $$;
