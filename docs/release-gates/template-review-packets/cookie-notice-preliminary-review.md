# Cookie notice template — preliminary review packet

**Purpose and status:** preparation for independent Moroccan legal and EN/FR/AR language review only. This is not legal advice, a current-law determination, or approval. Keep the template in `DRAFT`; do not infer consent or CNDP filing requirements from this packet.

## Exact material reviewed

- Repository: `BaseWorkers/openlegal-morocco`.
- Working baseline: candidate branch at commit `2f29e8adc4cf2c64e201ff97d77bcbe62e800dd3`, based on `main` commit `0684959816cbcd7402f27ae00be28ad6eccba204`.
- Template: `cookie-notice`, version `0.1.3`, jurisdiction tag `MA`, languages `en`, `fr`, `ar`; legal and all language reviews pending; generator disabled.
- SHA-256 digests:
  - `metadata.yaml`: `6e07345297338ce187aac2ba5a19af2dc660f94994ac27f493791367cf6cd2bf`
  - `en.md`: `0fc06252bd7ddc7543264619143e0983b85ca63204836ddc961ff28f1518d629`
  - `fr.md`: `8bfb1ff4704c0a6eafc4d1cb4e627e81b6c9e5cbf321d6c85b6bc8d4ce9279ac`
  - `ar.md`: `6e8327a1e2b17c017979500d1bb77eff2e37e7e6bab2e60c9b05fef2b5e8e865`
  - `notes.md`: `da7ff221d5240b9b1e589bba17eb1b342add9c1d29fdb2e4240a416f45575fdc`
  - `sources.yaml`: `1558832c796dbb672a307f02dcac827efa585b91588810d37b75882914ba5a24`

## Official-source observations on 2026-10-12

- The CNDP's [D-939-2025 decision](https://www.cndp.ma/wp-content/uploads/2025/12/Deliberation-N%C2%B0-D-939-2025-du-28112025-relative-au-modele-de-declaration-simplifiee-relative-au-traitement-des-donnees-a-caractere-personnel-de-cookies-sur-un-terminal.pdf) is dated 28 November 2025 and describes a simplified declaration model for processing personal data through installing, recording, or storing cookies on a user's terminal. It defines a cookie as a small file stored by a server on a terminal and associated with a web domain. The exact application to other technologies in this draft (local storage, pixels, SDKs, tags, and embedded services) needs legal interpretation.
- D-939-2025 lists purposes and limits, a six-month maximum retention period for data collected via cookies, information to provide before the first cookie is stored, security/subcontractor obligations, a simplified CNDP declaration, and prior-CNDP-authorization language for transfers and certain profiling/interconnection cases. Applicability to a real setup and any interaction with other laws or decisions remain for counsel.
- D-939-2025 section 6 appears internally difficult to reconcile: it says prior consent is not needed for the listed purposes except personalized advertising and social-sharing features, then says consent must be collected before the first cookie is stored and must allow refusal. This packet does not resolve that wording. Counsel should verify the official page layout and any subsequent CNDP interpretation before the template states a rule.
- The CNDP's current [notification procedure page](https://www.cndp.ma/procedures-de-notification-process/) lists D-939-2025 under website cookie management but identifies the form as F-214, a “déclaration normale conformément à une décision”; D-939-2025 itself describes a simplified declaration. The page also asks for consent-collection or other legal-basis documentation, an information notice, and (where applicable) a subcontractor contract. Confirm the current form and process with the CNDP before telling a user which filing to make.
- These pages establish what the CNDP currently displays, not a complete amendment history, legal opinion, or decision for any specific operator.

## Preliminary review questions

| Issue | Draft coverage | Question for counsel |
| --- | --- | --- |
| Scope and technology types | Sections 1–2 ask the operator to inventory cookies, scripts, tags, SDKs, local storage, pixels, and embedded services | Which of these are within D-939's defined cookie scope, and which need a separate legal analysis? Do not equate every tracker or local-storage item with a cookie. |
| Purposes and profiling | Section 3 asks for actual purpose, provider, first/third-party status, and duration, but defines no permitted purpose | Map each actual purpose to D-939's categories; identify when profiling or another activity may require authorization. Avoid implying this list is exhaustive or that the template approves a purpose. |
| Consent and user controls | Section 4 asks what controls exist; section 5 explicitly makes no default consent/opt-in/opt-out conclusion | Resolve section 6's consent wording against the official decision and current CNDP procedure. Confirm the required timing, clear action, accessible refusal, preference persistence (the decision states a maximum six-month retention for the choice), and withdrawal behavior for the actual deployment. |
| Retention | Inventory asks for actual duration or deletion criterion; no fixed limit appears | If D-939 applies, how should its stated six-month maximum for cookie-collected data be reflected, and which data or purposes fall within that statement? |
| Information before first deposit | Sections 1, 3, 6, and 7 provide service, inventory, provider/transfer, and contact fields | D-939 lists controller identity, purposes, data categories, recipients/transfers, rights contact, and CNDP receipt references. The draft has no dedicated data-category or receipt-reference fields; determine applicability and whether they should be added. |
| CNDP notification | Section 5 refers generally to legal review, without naming a form or promising a filing result | Reconcile the decision's simplified-declaration language with the procedure page's F-214 label. Keep the draft from advising users to submit a specific form until verified. |
| Transfers and vendors | Section 6 asks for provider, destination, access, and related privacy notice, and disclaims transfer approval | Verify actual hosting/support flows and the applicable CNDP authorization process. Do not treat a vendor contract or a notice statement as transfer authorization. |
| Security and subcontractors | Sections 3 and 6 ask for providers and data flow; no security promise is made | Determine whether the notice needs an accurate high-level statement and how controller/subcontractor responsibilities should be represented. Do not expose sensitive controls. |

## Structural language-parity check

A mechanical comparison found the same seven section markers in the same order and eleven identical placeholder names in EN/FR/AR. That proves structural parity only. It does not establish semantic equivalence or professional quality. One phrase merits explicit review: English “banner” is rendered as French “bandeau” and Arabic “لافتة”; assess whether the Arabic word describes a web consent interface naturally and accurately in this context. Also review Moroccan privacy terminology, consent/refusal labels, RTL layout, numbering, and punctuation.

## Required reviewer decisions

1. Moroccan counsel: resolve the D-939 consent wording and F-214/simplified-form mismatch; verify the current CNDP procedure, actual scope, purpose limits, retention, information fields, vendor flows, and transfer conditions.
2. Independent language reviewers: compare legal meaning and interface terminology in each language against the reviewed legal position; record separate EN, FR, and AR decisions.
3. Privacy specialist: assess whether the actual technical inventory and controls can support each statement; test consent/refusal/persistence behavior on real desktop/mobile deployments.
4. Rights reviewer: clear authorship/licensing of the template and every source shipped with the package. This packet does not clear rights.
5. After reviewer authorization, record qualifications, conflicts, exact scope, review date, repository revision, file digests, and signed decision. Until then every review status remains pending.

## Sources

- [CNDP D-939-2025 official decision](https://www.cndp.ma/wp-content/uploads/2025/12/Deliberation-N%C2%B0-D-939-2025-du-28112025-relative-au-modele-de-declaration-simplifiee-relative-au-traitement-des-donnees-a-caractere-personnel-de-cookies-sur-un-terminal.pdf)
- [CNDP current notification procedures](https://www.cndp.ma/procedures-de-notification-process/)
- [CNDP announcement of the November 2025 deliberations](https://www.cndp.ma/la-cndp-publie-de-nouvelles-deliberations/)
