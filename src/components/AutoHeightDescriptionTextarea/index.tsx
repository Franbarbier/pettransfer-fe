import {
  type ChangeEventHandler,
  type ReactElement,
  type TextareaHTMLAttributes,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";

/** Textarea que ajusta su altura al contenido (sin scroll interno). */
export function AutoHeightDescriptionTextarea({
  className,
  minHeightPx = 44,
  value,
  onChange,
  style,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows" | "onChange"> & {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  minHeightPx?: number;
}): ReactElement {
  const ref = useRef<HTMLTextAreaElement>(null);
  const v = value ?? "";

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minHeightPx)}px`;
  }, [minHeightPx]);

  useLayoutEffect(() => {
    resize();
  }, [v, resize]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={v}
      onChange={(e) => {
        onChange(e);
        requestAnimationFrame(resize);
      }}
      className={className}
      style={{ overflow: "hidden", resize: "none", ...style }}
      {...rest}
    />
  );
}
