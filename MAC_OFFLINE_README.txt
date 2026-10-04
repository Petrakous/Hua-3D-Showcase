HUA 3D SHOWCASE - MAC OFFLINE PACKAGE
=====================================

1. Copy the entire HUA-3D-Showcase-Mac-Offline folder to the MacBook.
2. Double-click START_MAC.command.
3. Keep the Terminal window open while using the showcase.
4. Press Control-C in that Terminal window to stop it.

The launcher opens:
http://127.0.0.1:8765/?assets=local

The ?assets=local part is important: all declared GLB, SOG, LOD, streamed and
collision assets are loaded from dist-r2-assets inside this folder instead of
Cloudflare R2.

FIRST-RUN MACOS NOTE
--------------------
If macOS does not allow the launcher to run, open Terminal in this folder and run:

chmod +x START_MAC.command
./START_MAC.command

The launcher uses Python 3 when available, with the macOS Ruby runtime as a
fallback. The 3D engine and model-viewer JavaScript libraries are also included
locally under vendor/.

Optional Google fonts and analytics may attempt an internet connection, but
they are not required for any 3D model to load or run.
