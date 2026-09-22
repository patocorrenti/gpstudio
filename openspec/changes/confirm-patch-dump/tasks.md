## 1. Confirm a patch-change dump

- [ ] 1.1 In `DeviceSession` (`src/device/session.ts`), after a user or pedal patch-change dump is applied, send one current-preset request without `refreshChain` / `beginChainRefresh`. Do not arm that request for connect, Reload, download, or upload. Clear it on disconnect, a newer patch change, and Reload. Verify a matching confirmation does not change the shown chain, the held dump, `modified`, or `chainSync`.

- [ ] 1.2 When that confirmation decodes to a different chain and the working patch is not modified and no control write is queued, replace the shown chain and the held dump, recapture the baseline, and report not modified. If the user already edited, keep the edit. Do not request another confirmation. Verify `npx tsc -b --pretty false` typechecks. Do not add a browser pass; the user checks a Bluetooth patch change that arrives wrong and a USB patch change that stays put.
