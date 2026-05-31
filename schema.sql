-- =============================================================================
-- HillingOne — PostgreSQL Schema
-- =============================================================================
-- Tested against PostgreSQL 16+
--
-- Quick start:
--   psql -U postgres -c "CREATE DATABASE hillingdon_booking;"
--   psql -U postgres -d hillingdon_booking -f schema.sql
--
-- The time_slots block uses generate_series(CURRENT_DATE, ...) so slots are
-- always 30 days into the future from the moment the file is run — the schema
-- never goes stale.
-- =============================================================================

SET client_encoding        = 'UTF8';
SET standard_conforming_strings = on;

BEGIN;

-- =============================================================================
-- 1. CLEAN SLATE  (safe to re-run — drops everything in FK-safe order)
-- =============================================================================

DROP VIEW  IF EXISTS facility_stats    CASCADE;
DROP VIEW  IF EXISTS booking_dashboard CASCADE;
DROP VIEW  IF EXISTS available_slots   CASCADE;
DROP TABLE IF EXISTS bookings          CASCADE;
DROP TABLE IF EXISTS time_slots        CASCADE;
DROP TABLE IF EXISTS facilities        CASCADE;
DROP TABLE IF EXISTS users             CASCADE;
DROP TABLE IF EXISTS categories        CASCADE;


-- =============================================================================
-- 2. TABLES
-- =============================================================================

CREATE TABLE categories (
    id          SERIAL       PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    icon        VARCHAR(10)  DEFAULT '📁'
);

CREATE TABLE users (
    id          SERIAL       PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    email       VARCHAR(200) NOT NULL UNIQUE,
    phone       VARCHAR(20),
    role        VARCHAR(20)  DEFAULT 'resident'
                CONSTRAINT users_role_check CHECK (role IN ('resident','staff','admin')),
    department  VARCHAR(100),
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE facilities (
    id            SERIAL       PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    category_id   INTEGER      REFERENCES categories(id),
    location      VARCHAR(300),
    address       VARCHAR(300),
    capacity      INTEGER,
    hourly_rate   NUMERIC(8,2) DEFAULT 0.00,
    description   TEXT,
    amenities     TEXT[],
    accessibility BOOLEAN      DEFAULT TRUE,
    parking       BOOLEAN      DEFAULT FALSE,
    is_active     BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE time_slots (
    id            SERIAL    PRIMARY KEY,
    facility_id   INTEGER   REFERENCES facilities(id),
    slot_date     DATE      NOT NULL,
    start_time    TIME      NOT NULL,
    end_time      TIME      NOT NULL,
    is_available  BOOLEAN   DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
    id            SERIAL      PRIMARY KEY,
    reference     VARCHAR(20) NOT NULL UNIQUE,
    user_id       INTEGER     REFERENCES users(id),
    facility_id   INTEGER     REFERENCES facilities(id),
    time_slot_id  INTEGER     REFERENCES time_slots(id),
    status        VARCHAR(20) DEFAULT 'confirmed'
                  CONSTRAINT bookings_status_check
                  CHECK (status IN ('pending','confirmed','cancelled','completed')),
    notes         TEXT,
    ai_suggested  BOOLEAN     DEFAULT FALSE,
    ai_confidence NUMERIC(5,2),
    created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- 3. INDEXES
-- =============================================================================

CREATE INDEX idx_facilities_category  ON facilities(category_id);
CREATE INDEX idx_facilities_location  ON facilities(location);
CREATE INDEX idx_time_slots_facility  ON time_slots(facility_id, slot_date);
CREATE INDEX idx_time_slots_available ON time_slots(is_available) WHERE is_available = TRUE;
CREATE INDEX idx_bookings_user        ON bookings(user_id);
CREATE INDEX idx_bookings_facility    ON bookings(facility_id);
CREATE INDEX idx_bookings_status      ON bookings(status);


-- =============================================================================
-- 4. VIEWS
-- =============================================================================

-- All currently available slots with full facility and category detail
CREATE VIEW available_slots AS
SELECT
    ts.id           AS slot_id,
    ts.slot_date,
    ts.start_time,
    ts.end_time,
    f.id            AS facility_id,
    f.name          AS facility_name,
    f.location,
    f.address,
    f.capacity,
    f.hourly_rate,
    f.amenities,
    f.accessibility,
    f.parking,
    c.id            AS category_id,
    c.name          AS category,
    c.icon          AS category_icon
FROM  time_slots ts
JOIN  facilities f  ON f.id = ts.facility_id
JOIN  categories c  ON c.id = f.category_id
WHERE ts.is_available = TRUE
  AND ts.slot_date   >= CURRENT_DATE
  AND f.is_active     = TRUE;

-- Staff dashboard: every booking with full denormalised context
CREATE VIEW booking_dashboard AS
SELECT
    b.id            AS booking_id,
    b.reference,
    b.status,
    b.notes,
    b.ai_suggested,
    b.ai_confidence,
    b.created_at,
    u.id            AS user_id,
    u.name          AS user_name,
    u.email         AS user_email,
    u.role          AS user_role,
    f.id            AS facility_id,
    f.name          AS facility_name,
    f.location      AS facility_location,
    c.name          AS category,
    ts.slot_date,
    ts.start_time,
    ts.end_time
FROM  bookings   b
JOIN  users      u  ON u.id  = b.user_id
JOIN  facilities f  ON f.id  = b.facility_id
JOIN  categories c  ON c.id  = f.category_id
JOIN  time_slots ts ON ts.id = b.time_slot_id
ORDER BY b.created_at DESC;

-- Utilisation analytics: booked vs available slots per facility
CREATE VIEW facility_stats AS
SELECT
    f.id                                                       AS facility_id,
    f.name                                                     AS facility_name,
    f.location,
    c.name                                                     AS category,
    COUNT(ts.id)                                               AS total_slots,
    COUNT(ts.id) FILTER (WHERE ts.is_available = FALSE)        AS booked_slots,
    COUNT(ts.id) FILTER (WHERE ts.is_available = TRUE)         AS available_slots,
    ROUND(
        100.0 * COUNT(ts.id) FILTER (WHERE ts.is_available = FALSE)
        / NULLIF(COUNT(ts.id), 0),
    1)                                                         AS utilisation_pct
FROM  facilities f
JOIN  categories  c  ON c.id          = f.category_id
LEFT JOIN time_slots ts ON ts.facility_id = f.id
WHERE f.is_active = TRUE
GROUP BY f.id, f.name, f.location, c.name
ORDER BY utilisation_pct DESC NULLS LAST;


-- =============================================================================
-- 5. SEED DATA — categories (10 rows)
-- =============================================================================

INSERT INTO categories (id, name, description, icon) VALUES
(1,  'Community Halls',        'Halls and function rooms available for hire',         '🏛️'),
(2,  'Sports Facilities',      'Sports pitches, courts, gyms and leisure centres',    '⚽'),
(3,  'Meeting Rooms',          'Council meeting rooms for staff and public use',       '🪑'),
(4,  'Parks & Open Spaces',    'Bookable park areas and outdoor event spaces',         '🌳'),
(5,  'Equipment Hire',         'Projectors, PA systems, marquees',                     '🎤'),
(6,  'Registry Services',      'Birth, death, marriage registration',                  '📋'),
(7,  'Housing Services',       'Repair appointments, housing consultations',            '🏠'),
(8,  'Benefits & Council Tax', 'Benefits and council tax appointments',                '💷'),
(9,  'Library Services',       'Study rooms, computer access, event spaces',           '📚'),
(10, 'Youth & Children',       'Youth centres, children activity rooms',               '👶');


-- =============================================================================
-- 6. SEED DATA — facilities (50 rows, 5 per category)
-- =============================================================================

INSERT INTO facilities (id, name, category_id, location, address, capacity, hourly_rate, description, amenities, accessibility, parking, is_active) VALUES

-- Community Halls (category 1)
(1,  'Winston Churchill Hall',          1, 'Ruislip',            '1 Pinn Way, Ruislip, HA4 7QL',              200, 45.00, 'Large community hall for events, weddings and meetings.',         ARRAY['WiFi','Kitchen','Stage','PA System'],    TRUE,  TRUE,  TRUE),
(2,  'Yiewsley Community Centre',       1, 'West Drayton',       '12 Harmondsworth Rd, UB7 9LQ',              120, 35.00, 'Versatile community space with breakout rooms.',                  ARRAY['WiFi','Kitchen','Toilets'],              TRUE,  TRUE,  TRUE),
(3,  'Hayes Community Hall',            1, 'Hayes',              '44 Station Rd, Hayes, UB3 4DD',             150, 40.00, 'Central hall with excellent transport links.',                    ARRAY['WiFi','Kitchen','Projector'],            TRUE,  FALSE, TRUE),
(4,  'Northwood Hills Community Centre',1, 'Northwood Hills',    '7 Joel St, HA6 1NZ',                         80, 30.00, 'Ideal for classes, workshops and small gatherings.',              ARRAY['WiFi','Kitchen'],                        TRUE,  TRUE,  TRUE),
(5,  'Barnhill Community Centre',       1, 'Hayes',              '25 Barnhill Lane, UB4 9EE',                 100, 32.00, 'Multi-purpose facility serving the Barnhill estate.',             ARRAY['WiFi','Kitchen','Garden'],               TRUE,  TRUE,  TRUE),

-- Sports Facilities (category 2)
(6,  'Hillingdon Sports & Leisure',     2, 'Uxbridge',           'Gatting Way, UB8 1ES',                      500, 60.00, 'Premier leisure centre with pool, gym and pitches.',              ARRAY['Pool','Gym','Sports Hall','Cafe'],        TRUE,  TRUE,  TRUE),
(7,  'Queensmead Sports Centre',        2, 'South Ruislip',      '55 Victoria Rd, HA4 0EG',                   200, 45.00, 'Football pitches, tennis courts and fitness suite.',              ARRAY['Football Pitches','Tennis Courts','Gym'], TRUE,  TRUE,  TRUE),
(8,  'Botwell Green Sports Centre',     2, 'Hayes',              'East Ave, UB3 2HW',                         300, 50.00, 'Modern sports centre with pool and gym.',                         ARRAY['Pool','Gym','MUGA'],                      TRUE,  TRUE,  TRUE),
(9,  'William Byrd Pool',               2, 'Harefield',          'Park Lane, UB9 6BJ',                        100, 30.00, 'Community swimming pool in Harefield.',                           ARRAY['Pool','Changing Rooms'],                  TRUE,  TRUE,  TRUE),
(10, 'Highgrove Pool & Fitness',        2, 'Ruislip',            'Eastcote Rd, HA4 8DZ',                      150, 35.00, 'Pool and gym with group classes.',                                ARRAY['Pool','Gym','Studio'],                    TRUE,  TRUE,  TRUE),

-- Meeting Rooms (category 3)
(11, 'Civic Centre - Room A',           3, 'Uxbridge',           'High St, UB8 1UW',                           30,  0.00, 'Formal committee room for meetings.',                             ARRAY['Projector','Video Conferencing','WiFi'],  TRUE,  FALSE, TRUE),
(12, 'Civic Centre - Room B',           3, 'Uxbridge',           'High St, UB8 1UW',                           20,  0.00, 'Smaller meeting room for working groups.',                        ARRAY['Screen','WiFi','Whiteboard'],             TRUE,  FALSE, TRUE),
(13, 'Civic Centre - Council Chamber',  3, 'Uxbridge',           'High St, UB8 1UW',                          100,  0.00, 'Main council chamber for large events.',                          ARRAY['PA System','Live Streaming','WiFi'],      TRUE,  FALSE, TRUE),
(14, 'Botwell Hub Meeting Room',        3, 'Hayes',              'East Ave, UB3 2HW',                          15, 15.00, 'Modern meeting space for community groups.',                      ARRAY['Screen','WiFi','Kitchen Access'],         TRUE,  TRUE,  TRUE),
(15, 'Ruislip Manor Library Meeting',   3, 'Ruislip Manor',      'Linden Ave, HA4 8TW',                        12, 10.00, 'Quiet meeting room in the library.',                              ARRAY['WiFi','Whiteboard'],                      TRUE,  FALSE, TRUE),

-- Parks & Open Spaces (category 4)
(16, 'Ruislip Lido - Event Space',      4, 'Ruislip',            'Reservoir Rd, HA4 7TY',                     500, 80.00, 'Stunning lakeside space for festivals and events.',               ARRAY['Toilets','Parking','Open Air Stage'],     TRUE,  TRUE,  TRUE),
(17, 'Fassnidge Park Bandstand',        4, 'Uxbridge',           'Fassnidge Park, UB8 2TU',                   200, 25.00, 'Victorian bandstand for concerts and gatherings.',                ARRAY['Power Supply','Open Air'],               TRUE,  FALSE, TRUE),
(18, 'Barra Hall Park - Picnic Area',   4, 'Hayes',              'Barra Hall Rd, UB3 3HE',                     80, 15.00, 'Bookable picnic and BBQ area.',                                   ARRAY['BBQ Area','Picnic Tables'],               TRUE,  TRUE,  TRUE),
(19, 'Manor Farm - Events Field',       4, 'Ruislip',            'Bury St, HA4 7SU',                          300, 60.00, 'Historic farm field for fairs and markets.',                      ARRAY['Toilets','Parking','Heritage Site'],      TRUE,  TRUE,  TRUE),
(20, 'Stockley Park - Community Green', 4, 'West Drayton',       'Stockley Park, UB11 1FW',                   150, 35.00, 'Green space for corporate and community events.',                 ARRAY['Parking','Toilets'],                      TRUE,  TRUE,  TRUE),

-- Equipment Hire (category 5)
(21, 'PA System (Portable)',            5, 'Uxbridge',           'Civic Centre, UB8 1UW',                    NULL, 25.00, 'Portable PA with speakers and wireless mics.',                   ARRAY['2 Speakers','Mixer','2 Mics'],            TRUE,  FALSE, TRUE),
(22, 'Projector & Screen Kit',          5, 'Uxbridge',           'Civic Centre, UB8 1UW',                    NULL, 15.00, 'HD projector with screen and cables.',                            ARRAY['Projector','Screen','HDMI'],              TRUE,  FALSE, TRUE),
(23, 'Marquee (6m x 12m)',              5, 'Ruislip',            'Depot, HA4 0FL',                           NULL,120.00, 'Large marquee with setup included.',                              ARRAY['Marquee','Setup Included'],               TRUE,  TRUE,  TRUE),
(24, 'Tables & Chairs (50 guests)',     5, 'Uxbridge',           'Civic Centre, UB8 1UW',                      50, 40.00, '10 tables and 50 chairs with delivery.',                          ARRAY['10 Tables','50 Chairs'],                  TRUE,  FALSE, TRUE),
(25, 'Staging Platform',                5, 'Ruislip',            'Depot, HA4 0FL',                           NULL, 80.00, 'Modular 4m x 3m stage with setup.',                               ARRAY['Stage','Steps','Setup'],                  TRUE,  TRUE,  TRUE),

-- Registry Services (category 6 — weekdays only)
(26, 'Birth Registration',              6, 'Uxbridge',           'Register Office, Civic Centre, UB8 1UW',      1,  0.00, 'Register a birth — 30 min appointment.',                          ARRAY['30 min'],                                TRUE,  FALSE, TRUE),
(27, 'Death Registration',              6, 'Uxbridge',           'Register Office, Civic Centre, UB8 1UW',      1,  0.00, 'Register a death — 30 min appointment.',                          ARRAY['30 min'],                                TRUE,  FALSE, TRUE),
(28, 'Marriage Notice',                 6, 'Uxbridge',           'Register Office, Civic Centre, UB8 1UW',      2, 35.00, 'Give notice of marriage or civil partnership.',                   ARRAY['30 min','ID Required'],                  TRUE,  FALSE, TRUE),
(29, 'Citizenship Ceremony',            6, 'Uxbridge',           'Council Chamber, Civic Centre, UB8 1UW',     60,  0.00, 'Monthly group citizenship ceremony.',                             ARRAY['1 hour','Guests Welcome'],               TRUE,  FALSE, TRUE),
(30, 'Wedding - Register Office',       6, 'Uxbridge',           'Register Office, Civic Centre, UB8 1UW',      8, 57.00, 'Simple civil ceremony.',                                          ARRAY['30 min','Photography OK'],               TRUE,  FALSE, TRUE),

-- Housing Services (category 7 — weekdays only)
(31, 'Housing Repair - Non Emergency',  7, 'Borough-wide',       'Various locations',                            1,  0.00, 'Non-emergency housing repair appointment.',                       ARRAY['2 hour slot','SMS Tracking'],             TRUE,  FALSE, TRUE),
(32, 'Housing Options Consultation',    7, 'Uxbridge',           'Civic Centre, UB8 1UW',                       1,  0.00, 'Housing options and homelessness support.',                       ARRAY['45 min'],                                TRUE,  FALSE, TRUE),
(33, 'Tenant Meeting - Estate Manager', 7, 'Borough-wide',       'Various estate offices',                       1,  0.00, 'Meet your estate manager.',                                       ARRAY['30 min'],                                TRUE,  FALSE, TRUE),
(34, 'Right to Buy Consultation',       7, 'Uxbridge',           'Civic Centre, UB8 1UW',                       1,  0.00, 'Discuss Right to Buy eligibility.',                               ARRAY['45 min','Docs Required'],                TRUE,  FALSE, TRUE),
(35, 'Leaseholder Service Charge',      7, 'Uxbridge',           'Civic Centre, UB8 1UW',                       1,  0.00, 'Review service charge details.',                                  ARRAY['30 min'],                                TRUE,  FALSE, TRUE),

-- Benefits & Council Tax (category 8 — weekdays only)
(36, 'Benefits Assessment',             8, 'Uxbridge',           'Civic Centre, UB8 1UW',                       1,  0.00, 'Housing benefit or council tax reduction.',                       ARRAY['45 min','Docs Required'],                TRUE,  FALSE, TRUE),
(37, 'Council Tax Query',               8, 'Uxbridge',           'Civic Centre, UB8 1UW',                       1,  0.00, 'Banding, discounts and payment plans.',                           ARRAY['30 min'],                                TRUE,  FALSE, TRUE),
(38, 'Universal Credit Support',        8, 'Hayes',              'Botwell Hub, East Ave, UB3 2HW',               1,  0.00, 'Help with UC applications and journal.',                          ARRAY['1 hour','Computer Provided'],             TRUE,  TRUE,  TRUE),
(39, 'Discretionary Housing Payment',   8, 'Uxbridge',           'Civic Centre, UB8 1UW',                       1,  0.00, 'Apply for discretionary housing payments.',                       ARRAY['30 min','Docs Required'],                TRUE,  FALSE, TRUE),
(40, 'Pension Credit Consultation',     8, 'Various',            'Various community centres',                    1,  0.00, 'Help applying for Pension Credit.',                               ARRAY['30 min'],                                TRUE,  FALSE, TRUE),

-- Library Services (category 9)
(41, 'Uxbridge Library - Study Room',   9, 'Uxbridge',           'High St, UB8 1HD',                            6,  0.00, 'Quiet study room, free for up to 2 hours.',                       ARRAY['WiFi','Power Outlets'],                  TRUE,  FALSE, TRUE),
(42, 'Hayes Library - Computer Suite',  9, 'Hayes',              'Golden Crescent, UB3 1AQ',                   12,  0.00, '12 computers with printing.',                                     ARRAY['12 PCs','Printing','WiFi'],              TRUE,  FALSE, TRUE),
(43, 'Ruislip Manor Library Events',    9, 'Ruislip Manor',      'Linden Ave, HA4 8TW',                        40, 20.00, 'Space for talks and workshops.',                                  ARRAY['Seating','Projector'],                   TRUE,  FALSE, TRUE),
(44, 'Charville Library Activity Room', 9, 'Hayes',              'Bury Ave, UB4 8LF',                          20,  0.00, 'Room for children groups and crafts.',                            ARRAY['Tables','Sink'],                         TRUE,  FALSE, TRUE),
(45, 'West Drayton Library Meeting',    9, 'West Drayton',       'Station Rd, UB7 7JS',                        10, 10.00, 'Small bookable meeting room.',                                    ARRAY['WiFi','Screen'],                         TRUE,  FALSE, TRUE),

-- Youth & Children (category 10)
(46, 'Hayes Youth Centre',              10, 'Hayes',             '35 Albert Rd, UB3 4HS',                       60, 20.00, 'Youth centre with sports and music.',                             ARRAY['Sports Equipment','Music Room','WiFi'],  TRUE,  FALSE, TRUE),
(47, 'Northwood Youth Centre',          10, 'Northwood',         '15 Murray Rd, HA6 2YP',                       40, 18.00, 'After-school clubs and holiday programmes.',                      ARRAY['Activity Room','Kitchen','Garden'],      TRUE,  TRUE,  TRUE),
(48, 'Uxbridge Young Peoples Centre',   10, 'Uxbridge',          '8 Gravel Hill, UB8 3NP',                      50, 22.00, 'Tech equipment and creative spaces.',                             ARRAY['Recording Studio','Computers','Art Room'],TRUE, FALSE, TRUE),
(49, 'South Ruislip Children Room',     10, 'South Ruislip',     '42 Long Drive, HA4 0HL',                      25, 12.00, 'Activity room for children 0–11.',                                ARRAY['Soft Play','Toys','Kitchen'],             TRUE,  TRUE,  TRUE),
(50, 'Harefield Youth Space',           10, 'Harefield',         '22 High St, UB9 6BU',                         30, 15.00, 'Village youth drop-in space.',                                    ARRAY['Games Room','Kitchen','Outdoor Area'],   TRUE,  TRUE,  TRUE);


-- =============================================================================
-- 7. SEED DATA — users (4 staff + 4 residents)
-- =============================================================================

INSERT INTO users (id, name, email, phone, role, department) VALUES
(1, 'Sarah Thompson',  'sarah.thompson@hillingdon.gov.uk', '01895 556001', 'staff',    'Community Services'),
(2, 'James Patel',     'james.patel@hillingdon.gov.uk',   '01895 556002', 'staff',    'Housing'),
(3, 'Maria Rodriguez', 'maria.rodriguez@hillingdon.gov.uk','01895 556003', 'staff',    'Benefits'),
(4, 'Admin User',      'admin@hillingdon.gov.uk',          '01895 556000', 'admin',    'Digital Services'),
(5, 'John Smith',      'john.smith@example.com',           '07700 900001', 'resident', NULL),
(6, 'Priya Kaur',      'priya.kaur@example.com',           '07700 900002', 'resident', NULL),
(7, 'Mohammed Ali',    'mohammed.ali@example.com',         '07700 900003', 'resident', NULL),
(8, 'Emma Wilson',     'emma.wilson@example.com',          '07700 900004', 'resident', NULL);


-- =============================================================================
-- 8. TIME SLOTS  (always 30 days from today — never expires)
--
-- Three slots per day per facility:
--   Morning:   09:00 – 12:00
--   Afternoon: 13:00 – 16:00
--   Evening:   17:00 – 20:00
--
-- Categories 6 (Registry), 7 (Housing), 8 (Benefits): weekdays only
-- =============================================================================

INSERT INTO time_slots (facility_id, slot_date, start_time, end_time, is_available)
SELECT
    f.id,
    d.slot_date::DATE,
    t.start_time::TIME,
    t.end_time::TIME,
    TRUE
FROM
    facilities f
    CROSS JOIN generate_series(
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '29 days',
        INTERVAL '1 day'
    ) AS d(slot_date)
    CROSS JOIN (VALUES
        ('09:00'::TIME, '12:00'::TIME),
        ('13:00'::TIME, '16:00'::TIME),
        ('17:00'::TIME, '20:00'::TIME)
    ) AS t(start_time, end_time)
WHERE
    f.is_active = TRUE
    AND (
        f.category_id NOT IN (6, 7, 8)
        OR EXTRACT(DOW FROM d.slot_date) BETWEEN 1 AND 5  -- Mon=1 … Fri=5
    );


-- =============================================================================
-- 9. SAMPLE BOOKINGS  (8 realistic demo rows)
--
-- Subqueries find valid future slot IDs so this block is always safe to run
-- regardless of the time_slot IDs generated above.
-- =============================================================================

INSERT INTO bookings (reference, user_id, facility_id, time_slot_id, status, notes, ai_suggested, ai_confidence)
SELECT 'HBC-2026-0001', 5, 1, ts.id, 'confirmed', 'Community group meeting — monthly session', TRUE, 92.5
FROM time_slots ts WHERE ts.facility_id = 1  AND ts.is_available = TRUE ORDER BY ts.slot_date, ts.start_time LIMIT 1;

INSERT INTO bookings (reference, user_id, facility_id, time_slot_id, status, notes, ai_suggested, ai_confidence)
SELECT 'HBC-2026-0002', 6, 3, ts.id, 'confirmed', 'Birthday party — 60 guests expected', TRUE, 88.0
FROM time_slots ts WHERE ts.facility_id = 3  AND ts.is_available = TRUE ORDER BY ts.slot_date, ts.start_time OFFSET 1 LIMIT 1;

INSERT INTO bookings (reference, user_id, facility_id, time_slot_id, status, notes, ai_suggested, ai_confidence)
SELECT 'HBC-2026-0003', 7, 6, ts.id, 'confirmed', 'Five-a-side football session — team of 10', FALSE, NULL
FROM time_slots ts WHERE ts.facility_id = 6  AND ts.is_available = TRUE ORDER BY ts.slot_date, ts.start_time LIMIT 1;

INSERT INTO bookings (reference, user_id, facility_id, time_slot_id, status, notes, ai_suggested, ai_confidence)
SELECT 'HBC-2026-0004', 8, 8, ts.id, 'pending',   'Family swim session', TRUE, 76.5
FROM time_slots ts WHERE ts.facility_id = 8  AND ts.is_available = TRUE ORDER BY ts.slot_date, ts.start_time LIMIT 1;

INSERT INTO bookings (reference, user_id, facility_id, time_slot_id, status, notes, ai_suggested, ai_confidence)
SELECT 'HBC-2026-0005', 1, 11, ts.id, 'confirmed', 'Weekly team planning meeting', FALSE, NULL
FROM time_slots ts WHERE ts.facility_id = 11 AND ts.is_available = TRUE ORDER BY ts.slot_date, ts.start_time LIMIT 1;

INSERT INTO bookings (reference, user_id, facility_id, time_slot_id, status, notes, ai_suggested, ai_confidence)
SELECT 'HBC-2026-0006', 5, 16, ts.id, 'confirmed', 'Summer charity fair — stalls and live music', TRUE, 95.0
FROM time_slots ts WHERE ts.facility_id = 16 AND ts.is_available = TRUE ORDER BY ts.slot_date, ts.start_time LIMIT 1;

INSERT INTO bookings (reference, user_id, facility_id, time_slot_id, status, notes, ai_suggested, ai_confidence)
SELECT 'HBC-2026-0007', 6, 26, ts.id, 'confirmed', 'Register birth of baby daughter', TRUE, 99.0
FROM time_slots ts WHERE ts.facility_id = 26 AND ts.is_available = TRUE ORDER BY ts.slot_date, ts.start_time LIMIT 1;

INSERT INTO bookings (reference, user_id, facility_id, time_slot_id, status, notes, ai_suggested, ai_confidence)
SELECT 'HBC-2026-0008', 7, 46, ts.id, 'confirmed', 'After-school coding club — 12 teenagers', FALSE, NULL
FROM time_slots ts WHERE ts.facility_id = 46 AND ts.is_available = TRUE ORDER BY ts.slot_date, ts.start_time LIMIT 1;

-- Mark booked slots as unavailable
UPDATE time_slots SET is_available = FALSE
WHERE id IN (SELECT time_slot_id FROM bookings WHERE time_slot_id IS NOT NULL);


-- =============================================================================
-- 10. RESET SEQUENCES  (so the next INSERT gets the right next ID)
-- =============================================================================

SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('facilities_id_seq', (SELECT MAX(id) FROM facilities));
SELECT setval('users_id_seq',      (SELECT MAX(id) FROM users));
SELECT setval('time_slots_id_seq', (SELECT MAX(id) FROM time_slots));
SELECT setval('bookings_id_seq',   (SELECT MAX(id) FROM bookings));

COMMIT;
