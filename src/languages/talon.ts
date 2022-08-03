import {
  createPatternMatchers,
  argumentMatcher,
  leadingMatcher,
  conditionMatcher,
  trailingMatcher,
  matcher,
  cascadingMatcher,
} from "../util/nodeMatchers";
import { childRangeSelector } from "../util/nodeSelectors";
import { patternFinder } from "../util/nodeFinders";

import { NodeMatcherAlternative } from "../typings/Types";
import { SimpleScopeTypeType } from "../typings/targetDescriptor.types";

// Generated by the following command:
// > curl https://raw.githubusercontent.com/tree-sitter/tree-sitter-java/master/src/node-types.json | jq '[.[] | select(.type == "statement" or .type == "declaration") | .subtypes[].type]'
const STATEMENT_TYPES = [
  "command",
];

const nodeMatchers: Partial<
  Record<SimpleScopeTypeType, NodeMatcherAlternative>
> = {
  statement: STATEMENT_TYPES,
  class: "class_declaration",
  className: "class_declaration[name]",
  ifStatement: "if_statement",
  string: "string_literal",
  comment: ["line_comment", "block_comment", "comment"],
  anonymousFunction: "lambda_expression",
  list: "array_initializer",
  functionCall: [
    "method_invocation",
    "object_creation_expression",
    "explicit_constructor_invocation",
  ],
  functionCallee: cascadingMatcher(
    matcher(
      patternFinder("method_invocation"),
      childRangeSelector(["argument_list"], [])
    ),
    matcher(
      patternFinder("object_creation_expression"),
      childRangeSelector(["argument_list"], [])
    ),
    matcher(
      patternFinder("explicit_constructor_invocation"),
      childRangeSelector(["argument_list", ";"], [])
    )
  ),
  collectionKey: "command.rule!",
  name: "command.rule!",
  namedFunction: ["method_declaration", "constructor_declaration"],
  type: trailingMatcher([
    "generic_type.type_arguments.type_identifier",
    "generic_type.type_identifier",
    "type_identifier",
    "local_variable_declaration[type]",
    "array_creation_expression[type]",
    "formal_parameter[type]",
    "method_declaration[type]",
  ]),
  functionName: [
    "method_declaration.identifier!",
    "constructor_declaration.identifier!",
  ],
  value: "command.block!",
  condition: conditionMatcher("*[condition]"),
  argumentOrParameter: argumentMatcher("formal_parameters", "argument_list"),
};

export default createPatternMatchers(nodeMatchers);
