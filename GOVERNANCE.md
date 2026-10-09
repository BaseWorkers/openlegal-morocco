# Governance

This project is shared as a v0.0.2 public tooling preview. Maintainers, decision rights, and reviewer authorization have not yet been appointed. Until governance is established, no contributor is implicitly authorized to mark material `LEGAL_REVIEWED`.

## Review authority

`LEGAL_REVIEWED` requires an explicitly authorized human legal reviewer to approve the exact version through an Ed25519 signature verified against a public key in the reviewer registry from the PR base branch. Authorized IDs and public keys are maintained in [`reviews/authorized-reviewers.yaml`](reviews/authorized-reviewers.yaml); the legal and language reviewer lists are currently empty, so validation rejects all review claims. Each language marked reviewed must link to a signed approval for that language from an active authorized language reviewer. Both review types bind to the same content digest. Maintainers must verify reviewer identity and protect key-registry changes. A signature proves control of the registered key and integrity of the record, not reviewer qualifications or the quality of the review. Automated agents may prepare drafts and review packets but cannot grant either state.

Substantive changes to legally reviewed content must clear or downgrade the review state. A status label is not an endorsement by a government, regulator, or professional body.

## Decisions and conflicts

Project maintainers should document material policy and architecture decisions in the repository. Source rights, legal provenance, and truthful review status take priority over release speed. Governance must be established before any template is represented as professionally reviewed or released for reliance.

## Maintainers and confidential reporting

No maintainers or staffed confidential reporting channels have been appointed. The Code of Conduct and security policy disclose this limitation; neither provides a private submission route today. Before ongoing community operations, maintainers must be named, decision and enforcement responsibilities assigned, and confidential conduct and security reporting channels published and staffed.
