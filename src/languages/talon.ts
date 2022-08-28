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

const KEY_TYPES = [
  "command.rule!",
  "assignment[left]",
  "match[key]",
  "settings.settings().settings()", // TODO(pcohen): match the settings().settings() afterwards
  "include_tag.tag().tag()" // TODO(pcohen): match the tag().tag() afterwards
]

/* TODO(pcohen):
 - "clear condition" would ideally leave the trailing -, chuck would delete it
*/

const nodeMatchers: Partial<
  Record<SimpleScopeTypeType, NodeMatcherAlternative>
> = {
  statement: STATEMENT_TYPES,
  command: "command",
  // NOTE(pcohen): `source_file.context!` allows "take condition" to work everywhere; whereas `context` alone requires a hat.
  // TODO(pcohen): this includes the trailing "-" which we probably don't want
  condition: "source_file.context!",
  string: "string_literal",
  // TODO(pcohen): only selects one line even if there are multiple comment lines

  comment: ["comment"],
  functionCall: ["action"],
  functionCallee: "action[action_name]",
  collectionKey: KEY_TYPES,
  name: KEY_TYPES,
  value: [
    "assignment[right]",
    "match[pattern]",
    "include_tag[tag]",
    "block",
  ],
  argumentOrParameter: argumentMatcher("argument_list"),
};

export default createPatternMatchers(nodeMatchers);
