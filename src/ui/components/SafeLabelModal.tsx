import type { FormEvent } from "react";
import { useEffect, useState } from "react";

export function SafeLabelModal({
  onClose,
  onSubmit
}: {
  onClose: () => void;
  onSubmit: (safeTitle: string) => Promise<void>;
}) {
  const [safeTitle, setSafeTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSafeTitle = safeTitle.trim();
    if (!nextSafeTitle || status === "saving") {
      return;
    }

    setStatus("saving");
    try {
      await onSubmit(nextSafeTitle);
      onClose();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel" role="dialog" aria-modal="true" aria-label="Safe label" onSubmit={submit}>
        <div className="modal-heading">
          <h2>Safe label</h2>
          <button className="hud-button ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
        <label className="field-label">
          Safe title
          <input
            autoFocus
            value={safeTitle}
            onChange={(event) => setSafeTitle(event.target.value)}
            disabled={status === "saving"}
          />
        </label>
        {status === "error" ? <p className="form-error">Label registration failed</p> : null}
        <div className="modal-actions">
          <button className="hud-button primary" type="submit" disabled={!safeTitle.trim() || status === "saving"}>
            {status === "saving" ? "Saving" : "Save label"}
          </button>
        </div>
      </form>
    </div>
  );
}
