# Governance

This project is a v0.0.1 public contribution preview. Base Workers is the founding project owner and technical maintainer, responsible for software, workflow, policy, and release stewardship. This role does not authorize legal or language review. No legal or language reviewers are currently authorized; no contributor or agent may mark material `LEGAL_REVIEWED` or `LANGUAGE_REVIEWED`.

## Review authority

`LEGAL_REVIEWED` requires an explicitly authorized human legal reviewer to approve the exact version through an Ed25519 signature verified against a public key in the reviewer registry from the PR base branch. Authorized IDs and public keys are maintained in [`reviews/authorized-reviewers.yaml`](reviews/authorized-reviewers.yaml); the legal and language reviewer lists are currently empty, so validation rejects all review claims. Each language marked reviewed must link to a signed approval for that language from an active authorized language reviewer. Both review types bind to the same content digest. Maintainers must verify reviewer identity and protect key-registry changes. A signature proves control of the registered key and integrity of the record, not reviewer qualifications or the quality of the review. Automated agents may prepare drafts and review packets but cannot grant either state.

Substantive changes to legally reviewed content must clear or downgrade the review state. A status label is not an endorsement by a government, regulator, or professional body.

## Decisions and conflicts

Base Workers should document material policy and architecture decisions in the repository. Technical maintainership covers project stewardship only; it does not substitute for qualified legal or language review. Source rights, legal provenance, and truthful review status take priority over release speed. No template may be represented as professionally reviewed or released for reliance without authorized, version-bound evidence.

## Maintainers and confidential reporting

Base Workers is named as founding project owner and technical maintainer. No confidential conduct or security reporting channels are currently published or staffed, and neither policy provides a private submission route. Before the project accepts confidential reports or offers ongoing community support, those routes must be published and staffed.
