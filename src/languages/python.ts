import { Selection } from "vscode";
import { SyntaxNode } from "web-tree-sitter";
import { SimpleScopeTypeType } from "../typings/targetDescriptor.types";
import { NodeFinder, NodeMatcherAlternative } from "../typings/Types";
import { argumentNodeFinder, patternFinder } from "../util/nodeFinders";
import {
  argumentMatcher,
  cascadingMatcher,
  conditionMatcher,
  createPatternMatchers,
  leadingMatcher,
  matcher,
  patternMatcher,
  trailingMatcher,
} from "../util/nodeMatchers";
import {
  argumentSelectionExtractor,
  childRangeSelector,
} from "../util/nodeSelectors";

// Generated by the following command:
// > curl https://raw.githubusercontent.com/tree-sitter/tree-sitter-python/d6210ceab11e8d812d4ab59c07c81458ec6e5184/src/node-types.json \
//   | jq '[.[] | select(.type == "_simple_statement" or .type == "_compound_statement") | .subtypes[].type]'
const STATEMENT_TYPES = [
  "assert_statement",
  "break_statement",
  "class_definition",
  "continue_statement",
  "decorated_definition",
  "delete_statement",
  "exec_statement",
  "expression_statement",
  "for_statement",
  "function_definition",
  "future_import_statement",
  "global_statement",
  "if_statement",
  "import_from_statement",
  "import_statement",
  "nonlocal_statement",
  "pass_statement",
  "print_statement",
  "raise_statement",
  "return_statement",
  "try_statement",
  "while_statement",
  "with_statement",
];

export const getTypeNode = (node: SyntaxNode) =>
  node.children.find((child) => child.type === "type") ?? null;

const dictionaryTypes = ["dictionary", "dictionary_comprehension"];
const listTypes = ["list", "list_comprehension", "set"];

function itemNodeFinder(
  parentType: string,
  childType: string,
  excludeFirstChild: boolean = false
): NodeFinder {
  const finder = argumentNodeFinder(parentType);
  return (node: SyntaxNode, selection?: Selection) => {
    const childNode = finder(node, selection);
    if (
      childNode?.type === childType &&
      (!excludeFirstChild ||
        childNode.id !== childNode.parent?.firstNamedChild?.id)
    ) {
      return childNode;
    }
    return null;
  };
}

const nodeMatchers: Partial<
  Record<SimpleScopeTypeType, NodeMatcherAlternative>
> = {
  map: dictionaryTypes,
  list: listTypes,
  statement: STATEMENT_TYPES,
  string: "string",
  collectionItem: cascadingMatcher(
    matcher(
      itemNodeFinder("import_from_statement", "dotted_name", true),
      argumentSelectionExtractor()
    ),
    matcher(
      itemNodeFinder("global_statement", "identifier"),
      argumentSelectionExtractor()
    )
  ),
  collectionKey: trailingMatcher(["pair[key]"], [":"]),
  ifStatement: "if_statement",
  anonymousFunction: "lambda?.lambda",
  functionCall: "call",
  functionCallee: "call[function]",
  comment: "comment",
  class: "decorated_definition?.class_definition",
  className: "class_definition[name]",
  namedFunction: "decorated_definition?.function_definition",
  functionName: "function_definition[name]",
  condition: conditionMatcher("*[condition]"),
  type: leadingMatcher(
    ["function_definition[return_type]", "*[type]"],
    [":", "->"]
  ),
  name: [
    "assignment[left]",
    "augmented_assignment[left]",
    "typed_parameter.identifier!",
    "parameters.identifier!",
    "*[name]",
  ],
  value: cascadingMatcher(
    leadingMatcher(
      ["assignment[right]", "augmented_assignment[right]", "~subscript[value]"],
      [
        ":",
        "=",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "//=",
        "**=",
        "&=",
        "|=",
        "^=",
        "<<=",
        ">>=",
      ]
    ),
    patternMatcher("return_statement.~return!")
  ),
  argumentOrParameter: cascadingMatcher(
    argumentMatcher("parameters", "argument_list"),
    matcher(patternFinder("call.generator_expression!"), childRangeSelector())
  ),
};

export default createPatternMatchers(nodeMatchers);
