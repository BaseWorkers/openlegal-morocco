# OpenLegal scanner rules — independent privacy review brief

**Status:** preparation for specialist review only. This document is not legal advice, a privacy assessment, or approval of the scanner. Do not treat automated validation or this brief as a professional review.

**Code baseline for review:** `BaseWorkers/openlegal-morocco` PR #16, branch `release/v0.1.1-stable`, commit `7ee3103e6b7045ae66e21ff25bb502bb078860bf` (parent `2c2edebfd774d1ce23acd360254e58d086fd7a80`). This is not yet `main`. Confirm this exact SHA and regenerate any packet inputs from it before recording a review. PR validation, DCO, and CodeQL checks passed on this SHA; those checks do not substitute for privacy-specialist review.

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

URL notice detection applied an anchored heading expression to the entire HTML document. A normal document beginning with `<!doctype html><html>...` therefore did not match a later `<h1>Privacy Policy</h1>`, even though the same title in the recognized path could match. Commit `7ee3103e6b7045ae66e21ff25bb502bb078860bf` changes the expression so Markdown headings stay line-anchored while HTML `<h1>`–`<h3>` and `<title>` tags may match anywhere in the document, including simple nested inline tags. A regression case covers a complete HTML document. The PR's `validate` and CodeQL checks passed for this exact commit. Ask the privacy reviewer to assess the revised rule's scope and residual false positives/negatives.

## Existing automated examples and review gaps

`tests/scanner.test.mjs` currently exercises output schema and no source excerpts; skipped secrets/dependencies/build output/lockfiles/symlinks; repository notice detection and a documentation-example non-match; localized output structure; Next.js detection; combined URL/repository coverage; same-origin HTML/privacy links and sanitized evidence; cookie storage without tracking classification; inaccessible-link reporting; critical-finding presentation; and rejection of private IP and cross-origin redirects. Commit `7ee3103e6b7045ae66e21ff25bb502bb078860bf` adds a regression case for a notice heading later in a complete HTML document.

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
