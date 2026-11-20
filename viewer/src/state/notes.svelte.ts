import type { SavedNote } from "../types";
import { api_request } from "./api";

const NOTE_FAILED = "The note was not saved. Check your connection, then try again.";

export const notes = $state({
  list: [] as SavedNote[],
  draft: "",
  error: "",
  available: false,
  on: false,
});

async function change_notes(change: () => Promise<unknown>): Promise<void> {
  notes.error = "";
  try {
    await change();
    notes.list = await api_request<SavedNote[]>("notes", "GET");
  } catch (error) {
    console.warn(error);
    notes.error = NOTE_FAILED;
  }
}

export function save_note(): Promise<void> {
  if (notes.draft.trim() === "") {
    return Promise.resolve();
  }
  return change_notes(async () => {
    await api_request("notes", "POST", undefined, { text: notes.draft });
    notes.draft = "";
  });
}

export const set_note_status = (id: string, status: SavedNote["status"]): Promise<void> =>
  change_notes(() => api_request("notes", "PATCH", id, { status }));

export const delete_note = (id: string): Promise<void> => change_notes(() => api_request("notes", "DELETE", id));

export async function load_notes(): Promise<void> {
  try {
    notes.list = await api_request<SavedNote[]>("notes", "GET");
    notes.available = true;
  } catch {
    notes.available = false;
  }
}
