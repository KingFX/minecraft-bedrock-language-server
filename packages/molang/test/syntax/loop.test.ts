import { tokenize, TokenType } from '../../src/molang/syntax/tokens';
import { BreakNode, ContinueNode, ExpressionNode, LoopNode, NodeType } from '../../src/molang/syntax/nodes';
import { nodesToString } from '../../src/molang/syntax/string';

// Helper: tokenize and parse a single expression from tokens
// We import the internal parseTokens indirectly through the tokenizer + parser pipeline.
// Since parseMolang depends on bc-minecraft-bedrock-shared (OffsetWord), we test the
// lower-level pieces directly.

// We can't use parseMolang directly due to the bc-minecraft-bedrock-shared dep issue,
// so we test what we can: tokenizer behavior, node type guards, string serialization,
// getChildern, and getLastEndPosition.

describe('loop/break/continue - tokenizer', () => {
  describe('keyword recognition', () => {
    test('loop is tokenized as Loop', () => {
      const tokens = tokenize('loop(10, {v.x = 1;})');
      expect(tokens[0].type).toBe(TokenType.Loop);
      expect(tokens[0].value).toBe('loop');
      expect(tokens[0].position).toBe(0);
    });

    test('break is tokenized as Break', () => {
      const tokens = tokenize('break');
      expect(tokens[0].type).toBe(TokenType.Break);
      expect(tokens[0].value).toBe('break');
    });

    test('continue is tokenized as Continue', () => {
      const tokens = tokenize('continue');
      expect(tokens[0].type).toBe(TokenType.Continue);
      expect(tokens[0].value).toBe('continue');
    });
  });

  describe('word boundary - keywords must not match as prefix of identifiers', () => {
    test('loopback is an Identifier, not Loop + back', () => {
      const tokens = tokenize('loopback');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('loopback');
    });

    test('looping is an Identifier, not Loop + ing', () => {
      const tokens = tokenize('looping');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('looping');
    });

    test('loop2 is an Identifier, not Loop + 2', () => {
      const tokens = tokenize('loop2');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('loop2');
    });

    test('loop_ is an Identifier, not Loop + _', () => {
      const tokens = tokenize('loop_');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('loop_');
    });

    test('breakpoint is an Identifier, not Break + point', () => {
      const tokens = tokenize('breakpoint');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('breakpoint');
    });

    test('breaking is an Identifier, not Break + ing', () => {
      const tokens = tokenize('breaking');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('breaking');
    });

    test('break1 is an Identifier, not Break + 1', () => {
      const tokens = tokenize('break1');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('break1');
    });

    test('continued is an Identifier, not Continue + d', () => {
      const tokens = tokenize('continued');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('continued');
    });

    test('continuing is an Identifier, not Continue + ing', () => {
      const tokens = tokenize('continuing');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('continuing');
    });

    test('continue2 is an Identifier, not Continue + 2', () => {
      const tokens = tokenize('continue2');
      expect(tokens[0].type).toBe(TokenType.Identifier);
      expect(tokens[0].value).toBe('continue2');
    });
  });

  describe('keyword followed by non-alphanumeric is recognized', () => {
    test('loop( is Loop + OpenParen', () => {
      const tokens = tokenize('loop(');
      expect(tokens[0].type).toBe(TokenType.Loop);
      expect(tokens[1].type).toBe(TokenType.OpenParen);
    });

    test('break; is Break + Semicolon', () => {
      const tokens = tokenize('break;');
      expect(tokens[0].type).toBe(TokenType.Break);
      expect(tokens[1].type).toBe(TokenType.Semicolon);
    });

    test('continue; is Continue + Semicolon', () => {
      const tokens = tokenize('continue;');
      expect(tokens[0].type).toBe(TokenType.Continue);
      expect(tokens[1].type).toBe(TokenType.Semicolon);
    });

    test('break at end of input is Break', () => {
      const tokens = tokenize('break');
      expect(tokens[0].type).toBe(TokenType.Break);
      expect(tokens[1].type).toBe(TokenType.EOF);
    });

    test('continue at end of input is Continue', () => {
      const tokens = tokenize('continue');
      expect(tokens[0].type).toBe(TokenType.Continue);
      expect(tokens[1].type).toBe(TokenType.EOF);
    });
  });

  describe('loop token sequence', () => {
    test('basic loop(10, {v.x = 1;}) produces correct token sequence', () => {
      const tokens = tokenize('loop(10, {v.x = 1;})');
      const types = tokens.map((t) => TokenType[t.type]);
      expect(types).toEqual([
        'Loop',
        'OpenParen',
        'Number',
        'Comma',
        'OpenBrace',
        'NamespacedIdentifier',
        'Assignment',
        'Number',
        'Semicolon',
        'CloseBrace',
        'CloseParen',
        'EOF',
      ]);
    });

    test('loop with break produces correct token types', () => {
      const tokens = tokenize('loop(10, {(v.x > 5) ? break;})');
      const breakTokens = tokens.filter((t) => t.type === TokenType.Break);
      expect(breakTokens).toHaveLength(1);
      expect(breakTokens[0].value).toBe('break');
    });

    test('loop with continue produces correct token types', () => {
      const tokens = tokenize('loop(10, {(v.x > 5) ? continue;})');
      const continueTokens = tokens.filter((t) => t.type === TokenType.Continue);
      expect(continueTokens).toHaveLength(1);
      expect(continueTokens[0].value).toBe('continue');
    });

    test('nested loop produces two Loop tokens', () => {
      const tokens = tokenize('loop(10, {loop(5, {v.x = 1;});})');
      const loopTokens = tokens.filter((t) => t.type === TokenType.Loop);
      expect(loopTokens).toHaveLength(2);
    });
  });

  describe('unary operator classification after keywords', () => {
    test('-1 after break is unary', () => {
      // This is a bit contrived but tests the checkUnaryOperators switch
      const tokens = tokenize('break -1');
      // break is Break, - should be UnaryOperator (since break is in the "make unary" case)
      const minus = tokens.find((t) => t.value === '-');
      expect(minus?.type).toBe(TokenType.UnaryOperator);
    });

    test('-1 after continue is unary', () => {
      const tokens = tokenize('continue -1');
      const minus = tokens.find((t) => t.value === '-');
      expect(minus?.type).toBe(TokenType.UnaryOperator);
    });

    test('+1 after loop is unary', () => {
      const tokens = tokenize('loop +1');
      const plus = tokens.find((t) => t.value === '+');
      expect(plus?.type).toBe(TokenType.UnaryOperator);
    });
  });

  describe('positions are tracked correctly', () => {
    test('loop token position is correct', () => {
      const tokens = tokenize('  loop(10, {})');
      expect(tokens[0].type).toBe(TokenType.Loop);
      expect(tokens[0].position).toBe(2);
    });

    test('break token position inside loop body', () => {
      const tokens = tokenize('loop(10, {break;})');
      const breakToken = tokens.find((t) => t.type === TokenType.Break)!;
      expect(breakToken.position).toBe(10);
    });

    test('continue token position inside loop body', () => {
      const tokens = tokenize('loop(10, {continue;})');
      const continueToken = tokens.find((t) => t.type === TokenType.Continue)!;
      expect(continueToken.position).toBe(10);
    });
  });
});

describe('loop/break/continue - node types', () => {
  describe('LoopNode', () => {
    test('create produces correct node', () => {
      const count = LiteralNode(10, 0);
      const body = LiteralNode(0, 5);
      const node = LoopNode.create({ position: 0, count, body });

      expect(node.type).toBe(NodeType.Loop);
      expect(node.position).toBe(0);
      expect(node.count).toBe(count);
      expect(node.body).toBe(body);
    });

    test('is() type guard works', () => {
      const count = LiteralNode(10, 0);
      const body = LiteralNode(0, 5);
      const node = LoopNode.create({ position: 0, count, body });

      expect(LoopNode.is(node)).toBe(true);
      expect(BreakNode.is(node)).toBe(false);
      expect(ContinueNode.is(node)).toBe(false);
    });

    test('getChildern returns [count, body]', () => {
      const count = LiteralNode(10, 0);
      const body = LiteralNode(0, 5);
      const node = LoopNode.create({ position: 0, count, body });

      const children = ExpressionNode.getChildern(node);
      expect(children).toEqual([count, body]);
    });

    test('getLastEndPosition traverses to deepest child', () => {
      const count = LiteralNode(10, 5);
      const body = LiteralNode(0, 20);
      const node = LoopNode.create({ position: 0, count, body });

      const endPos = ExpressionNode.getLastEndPosition(node);
      // body has higher position (20), body is LiteralNode with value "0" (length 1)
      // so endPos = 20 + 1 = 21
      expect(endPos).toBe(21);
    });
  });

  describe('BreakNode', () => {
    test('create produces correct node', () => {
      const node = BreakNode.create({ position: 10 });
      expect(node.type).toBe(NodeType.Break);
      expect(node.position).toBe(10);
    });

    test('is() type guard works', () => {
      const node = BreakNode.create({ position: 0 });
      expect(BreakNode.is(node)).toBe(true);
      expect(LoopNode.is(node)).toBe(false);
      expect(ContinueNode.is(node)).toBe(false);
    });

    test('getChildern returns empty array', () => {
      const node = BreakNode.create({ position: 0 });
      expect(ExpressionNode.getChildern(node)).toEqual([]);
    });

    test('getLastEndPosition returns position + 5 (length of "break")', () => {
      const node = BreakNode.create({ position: 10 });
      expect(ExpressionNode.getLastEndPosition(node)).toBe(15);
    });
  });

  describe('ContinueNode', () => {
    test('create produces correct node', () => {
      const node = ContinueNode.create({ position: 10 });
      expect(node.type).toBe(NodeType.Continue);
      expect(node.position).toBe(10);
    });

    test('is() type guard works', () => {
      const node = ContinueNode.create({ position: 0 });
      expect(ContinueNode.is(node)).toBe(true);
      expect(BreakNode.is(node)).toBe(false);
      expect(LoopNode.is(node)).toBe(false);
    });

    test('getChildern returns empty array', () => {
      const node = ContinueNode.create({ position: 0 });
      expect(ExpressionNode.getChildern(node)).toEqual([]);
    });

    test('getLastEndPosition returns position + 8 (length of "continue")', () => {
      const node = ContinueNode.create({ position: 10 });
      expect(ExpressionNode.getLastEndPosition(node)).toBe(18);
    });
  });
});

describe('loop/break/continue - string serialization', () => {
  test('BreakNode serializes to "break"', () => {
    const node = BreakNode.create({ position: 0 });
    expect(nodesToString(node)).toBe('break');
  });

  test('ContinueNode serializes to "continue"', () => {
    const node = ContinueNode.create({ position: 0 });
    expect(nodesToString(node)).toBe('continue');
  });

  test('LoopNode serializes to loop(count, body)', () => {
    const count = LiteralNode(10, 0);
    const body = BreakNode.create({ position: 5 });
    const node = LoopNode.create({ position: 0, count, body });

    expect(nodesToString(node)).toBe('loop(10, break)');
  });

  test('LoopNode with complex body serializes correctly', () => {
    const count = LiteralNode(10, 0);
    const body = ContinueNode.create({ position: 5 });
    const node = LoopNode.create({ position: 0, count, body });

    expect(nodesToString(node)).toBe('loop(10, continue)');
  });

  test('ExpressionNode.toString delegates to nodesToString', () => {
    const node = BreakNode.create({ position: 0 });
    expect(ExpressionNode.toString(node)).toBe('break');
  });
});

// Helper to create a LiteralNode for testing
function LiteralNode(value: number, position: number): ExpressionNode {
  return {
    type: NodeType.Literal,
    value: value.toString(),
    position,
  };
}
