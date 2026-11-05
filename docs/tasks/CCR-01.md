# CCR-01 — Add i18n keys for lookalike exception inputs and share ring selector

| Field | Value |
|---|---|
| Raised by | Antigravity |
| Raised from card | AG-01B |
| Status | Accepted |
| Contract version | from `contract-v1` to `contract-v3` |

## Need
During QA round 2 of AG-01B (finding M-1), the reviewer noted that accessible names and placeholders for the look-alike exceptions inputs (`SettingsScreen.tsx:243,251`) and exception add button (`:258`), as well as the ring selector on `ShareScreen.tsx:145,150`, currently lack dedicated keys in `contract-v1`. Using generic keys (`settings.lookalike.exceptions`, `common.save`, `share.title`) resulted in identical, non-descriptive labels for screen readers.

## Proposed shape
Add the following 4 keys to `I18N_KEYS`:

| Key | vi | en | Parameters |
|---|---|---|---|
| `settings.lookalike.domainA` | Tên miền tin cậy | Trusted domain | none |
| `settings.lookalike.domainB` | Tên miền ngoại lệ | Exception domain | none |
| `settings.lookalike.add` | Thêm ngoại lệ | Add exception | none |
| `share.selectRing` | Chọn vòng để chia sẻ | Select ring to share | none |

## Workaround meanwhile
In `src/taskpane/screens/SettingsScreen.tsx` and `src/taskpane/screens/ShareScreen.tsx`, distinct descriptive strings are kept in a local `CCR_STRINGS` constant and passed via JSX expressions (`aria-label={CCR_STRINGS.domainA}`), keeping screen-reader names accurate without triggering the raw literal attribute check `aria-label="[A-Za-z]`. Once the lead publishes these keys in `contract-v3` (tracked in `CL-05D`), they will be switched to `t(...)`.

## Lead decision
Accepted as proposed (2026-11-05). The four keys and their meaning go into the scope of CL-05D and ship with `contract-v3`; the `vi` and `en` texts in the table above are the starting values for AG-07. Antigravity switches `CCR_STRINGS` in `SettingsScreen.tsx` and `ShareScreen.tsx` to `t(...)` after the tag, in the card that touches those screens next.
