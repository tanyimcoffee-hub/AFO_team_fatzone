# Place data

`services/api` loads every file in this folder once at startup (`services/api/places-store.js`).

## Folders

| Path | Owner | Notes |
|---|---|---|
| `osm/<ISO>.json` | generated | Starter data from OpenStreetMap, one file per province (ISO 3166-2 code, e.g. `TH-50` = เชียงใหม่). Do not edit by hand. |
| `osm/provinces.json` | generated | Province list (77) with Thai/English names and counts per type. |
| `team/*.json` | Travel Data team (Person 2) | Curated data. Any number of files, each a JSON array. |
| `../../places_bkk_cnx.json` | Travel Data team | Original team file at the repo root. Still loaded as team data. |

## Place schema

Required for team data:

```json
{ "id": "place_001", "name": "วัดพระธาตุดอยสุเทพ", "province": "เชียงใหม่", "type": "attraction" }
```

Optional: `lat`, `lon`, `nameEn`, `brand`, `category`, `verified` (set `true` only when checked against a real source).

`type` must be one of: `attraction`, `restaurant`, `cafe`, `hotel`, `fuel`, `rest_stop`.

`province` can be the Thai or English name, with or without `จังหวัด`. Rows with an unknown province or a missing field are skipped with a warning in the server log.

## Merge rules

Team data wins over OpenStreetMap data:

1. Same `id` as an OSM row: the team row replaces it. Use the OSM id (e.g. `osm-node-123`) to correct an OSM place.
2. Same name, province and type as an OSM row: the team row replaces it.
3. Everything else is added.

## Refreshing OpenStreetMap data

```bash
cd services/api
npm run fetch:osm             # provinces not downloaded yet (re-run to resume)
npm run fetch:osm -- --force  # re-download all 77 provinces
npm run fetch:osm -- TH-50    # one province
```

The script queries the public Overpass API with a delay between provinces and retries on server errors. A province that still fails is skipped and listed at the end; run the command again to fetch it. Only named places are kept.

OSM tag mapping:

| type | OSM tags |
|---|---|
| `fuel` | `amenity=fuel` |
| `restaurant` | `amenity=restaurant` |
| `cafe` | `amenity=cafe` |
| `hotel` | `tourism=hotel, motel, guest_house, hostel` |
| `attraction` | `tourism=attraction, viewpoint, museum, theme_park, zoo, aquarium` |
| `rest_stop` | `highway=rest_area, services` |

## License and accuracy

OpenStreetMap data is © OpenStreetMap contributors, available under the [Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright). Any page that shows this data must credit "© OpenStreetMap contributors".

OSM rows are always `verified: false`. They can be missing, closed, or out of date. Coverage varies by province.
