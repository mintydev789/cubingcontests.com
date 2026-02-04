"use client";

import Button from "~/app/components/UI/Button.tsx";
import ToastMessages from "~/app/components/UI/ToastMessages.tsx";

type Props = {
  children: React.ReactNode;
  buttonText?: string;
  hideToasts?: boolean;
  disableControls?: boolean;
  hideSubmitButton?: boolean;
  isLoading?: boolean;
  onSubmit?: () => void;
  onCancel?: () => void;
};

function Form({
  children,
  buttonText = "Submit",
  hideToasts,
  disableControls,
  hideSubmitButton,
  isLoading,
  onSubmit,
  onCancel,
}: Props) {
  const showSubmitButton = !hideSubmitButton && buttonText;
  if (showSubmitButton && !onSubmit) throw new Error("onSubmit cannot be undefined unless the submit button is hidden");

  const controlsDisabled = disableControls || isLoading;

  return (
    <form
      className="fs-5 container mx-auto my-4 px-3"
      style={{ maxWidth: "var(--cc-md-width)" }}
      onSubmit={(e) => e.preventDefault()}
    >
      {!hideToasts && <ToastMessages />}

      {children}

      {(showSubmitButton || onCancel) && (
        <div className="d-flex mt-4 gap-3">
          {showSubmitButton && (
            <Button
              id="form_submit_button"
              type="submit"
              onClick={onSubmit}
              disabled={controlsDisabled}
              isLoading={isLoading}
            >
              {buttonText}
            </Button>
          )}
          {onCancel && (
            <Button id="form_cancel_button" onClick={onCancel} disabled={controlsDisabled} className="btn-danger">
              Cancel
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

export default Form;
