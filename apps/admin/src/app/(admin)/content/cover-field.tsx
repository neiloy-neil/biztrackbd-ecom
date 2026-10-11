"use client";

import { useState } from "react";
import { ImagePicker } from "@/components/image-picker";

/** The blog's cover picture: the picker uploads it, a hidden field carries the address into the form. */
export function CoverField({ initial, disabled }: { initial: string; disabled?: boolean }) {
  const [url, setUrl] = useState(initial);
  return (
    <>
      <ImagePicker label="Cover picture" value={url} onChange={setUrl} disabled={disabled} />
      <input type="hidden" name="coverImage" value={url} />
    </>
  );
}
