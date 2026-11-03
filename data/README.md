# Texas location directory

`texas-locations.json` contains 9,591 current Texas populated-place features from
GeoNames, imported on 2 November 2026. It includes primary county names matched
through the GeoNames administrative-county crosswalk. It contains public
geographic data, not business leads or private records.

Attribution: [GeoNames](https://www.geonames.org/), licensed under
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
The derived file filters the US dataset to Texas populated places, excludes
historical/abandoned/destroyed features and adds a county-name crosswalk. Source
URLs, source-file SHA-256 hashes and import time are embedded in the JSON.
GeoNames does not guarantee accuracy or complete coverage.

Refresh with `npm run locations:import`. This fetches the established upstream
datasets; do not hand-edit a list of cities. See [outreach setup](../docs/OUTREACH.md).
