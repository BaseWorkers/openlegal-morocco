# OpenLegal 0.1.1 local package-install smoke check

**Status:** local pre-release check only. It does not prove publication under npm `latest`, legal or source-rights clearance, security review, or professional approval of any template.

## Exact package artifact

- Source tree: `BaseWorkers/openlegal-morocco`, PR #16 release branch.
- Base `main`: `0684959816cbcd7402f27ae00be28ad6eccba204`.
- Package source commit: `03e78cb74e0cee3fcb733c45c4cca65eb6a70f71`.
- Package: `openlegal@0.1.1`, 196 files, 1,305,049 unpacked bytes.
- Tarball SHA-1: `6a53147c8f5b2e8c051e0b1231f60c10cb20abf4`.
- Tarball integrity: `sha512-tTHEwahk9b1UFldPS+kx9v+8qRr+HejvTFAvGr37BzS/fd44/CvvgryPSBGbcCKzL/Qcay46QPBxwXucsEiihg==`.
- Package has no JavaScript runtime dependencies. It includes all 14 draft template packages; therefore the unresolved rights gate still applies.

## Results

The tarball was installed from a local file using `npm install --prefix <isolated-directory> --omit=dev --ignore-scripts --no-audit --no-fund`. This did not install from the public npm registry.

| Check | Result |
| --- | --- |
| Installed `openlegal --version` | `OpenLegal 0.1.1` |
| Installed `openlegal check` | `valid: true`, 14 template packages |
| Installed `openlegal list --language en` | 14 templates; includes `privacy-policy`; recorded drafts shown |
| Installed CLI scan on synthetic Next.js fixture | Findings schema `2.0.0`; identified Next.js and emitted notice, tracking, cookie-storage, third-party-integration, and GDPR-scope question indicators |
| Scan data handling | Synthetic cookie literal did not appear in the report |
| Installed MCP initialize | Server `OpenLegal` version `0.1.1`, protocol `2025-06-18` |
| Installed MCP `tools/list` | 11 tools returned |
| Installed MCP `list_templates` | 14 templates returned |
| Installed MCP `get_review_status` | Legal and EN/FR/AR reviews all returned `pending` |

## Limits and next release check

- These checks exercise an isolated local tarball install and local CLI/MCP use, not a fresh install from npm `latest`.
- Re-run installation and usage checks against the actual published stable version after publication; record the registry version, dist-tag, tarball integrity, runtime versions, and command output then.
- Do not publish until source-rights review is accepted. The tarball still includes the 14 template packages, and the rights-scope map remains provisional.
- The smoke check cannot establish legal accuracy, professional translation quality, scanner precision/recall, or security in every supported environment.
