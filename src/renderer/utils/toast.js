export function emitToast({
  type = "info",
  title = "",
  message = "",
  duration = 4000,
} = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("app:toast", {
      detail: { type, title, message, duration },
    })
  );
}
