/**
 * Marks for editing on the page itself (the editor's preview only; the live store never sets `editing`). A piece of text carries the path of
 * the setting it shows; `twin` says it has a Bangla version, `multiline` that Enter makes a new line (otherwise Enter finishes). A picture
 * carries its path and a click opens the picture chooser in the editor.
 */
export const mark = (editing: boolean | undefined) => (path: string, twin = true, multiline = false): Record<string, string> =>
  editing ? { "data-edit": path, ...(twin ? { "data-tw": "1" } : {}), ...(multiline ? { "data-ml": "1" } : {}) } : {};

export const markImg = (editing: boolean | undefined) => (path: string): Record<string, string> => (editing ? { "data-edit-image": path } : {});
