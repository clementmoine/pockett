"use client";

import { useRef, useState } from "react";
import { Paintbrush } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
  onBlur,
  className,
  ...props
}: React.ComponentProps<"input">) {
  const [internalValue, setInternalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleColorChange = (color: string) => {
    setInternalValue(color);
    if (onChange) {
      onChange({
        target: { value: color },
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleBlur = () => {
    if (onBlur) {
      onBlur({
        target: { value: internalValue },
      } as React.FocusEvent<HTMLInputElement>);
    }
  };

  const openColorPicker = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className="relative">
      <Button
        variant={"outline"}
        type="button"
        onClick={openColorPicker}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          "justify-start text-left",
          className,
        )}
      >
        <div className="w-full flex items-center gap-2">
          {internalValue ? (
            <div
              className="h-4 w-4 rounded !bg-center !bg-cover transition-all"
              style={{ background: internalValue as string }}
            />
          ) : (
            <Paintbrush className="h-4 w-4" />
          )}
          <div
            className={cn(
              "truncate flex-1 ",
              !internalValue && "!text-muted-foreground",
            )}
          >
            {internalValue ? internalValue : "Pick a color"}
          </div>
        </div>
      </Button>

      <input
        ref={inputRef}
        type="color"
        value={internalValue}
        className="absolute w-full h-full inset-0 opacity-0 cursor-pointer"
        onChange={(e) => handleColorChange(e.target.value)}
        onBlur={handleBlur}
        {...props}
      />
    </div>
  );
}
