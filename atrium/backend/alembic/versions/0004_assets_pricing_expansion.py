"""Assets: add real pricing + expand to 48 Hillingdon facilities

Revision ID: 0004_assets_pricing_expansion
Revises: 0003_auth
Create Date: 2026-06-06
"""
from alembic import op


revision = "0004_assets_pricing_expansion"
down_revision = "0003_auth"
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# Pricing for the original 25 assets
# ---------------------------------------------------------------------------
_PRICING = {
    # Community centres
    "Botwell Green Community Centre":       35.00,
    "Hayes End Community Centre":           28.00,
    "Yiewsley Community Centre":            22.00,
    "Northwood Community Centre":           32.00,
    # Library spaces
    "Uxbridge Library Meeting Room":        15.00,
    "Manor Farm Library Study Pod":          8.00,
    "Northwood Library Hall":               18.00,
    "Ruislip Manor Library Group Room":     12.00,
    # Children's centres
    "Hayes Children's Centre Activity Room A": 12.00,
    "Hayes Children's Centre Activity Room B": 12.00,
    "Yiewsley Children's Centre Family Room":  10.00,
    "Northwood Children's Centre Sensory Room": 10.00,
    # Sports & leisure
    "Botwell Green Sports Centre Hall":     55.00,
    "Highgrove Pool Function Room":         35.00,
    "Hillingdon Sports Complex Meeting Room": 20.00,
    # Council buildings
    "Civic Centre Committee Room A":        22.00,
    "Civic Centre Committee Room B":        20.00,
    "Civic Centre Public Meeting Hall":     80.00,
    # Outdoor spaces
    "Yiewsley Recreation Ground Pavilion":  18.00,
    "Hillingdon Court Park Pavilion":       22.00,
    "Manor Farm Outdoor Terrace":           25.00,
    # Equipment
    "Audio Visual Loan Kit":                 8.00,
    "Portable PA System":                    6.00,
    "Marquee for Community Events":         25.00,
    "Projector and Screen Bundle":           5.00,
}

# ---------------------------------------------------------------------------
# 23 new facilities  (name, category, ward, cap, rate, wheelchair, parking, kitchen, lat, lng, co2)
# ---------------------------------------------------------------------------
_NEW_ASSETS = [
    # ── Community centres ────────────────────────────────────────────────
    ("Ickenham Village Hall",
     "community_centres", "Ickenham",        80,  35.00, True,  True,  True,  51.5615, -0.4490, 0.45),
    ("West Drayton Community Centre",
     "community_centres", "Yiewsley",         65,  28.00, True,  True,  True,  51.5022, -0.4703, 0.48),
    ("Harlington Community Centre",
     "community_centres", "Harlington",       55,  24.00, True,  True,  False, 51.4895, -0.4251, 0.50),
    ("Charville Community Hall",
     "community_centres", "Hayes Town",       45,  20.00, True,  False, False, 51.5156, -0.4302, 0.52),
    ("South Ruislip Community Centre",
     "community_centres", "South Ruislip",    70,  30.00, True,  True,  True,  51.5540, -0.4066, 0.46),
    ("Yeading Community Centre",
     "community_centres", "Yeading",          50,  22.00, False, True,  True,  51.5289, -0.3908, 0.49),
    # ── Library spaces ───────────────────────────────────────────────────
    ("Hayes Library Conference Room",
     "library_spaces",    "Hayes Town",       18,  12.00, True,  False, False, 51.5139, -0.4268, 0.35),
    ("West Drayton Library Meeting Room",
     "library_spaces",    "Yiewsley",         12,  10.00, True,  True,  False, 51.5025, -0.4699, 0.32),
    ("Ruislip Library Meeting Room",
     "library_spaces",    "Ruislip",          20,  15.00, True,  True,  False, 51.5759, -0.4170, 0.36),
    ("Eastcote Library Group Room",
     "library_spaces",    "Eastcote",         14,  10.00, True,  True,  False, 51.5842, -0.3975, 0.33),
    ("Ickenham Library Meeting Room",
     "library_spaces",    "Ickenham",         16,  12.00, True,  False, False, 51.5618, -0.4498, 0.34),
    # ── Children's centres ───────────────────────────────────────────────
    ("Pinkwell Children's Centre Activity Room",
     "childrens_centres", "Hayes Town",       22,  12.00, True,  True,  True,  51.5040, -0.4195, 0.38),
    ("Charville Children's Centre Group Room",
     "childrens_centres", "Hayes Town",       18,  10.00, True,  False, False, 51.5156, -0.4302, 0.36),
    ("Colham Children's Centre Activity Space",
     "childrens_centres", "Hillingdon East",  20,  12.00, True,  True,  False, 51.5410, -0.4520, 0.37),
    # ── Sports & leisure ─────────────────────────────────────────────────
    ("Queensmead Sports Centre Activity Hall",
     "sports_leisure",    "South Ruislip",   100,  55.00, True,  True,  False, 51.5552, -0.4058, 0.62),
    ("Uxbridge Sports Ground Pavilion",
     "sports_leisure",    "Uxbridge",         40,  25.00, True,  True,  True,  51.5482, -0.4740, 0.44),
    # ── Outdoor spaces ───────────────────────────────────────────────────
    ("Ruislip Lido Events Pavilion",
     "outdoor_spaces",    "Ruislip",         100,  40.00, True,  True,  True,  51.5813, -0.4348, 0.55),
    ("Fassnidge Park Pavilion",
     "outdoor_spaces",    "Uxbridge",         55,  25.00, True,  True,  False, 51.5430, -0.4778, 0.42),
    ("Lake Farm Country Park Events Space",
     "outdoor_spaces",    "Hayes Town",       75,  28.00, False, True,  False, 51.5072, -0.4392, 0.58),
    ("Hillingdon House Farm Events Barn",
     "outdoor_spaces",    "Hillingdon East", 120,  45.00, False, True,  True,  51.5400, -0.4470, 0.65),
    ("Cranford Countryside Park Pavilion",
     "outdoor_spaces",    "Hillingdon East",  40,  18.00, False, True,  False, 51.4890, -0.4310, 0.48),
    # ── Equipment ────────────────────────────────────────────────────────
    ("Laptop Bundle (x10)",
     "equipment",         "Uxbridge",          1,  15.00, True,  False, False, 51.5466, -0.4790, 0.10),
    ("Folding Table & Chair Set x50",
     "equipment",         "Uxbridge",          1,  12.00, True,  False, False, 51.5466, -0.4790, 0.10),
]


def _sql_bool(v: bool) -> str:
    return "true" if v else "false"


def _acc(wheelchair: bool) -> str:
    """Return a jsonb_build_object() SQL expression — avoids :true bind-param issue."""
    v = _sql_bool(wheelchair)
    return (
        f"jsonb_build_object("
        f"'wheelchair_access',{v}::boolean,"
        f"'hearing_loop',{v}::boolean,"
        f"'accessible_toilet',{v}::boolean,"
        f"'parking_accessible',{v}::boolean)"
    )


def _amen(kitchen: bool, parking: bool) -> str:
    """Return a jsonb_build_object() SQL expression — avoids :true bind-param issue."""
    k = _sql_bool(kitchen)
    p = _sql_bool(parking)
    return (
        f"jsonb_build_object("
        f"'kitchen',{k}::boolean,"
        f"'wifi',true::boolean,"
        f"'projector',true::boolean,"
        f"'whiteboard',true::boolean,"
        f"'stage',false::boolean,"
        f"'parking',{p}::boolean)"
    )


def upgrade() -> None:
    # ── 1. Price all existing assets ──────────────────────────────────────
    for name, rate in _PRICING.items():
        safe_name = name.replace("'", "''")
        op.execute(
            f"UPDATE assets SET hourly_rate = {rate} WHERE name = '{safe_name}'"
        )

    # ── 2. Add parking field to existing amenities that don't have it ────
    #    Use jsonb_build_object to avoid :true bind-param issue.
    #    Use jsonb_exists() instead of ? operator (which SQLAlchemy intercepts).
    _parking_yes = [
        "Botwell Green Community Centre", "Hayes End Community Centre",
        "Northwood Community Centre", "Botwell Green Sports Centre Hall",
        "Highgrove Pool Function Room", "Civic Centre Public Meeting Hall",
        "Yiewsley Recreation Ground Pavilion", "Hillingdon Court Park Pavilion",
        "Manor Farm Outdoor Terrace",
    ]
    for name in _parking_yes:
        safe = name.replace("'", "''")
        op.execute(
            f"UPDATE assets "
            f"SET amenities = amenities || jsonb_build_object('parking', true::boolean) "
            f"WHERE name = '{safe}' AND NOT jsonb_exists(amenities, 'parking')"
        )
    op.execute(
        "UPDATE assets "
        "SET amenities = amenities || jsonb_build_object('parking', false::boolean) "
        "WHERE NOT jsonb_exists(amenities, 'parking')"
    )

    # ── 3. Fix placeholder image colour (old blue → teal) ────────────────
    op.execute(
        "UPDATE assets SET image_url = REPLACE(image_url, '1B4F8C', '0D9488') "
        "WHERE image_url LIKE '%1B4F8C%'"
    )

    # ── 4. Insert new facilities (idempotent) ────────────────────────────
    for (
        name, category, ward, cap, rate,
        wheelchair, parking, kitchen,
        lat, lng, co2,
    ) in _NEW_ASSETS:
        safe_name = name.replace("'", "''")
        safe_ward = ward.replace("'", "''")
        desc = f"{safe_name} in {safe_ward}, London Borough of Hillingdon. Capacity {cap}."
        img  = f"https://placehold.co/400x300/0D9488/FFFFFF/png?text={name.replace(' ', '+')}"
        acc  = _acc(wheelchair)
        amen = _amen(kitchen, parking)

        op.execute(f"""
            INSERT INTO assets
                (id, name, category, ward, capacity, description,
                 accessibility, amenities, hourly_rate,
                 latitude, longitude, image_url, co2_per_visit, is_active, created_at)
            SELECT
                gen_random_uuid(),
                '{safe_name}', '{category}', '{safe_ward}', {cap},
                '{desc}',
                {acc},
                {amen},
                {rate}, {lat}, {lng},
                '{img}',
                {co2}, true, now()
            WHERE NOT EXISTS (SELECT 1 FROM assets WHERE name = '{safe_name}')
        """)


def downgrade() -> None:
    new_names = [a[0].replace("'", "''") for a in _NEW_ASSETS]
    names_sql  = ", ".join(f"'{n}'" for n in new_names)
    op.execute(f"DELETE FROM assets WHERE name IN ({names_sql})")
    op.execute("UPDATE assets SET hourly_rate = 0")
