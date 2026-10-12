# Data processing agreement: preliminary review packet

**Status: preparation for independent review only.** This packet is not a legal opinion, approval, translation review, or confirmation that the template is fit to sign. The template remains `DRAFT`; generation remains disabled. It records research questions and file identity so qualified reviewers can assess the exact material.

## Review target

- Template: `templates/privacy/data-processing-agreement`
- Version: `0.1.2` (verify against `metadata.yaml` before review)
- Jurisdiction tag: Morocco
- Languages: English, French, Arabic
- Target files and SHA-256 at packet preparation:
  - `metadata.yaml`: `f4ccf0bd5a9cf8d3d8a1f8a49323664496f3341f85fef293a1f80415f410ba16`
  - `variables.schema.json`: `1f11262b385b3e912a381a5db6b5101cbced94031194498643b9238756c5d71f`
  - `en.md`: `378e573b394af4c2e7dc45ab2b7d5f1fc7feee197d91b29e3ef6a3dbd517c320`
  - `fr.md`: `446a52d9bfe2c4d781e8dfaa3b785851411a1101bd270860165865fe85c19478`
  - `ar.md`: `54225588b577d5764284b096641542a3c73e08762dbdabe793ead9a262756c6b`
  - `notes.md`: `082011178b1ea1705b364a3c69b75c43af9d01f3146deac17b66aa072e3b02b4`
  - `sources.yaml`: `834a97b10671fd9241f8416e95041ad99409310cac9cc0aaf860226c3aa21061`

Recompute these hashes before review; any difference means the reviewer must assess the updated files and the packet must be refreshed.

## What the accessed primary sources say

- The Ministry of Justice legal database reproduces Law 09-08 and defines the controller by who determines purposes and means, and the processor as an entity processing personal data on the controller's behalf (Article 1). This supports checking actual conduct rather than relying on contract labels. The database record is a promulgation text, not proof that a complete current consolidated text or amendment history has been verified: [Ministry legal database, Law 09-08](https://bdj.mmsp.gov.ma/Fr/Document/8974-Loi-n-09-08-promulgu%C3%A9e-par-le-dahir-n-1-09-15-du.aspx).
- In the CNDP-hosted French text, Article 23(1) places appropriate technical and organizational security measures on the controller; Article 23(2) says the controller must select a processor providing sufficient security guarantees and ensure those measures are respected; Article 23(3) requires processing on behalf of the controller to be governed by a contract or legal instrument that provides, in particular, that the processor acts only on the controller's instructions and that the paragraph 1 obligations also apply to it; Article 23(4) requires relevant contract/security elements to be recorded in writing or equivalent form for evidence. Article 25 says a person under the authority of the controller or processor, and the processor itself when accessing personal data, may process only on the controller's instruction except under legal obligations. See [CNDP-hosted Law 09-08, Articles 23 and 25](https://www.cndp.ma/images/lois/Loi-09-08-Fr.pdf).
- Articles 43–44 in that same text address transfers to foreign states. Article 43 sets a sufficient-protection condition and criteria for assessing it; Article 44 lists derogations, including express consent, specified necessities, an applicable international agreement, and an express reasoned CNDP authorization in the stated circumstances. This packet does not determine whether any destination, remote access, hosting, support, or vendor arrangement qualifies, nor whether later rules or CNDP practice affect a particular case. See [CNDP-hosted Law 09-08, Articles 43–44](https://www.cndp.ma/images/lois/Loi-09-08-Fr.pdf).
- The original publication is also available as [Official Bulletin n° 5714 (2009), French edition](https://www.sgg.gov.ma/BO/bo_fr/2009/bo_5714_fr.pdf). A publication text alone does not resolve current law.

## Questions for Moroccan counsel

1. Verify the current consolidated law, amendments, implementing texts, CNDP decisions and procedures relevant to this agreement and the parties' actual facts. Confirm territorial scope and whether each party's actual purpose-setting and means make the proposed role descriptions accurate.
2. Confirm whether the agreement's schedule and instruction mechanism sufficiently capture the actual processing and the requirements of Article 23, including who decides purposes/means, specific operations, data and people, duration, locations, security measures, and personnel access.
3. Review whether the draft's proposed subprocessor authorization/change process and flow-down terms are legally sufficient and commercially workable. The draft does not claim that naming a vendor is authorization or that every listed vendor is acceptable.
4. Identify all storage, support, backup, analytics, subprocessors, remote access, and onward flows. For each relevant foreign destination, determine the applicable legal route under current rules and what evidence or CNDP process is required. Do not rely on the placeholder or the source-text summary as transfer authorization.
5. Review assistance, incident notice, audits, retention, deletion, liability, precedence, governing law, dispute resolution, and signatures. In particular, confirm any statutory duties separately: the incident period is expressly a negotiable contractual placeholder, and this draft asserts no statutory deadline or general audit right.
6. Confirm sensitive/restricted data handling, sector-specific obligations, and any required declaration, authorization, or CNDP filing for the underlying processing. This packet makes no claim that this DPA alone satisfies those separate gates.
7. Record the legal reviewer's name, qualifications/scope, conflicts or independence declaration, date, exact file hashes reviewed, findings, and approved change list. Do not change the template status without that evidence and an authorized maintainer action.

## Questions for an independent EN/FR/AR reviewer

- Confirm that each language communicates the same legal propositions, caveats, conditions, and negotiation choices; section identifiers align, but that is only structural parity.
- Review Moroccan legal terminology, particularly controller/processor role labels, subprocessor terms, cross-border transfers, incident notice, retention/deletion, and dispute clauses.
- Check Arabic legal register, grammar, punctuation, and right-to-left rendering in the actual generated document, including tables and signature blocks.
- Record reviewer identity, language competence, date, exact hashes reviewed, findings, and approved changes. No language review is claimed by this packet.

## Mechanical observations (not substantive approval)

- EN/FR/AR each contain the same 12 section markers: `scope`, `roles`, `security`, `subprocessors`, `transfers`, `requests`, `incidents`, `audits`, `retention`, `term`, `law-disputes`, `signatures`.
- The three language files currently use the same set of 25 template variables. This checks placeholder-set parity only; it does not verify meaning, completeness, schema correctness, rendering, or legal sufficiency.
- The draft explicitly labels the document as not ready for signature, leaves current-law application unresolved, treats the incident period as contractual, and says generation is disabled.

## Disposition

No clause has been approved or changed by this packet. No legal or language review has been completed. Keep the template `DRAFT` and generation disabled until both independent reviews are documented against the exact version and hashes, and an authorized maintainer records the decision.
