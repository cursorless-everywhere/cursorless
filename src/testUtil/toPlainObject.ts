import { Selection, Position, Range, TextEditor } from "vscode";
import { TestDecoration } from "../core/editStyles";
import { Token } from "../typings/Types";

export type PositionPlainObject = {
  line: number;
  character: number;
};

export type RangePlainObject = {
  start: PositionPlainObject;
  end: PositionPlainObject;
};

export type RangePlainObjectWithOffsets = {
  start: PositionPlainObject;
  end: PositionPlainObject;
  startOffset: number;
  endOffset: number;
};

export type SelectionPlainObject = {
  anchor: PositionPlainObject;
  active: PositionPlainObject;
};

export type SerializedMarks = {
  [decoratedCharacter: string]: RangePlainObject;
};

export function rangeToPlainObject(range: Range): RangePlainObject {
  return {
    start: positionToPlainObject(range.start),
    end: positionToPlainObject(range.end),
  };
}

/**
 * Like `rangeToPlainObject`, but also includes the document character offsets.
 *
 * This is mainly for ease of implementation inside of other editors.
 * @param range
 * @param editor
 */
export function rangeToPlainObjectWithOffsets(
  range: Range,
  editor: TextEditor
): RangePlainObjectWithOffsets {
  return {
    start: positionToPlainObject(range.start),
    end: positionToPlainObject(range.end),
    startOffset: editor.document.offsetAt(range.start),
    endOffset: editor.document.offsetAt(range.end),
  };
}

export function selectionToPlainObject(
  selection: Selection
): SelectionPlainObject {
  return {
    anchor: positionToPlainObject(selection.anchor),
    active: positionToPlainObject(selection.active),
  };
}

export function positionToPlainObject(position: Position): PositionPlainObject {
  return { line: position.line, character: position.character };
}

export function marksToPlainObject(marks: {
  [decoratedCharacter: string]: Token;
}) {
  const serializedMarks: SerializedMarks = {};
  Object.entries(marks).forEach(
    ([key, value]: [string, Token]) =>
      (serializedMarks[key] = rangeToPlainObject(value.range))
  );
  return serializedMarks;
}

export function testDecorationsToPlainObject(decorations: TestDecoration[]) {
  return decorations.map(({ name, type, start, end }) => ({
    name,
    type,
    start: positionToPlainObject(start),
    end: positionToPlainObject(end),
  }));
}
