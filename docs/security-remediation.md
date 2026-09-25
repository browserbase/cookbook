# Dependabot remediation

Snapshot: 2026-09-24, `browserbase/cookbook`, all 136 open Dependabot alerts.

Local manifest and lockfile versions resolve 129 alert ranges without adding dependency overrides. Seven alerts remain blocked:

- Four ChromaDB alerts: CrewAI 1.15.20 requires ChromaDB 1.1.x, and the latest published ChromaDB release (1.5.9) is also affected. No patched release is listed.
- Two ws alerts: Trigger 4.6.3 pins socket.io-client 4.7.5, whose engine.io-client dependency requires ws ~8.17.1. That range excludes the fixed release.
- One deepmerge-ts alert: Trigger's build package depends on Prisma config 6.x, which pins deepmerge-ts 7.1.5. The fixed release is 8.0.0.

Trigger SDK, build package, and CLI are aligned at 4.6.3, which passes the local seven-day package-age policy. The newer 4.6.4 release was blocked by that policy. The overrides initially used for remediation were removed; the remaining transitive fixes require upstream dependency upgrades or replacement of the affected integrations. Alerts have not been dismissed; GitHub will re-evaluate after these changes reach the default branch.

## Validation

- 39 archive tests passed against a clean temporary install of adm-zip 0.6.1.
- 35 synthetic integration tests passed (AgentKit lifecycle and Trigger cleanup, storage, and summaries).
- All four npm lockfiles passed `npm ci --dry-run --ignore-scripts --audit=false`. This checks lockfile consistency, not a full installation or application build.
- Poetry resolved the patched dependency constraints and passed `poetry check --lock`.
- Live browser, Trigger worker, AI, and flight-booking workflows were not run.
- Local Chrome worker test was not runnable without its external Puppeteer fixture configuration.

## Alert-by-alert result

| Alert | Package | Resolved local versions | Result |
| --- | --- | --- | --- |
| [#1](https://github.com/browserbase/cookbook/security/dependabot/1) | `ajv` | 6.15.0 | Outside reported vulnerable range |
| [#2](https://github.com/browserbase/cookbook/security/dependabot/2) | `minimatch` | 10.2.6, 3.1.5 | Outside reported vulnerable range |
| [#3](https://github.com/browserbase/cookbook/security/dependabot/3) | `minimatch` | 10.2.6, 3.1.5 | Outside reported vulnerable range |
| [#4](https://github.com/browserbase/cookbook/security/dependabot/4) | `minimatch` | 10.2.6, 3.1.5 | Outside reported vulnerable range |
| [#5](https://github.com/browserbase/cookbook/security/dependabot/5) | `minimatch` | 10.2.6, 3.1.5 | Outside reported vulnerable range |
| [#6](https://github.com/browserbase/cookbook/security/dependabot/6) | `minimatch` | 10.2.6, 3.1.5 | Outside reported vulnerable range |
| [#7](https://github.com/browserbase/cookbook/security/dependabot/7) | `minimatch` | 10.2.6, 3.1.5 | Outside reported vulnerable range |
| [#8](https://github.com/browserbase/cookbook/security/dependabot/8) | `flatted` | 3.4.4 | Outside reported vulnerable range |
| [#9](https://github.com/browserbase/cookbook/security/dependabot/9) | `flatted` | 3.4.4 | Outside reported vulnerable range |
| [#10](https://github.com/browserbase/cookbook/security/dependabot/10) | `yaml` | 2.9.1 | Outside reported vulnerable range |
| [#11](https://github.com/browserbase/cookbook/security/dependabot/11) | `picomatch` | 4.0.7 | Outside reported vulnerable range |
| [#12](https://github.com/browserbase/cookbook/security/dependabot/12) | `picomatch` | 4.0.7 | Outside reported vulnerable range |
| [#13](https://github.com/browserbase/cookbook/security/dependabot/13) | `picomatch` | 4.0.7 | Outside reported vulnerable range |
| [#14](https://github.com/browserbase/cookbook/security/dependabot/14) | `picomatch` | 4.0.7 | Outside reported vulnerable range |
| [#15](https://github.com/browserbase/cookbook/security/dependabot/15) | `brace-expansion` | 1.1.21, 5.0.12 | Outside reported vulnerable range |
| [#16](https://github.com/browserbase/cookbook/security/dependabot/16) | `brace-expansion` | 1.1.21, 5.0.12 | Outside reported vulnerable range |
| [#17](https://github.com/browserbase/cookbook/security/dependabot/17) | `js-yaml` | 4.3.2 | Outside reported vulnerable range |
| [#18](https://github.com/browserbase/cookbook/security/dependabot/18) | `brace-expansion` | 1.1.21, 5.0.12 | Outside reported vulnerable range |
| [#19](https://github.com/browserbase/cookbook/security/dependabot/19) | `brace-expansion` | 1.1.21, 5.0.12 | Outside reported vulnerable range |
| [#20](https://github.com/browserbase/cookbook/security/dependabot/20) | `js-yaml` | 4.3.2 | Outside reported vulnerable range |
| [#21](https://github.com/browserbase/cookbook/security/dependabot/21) | `brace-expansion` | 1.1.21, 5.0.12 | Outside reported vulnerable range |
| [#22](https://github.com/browserbase/cookbook/security/dependabot/22) | `brace-expansion` | 1.1.21, 5.0.12 | Outside reported vulnerable range |
| [#23](https://github.com/browserbase/cookbook/security/dependabot/23) | `brace-expansion` | 1.1.21, 5.0.12 | Outside reported vulnerable range |
| [#24](https://github.com/browserbase/cookbook/security/dependabot/24) | `brace-expansion` | 1.1.21, 5.0.12 | Outside reported vulnerable range |
| [#25](https://github.com/browserbase/cookbook/security/dependabot/25) | `js-yaml` | 4.3.2 | Outside reported vulnerable range |
| [#26](https://github.com/browserbase/cookbook/security/dependabot/26) | `@humanfs/node` | 0.16.8 | Outside reported vulnerable range |
| [#27](https://github.com/browserbase/cookbook/security/dependabot/27) | `js-yaml` | 4.3.2 | Outside reported vulnerable range |
| [#28](https://github.com/browserbase/cookbook/security/dependabot/28) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#29](https://github.com/browserbase/cookbook/security/dependabot/29) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#30](https://github.com/browserbase/cookbook/security/dependabot/30) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#31](https://github.com/browserbase/cookbook/security/dependabot/31) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#32](https://github.com/browserbase/cookbook/security/dependabot/32) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#33](https://github.com/browserbase/cookbook/security/dependabot/33) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#34](https://github.com/browserbase/cookbook/security/dependabot/34) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#35](https://github.com/browserbase/cookbook/security/dependabot/35) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#36](https://github.com/browserbase/cookbook/security/dependabot/36) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#37](https://github.com/browserbase/cookbook/security/dependabot/37) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#38](https://github.com/browserbase/cookbook/security/dependabot/38) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#39](https://github.com/browserbase/cookbook/security/dependabot/39) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#40](https://github.com/browserbase/cookbook/security/dependabot/40) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#41](https://github.com/browserbase/cookbook/security/dependabot/41) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#42](https://github.com/browserbase/cookbook/security/dependabot/42) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#43](https://github.com/browserbase/cookbook/security/dependabot/43) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#44](https://github.com/browserbase/cookbook/security/dependabot/44) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#45](https://github.com/browserbase/cookbook/security/dependabot/45) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#46](https://github.com/browserbase/cookbook/security/dependabot/46) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#47](https://github.com/browserbase/cookbook/security/dependabot/47) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#48](https://github.com/browserbase/cookbook/security/dependabot/48) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#49](https://github.com/browserbase/cookbook/security/dependabot/49) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#50](https://github.com/browserbase/cookbook/security/dependabot/50) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#51](https://github.com/browserbase/cookbook/security/dependabot/51) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#52](https://github.com/browserbase/cookbook/security/dependabot/52) | `next` | 16.3.6 | Outside reported vulnerable range |
| [#53](https://github.com/browserbase/cookbook/security/dependabot/53) | `adm-zip` | 0.6.1 | Outside reported vulnerable range |
| [#54](https://github.com/browserbase/cookbook/security/dependabot/54) | `adm-zip` | 0.6.1 | Outside reported vulnerable range |
| [#55](https://github.com/browserbase/cookbook/security/dependabot/55) | `adm-zip` | 0.6.1 | Outside reported vulnerable range |
| [#56](https://github.com/browserbase/cookbook/security/dependabot/56) | `adm-zip` | 0.6.1 | Outside reported vulnerable range |
| [#57](https://github.com/browserbase/cookbook/security/dependabot/57) | `adm-zip` | 0.6.1 | Outside reported vulnerable range |
| [#58](https://github.com/browserbase/cookbook/security/dependabot/58) | `qs` | 6.16.0 | Outside reported vulnerable range |
| [#59](https://github.com/browserbase/cookbook/security/dependabot/59) | `qs` | 6.16.0 | Outside reported vulnerable range |
| [#60](https://github.com/browserbase/cookbook/security/dependabot/60) | `qs` | 6.16.0 | Outside reported vulnerable range |
| [#61](https://github.com/browserbase/cookbook/security/dependabot/61) | `qs` | 6.16.0 | Outside reported vulnerable range |
| [#62](https://github.com/browserbase/cookbook/security/dependabot/62) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#63](https://github.com/browserbase/cookbook/security/dependabot/63) | `starlette` | 1.7.0 | Outside reported vulnerable range |
| [#64](https://github.com/browserbase/cookbook/security/dependabot/64) | `starlette` | 1.7.0 | Outside reported vulnerable range |
| [#65](https://github.com/browserbase/cookbook/security/dependabot/65) | `urllib3` | 2.8.0 | Outside reported vulnerable range |
| [#66](https://github.com/browserbase/cookbook/security/dependabot/66) | `urllib3` | 2.8.0 | Outside reported vulnerable range |
| [#67](https://github.com/browserbase/cookbook/security/dependabot/67) | `filelock` | 3.32.7 | Outside reported vulnerable range |
| [#68](https://github.com/browserbase/cookbook/security/dependabot/68) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#69](https://github.com/browserbase/cookbook/security/dependabot/69) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#70](https://github.com/browserbase/cookbook/security/dependabot/70) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#71](https://github.com/browserbase/cookbook/security/dependabot/71) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#72](https://github.com/browserbase/cookbook/security/dependabot/72) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#73](https://github.com/browserbase/cookbook/security/dependabot/73) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#74](https://github.com/browserbase/cookbook/security/dependabot/74) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#75](https://github.com/browserbase/cookbook/security/dependabot/75) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#76](https://github.com/browserbase/cookbook/security/dependabot/76) | `urllib3` | 2.8.0 | Outside reported vulnerable range |
| [#77](https://github.com/browserbase/cookbook/security/dependabot/77) | `filelock` | 3.32.7 | Outside reported vulnerable range |
| [#78](https://github.com/browserbase/cookbook/security/dependabot/78) | `virtualenv` | 20.39.1 | Outside reported vulnerable range |
| [#79](https://github.com/browserbase/cookbook/security/dependabot/79) | `pyasn1` | 0.6.4 | Outside reported vulnerable range |
| [#80](https://github.com/browserbase/cookbook/security/dependabot/80) | `cryptography` | 50.0.1 | Outside reported vulnerable range |
| [#81](https://github.com/browserbase/cookbook/security/dependabot/81) | `orjson` | 3.12.0 | Outside reported vulnerable range |
| [#82](https://github.com/browserbase/cookbook/security/dependabot/82) | `pyasn1` | 0.6.4 | Outside reported vulnerable range |
| [#83](https://github.com/browserbase/cookbook/security/dependabot/83) | `requests` | 2.34.2 | Outside reported vulnerable range |
| [#84](https://github.com/browserbase/cookbook/security/dependabot/84) | `cryptography` | 50.0.1 | Outside reported vulnerable range |
| [#85](https://github.com/browserbase/cookbook/security/dependabot/85) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#86](https://github.com/browserbase/cookbook/security/dependabot/86) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#87](https://github.com/browserbase/cookbook/security/dependabot/87) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#88](https://github.com/browserbase/cookbook/security/dependabot/88) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#89](https://github.com/browserbase/cookbook/security/dependabot/89) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#90](https://github.com/browserbase/cookbook/security/dependabot/90) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#91](https://github.com/browserbase/cookbook/security/dependabot/91) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#92](https://github.com/browserbase/cookbook/security/dependabot/92) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#93](https://github.com/browserbase/cookbook/security/dependabot/93) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#94](https://github.com/browserbase/cookbook/security/dependabot/94) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#95](https://github.com/browserbase/cookbook/security/dependabot/95) | `urllib3` | 2.8.0 | Outside reported vulnerable range |
| [#96](https://github.com/browserbase/cookbook/security/dependabot/96) | `idna` | 3.20 | Outside reported vulnerable range |
| [#97](https://github.com/browserbase/cookbook/security/dependabot/97) | `chromadb` | 1.1.1 | Blocked: no patched ChromaDB release |
| [#98](https://github.com/browserbase/cookbook/security/dependabot/98) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#99](https://github.com/browserbase/cookbook/security/dependabot/99) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#100](https://github.com/browserbase/cookbook/security/dependabot/100) | `starlette` | 1.7.0 | Outside reported vulnerable range |
| [#101](https://github.com/browserbase/cookbook/security/dependabot/101) | `pyarrow` | 25.0.1 | Outside reported vulnerable range |
| [#102](https://github.com/browserbase/cookbook/security/dependabot/102) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#103](https://github.com/browserbase/cookbook/security/dependabot/103) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#104](https://github.com/browserbase/cookbook/security/dependabot/104) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#105](https://github.com/browserbase/cookbook/security/dependabot/105) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#106](https://github.com/browserbase/cookbook/security/dependabot/106) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#107](https://github.com/browserbase/cookbook/security/dependabot/107) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#108](https://github.com/browserbase/cookbook/security/dependabot/108) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#109](https://github.com/browserbase/cookbook/security/dependabot/109) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#110](https://github.com/browserbase/cookbook/security/dependabot/110) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#111](https://github.com/browserbase/cookbook/security/dependabot/111) | `cryptography` | 50.0.1 | Outside reported vulnerable range |
| [#112](https://github.com/browserbase/cookbook/security/dependabot/112) | `starlette` | 1.7.0 | Outside reported vulnerable range |
| [#113](https://github.com/browserbase/cookbook/security/dependabot/113) | `starlette` | 1.7.0 | Outside reported vulnerable range |
| [#114](https://github.com/browserbase/cookbook/security/dependabot/114) | `Starlette` | 1.7.0 | Outside reported vulnerable range |
| [#115](https://github.com/browserbase/cookbook/security/dependabot/115) | `starlette` | 1.7.0 | Outside reported vulnerable range |
| [#116](https://github.com/browserbase/cookbook/security/dependabot/116) | `setuptools` | 84.0.0 | Outside reported vulnerable range |
| [#117](https://github.com/browserbase/cookbook/security/dependabot/117) | `pyasn1` | 0.6.4 | Outside reported vulnerable range |
| [#118](https://github.com/browserbase/cookbook/security/dependabot/118) | `pyasn1` | 0.6.4 | Outside reported vulnerable range |
| [#119](https://github.com/browserbase/cookbook/security/dependabot/119) | `pyasn1` | 0.6.4 | Outside reported vulnerable range |
| [#120](https://github.com/browserbase/cookbook/security/dependabot/120) | `black` | 26.5.1 | Outside reported vulnerable range |
| [#121](https://github.com/browserbase/cookbook/security/dependabot/121) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#122](https://github.com/browserbase/cookbook/security/dependabot/122) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#123](https://github.com/browserbase/cookbook/security/dependabot/123) | `aiohttp` | 3.14.3 | Outside reported vulnerable range |
| [#124](https://github.com/browserbase/cookbook/security/dependabot/124) | `cryptography` | 50.0.1 | Outside reported vulnerable range |
| [#125](https://github.com/browserbase/cookbook/security/dependabot/125) | `chromadb` | 1.1.1 | Blocked: no patched ChromaDB release |
| [#126](https://github.com/browserbase/cookbook/security/dependabot/126) | `chromadb` | 1.1.1 | Blocked: no patched ChromaDB release |
| [#127](https://github.com/browserbase/cookbook/security/dependabot/127) | `chromadb` | 1.1.1 | Blocked: no patched ChromaDB release |
| [#128](https://github.com/browserbase/cookbook/security/dependabot/128) | `cryptography` | 50.0.1 | Outside reported vulnerable range |
| [#129](https://github.com/browserbase/cookbook/security/dependabot/129) | `ws` | 8.17.1, 8.21.3 | Blocked: upstream dependency constraint |
| [#130](https://github.com/browserbase/cookbook/security/dependabot/130) | `ws` | 8.17.1, 8.21.3 | Blocked: upstream dependency constraint |
| [#131](https://github.com/browserbase/cookbook/security/dependabot/131) | `@opentelemetry/core` | 2.8.0 | Outside reported vulnerable range |
| [#132](https://github.com/browserbase/cookbook/security/dependabot/132) | `extract-zip` | Removed from dependency tree | Outside reported vulnerable range |
| [#133](https://github.com/browserbase/cookbook/security/dependabot/133) | `deepmerge-ts` | 7.1.5 | Blocked: upstream dependency constraint |
| [#134](https://github.com/browserbase/cookbook/security/dependabot/134) | `extract-zip` | Removed from dependency tree | Outside reported vulnerable range |
| [#135](https://github.com/browserbase/cookbook/security/dependabot/135) | `extract-zip` | Removed from dependency tree | Outside reported vulnerable range |
| [#136](https://github.com/browserbase/cookbook/security/dependabot/136) | `extract-zip` | Removed from dependency tree | Outside reported vulnerable range |
