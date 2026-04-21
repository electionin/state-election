import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / 'tnelection2026.db'
OUT_PATH = ROOT / 'public' / 'data' / 'states' / 'tn' / 'ac_details.json'
PHOTO_DIR = ROOT / 'public' / 'data' / 'states' / 'tn' / 'candidate_photo'


def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def main() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f'Database not found: {DB_PATH}')

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    ac_rows = conn.execute(
        '''
        SELECT dcode, pc_code, ac_code, name_ta, name_en, reserved,
               polling_stations, male_voters, female_voters, thirdgender_voters, total_voters
        FROM ac
        ORDER BY ac_code
        '''
    ).fetchall()

    candidate_rows = conn.execute(
        '''
        SELECT ac_code, sl_no, name_en, name_ta, party_en, party_ta, alliance_ta, symbol_en, photo_name
        FROM ac_candidate
        ORDER BY ac_code, sl_no
        '''
    ).fetchall()

    district_rows = conn.execute(
        '''
        SELECT dcode, name_en, name_ta
        FROM district
        ORDER BY dcode
        '''
    ).fetchall()

    candidates_by_ac = {}

    def resolve_photo_file(photo_name: str) -> str:
        raw = (photo_name or '').strip()
        if not raw:
            return ''

        if Path(raw).suffix:
            candidate = PHOTO_DIR / raw
            return raw if candidate.exists() else ''

        for ext in ('.jpg', '.jpeg', '.png', '.webp'):
            candidate = PHOTO_DIR / f'{raw}{ext}'
            if candidate.exists():
                return f'{raw}{ext}'
        return ''

    for row in candidate_rows:
        ac_code = to_int(row['ac_code'])
        photo_name = (row['photo_name'] or '').strip()
        candidates_by_ac.setdefault(ac_code, []).append({
            'sl_no': to_int(row['sl_no']),
            'name_en': (row['name_en'] or '').strip(),
            'name_ta': (row['name_ta'] or '').strip(),
            'party_en': (row['party_en'] or '').strip(),
            'party_ta': (row['party_ta'] or '').strip(),
            'alliance_ta': (row['alliance_ta'] or '').strip(),
            'symbol_en': (row['symbol_en'] or '').strip(),
            'photo_name': photo_name,
            'photo_file': resolve_photo_file(photo_name),
        })

    out = []
    for row in ac_rows:
        ac_code = to_int(row['ac_code'])
        out.append({
            'dcode': to_int(row['dcode']),
            'pc_code': to_int(row['pc_code']),
            'ac_code': ac_code,
            'name_ta': (row['name_ta'] or '').strip(),
            'name_en': (row['name_en'] or '').strip(),
            'reserved': (row['reserved'] or '').strip(),
            'polling_stations': to_int(row['polling_stations']),
            'male_voters': to_int(row['male_voters']),
            'female_voters': to_int(row['female_voters']),
            'thirdgender_voters': to_int(row['thirdgender_voters']),
            'total_voters': to_int(row['total_voters']),
            'candidates': candidates_by_ac.get(ac_code, []),
        })

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    districts = [
        {
            'dcode': to_int(row['dcode']),
            'name_en': (row['name_en'] or '').strip(),
            'name_ta': (row['name_ta'] or '').strip(),
        }
        for row in district_rows
    ]

    OUT_PATH.write_text(json.dumps({'districts': districts, 'acs': out}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Wrote {len(out)} AC records to {OUT_PATH}')


if __name__ == '__main__':
    main()
