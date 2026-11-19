export enum TagActionType {
  UPVOTE = "upvote",
  DOWNVOTE = "downvote",
  WITHDRAW = "withdraw",
}

export enum Modes {
  easy = "easy",
  medium = "medium",
  hard = "hard",
}

export type SortOption =
  | "release_date"
  | "artist_credit_name"
  | "release_name"
  | "confidence";

export enum FlairEnum {
  None = "",
  Shake = "shake",
  ColorSweep = "lb-colors-sweep",
  LightSweep = "light-sweep",
  Wave = "wave",
  FlipHorizontal = "flip-horizontal",
  FlipVertical = "flip-vertical",
  Flip3D = "flip-3d",
  Extruded = "extruded",
  Underline = "underline",
  Tornado = "tornado",
  Highlighter = "highlighter",
  Anaglyph = "anaglyph",
  Sliced = "sliced",
}
export type Flair = `${FlairEnum}`;
