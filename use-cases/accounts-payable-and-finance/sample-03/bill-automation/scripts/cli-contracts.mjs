export function requireSuccessfulAction(action, screenshotPath) {
  if (action?.data?.success !== true) {
    const detail = action?.data?.message ? `: ${action.data.message}` : "";
    throw new Error(
      `Action was unsuccessful${detail}; screenshot: ${screenshotPath}`,
    );
  }
}

export async function releaseSavedSession({
  loadSavedSession,
  requestRelease,
  clearSavedSession,
}) {
  const existing = loadSavedSession();
  if (!existing) {
    return { success: true, message: "No saved session to release" };
  }
  await requestRelease(existing.sessionId);
  clearSavedSession();
  return { success: true, message: "Session release requested" };
}

export function commandFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    exitCode: 1,
    clearSession:
      message.includes("Session") || message.toLowerCase().includes("connect"),
    output: JSON.stringify({ success: false, error: message }, null, 2),
  };
}
