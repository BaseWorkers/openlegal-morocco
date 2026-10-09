# Legal source change candidates

The change-tracker MVP emits a versioned, hash-only candidate record when a locally supplied copy of an allowlisted source differs from a prior SHA-256 digest. The record is a triage signal, not a legal update or interpretation. The tool does not fetch sources, retain source text, open GitHub issues, update claims/templates, or change review states.

## Compare a local copy

```sh
sha256sum prior-copy.pdf
npm run cli -- changes compare sgg-bo-5714-2009 \
  --previous-sha <64-character-lowercase-sha256> \
  --current ./current-copy.pdf
```

The current copy is read only to calculate its digest. The JSON record is written to stdout and includes the source registry URL, comparison timestamp, change status, and limitations. To provide a deterministic timestamp, add `--retrieved-at 2026-10-09T12:00:00Z`.

Only IDs listed in `change-tracker/allowlist.json` are accepted. The list enables manual local comparison for triage; it is not permission to crawl, republish, or automatically fetch those URLs. Existing source registry reuse terms and verification states continue to apply.

## Source qualification snapshot

Checked 2026-10-09 for the initial pilot:

- The [CNDP conditions of use](https://www.cndp.ma/conditions-dutilisation/) state in section 4 that CNDP owns the site content and that commercial use is prohibited. This record does not determine how those terms apply to local checksum comparison, metadata, automated requests, or this project's maintainer context. No CNDP automated retrieval is enabled.
- The [SGG homepage](https://www.sgg.gov.ma/Accueil.aspx) displays current Official Bulletin publication information, and the [Official Printing Directorate page](https://www.sgg.gov.ma/imprimerieofficielle.aspx) describes its role in publishing the Bulletin. No official machine-readable feed or terms authorizing scheduled retrieval were verified in this review. No SGG polling is enabled.

These are dated source-discovery notes, not legal advice or a conclusion that a feed does or does not exist. Recheck the source's published terms and available feed before enabling retrieval. The allowlist authorizes manual local-file hashing only.

## Review sequence

1. A maintainer confirms the local copy came from the cited source and records the retrieval evidence.
2. A maintainer determines whether the difference reflects changed source content, formatting, metadata, or an incomplete copy.
3. A qualified legal reviewer identifies any affected claims and assesses legal meaning.
4. Any content or status change follows the existing contribution, review, and release process.

No step automatically creates issues or alters legal materials. Automated retrieval, feed support, historical snapshots, GitHub issue creation, and claim mapping remain future work pending source terms, reliable feeds, and explicit human approval.
