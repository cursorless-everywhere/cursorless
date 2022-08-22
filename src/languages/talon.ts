import {
  createPatternMatchers,
  argumentMatcher,
} from "../util/nodeMatchers";

import { NodeMatcherAlternative } from "../typings/Types";
import { SimpleScopeTypeType } from "../typings/targetDescriptor.types";

const STATEMENT_TYPES = [
  "expression",
  "command",
  "settings",
  // "block",
];


const nodeMatchers: Partial<
  Record<SimpleScopeTypeType, NodeMatcherAlternative>
> = {
  statement: STATEMENT_TYPES,
  command: "command",
  // NOTE(pcohen): `source_file.context!` allows "take condition" to work everywhere; whereas `context` alone requires a hat.
  condition: "source_file.context!",
  string: "string_literal",
  // TODO(pcohen): only selects one line even if there are multiple comment lines
  comment: ["comment"],
  functionCall: ["expression[0]"],
  functionCallee: "expression[0]",
  collectionKey: [
    "command.rule!",
    "assignment[0]", // TODO(pcohen): ideally match the child by name rather than using a child index
    "match[0]", // // TODO(pcohen): ideally match the "key: identifier" rather than using a child index
    "settings", // TODO(pcohen): match the settings().settings() afterwards
    "include_tag" // TODO(pcohen): match the tag().tag() afterwards
  ],
  name: "command.rule!",
  value: [
    "assignment[1]", // TODO(pcohen): match "right: <integer/string/etc.>" rather than using an index
    "match[1]", // TODO(pcohen): match "key: identifier" rather than using an index
    "block",
  ],
  argumentOrParameter: argumentMatcher("argument_list"),
};

export default createPatternMatchers(nodeMatchers);
