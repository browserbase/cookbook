interface ActionResponse {
  data?: { success?: boolean; message?: string };
}
interface SavedSession {
  sessionId: string;
}
export function requireSuccessfulAction(
  action: ActionResponse,
  screenshotPath: string,
): void;
export function releaseSavedSession(options: {
  loadSavedSession: () => SavedSession | null;
  requestRelease: (sessionId: string) => Promise<void>;
  clearSavedSession: () => void;
}): Promise<{ success: true; message: string }>;
export function commandFailure(error: unknown): {
  exitCode: 1;
  clearSession: boolean;
  output: string;
};
