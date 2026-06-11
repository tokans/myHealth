/**
 * `Sheet` now lives in the shared core (`sharedcorelib/ui`); re-export shim so existing
 * `@/components/ui/sheet` import sites (ProfileDrawer, etc.) stay unchanged. The styled
 * primitive requires the §4.2 theming policy (shared preset + theme.css + the
 * `../sharedCoreLib/src/ui/**` content glob), which this app now adopts.
 */
export { Sheet, SheetClose, SheetContent, type SheetSide, type SheetContentProps } from "sharedcorelib/ui";
