; Buzz Korean NSIS hooks, used instead of src-tauri/installer-hooks.nsh.
; (ASCII only: NSIS reads an include without a BOM in the ANSI code page.)
;
; The official hooks add the install's bin folder (buzz.exe) to the user's
; PATH and remove it on uninstall. Installed next to official Buzz, that makes
; the two `buzz` commands shadow each other, so Buzz Korean never reads or
; writes PATH. Run its CLI by full path: "$INSTDIR\bin\buzz.exe".
;
; Like the official hooks, give existing shortcuts this build's identifier
; (ai.codepair.buzz-korean) as their AppUserModelID, which notifications use.
!macro NSIS_HOOK_POSTINSTALL
  ${If} ${FileExists} "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  ${EndIf}
  ${If} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
    !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
  ${EndIf}
!macroend
