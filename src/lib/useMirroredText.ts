import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps a text input's own text in local state, reports every change upward, and adopts the
 * caller's value only when the caller genuinely changes it (a prefill, a reset, a clear button).
 *
 * Why every input in the app goes through this: a plain controlled `TextInput` renders its text
 * from state that lands at least one pass after the keystroke. Android applies the edit natively
 * first, so the late echo overwrites the native buffer — characters vanish and the caret jumps.
 * It is worst while deleting: backspace repeats fast, and the keyboard rewrites the whole word
 * being edited. Local state is committed in the same pass as the keystroke, so the field always
 * shows what was typed however slow the caller is (a form re-rendering a dozen fields, a write to
 * storage). A caller that transforms the text — filtering digits, normalizing a phone — still
 * wins: its value differs from what was emitted, so it is adopted on the next render.
 */
export function useMirroredText(value: string, onChangeText: (text: string) => void) {
  const [text, setText] = useState(value);
  // The last text the field and its caller agreed on: what was emitted, or what was adopted.
  const agreed = useRef(value);

  useEffect(() => {
    if (value === agreed.current) return;
    agreed.current = value;
    // Adopting a change that came from outside the field (prefill, reset, clear) is this hook's job.
    setText(value);
  }, [value]);

  const handleChangeText = useCallback(
    (next: string) => {
      agreed.current = next;
      setText(next);
      onChangeText(next);
    },
    [onChangeText],
  );

  return { text, handleChangeText };
}
