/**
 * downloadSource.ts
 *
 * Client-side utility that packages the current project source into a
 * downloadable ZIP archive.  Used by GithubSyncDialog to let the user export
 * the project when a live GitHub connection is not available.
 *
 * In the browser-hosted Base44 context the source tree is not directly
 * readable at runtime, so we redirect to the Base44 CLI export guide.
 * On environments where a native bridge exposes `window.VibeCoreNative.exportSource()`
 * that path is used instead (Android Oboe WebView bridge).
 */

export interface DownloadSourceOptions {
  /** Optional filename for the ZIP (without extension). */
  filename?: string;
}

/**
 * Result returned by `downloadSourceZip`.
 *
 * The `GithubSyncDialog` component surfaces `files` and `bytes` to the user
 * so both are always returned even when we open the CLI guide as a fallback
 * (in which case they are 0 and `initiated` is false).
 */
export interface DownloadSourceResult {
  /** Whether a real download / native export was initiated. */
  initiated: boolean;
  /** Number of files included (0 if fallback to CLI guide). */
  files: number;
  /** Total bytes (0 if fallback to CLI guide). */
  bytes: number;
}

/**
 * Attempt to download the project source as a ZIP.
 *
 * - Native Android WebView bridge → Kotlin JavascriptInterface → Oboe
 * - Browser fallback → opens the Base44 CLI export guide
 */
export async function downloadSourceZip(
  opts: DownloadSourceOptions = {}
): Promise<DownloadSourceResult> {
  const filename = opts.filename ?? "SonicArchitect-source";

  // Native Android bridge path (WebView + Kotlin JavascriptInterface → Oboe)
  const native = (window as unknown as Record<string, unknown>)
    .VibeCoreNative as { exportSource?: (name: string) => void } | undefined;
  if (native?.exportSource) {
    native.exportSource(filename);
    return { initiated: true, files: 0, bytes: 0 };
  }

  // Hosted-Base44 fallback: open the CLI export documentation
  window.open(
    "https://docs.base44.com/developers/references/cli/get-started/overview",
    "_blank",
    "noopener,noreferrer"
  );
  return { initiated: false, files: 0, bytes: 0 };
}
