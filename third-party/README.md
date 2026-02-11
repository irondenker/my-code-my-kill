# THIRD_PARTY_NOTICES

This file records third-party code, templates, fonts, and assets used in this repository.

## Status Legend

- `verified`: license/source confirmed and compliant.
- `unverified`: source or license is not fully confirmed yet.
- `replaced`: third-party asset removed and replaced with original work.

## Notice Entries

### Entry: HTML Template HTTP Codes

- `status`: verified
- `component`: static error pages (`server/views/errors/403`, `404`, `500`, `503`, `504`, `edge`)
- `upstream author`: Giuliano Peccetto (PecceG2), Adam Quinlan
- `upstream source`: <https://github.com/PecceG2/HTML_Template_http_codes>
- `license`: MIT (repository license declaration)
- `local modifications`: UI copy replacement, fallback routing behavior, code-specific messaging, edge template extension
- `required attribution`: Include MIT copyright and permission notice in repository/distributions
- `license copy`: `licenses/PecceG2-HTML_Template_http_codes-MIT.txt`
- `notes`: Keep this notice file and the MIT license copy with distributed source.

### Entry: Oxygen Font Webfont Reference

- `status`: unverified
- `component`: `server/views/errors/**/oxygen.fonts.css`
- `upstream author`: Google Fonts / Oxygen typeface contributors
- `upstream source`: <https://fonts.googleapis.com> / <https://fonts.gstatic.com>
- `license`: TODO (confirm exact font license and redistribution requirements)
- `local modifications`: local CSS wrapper and usage in error pages
- `required attribution`: TODO (fill based on confirmed license)
- `notes`: Confirm whether current self-host/reference method is compliant for distribution model.

## Project Copyright

Repository-level copyright and license for original code/assets:

- `owner`: TODO (your name or organization)
- `year`: TODO
- `license`: TODO
