# Content model and sources of truth

This repository uses the template packages, source registry, research claims, and immutable review records as its content sources of truth. CLI, MCP, static API, findings, and site outputs are derived views; they must not become independent stores for legal content or review status.

## Template packages

Each package lives under `templates/<category>/<id>/` and is identified by `metadata.yaml`. The current metadata is JSON-compatible YAML and is validated against `schemas/template.schema.json`. It records the stable ID and slug, localized titles, jurisdiction, categories, discovery use cases, supported languages, semantic version, status, legal and language review fields, generator gate, license, and last-updated date. A language file is present only for a language named in metadata; validation checks package consistency.

`status` describes the package's recorded workflow state. `legal_review.status` and per-language `language_review` are separate recorded fields; tools display them as stored and do not infer that one implies another. `generator_enabled` is an independent gate and must remain false unless the applicable policy and human authorization permit enabling it.

## Source provenance and claims

`sources/registry.yaml` contains source identity, title, publisher, jurisdiction, source type, HTTPS URL, access and verification dates, verification status, reuse basis, reuse status, license and scope details, and limitations. Registry inclusion or `verification_status: verified` does not mean that every legal proposition is current, applicable, or approved.

Each package's `sources.yaml` links its source IDs and declared uses to the source registry. Reused wording requires an exact reviewed reuse scope and attribution as enforced by package validation. Research claims live in `research/**/claims.json`; the claim schema separates source-text evidence, current-law status, legal-review status, pinpoint, and notes. A claim-to-source link is provenance, not a legal conclusion.

## Review evidence

Review records under `reviews/` bind an exact template ID and version, language/scope, reviewer identifier, outcome, review date, and SHA-256 digest. Legal and research review records use the repository's signed-record schemas. Language review evidence is tracked separately by language. A material edit changes the content digest; prior evidence must not be represented as covering the changed content. The review-transition policy in `schemas/review-transitions.json` describes allowed package-status transitions, while CI audits changes to review fields. A permitted transition alone does not authenticate a reviewer or establish that an approval is genuine.

No automation may create a human approval, change legal-review status, or imply a qualified person reviewed a language/version. Only evidence recorded in the repository is reportable, with its exact scope and verification limits.

## Derived interfaces

- The local CLI, MCP server, generated static API, and catalog load package metadata and sources from this repository.
- Generated artifacts include repository revision and recorded status where available; they do not own or alter those values.
- The findings schema models technical observations and potential legal questions separately. Findings output is an export, not a template-review state.
- The source change tracker stores only a candidate hash comparison and awaits maintainer/source verification and qualified legal assessment.

When fields conflict or required evidence is missing, preserve the underlying records, report the inconsistency or unknown, and request review through the repository workflow. Do not resolve ambiguity by silently promoting a status or inventing a default.
