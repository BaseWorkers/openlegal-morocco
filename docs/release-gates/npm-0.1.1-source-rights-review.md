# OpenLegal npm 0.1.1 source-rights review packet

**Preparation only.** This packet is a file inventory and review aid. It is not a rights determination, legal review, authorship record, or publication approval.

- Original PR #16 inventory: commit `7ee3103e6b7045ae66e21ff25bb502bb078860bf`; `openlegal@0.1.1`, 196 files, 1301241 unpacked bytes; integrity `sha512-bUhpdFIuFReKwitX/KT04sIJi/7fLnFjDLlqDIhjtP8nv1aiSM4h0Ha3Zi/ibq3RokF+K9XZo4P90tmkLuVhjQ==`.
- Current-main candidate recheck (2026-10-12): base `main` commit `0684959816cbcd7402f27ae00be28ad6eccba204`; release-preparation commit `5bb2d22` (`codex/v0.1.1-candidate-current-main`). `npm pack --dry-run --json --ignore-scripts` reports `openlegal@0.1.1`, 196 files, 1305025 unpacked bytes, 112 template files across 14 template packages, no package-level `license` field, and integrity `sha512-SGrrhs3E0dfFMAbwLFy0RS4EH9iuFkSG4CirKHY5HRypMxW453tJHKHqvpKwR2QRtpEOffs5NwkUerKbZTRW8w==`. This is a local dry run, not a publish or rights approval.
- package.json license field: not set; the package combines different intended licenses.
- Scope-map status: provisional; scope-map validator covers the repository, but explicitly says human ownership, source-rights, and license review remain required.
- Shipped paths: 196; covered by intended-scope rules: 196; unmapped: 0.
- Scope counts in this tarball: project-documentation: 8; upstream-license-texts: 2; original-content: 126; software-and-tooling: 60.
- Template packages: 14; template files shipped: 112; all template review states remain DRAFT.
- Declared template sources: 39; reuse-status counts: research-only: 38; file-level-review-required: 1.
- Declared source IDs absent from registry: none.

## Decision required under issue #5

1. Confirm ownership/authorship or contributor permissions for every shipped file, especially all template text, research prose, clauses, and source metadata.
2. Confirm the intended license for every shipped path and whether the mixed-license package metadata and notices communicate it accurately.
3. Review upstream terms and source-to-template similarities for every third-party source; record required attribution and compatibility with this package and redistribution.
4. Exclude or clearly mark material whose rights are unclear or incompatible before stable publication.
5. Verify contributor agreement language and named maintainer responsibility. DCO sign-off alone does not establish copyright ownership, assignment, or permission to license the material.

## Additional provenance finding (2026-10-12)

- Inspection of the paired private repository history found the initial foundation commit `552766e844b052c859730827b1b83990b7f8cf7f` added the multilingual template packages in one large snapshot. Its Git author is `Jawadbenhammoupro <jawadbenhammou.pro@gmail.com>`; that records the commit author field, not proof that every line was personally written or that all third-party rights were clear.
- That initial commit has no `Signed-off-by` trailer, and `DCO.md` was not present in that commit. The repository's later DCO process therefore does not retroactively certify the initial template snapshot. A current DCO sign-off on a later documentation commit is not a substitute for an explicit rights/provenance attestation covering the original content.
- The private-history evidence does not identify per-file authors, external assistance, employer/client contributions, or source-specific adaptations. The selected General Legal source audit checked the pinned repository license, README, and one mutual-NDA source file only; it did not compare the other four source files associated with five packages. The template notes assert no wording was copied or adapted, but that assertion is not a completed clause-by-clause comparison.
- Disposition: rights clearance remains **unresolved**. Do not close issue #5 or publish the template-inclusive stable tarball until ownership/authority and the remaining source-to-template comparison are documented and independently accepted.

## Source records used by the 14 template packages

| Source ID | Verification | Reuse status | Recorded license / signal | Used by |
| --- | --- | --- | --- | --- |
| `adala-code-travail` | verified | research-only | none recorded | business/independent-contractor-agreement, employment/employee-confidentiality-ip, employment/employment-agreement, employment/internship-agreement, employment/offer-letter |
| `adala-consumer-protection` | verified | research-only | none recorded | business/terms-of-service |
| `adala-decree-2-22-687-electronic-trust-services` | verified | research-only | none recorded | business/terms-of-service |
| `adala-electronic-transactions` | verified | research-only | none recorded | business/terms-of-service |
| `adala-law-2-00-copyright` | verified | research-only | none recorded | employment/employee-confidentiality-ip |
| `adala-portal-code-obligations` | verified | research-only | none recorded | business/independent-contractor-agreement, business/master-services-agreement, business/mutual-nda, business/one-way-nda, software/software-development-agreement, software/statement-of-work |
| `bdj-law-43-20-metadata` | verified | research-only | none recorded | business/terms-of-service |
| `cndp-conformite-des-sites-web` | verified | research-only | none recorded | privacy/cookie-notice, privacy/privacy-policy |
| `cndp-decret-2-09-165` | verified | research-only | none recorded | privacy/cookie-notice, privacy/data-processing-agreement, privacy/privacy-policy |
| `cndp-deliberation-d-939-2025-cookie-data` | verified | research-only | none recorded | privacy/cookie-notice |
| `cndp-demande-accompagnement-form-categories` | verified | research-only | none recorded | privacy/cookie-notice |
| `cndp-form-f214-20250724` | verified | research-only | none recorded | privacy/cookie-notice |
| `cndp-guide-conformite-sites-web-pdf` | verified | research-only | none recorded | privacy/cookie-notice |
| `cndp-loi-09-08` | verified | research-only | none recorded | privacy/cookie-notice, privacy/data-processing-agreement, privacy/privacy-policy |
| `cndp-notifier-un-traitement` | verified | research-only | none recorded | privacy/cookie-notice, privacy/data-processing-agreement, privacy/privacy-policy |
| `cndp-procedures-de-notification-process` | verified | research-only | none recorded | privacy/cookie-notice |
| `general-legal-templates` | verified | file-level-review-required | CC0-1.0 repository-level signal; target-file rights not cleared | business/master-services-agreement, business/mutual-nda, business/one-way-nda, software/software-development-agreement, software/statement-of-work |
| `ilo-natlex-decree-2-91-517-reproduction` | verified | research-only | none recorded | employment/internship-agreement |
| `ompic-law-23-13` | verified | research-only | none recorded | employment/employee-confidentiality-ip, software/software-development-agreement |
| `sgg-bill-013-26-copyright-status` | verified | research-only | none recorded | employment/employee-confidentiality-ip |
| `sgg-bo-4197-ar-decree-2-91-517` | unverified | research-only | none recorded | employment/internship-agreement |
| `sgg-bo-5210-2004-labor-code` | verified | research-only | none recorded | business/independent-contractor-agreement, employment/employee-confidentiality-ip, employment/employment-agreement, employment/internship-agreement, employment/offer-letter |
| `sgg-bo-5714-2009` | verified | research-only | none recorded | privacy/cookie-notice, privacy/data-processing-agreement, privacy/privacy-policy |
| `sgg-bo-6342-ar-law-101-14-insertion-training` | verified | research-only | none recorded | employment/internship-agreement |
| `sgg-bo-6344-law-101-14-insertion-training` | verified | research-only | none recorded | employment/internship-agreement |
| `sgg-bo-6945-law-78-20-amends-31-08-article-202` | verified | research-only | none recorded | business/terms-of-service |
| `sgg-bo-6951-law-43-20` | verified | research-only | none recorded | business/terms-of-service |
| `sgg-bo-7162-decree-2-22-687` | verified | research-only | none recorded | business/terms-of-service |
| `sgg-bo-7362-law-60-24-finance-2025` | verified | research-only | none recorded | employment/internship-agreement |
| `sgg-bo-7399-decree-2-25-266-cnss` | verified | research-only | none recorded | employment/internship-agreement |
| `sgg-bo-7443-order-1314-25-cnss-base` | verified | research-only | none recorded | employment/internship-agreement |
| `sgg-bo-7464-erratum-order-1314-25` | verified | research-only | none recorded | employment/internship-agreement |
| `sgg-bo-7533-law-013-26` | verified | research-only | none recorded | employment/internship-agreement |
| `sgg-consolidated-copyright-law-2-00` | verified | research-only | none recorded | employment/employee-confidentiality-ip |
| `sgg-consolidated-law-31-08` | verified | research-only | none recorded | business/terms-of-service |
| `sgg-consolidated-texts-index` | verified | research-only | none recorded | business/terms-of-service |
| `sgg-legislation-portal-032-26-status` | verified | research-only | none recorded | employment/employment-agreement, employment/offer-letter |
| `sgg-legislation-portal-51-25-status` | verified | research-only | none recorded | employment/internship-agreement, employment/offer-letter |
| `sgg-projet-labor-amendment-032-26` | verified | research-only | none recorded | business/independent-contractor-agreement, employment/employee-confidentiality-ip, employment/employment-agreement, employment/offer-letter |

## Every path in the 0.1.1 tarball

| Shipped path | Intended-scope rule | Intended SPDX | Rule exception / limitation |
| --- | --- | --- | --- |
| `DISCLAIMER.md` | project-documentation | CC0-1.0 | Referenced third-party material is excluded. |
| `INTEGRATIONS.md` | project-documentation | CC0-1.0 | Referenced third-party material is excluded. |
| `LICENSES/CC0-1.0.txt` | upstream-license-texts | upstream terms retained | Keep upstream license text, copyright, and notices intact; do not apply the project license to these files. DCO.md is the verbatim DCO 1.1 text and its notice must remain intact. |
| `LICENSES/MIT.txt` | upstream-license-texts | upstream terms retained | Keep upstream license text, copyright, and notices intact; do not apply the project license to these files. DCO.md is the verbatim DCO 1.1 text and its notice must remain intact. |
| `LICENSES/README.md` | project-documentation | CC0-1.0 | Referenced third-party material is excluded. |
| `LICENSES/scopes.json` | project-documentation | CC0-1.0 | Referenced third-party material is excluded. |
| `README.ar.md` | project-documentation | CC0-1.0 | Referenced third-party material is excluded. |
| `README.fr.md` | project-documentation | CC0-1.0 | Referenced third-party material is excluded. |
| `README.md` | project-documentation | CC0-1.0 | Referenced third-party material is excluded. |
| `RELEASE_NOTES.md` | project-documentation | CC0-1.0 | Referenced third-party material is excluded. |
| `clauses/catalog.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `mcp/README.md` | software-and-tooling | MIT | More specific path rules override this rule. |
| `mcp/server.py` | software-and-tooling | MIT | More specific path rules override this rule. |
| `package.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `research/morocco/claims.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `research/morocco/companies.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `research/morocco/consumer-ecommerce.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `research/morocco/contracts.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `research/morocco/electronic-transactions.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `research/morocco/employment.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `research/morocco/intellectual-property.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `research/morocco/privacy-data-protection.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `reviews/authorized-reviewers.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `reviews/records.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `reviews/research-records.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `schemas/authorized-reviewers.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/change-candidate.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/clause-catalog.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/control-taxonomy.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/findings-v1.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/findings.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/research-claim.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/research-review.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/review-transitions.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/review.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/source.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/template-sources.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/template.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `schemas/variables.schema.json` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/audit-generator-privacy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/audit-internal-links.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/audit-markdown-accessibility.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/audit-review-transitions.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/audit-secrets.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/audit-source-links.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/build-review-packets.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/build-site.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/build-static-api.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/catalog.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/change-tracker.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/changelog-policy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/check-dco.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/check-syntax.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/clause-catalog-policy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/docx-export.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/export-project-preview.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/export-template.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/findings.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/generator-core.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/generator-policy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/generator-runtime.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/markdown-renderer.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/openlegal-mcp.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/openlegal.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/project-export-policy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/render-template.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/research-claim-policy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/review-policy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/review-signatures.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/scanner.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/schema-validator.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/sign-review-record.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/source-link-network.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/source-link-policy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/source-reuse-policy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/template-package-utils.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/template-source-use-policy.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/translation-parity.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/validate-codex-plugin.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/validate-foundation.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/validate-license-scopes.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `scripts/validate-template-packages.mjs` | software-and-tooling | MIT | More specific path rules override this rule. |
| `sources/official-morocco.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `sources/registry.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/independent-contractor-agreement/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/independent-contractor-agreement/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/independent-contractor-agreement/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/independent-contractor-agreement/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/independent-contractor-agreement/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/independent-contractor-agreement/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/independent-contractor-agreement/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/independent-contractor-agreement/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/master-services-agreement/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/master-services-agreement/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/master-services-agreement/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/master-services-agreement/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/master-services-agreement/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/master-services-agreement/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/master-services-agreement/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/master-services-agreement/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/mutual-nda/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/mutual-nda/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/mutual-nda/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/mutual-nda/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/mutual-nda/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/mutual-nda/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/mutual-nda/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/mutual-nda/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/one-way-nda/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/one-way-nda/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/one-way-nda/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/one-way-nda/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/one-way-nda/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/one-way-nda/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/one-way-nda/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/one-way-nda/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/terms-of-service/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/terms-of-service/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/terms-of-service/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/terms-of-service/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/terms-of-service/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/terms-of-service/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/terms-of-service/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/business/terms-of-service/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employee-confidentiality-ip/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employee-confidentiality-ip/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employee-confidentiality-ip/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employee-confidentiality-ip/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employee-confidentiality-ip/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employee-confidentiality-ip/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employee-confidentiality-ip/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employee-confidentiality-ip/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employment-agreement/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employment-agreement/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employment-agreement/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employment-agreement/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employment-agreement/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employment-agreement/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employment-agreement/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/employment-agreement/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/internship-agreement/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/internship-agreement/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/internship-agreement/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/internship-agreement/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/internship-agreement/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/internship-agreement/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/internship-agreement/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/internship-agreement/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/offer-letter/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/offer-letter/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/offer-letter/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/offer-letter/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/offer-letter/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/offer-letter/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/offer-letter/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/employment/offer-letter/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/cookie-notice/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/cookie-notice/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/cookie-notice/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/cookie-notice/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/cookie-notice/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/cookie-notice/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/cookie-notice/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/cookie-notice/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/data-processing-agreement/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/data-processing-agreement/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/data-processing-agreement/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/data-processing-agreement/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/data-processing-agreement/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/data-processing-agreement/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/data-processing-agreement/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/data-processing-agreement/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/privacy-policy/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/privacy-policy/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/privacy-policy/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/privacy-policy/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/privacy-policy/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/privacy-policy/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/privacy-policy/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/privacy/privacy-policy/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/software-development-agreement/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/software-development-agreement/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/software-development-agreement/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/software-development-agreement/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/software-development-agreement/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/software-development-agreement/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/software-development-agreement/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/software-development-agreement/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/statement-of-work/CHANGELOG.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/statement-of-work/ar.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/statement-of-work/en.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/statement-of-work/fr.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/statement-of-work/metadata.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/statement-of-work/notes.md` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/statement-of-work/sources.yaml` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |
| `templates/software/statement-of-work/variables.schema.json` | original-content | CC0-1.0 | Third-party text, source material, and individually authored reviewer submissions keep their own rights and notices. |

## Reviewer record

- Reviewer name / authorized ID:
- Qualifications and relevant rights/licensing experience:
- Conflict and independence statement:
- Date and exact package integrity reviewed:
- Method: ownership/provenance checks, source-term checks, file-level comparison, attribution/notice review:
- Files or sources requiring exclusion, correction, or additional evidence:
- Required changes before publication:
- Outcome: approved for stated scope / changes requested / unresolved:
- Signed record ID and registered key ID (if authorized by governance):
