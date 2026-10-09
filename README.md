# OpenLegal

[English](README.md) · [Français](README.fr.md) · [العربية](README.ar.md)

**v0.0.3 · OpenLegal npm package preview**

OpenLegal is an independent, public-interest project building reusable legal-document resources to help Moroccan startups and other teams operating online recognize common legal questions and prepare discussion drafts for qualified Moroccan counsel. The project has no profit-making aim; this describes its purpose, not a registered legal status. The project is open to community contribution and adaptation, and its license terms allow reuse, including commercial reuse.

We welcome Moroccan lawyers and legal researchers, Arabic/French/English translators, founders, and software contributors to help review, improve, translate, or adapt the project. To apply as a legal reviewer, language reviewer, research reviewer, or community moderator, use the [reviewer interest form](https://github.com/BaseWorkers/openlegal-morocco/issues/new?template=reviewer-interest.yml) and read the [onboarding guide](docs/REVIEWER_ONBOARDING.md). The form and replies are public; do not submit private documents or contact details. For other contributions, open **Issues → New issue → Offer a contribution**. See [Contributing](CONTRIBUTING.md) and [release notes](RELEASE_NOTES.md).

## Install the public CLI

Requires Node.js 22 or later.

```sh
npm install openlegal
npx openlegal --help
```

For a global command, use `npm install --global openlegal`. The optional `openlegal-mcp` command requires Python 3.10 or later. This release contains Morocco-focused materials only.

## Current status

This v0.0.3 preview contains 14 structured template packages shared for community review and contribution. They are not ready for public reliance. No template is marked `LEGAL_REVIEWED` or `RELEASED`, and no authorized human legal or language review is recorded.

The files are working drafts. They may be incomplete, outdated, or unsuitable for a specific person, transaction, or business. The project does not certify that a business or document is legally compliant. Do not sign or rely on them without qualified Moroccan legal advice.

## Browse templates

### Business

- [Independent Contractor Agreement — discussion draft](templates/business/independent-contractor-agreement/en.md) · [FR](templates/business/independent-contractor-agreement/fr.md) · [AR](templates/business/independent-contractor-agreement/ar.md) — DRAFT; v0.1.1
- [Master Services Agreement — discussion draft](templates/business/master-services-agreement/en.md) · [FR](templates/business/master-services-agreement/fr.md) · [AR](templates/business/master-services-agreement/ar.md) — DRAFT; v0.1.1
- [Mutual Non-Disclosure Agreement](templates/business/mutual-nda/en.md) · [FR](templates/business/mutual-nda/fr.md) · [AR](templates/business/mutual-nda/ar.md) — DRAFT; v0.1.3
- [One-Way Non-Disclosure Agreement](templates/business/one-way-nda/en.md) · [FR](templates/business/one-way-nda/fr.md) · [AR](templates/business/one-way-nda/ar.md) — DRAFT; v0.1.1
- [Terms of Service — discussion draft](templates/business/terms-of-service/en.md) · [FR](templates/business/terms-of-service/fr.md) · [AR](templates/business/terms-of-service/ar.md) — DRAFT; v0.1.1

### Employment

- [Employee Confidentiality and Intellectual Property Agreement — discussion draft](templates/employment/employee-confidentiality-ip/en.md) · [FR](templates/employment/employee-confidentiality-ip/fr.md) · [AR](templates/employment/employee-confidentiality-ip/ar.md) — DRAFT; v0.1.0
- [Employment Agreement — discussion draft](templates/employment/employment-agreement/en.md) · [FR](templates/employment/employment-agreement/fr.md) · [AR](templates/employment/employment-agreement/ar.md) — DRAFT; v0.1.0
- [Internship / Training Placement Agreement — discussion draft](templates/employment/internship-agreement/en.md) · [FR](templates/employment/internship-agreement/fr.md) · [AR](templates/employment/internship-agreement/ar.md) — DRAFT; v0.1.2
- [Employment Offer Letter — discussion draft](templates/employment/offer-letter/en.md) · [FR](templates/employment/offer-letter/fr.md) · [AR](templates/employment/offer-letter/ar.md) — DRAFT; v0.1.0

### Privacy

- [Cookie and Similar Technology Notice — discussion draft](templates/privacy/cookie-notice/en.md) · [FR](templates/privacy/cookie-notice/fr.md) · [AR](templates/privacy/cookie-notice/ar.md) — DRAFT; v0.1.3
- [Data Processing Agreement — discussion draft](templates/privacy/data-processing-agreement/en.md) · [FR](templates/privacy/data-processing-agreement/fr.md) · [AR](templates/privacy/data-processing-agreement/ar.md) — DRAFT; v0.1.2
- [Privacy Policy — discussion draft](templates/privacy/privacy-policy/en.md) · [FR](templates/privacy/privacy-policy/fr.md) · [AR](templates/privacy/privacy-policy/ar.md) — DRAFT; v0.1.3

### Software

- [Software Development Agreement — discussion draft](templates/software/software-development-agreement/en.md) · [FR](templates/software/software-development-agreement/fr.md) · [AR](templates/software/software-development-agreement/ar.md) — DRAFT; v0.1.0
- [Statement of Work — discussion draft](templates/software/statement-of-work/en.md) · [FR](templates/software/statement-of-work/fr.md) · [AR](templates/software/statement-of-work/ar.md) — DRAFT; v0.1.0

## Sources and limitations

Each package includes its own source declarations, assumptions, and review notes. The source registry and Morocco research folder provide additional provenance. Source references do not mean that a template has been legally approved or that a cited rule is current.

Machine-readable review ledgers and the reviewer authorization registry are included for provenance. Their current empty state means no human review approval is recorded. The included schemas describe the project data formats.

This repository also includes the project validation and export tools, automated GitHub checks, and test fixtures that support the template and provenance system.

## Project policies

- [Governance](GOVERNANCE.md)
- [Contributing](CONTRIBUTING.md)
- [Reviewing and feedback](REVIEWING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [License policy](LICENSES/README.md)

Read [DISCLAIMER.md](DISCLAIMER.md) before using any material. Original legal content, research prose, and template packages are intended for CC0-1.0 ([license text](LICENSES/CC0-1.0.txt)); included schemas and tooling are intended for MIT ([license text](LICENSES/MIT.txt)). The scope map is provisional and does not clear third-party material or reviewer submissions, which remain subject to their own rights and notices. Only contribute material you have the right to share under the applicable license.

## Local tools

Try the [CLI and MCP smoke tests](INTEGRATIONS.md) against this checkout. Both tools are read-only; their output does not count as professional review.

## Developer interoperability

The project publishes a vendor-neutral, versioned findings schema and read-only export interfaces. See [the interoperability specification](docs/INTEROPERABILITY.md) for JSON and Markdown CLI exports, MCP validation, the generic control taxonomy, privacy limits, and compatibility policy.

## Static catalog preview

Build the local multilingual, read-only catalog with `npm run build:site`. See [site documentation](docs/SITE.md) for preview instructions and the owner-confirmed public URL requirement.
