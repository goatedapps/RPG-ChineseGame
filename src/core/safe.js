export function safely(action, onError = console.error) {
  try {
    return action();
  } catch (error) {
    onError(error);
    return undefined;
  }
}

export async function safelyAsync(action, onError = console.error) {
  try {
    return await action();
  } catch (error) {
    onError(error);
    return undefined;
  }
}
