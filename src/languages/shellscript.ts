import {
  createPatternMatchers,
  argumentMatcher,
} from "../util/nodeMatchers";

import { NodeMatcherAlternative } from "../typings/Types";
import { SimpleScopeTypeType } from "../typings/targetDescriptor.types";

const STATEMENT_TYPES = [
  "variable_assignment",
  "command",
];

const KEY_TYPES = [
  "variable_assignment[name]",

]

/* TODO(pcohen):
 - "clear condition" would ideally leave the trailing -, chuck would delete it
*/

const nodeMatchers: Partial<
  Record<SimpleScopeTypeType, NodeMatcherAlternative>
> = {
  argumentOrParameter: argumentMatcher("command[argument]"),
  statement: STATEMENT_TYPES,
  condition: "if_statement",
  string: "string_literal",
  comment: ["comment"],
  functionCall: ["action"],
  functionCallee: "action[action_name]",
  functionName: "function_definition[name]",
  collectionKey: KEY_TYPES,
  name: KEY_TYPES,
  namedFunction: "function_definition",
  value: [
    "variable_assignment[value]",
  ]
};

export default createPatternMatchers(nodeMatchers);
