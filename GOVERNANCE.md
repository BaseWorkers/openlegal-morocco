# Governance

This project is a public repository/CLI/MCP preview; it has no public hosted service. On 2026-10-12, Jawad Benhammou (`@Jawadbenhammoupro`) accepted appointment as technical maintainer and security-response owner. No legal or language reviewers have been appointed; no contributor is authorized to mark material `LEGAL_REVIEWED` or `LANGUAGE_REVIEWED` without the independent reviewer authorization and signed evidence described below. GitHub repository permission, code ownership, authorship, or DCO sign-off alone does not confer a reviewer role.

## Maintainer responsibility

The technical maintainer owns repository operations, release coordination, reviewer qualification records, and protecting review-state changes. As security-response owner, Jawad Benhammou receives and reviews private vulnerability reports submitted through the GitHub Security Advisories private-reporting route described in [`SECURITY.md`](SECURITY.md). Responses are best-effort when the maintainer is available; there is no response-time guarantee or alternate because this is a one-maintainer local repository/CLI/MCP project without staffed on-call coverage and no second responder has accepted continuity duties. No confidential conduct-reporting service is offered because there is no separate conduct responder or managed intake channel.

## Review authority

`LEGAL_REVIEWED` requires an explicitly authorized human legal reviewer to approve the exact version through an Ed25519 signature verified against a public key in the reviewer registry from the PR base branch. Authorized IDs and public keys are maintained in [`reviews/authorized-reviewers.yaml`](reviews/authorized-reviewers.yaml); the legal and language reviewer lists are currently empty, so validation rejects all review claims. Each language marked reviewed must link to a signed approval for that language from an active authorized language reviewer. Both review types bind to the same content digest. Maintainers must verify reviewer identity and protect key-registry changes. A signature proves control of the registered key and integrity of the record, not reviewer qualifications or the quality of the review. Automated agents may prepare drafts and review packets but cannot grant either state.

## Qualification, independence, and scope

Before adding a reviewer to the registry, a maintainer must document identity verification, relevant qualifications, conflicts, and the exact authorized scope. A public profile, GitHub role, prior contribution, or cryptographic signature alone is not proof of professional competence.

- **Moroccan legal review:** require documented Moroccan-law expertise relevant to the assigned topic, supported by current bar membership in Morocco or a law-academic/research appointment with recent work in that subject. Record the qualification source and its verification date. Authorize scopes separately (for example, privacy, employment, commercial contracts, or intellectual property); do not infer expertise across them. The reviewer must verify current primary sources, amendments, commencement, and applicability for the review date.
- **Language review:** require documented professional-level ability in the specific language and experience in legal translation, legal editing, or comparable legal-language work. Record the language and evidence checked. A language reviewer evaluates fidelity, terminology, omissions, and changes to legal effect; this does not grant legal-interpretation authority. English, French, and Arabic are separate scopes.
- **Scanner privacy review:** require documented privacy/security expertise relevant to static code analysis, tracking technologies, or privacy engineering. Scope the review to rule IDs, scan modes, jurisdictions, and languages. This review evaluates technical indicator usefulness and limitations; it does not confer legal or compliance approval.
- **Independence and conflicts:** disclose authorship, financial interests, professional relationships, and other material conflicts for the assigned work. A reviewer who authored or adapted the reviewed material cannot be described as independent for that material. Record any accepted limitation and the reason.

Each reviewer assignment must identify its package or rule set, version, language or jurisdiction, exact repository commit, content digest, and review date. One person may cover multiple scopes only if each scope is separately evidenced and authorized. A review in one language does not approve another language.

The reviewer registry records a public qualification summary and evidence reference, the dates qualifications and conflicts were checked, and exact scope tokens. Legal tokens include `jurisdiction:MA`, `template:<template-id>`, and `claim:<claim-id>`; language tokens use `template:<template-id>:<language>` where language is `en`, `fr`, or `ar`. Validation rejects template, claim, jurisdiction, or language approvals outside the reviewer's recorded scopes. Do not put identity documents or private contact details in the public registry.

## Maintainer appointment and responsibilities

A named human must accept the maintainer role before being added to governance records. Record their public account, role, decision scope, start date, and an alternate for continuity, or document why no alternate is available. Maintainers verify reviewer qualifications and conflicts, protect signing-key registry changes, keep review records accurate, and handle release decisions. They must not claim legal or language competence solely from the maintainer role.

For ongoing operations, Jawad Benhammou is the named security-response owner who monitors private vulnerability reports through GitHub's private reporting route described in [`SECURITY.md`](SECURITY.md). The notification path still needs an operational test, and no response-time commitment or alternate responder has been established. There is no confidential conduct-reporting route yet; do not send conduct reports containing sensitive details through public issues or pull requests. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

Substantive changes to legally reviewed content must clear or downgrade the review state. A status label is not an endorsement by a government, regulator, or professional body.

## Decisions and conflicts

Project maintainers should document material policy and architecture decisions in the repository. Source rights, legal provenance, and truthful review status take priority over release speed. Governance must be established before any template is represented as professionally reviewed or released for reliance.
