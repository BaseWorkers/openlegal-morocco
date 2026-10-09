# v0.0.3 — OpenLegal npm package preview

This release establishes OpenLegal as the public product brand and publishes an installable CLI package named `openlegal`. It adds `openlegal` and `openlegal-mcp` commands for local, read-only use. The package contains the Morocco jurisdiction pack only; additional jurisdictions are not included or implied.

Install into a project with `npm install openlegal` and run `npx openlegal --help`. For global use, install with `npm install --global openlegal`. MCP clients can launch `openlegal-mcp`; Python 3.10 or newer is required. All fourteen template packages remain `DRAFT`, and no professional review is recorded.

The tools do not make network requests, edit files, or approve legal content. Read [the integration guide](INTEGRATIONS.md) and [disclaimer](DISCLAIMER.md) before use.

---

# v0.0.2 — Local tooling test preview

This preview makes the local command-line interface and read-only MCP server easier for people to configure, try, and report feedback on. It is intended for technical evaluation and community feedback; it does not represent legal or language approval.

## Test the local tools

- CLI and MCP: follow the [integration guide](INTEGRATIONS.md) to configure the local tools and make sample read-only calls.
- The command-line tool requires Node.js 22 or newer; the MCP server requires Python 3.10 or newer. Neither tool requires third-party runtime packages.

The CLI and MCP server read only the local checkout. They do not access a tester's private repository, make network requests, edit files, or approve any material. Please use synthetic or public examples only; do not send personal, client, confidential, or secret data to the tools or in public issues.

## Content and review status

All fourteen template packages remain `DRAFT`. The legal and language reviewer registries remain empty, and no maintainers have been appointed. The tooling does not turn source records, passing checks, or tester feedback into professional review.

The public contribution, license-scope, and source-rights limitations stated in v0.0.1 remain in force. This tooling preview does not clear third-party rights, settle contribution terms, or establish a staffed confidential reporting service.

# v0.0.1 — Early public contribution release

OpenLegal is an independent, public-interest project intended to help Moroccan startups and other teams operating online recognize common legal questions and prepare document drafts to discuss with qualified Moroccan counsel. The project has no profit-making aim; this describes its purpose, not a registered legal status. Its goal is to make useful, reusable starting points easier to find, discuss, review, and adapt. It does not certify legal compliance.

This first release is a community contribution preview. It is being shared so Moroccan legal professionals and researchers, translators, founders, and developers can help shape the work. It is not a claim that the templates are complete or professionally approved.

## Included

- Fourteen structured legal-template discussion drafts, with English, French, and Arabic versions.
- Template metadata, declared variables, source records, research notes, and explicit review-status tracking.
- Project policies, contribution and review workflows, and GitHub issue forms for research and template corrections.
- Repository validation, document export, and automated checks.

This is a repository project. It does not include or depend on a public website.

## Review status and limits

All fourteen templates are marked `DRAFT`. No authorized human legal or language review is recorded, and none is marked `LEGAL_REVIEWED` or `RELEASED`. Sources and automated checks do not amount to legal advice, professional review, or a guarantee that a document is current, valid, enforceable, or suitable for a particular business. Read [DISCLAIMER.md](DISCLAIMER.md) before using any material.

The project is intended to license original legal content under CC0-1.0 and original software under MIT. The path map and ownership review are provisional. This release does not clear third-party rights or license contributor submissions; contributors should only share material they have the right to contribute under the applicable license. The stated licenses allow reuse under their terms, including commercial reuse; the project's public-interest purpose does not add a non-commercial restriction.

The project has not finalized legal terms for accepting contributor submissions and has no contributor license agreement or ownership-assignment process. The path map describes intended license scopes only. A pull request does not establish ownership or clear rights; maintainers must verify rights and resolve contribution terms before merging contributed content.

## Help the project

Contributions are welcome in legal research, source verification, template review, translation, accessibility, and software. Start with [CONTRIBUTING.md](CONTRIBUTING.md), review the [governance policy](GOVERNANCE.md), and use the repository issue forms to suggest corrections or areas where help is needed. Do not submit personal data, confidential client material, or completed agreements.

Base Workers is the founding project owner and technical maintainer. No authorized legal or language reviewers have been appointed. Public contributions may help establish review capacity; no contribution or issue changes a template's review status by itself.
# v0.1.0 (pre-release, not yet published)

- Add `openlegal scan` for bounded, local-only Node.js and TypeScript repository indicators, with Markdown/JSON output and English, French, and Arabic report text.
- Add Findings contract v2.0.0 with explicit rule IDs and Moroccan jurisdiction; keep v1 exports valid and publish both schema versions in the static API build.
- Add MCP `scan_repository`, which requires an explicit path and invokes the same CLI scanner.
- Add an advisory GitHub composite Action that writes a report to the job summary and does not block CI for findings.
- Findings are technical indicators and questions for qualified review, not legal conclusions or compliance certification. No scanner rules have independent legal review.
