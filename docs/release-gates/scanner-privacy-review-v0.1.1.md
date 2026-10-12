# OpenLegal scanner rules — independent privacy review brief

**Status:** preparation for specialist review only. This document is not legal advice, a privacy assessment, or approval of the scanner. Do not treat automated validation or this brief as a professional review.

**Code baseline for review:** scanner release changes were prepared from `main` commit `0684959816cbcd7402f27ae00be28ad6eccba204` and carried in `BaseWorkers/openlegal-morocco` PR #16 (`release/v0.1.1-stable`). The currently checked-out and last remotely verified PR head is `eecd24dd35be89f2fca2e264082cdd77f6e0ab2e`; CI and CodeQL passed on that commit. These are documentation-only commits after scanner source preparation. The scanner source itself and its review evidence must be checked by SHA-256 before a reviewer starts; do not rely on a branch name alone. This is not a privacy-specialist approval.

### Review file identity at PR head `eecd24dd35be89f2fca2e264082cdd77f6e0ab2e`

Recompute these digests at review time; a mismatch means the review target has changed.

| File | SHA-256 |
| --- | --- |
| `scripts/scanner.mjs` | `2561f14498f43a7c71225b278df1f653d031e61805a1695b3838fa0a4ca42ed8` |
| `scripts/findings.mjs` | `21d0b97811b7ecb68c0a81389e4d7c8f9f3427af06188ab158ac470898a09d1a` |
| `schemas/findings.schema.json` | `fa9b9fb08d839d58c42852f637184bdd67e7ab5d5fc4fca41f84bb74f4b35a7c` |
| `tests/scanner.test.mjs` | `257b843845e89c00dd4d67b5b1a40a62ef257531021b199d7361c6c95974202c` |
| `sources/registry.yaml` | `3ab95d57c7785f9707eb4d87a83e5015eb5fe7796360ec7986f1b383e44d8ed8` |
| `research/morocco/privacy-data-protection.md` | `447b0516cb7ffb53f85af787760ff59b610d31187b802eedc8b6ce7a2b40fb63` |
| `research/morocco/claims.json` | `12e3f0b395967e292333713694686936d0b1e035318ab993ff600f9f2b997e53` |

## Requested reviewer decision

Please assess whether each indicator is useful, appropriately scoped, and described without implying a legal conclusion; identify material false-positive and false-negative classes; and state whether any rule, wording, jurisdiction mapping, or output should change before release. Record qualifications, conflicts, review date, exact code revision, rule IDs, language scope, evidence, and limitations.

The scanner currently emits technical indicators and discussion questions. It does not determine whether an organization complies with Moroccan Law 09-08 or the GDPR.

## Rule inventory and questions

| Rule ID | Implementation | Intended signal | Questions for the reviewer |
| --- | --- | --- | --- |
| `openlegal.privacy.notice.presence` | `scripts/scanner.mjs`: `NOTICE_PATH`, `NOTICE_HEADING`; local repository and URL scans | Detects recognized privacy-notice names/headings; absence is phrased as “not detected” | Are recognized names/headings adequate for EN/FR/AR and common frameworks? Does presence/absence wording avoid implying that a notice is legally required, complete, applicable, or sufficient? |
| `openlegal.privacy.cookie-storage.indicator` | `COOKIE_STORAGE` | Finds `document.cookie` or `cookieStore` text | Are these indicators useful for review without treating necessary storage as tracking? What important browser storage paths or consent controls are outside scope? |
| `openlegal.privacy.tracking.indicator` | `TRACKING` | Matches a fixed list of analytics/tracking SDK names and call patterns | Which common patterns, wrappers, tag managers, or dynamically loaded scripts are missed? Which documentation/configuration examples can create false positives? Is the “consent behavior was not evaluated” caveat sufficient? |
| `openlegal.third_party.integration.indicator` | `PROVIDER` | Matches selected provider hostnames/package names | Is this list representative for the stated use? Could a match incorrectly imply data transmission? Which providers or indirect integrations are missed? |
| `openlegal.gdpr.territorial-scope.question` | Always emitted for repository scans; references GDPR Article 3 | Prompts a human to assess territorial scope from facts outside source code | Is always emitting this question useful and correctly localized? Is the EU jurisdiction label and Article 3 reference appropriately bounded? |

## Scan boundaries visible in the implementation

- Repository mode is static text inspection; it does not execute application code. It includes selected JavaScript/TypeScript, HTML, Markdown, and `package.json` files. It skips dotfiles, symlinks, lockfiles, dependencies, build output, and several generated/vendor directories.
- The implementation caps depth at 24, files at 5,000, each file at 1 MiB, and total input at 25 MiB. Files beyond a cap are skipped or stop collection and generate a limitation.
- Tracking/provider/storage rules are applied to non-Markdown text line by line. A whole-line comment heuristic suppresses some code comments; it does not parse ASTs or distinguish executable from inert strings/configuration.
- URL mode fetches HTML only, without running JavaScript, submitting forms, logging in, changing consent settings, or inspecting authenticated pages. It follows at most three same-origin redirects and scans the initial page plus at most four discovered same-origin privacy links; total response size is limited to 2 MiB per page and each request to 10 seconds.
- URL links are found by a bounded `href` regex and recognized path patterns. Pages requiring client-side rendering, links without matching paths, and pages beyond the cap may be missed. Unavailable privacy links are reported as incomplete scope.
- Evidence records matched paths/lines and content digests; source excerpts are not included. URL evidence uses a digest and host/path. Findings remain `human_review: pending`.
- Findings use informational priority in `finding()`. The “readiness” signal is an internal open-review-work score; a separate coverage score records completed scan scopes. Neither score is legal risk or compliance.
- The report states that indicators do not prove personal-data transmission, consent absence, applicability, notice completeness, or compliance. Legal interpretation and current-law status for scanner rules are expressly marked not independently reviewed.

## Candidate false-positive / false-negative questions

These are review prompts inferred from the implementation, not validated error rates:

1. Literal matching may miss aliased, wrapped, dynamically imported, obfuscated, or custom telemetry and storage code; ask which omissions matter for the intended evidence-gathering use.
2. Literal matches in package manifests, examples, non-executable strings, or inline comments may indicate presence without actual runtime use. Confirm current messages preserve that distinction.
3. Name/heading matches may detect a draft, stale, irrelevant, or incomplete notice; the rule currently detects presence only.
4. A clean result cannot establish absence of behavior because source collection is bounded and excludes files/directories, and URL scanning does not execute JavaScript.
5. Provider SDK/hostname indicators cannot show what fields are sent, whether a request occurs, processing location, or contractual safeguards.
6. Cookie APIs do not establish a cookie's purpose, lifetime, personal-data content, or tracking use; the separate rule is intentionally not classified as tracking by itself.
7. Translation parity and legal meaning of the EN/FR/AR messages need language/legal review; tests establish structural localization, not professional equivalence.
8. The fixed confidence values are implementation constants, not calibrated probabilities. Please assess whether they should be removed, qualified, or supported by validation data.

## Engineering issue found during preparation

URL notice detection previously applied an anchored heading expression to the entire HTML document. A normal document beginning with `<!doctype html><html>...` therefore did not match a later `<h1>Privacy Policy</h1>`, even though the same title in the recognized path could match. The current candidate keeps Markdown headings line-anchored while HTML `<h1>`–`<h3>` and `<title>` tags may match anywhere in the document, including simple nested inline tags. A regression case covers a complete HTML document. Ask the privacy reviewer to assess the revised rule's scope and residual false positives/negatives.

## Existing automated examples and review gaps

`tests/scanner.test.mjs` exercises these representative rule-to-test links:

| Rule | Positive examples | Negative / boundary examples |
| --- | --- | --- |
| `openlegal.privacy.notice.presence` | `notice paths are detected...`; `public URL scan detects a privacy heading inside a complete HTML document`; same-origin URL tests | Unrelated README example; inaccessible privacy page; bounded same-origin link behavior |
| `openlegal.privacy.cookie-storage.indicator` | Repository fixture and `public URL scan fetches only same-origin HTML pages...` | `cookie storage by itself is not classified as tracking`; cookie-named JavaScript asset is ignored |
| `openlegal.privacy.tracking.indicator` | Repository fixture (`posthog-js`, `gtag`) and URL scan with Google Analytics | Unrelated Markdown example; skipped dependencies/build output; cookie API alone |
| `openlegal.third_party.integration.indicator` | URL scan with Google Analytics host; repository fixture includes a PostHog dependency | No broad provider inventory or runtime network-use validation |
| `openlegal.gdpr.territorial-scope.question` | Output-contract test checks EU jurisdiction and the question; localized structure checked for Arabic/French | No code test can determine the underlying organization-specific territorial facts |

This matrix is a map of selected automated examples, not a quality or accuracy study. Tests do not cover every alternative literal in the regular expressions, representative real applications, or professional translation equivalence.

These are selected regression examples, not a representative accuracy study. They do not establish recall/precision on real applications, completeness of provider/tracker inventories, correctness of legal interpretation, current-law status, adequacy across all deployment patterns, or professional translation equivalence. The reviewer should decide whether a labeled corpus, representative real-world samples, or additional adversarial cases are needed before making any accuracy claim.

## Legal/source review still required

The scanner source registry references CNDP materials and GDPR Article 3, but those references alone do not establish current legal status, applicability, or adequacy of the rules. Reviewers should verify official source text and status for the review date, identify pinpoint provisions, and distinguish statutory requirements from CNDP guidance and the project's technical assumptions. Any unsettled point must remain explicitly unresolved.

## Files to review

- `scripts/scanner.mjs` — patterns, collection limits, URL fetching, findings, confidence, assessment and localized caveats.
- `scripts/findings.mjs` and the finding schema — validation contract and status fields.
- `tests/scanner.test.mjs` — tested examples and limits of current automated coverage.
- `sources/registry.yaml` — source metadata used by reports.
- `research/morocco/privacy-data-protection.md` and `research/morocco/claims.json` — current project research caveats; do not treat them as independent legal review.

## Reviewer record

- Reviewer name / authorized reviewer ID:
- Privacy qualifications and relevant jurisdictions:
- Conflicts and independence statement:
- Date and exact code revision reviewed:
- Rules and language(s) in scope:
- Method and representative systems/scenarios considered:
- Findings by rule ID, with concrete examples and source pinpoints:
- False-positive / false-negative classes and residual limitations:
- Required changes before approval:
- Outcome: approved for stated scope / changes requested / informational only:
- Signed record ID and registered key ID (if authorized by project governance):

**Governance note:** the current authorized reviewer registry is empty. Completing this brief does not authorize a review status or release claim; reviewer authorization and a valid signed record are still required.
