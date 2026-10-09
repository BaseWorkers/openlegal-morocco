# Contributing

Contributions are welcome for Moroccan legal research, template content, source records, language review, and project policies. Every contribution is subject to the project's [disclaimer](DISCLAIMER.md), [governance policy](GOVERNANCE.md), and license notices.

## Adapting or reusing the project

You may adapt or reuse project material under the license that applies to that material. The intended scope is described in [`LICENSES/README.md`](LICENSES/README.md) and [`LICENSES/scopes.json`](LICENSES/scopes.json), but the mapping and ownership review are provisional. Check file-level source notices and third-party rights before reuse; a project license does not clear material the project does not own. Preserve applicable notices and provenance.

When adapting a template, identify your changes, sources, intended jurisdiction, and version. Do not carry a review or release status over to an adapted version; legal and language review applies only to the exact content and language reviewed. An adaptation does not imply endorsement by OpenLegal. The project's public-interest purpose does not restrict reuse to non-commercial use; follow the applicable license terms.

## Contribution rights are provisional

The project has not finalized the legal terms for accepting contributor submissions, and it has no contributor license agreement or ownership-assignment process. The path-to-license map describes intended scopes only; it does not grant rights in submitted material. Before proposing content for inclusion, check the applicable notice and contribute only material whose rights you control and that you are willing to offer under the stated intended license. Do not submit third-party material, restricted content, or work made for an employer or client unless you have clear authority to do so. A pull request does not itself establish ownership, clear third-party rights, or authorize legal or language review status. Maintainers must resolve contribution terms and verify rights before merging contributed content.

## DCO sign-off

For commits submitted to a target branch that already contains `DCO.md`, sign off every commit with the Developer Certificate of Origin (DCO) version 1.1:

```sh
git commit -s -m "type: explain the contribution"
```

Git adds a `Signed-off-by: Name <email>` trailer. Use your own name and an email address you are comfortable making public in the repository's permanent commit history. The sign-off records the certification in `DCO.md`; it is not a CLA, does not assign copyright, and does not change the license that applies to any file.

The DCO check applies to new pull requests once their target branch contains `DCO.md`. Existing commits are not rewritten to add sign-offs. DCO sign-off does not resolve the project's provisional license-scope mapping, clear third-party rights, or replace maintainer review. If the applicable license or your authority to contribute is unclear, do not submit that material until it is resolved.

## Source, rights, and accuracy

- Support each important Morocco-specific legal statement with a traceable source and pinpoint, or mark it unresolved.
- When template review notes cite a research claim ID, map that claim under every supporting source in the package's `sources.yaml`; claim links are provenance metadata and do not imply legal review or current-law verification.
- Prefer official Moroccan legislation and relevant government or regulatory sources. Do not invent laws, article numbers, deadlines, filings, or approval requirements.
- Identify the exact source, version, license, and scope before reusing third-party wording. A repository-level license signal alone does not authorize reuse of an individual file.
- Keep third-party notices with the material they cover. Do not label third-party wording as project-created content.
- Submit only material you created or have authority to contribute under the applicable project terms. If ownership or permission is uncertain, identify the affected material and leave it unresolved.

## Templates and languages

A template contribution should include its purpose, jurisdiction, version, sources, assumptions, declared variables, and review status. Keep Arabic, French, and English text aligned in legal effect; flag uncertain terminology or meaning rather than silently resolving it. Update the template's changelog when its content changes.

Variables may fill declared fields but must not inject or rewrite legal clauses. A contribution must not claim that a template is compliant, legally valid, officially approved, or professionally reviewed without evidence for that exact version.

## Review status

Research, community, language, and legal review are separate activities. State the exact content and language reviewed, the reviewer's authorized role, and unresolved questions. Automated or community review does not count as legal review.

Only an authorized human reviewer may approve the `LEGAL_REVIEWED` state for the exact version. Review records must be signed and verified under the project's [governance policy](GOVERNANCE.md). If a substantive change affects reviewed content, its approval must be invalidated until it is reviewed again.

## Privacy and conduct

Do not submit personal, confidential, client, or live transaction information. Discuss examples using synthetic information. Follow the [Code of Conduct](CODE_OF_CONDUCT.md); use the private security reporting route only when it is enabled, and do not publish sensitive vulnerability details.

GitHub Actions checks repository structure and review records. Passing automated checks does not establish legal accuracy, source rights, translation quality, reviewer qualifications, or approval.
