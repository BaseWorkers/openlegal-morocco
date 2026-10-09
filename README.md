# Open Legal Morocco

Open Legal Morocco is an independent, non-profit-purpose open-source project maintained as a GitHub repository. It aims to help Moroccan startups and other teams operating online recognize common legal questions and prepare drafts to discuss with qualified counsel. It is intended for public benefit and community contribution, not as a profit-making venture; this description does not claim registered nonprofit status. It does not certify legal compliance. There is no public website or hosted generator.

## Status

- 14 structured template packages are present; all are drafts in English, French, and Arabic.
- No template is marked `LEGAL_REVIEWED` or `RELEASED`. Drafts may be incomplete, outdated, or unsuitable for a particular situation.
- No government or professional endorsement is claimed.
- Software license target: MIT. See [`LICENSES/MIT.txt`](LICENSES/MIT.txt).
- Original legal-content license target: CC0-1.0. See [`LICENSES/CC0-1.0.txt`](LICENSES/CC0-1.0.txt).
- Provisional path-to-license mapping: [`LICENSES/README.md`](LICENSES/README.md) and [`LICENSES/scopes.json`](LICENSES/scopes.json); this does not establish ownership or clear third-party rights.
- Third-party material keeps its own rights and license. A project license target does not authorize reuse of material the project does not own.

This is an informational project, not legal advice. Read [`DISCLAIMER.md`](DISCLAIMER.md) before using any material.

## Template catalog

Each package includes metadata, a variable schema, source declarations, review notes, a changelog, and the EN/FR/AR Markdown texts. Open the linked language file; the adjacent files in that folder contain the rest of the package. Package metadata includes document type, intended business types, use-case tags, and review status for repository search. These tags help locate drafts and do not determine legal suitability.

| Template | Area | EN / FR / AR |
|---|---|---|
| Mutual NDA | [Business](templates/business/README.md) | [EN](templates/business/mutual-nda/en.md) · [FR](templates/business/mutual-nda/fr.md) · [AR](templates/business/mutual-nda/ar.md) |
| One-Way NDA | [Business](templates/business/README.md) | [EN](templates/business/one-way-nda/en.md) · [FR](templates/business/one-way-nda/fr.md) · [AR](templates/business/one-way-nda/ar.md) |
| Independent Contractor Agreement | [Business](templates/business/README.md) | [EN](templates/business/independent-contractor-agreement/en.md) · [FR](templates/business/independent-contractor-agreement/fr.md) · [AR](templates/business/independent-contractor-agreement/ar.md) |
| Master Services Agreement | [Business](templates/business/README.md) | [EN](templates/business/master-services-agreement/en.md) · [FR](templates/business/master-services-agreement/fr.md) · [AR](templates/business/master-services-agreement/ar.md) |
| Terms of Service | [Business](templates/business/README.md) | [EN](templates/business/terms-of-service/en.md) · [FR](templates/business/terms-of-service/fr.md) · [AR](templates/business/terms-of-service/ar.md) |
| Employment Agreement | [Employment](templates/employment/README.md) | [EN](templates/employment/employment-agreement/en.md) · [FR](templates/employment/employment-agreement/fr.md) · [AR](templates/employment/employment-agreement/ar.md) |
| Internship / Training Placement Agreement | [Employment](templates/employment/README.md) | [EN](templates/employment/internship-agreement/en.md) · [FR](templates/employment/internship-agreement/fr.md) · [AR](templates/employment/internship-agreement/ar.md) |
| Employment Offer Letter | [Employment](templates/employment/README.md) | [EN](templates/employment/offer-letter/en.md) · [FR](templates/employment/offer-letter/fr.md) · [AR](templates/employment/offer-letter/ar.md) |
| Employee Confidentiality and IP Agreement | [Employment](templates/employment/README.md) | [EN](templates/employment/employee-confidentiality-ip/en.md) · [FR](templates/employment/employee-confidentiality-ip/fr.md) · [AR](templates/employment/employee-confidentiality-ip/ar.md) |
| Privacy Policy | [Privacy](templates/privacy/README.md) | [EN](templates/privacy/privacy-policy/en.md) · [FR](templates/privacy/privacy-policy/fr.md) · [AR](templates/privacy/privacy-policy/ar.md) |
| Cookie and Similar Technology Notice | [Privacy](templates/privacy/README.md) | [EN](templates/privacy/cookie-notice/en.md) · [FR](templates/privacy/cookie-notice/fr.md) · [AR](templates/privacy/cookie-notice/ar.md) |
| Data Processing Agreement | [Privacy](templates/privacy/README.md) | [EN](templates/privacy/data-processing-agreement/en.md) · [FR](templates/privacy/data-processing-agreement/fr.md) · [AR](templates/privacy/data-processing-agreement/ar.md) |
| Software Development Agreement | [Software](templates/software/README.md) | [EN](templates/software/software-development-agreement/en.md) · [FR](templates/software/software-development-agreement/fr.md) · [AR](templates/software/software-development-agreement/ar.md) |
| Statement of Work | [Software](templates/software/README.md) | [EN](templates/software/statement-of-work/en.md) · [FR](templates/software/statement-of-work/fr.md) · [AR](templates/software/statement-of-work/ar.md) |

## Repository map

- [`templates/`](templates/): versioned, structured multilingual template packages.
- [`clauses/`](clauses/): clause taxonomy with source/template reference checks; concepts cannot be assigned to templates or advanced beyond taxonomy-only until clause-level human review is supported.
- [`research/morocco/`](research/morocco/): topic research notes and machine-readable claims.
- [`sources/`](sources/): source registry, official-source map, and reuse decisions.
- [`schemas/`](schemas/): metadata, variables, sources, claims, and review schemas.
- [`reviews/`](reviews/): review policy, reviewer authorization records, and generated review packets.
- [`scripts/`](scripts/): validation, source-link audit, review-packet, and offline rendering tools.
- [`.github/`](.github/): contribution forms, pull-request checklist, and CI.
- [`ROADMAP.md`](ROADMAP.md): staged implementation plan and open work.

## Contributing

Contributions are welcome from Moroccan legal professionals, researchers, translators, developers, founders, and teams adapting the project. Read [`CONTRIBUTING.md`](CONTRIBUTING.md), [`REVIEWING.md`](REVIEWING.md), and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before contributing. Every important Moroccan legal claim needs traceable support or an explicit unresolved status. Legal and language review requires an authorized human's independently authenticated approval of the exact version. No template is currently approved, and public feedback or automated checks do not count as professional review. The v0.0.1 preview invites review and collaboration; it does not represent legal approval.

## Development

Requires Node.js 22 or later. CI uses Node.js 24. The project uses Node built-ins and has no runtime dependencies.

```sh
npm run validate
npm run audit:links
npm run audit:internal-links
npm run audit:privacy
npm test
npm run build:review-packets
```

The review-packet command writes generated materials under ignored `dist/review-packets/`; it prepares review documents but does not approve them.

The offline renderer/exporter reads up to 1 MiB of UTF-8 JSON values from standard input and refuses generation unless the selected template and language have passed the legal, language, release, and input-safety gates. It rejects larger inputs, malformed UTF-8, control characters, line separators, and bidirectional formatting controls in text values. No current package meets those gates. Export supports Markdown, plain text, standalone HTML, DOCX, and PDF; PDF conversion requires LibreOffice or `soffice` on the local machine. Inputs are not sent over the network or persisted by the tool. Select an explicit output path; the command will not overwrite an existing file.

```sh
# Illustrative only: all current packages are drafts and fail the release/review gate.
npm run export -- templates/business/mutual-nda en md ./mutual-nda.md < values.json
npm run export -- templates/business/mutual-nda ar txt ./mutual-nda.txt < values.json
npm run export -- templates/business/mutual-nda ar docx ./mutual-nda.docx < values.json
npm run export -- templates/business/mutual-nda ar pdf ./mutual-nda.pdf < values.json
```

## Project plan

The staged roadmap maps the supplied project plan and records the current repository-only scope in [`ROADMAP.md`](ROADMAP.md). The project uses other template repositories for research and comparison only; it is not a fork and does not copy their branding or Git history.
# Developer interoperability

The project publishes a vendor-neutral, versioned findings schema and read-only export interfaces. See [the interoperability specification](docs/INTEROPERABILITY.md) for JSON/Markdown CLI exports, MCP validation, the generic control taxonomy, privacy limits, and compatibility policy.
